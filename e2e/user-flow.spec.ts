/**
 * Mechanic App — Full E2E Browser Test (Playwright / headless Chromium)
 *
 * Prerequisites:
 *   1. Backend running:  cd server && node index.js
 *   2. Expo web running: npm run web   (http://localhost:8081)
 *
 * Run:
 *   npx playwright test
 *   npx playwright test --headed          ← visible browser, good for debugging
 *   APP_URL=http://... npx playwright test ← custom app URL
 *
 * Login strategy:
 *   Phone sign-in is our own OTP over plain HTTP now, so this drives the real
 *   endpoints rather than faking a session:
 *     1. POST /api/auth/otp/request for the whitelisted test number. In a
 *        non-production backend the response carries the code, and no SMS is
 *        sent.
 *     2. POST /api/auth/otp/verify to get a real access/refresh pair.
 *     3. Inject both tokens plus the user into localStorage (AsyncStorage maps
 *        to localStorage on web) before the page loads.
 *
 *   Injecting the user *without* a token, as this used to, no longer works —
 *   and it should not: that combination was a bug that made the UI look signed
 *   in while every request 401'd.
 */

import { expect, Page, test } from '@playwright/test';

const API_URL   = process.env.API_URL   || 'http://localhost:3000';
const TEST_PHONE = '+11111111111';
/** Fixed code the backend accepts for whitelisted numbers outside production. */
const TEST_NUMBER_CODE = '000000';

// ─── helpers ─────────────────────────────────────────────────────────────────

async function waitForText(page: Page, text: string | RegExp, timeout = 20_000) {
    // page.getByText() natively handles both strings and RegExp
    await expect(page.getByText(text).first()).toBeVisible({ timeout });
}

async function clickText(page: Page, text: string) {
    await page.locator(`text=${text}`).first().click();
}

// ─── fetch test-user data from API (Node side, before browser opens) ─────────

interface TestSession {
    accessToken: string;
    refreshToken: string;
    user: Record<string, unknown>;
}

/** Unwraps the standard { success, message, data } envelope. */
async function callApi<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.success) {
        throw new Error(
            `POST ${path} → ${res.status} ${JSON.stringify(payload?.error ?? payload)}. ` +
            'Is the backend running with OTP_TEST_NUMBERS_ENABLED=true and SMS_PROVIDER=log?',
        );
    }
    return payload.data as T;
}

/**
 * Signs in through the real OTP endpoints.
 *
 * Depends on the backend running non-production with test numbers enabled: the
 * whitelisted number accepts a fixed code and sends nothing. `devCode` is the
 * fallback for a non-whitelisted number while SMS is simulated.
 */
async function signInAsTestUser(): Promise<TestSession> {
    const challenge = await callApi<{ requestId: string; devCode?: string }>(
        '/api/auth/otp/request',
        { phone: TEST_PHONE, purpose: 'login' },
    );

    const session = await callApi<TestSession>('/api/auth/otp/verify', {
        requestId: challenge.requestId,
        phone:     TEST_PHONE,
        code:      challenge.devCode ?? TEST_NUMBER_CODE,
    });

    if (!session.accessToken || !session.refreshToken) {
        throw new Error('OTP verify returned no session — check the test number is registered.');
    }
    return session;
}

// ─── test ─────────────────────────────────────────────────────────────────────

test('Full user journey: session inject → edit profile → request → accept → cancel', async ({ page }) => {

    // ── 0. Sign in via the real OTP endpoints (Node context, not browser) ────
    let session: TestSession;
    await test.step('Sign in through the OTP endpoints', async () => {
        session = await signInAsTestUser();
        expect(session.user.id).toBeTruthy();
        console.log(`  → user: ${session.user.name} ${session.user.surname}  id: ${session.user.id}`);
    });

    // ── 1. Inject session + force local API config ────────────────────────────
    await test.step('Inject the session into localStorage', async () => {
        // Intercept the bootstrap config fetch so ConfigService always gets
        // local endpoints — prevents it from overwriting localStorage with prod URLs.
        const localBootstrap = {
            envs: {
                prod: { apiBaseUrl: API_URL, wsUrl: API_URL.replace('http', 'ws') },
            },
        };
        await page.route('https://bootstrap.mechanicapp.com/config', route =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(localBootstrap) })
        );

        // AsyncStorage on web stores values under the plain key in localStorage.
        await page.addInitScript(({ session, apiUrl }) => {
            try {
                const serialised = JSON.stringify(session.user);
                // Both storage keys used by different AsyncStorage versions
                localStorage.setItem('user_session', serialised);
                localStorage.setItem('@AsyncStorage:user_session', serialised);

                // Both tokens are required: the bootstrap treats an access token
                // with no refresh token beside it as a pre-refresh-token session
                // and tries to exchange it, and a cached user with no token at
                // all as signed out.
                for (const [key, value] of [
                    ['access_token', session.accessToken],
                    ['refresh_token', session.refreshToken],
                ]) {
                    localStorage.setItem(key, value);
                    localStorage.setItem(`@AsyncStorage:${key}`, value);
                }

                // Pre-seed the config cache so ConfigService skips the network
                // fetch even if the route intercept races with app startup.
                const localConfig = JSON.stringify({
                    envs: {
                        prod: { apiBaseUrl: apiUrl, wsUrl: apiUrl.replace('http', 'ws') },
                    },
                });
                localStorage.setItem('@mechanic:remoteConfigCache', localConfig);
                localStorage.setItem('@AsyncStorage:@mechanic:remoteConfigCache', localConfig);
            } catch { /* storage blocked — test will fail later with a clear message */ }
        }, { session: session!, apiUrl: API_URL });
    });

    // ── 2. Load app — should land on tabs (already logged in) ────────────────
    await test.step('Load app — expect to land on main tabs', async () => {
        await page.goto('/');
        // App reads the injected session from AsyncStorage and skips login
        await page.waitForURL(/\/(tabs|assist|appointments|index)/, { timeout: 25_000 });
        console.log('  → landed on:', page.url());
    });

    // ── 3. Navigate to Profile → Personal Information ────────────────────────
    await test.step('Open Personal Information screen', async () => {
        await page.goto('/personal-info');
        await waitForText(page, 'Personal information');
    });

    // ── 4. Update address fields ──────────────────────────────────────────────
    await test.step('Fill address: 956 Golden Cane Dr, Weston FL 33327', async () => {
        // Street input — find by placeholder text
        const streetInput = page.locator('input[placeholder*="street" i], input[placeholder*="address" i], input[placeholder*="Enter" i]').first();
        if (await streetInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await streetInput.click({ clickCount: 3 });
            await streetInput.fill('956 Golden Cane Dr');
            // Wait briefly for autocomplete and dismiss if shown
            await page.waitForTimeout(1_500);
            const suggestion = page.locator('div').filter({ hasText: /956 Golden Cane/i }).nth(1);
            if (await suggestion.isVisible({ timeout: 4_000 }).catch(() => false)) {
                await suggestion.click();
            }
        }

        // Zip code — match by placeholder containing zip/33 digits
        const allInputs = await page.locator('input').all();
        for (const inp of allInputs) {
            const ph = (await inp.getAttribute('placeholder') ?? '').toLowerCase();
            if (/zip|postal|3313|3332/.test(ph)) {
                await inp.click({ clickCount: 3 });
                await inp.fill('33327');
                break;
            }
        }

        // City
        const cityInput = page.locator('input[placeholder*="city" i]').first();
        if (await cityInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await cityInput.click({ clickCount: 3 });
            await cityInput.fill('Weston');
        }
    });

    // ── 5. Save profile ───────────────────────────────────────────────────────
    await test.step('Click "Update Profile" and close success modal', async () => {
        await clickText(page, 'Update Profile');
        await waitForText(page, 'Success');
        await clickText(page, 'Close');
    });

    // ── 6. Start the request-assistance wizard ────────────────────────────────
    await test.step('Navigate to Request Assistance', async () => {
        await page.goto('/request-assistance');
        await waitForText(page, 'Request a mechanic');
    });

    // ── 7. Choose Immediate Assistance ───────────────────────────────────────
    await test.step('Choose IMMEDIATE ASSISTANCE', async () => {
        await clickText(page, 'IMMEDIATE ASSISTANCE');
        await page.waitForTimeout(1_000);
    });

    // ── 8. Select first vehicle ───────────────────────────────────────────────
    await test.step('Select first vehicle', async () => {
        // Wait for the vehicle selection screen to be fully loaded
        await waitForText(page, 'Select your vehicle', 10_000);

        // Vehicle cards are plain divs — match by the model text rendered inside them.
        // The first non-"Add a vehicle" card is the user's registered vehicle.
        const vehicleCard = page.locator('div')
            .filter({ hasText: /model|make|year|\bNO PLATE\b/i })
            .filter({ hasNotText: /add a vehicle/i })
            .first();

        try {
            await vehicleCard.waitFor({ state: 'visible', timeout: 8_000 });
            await vehicleCard.click();
        } catch {
            // Fallback: click "Add a vehicle" isn't useful — try any skip/continue
            const skip = page.locator('text=/skip|continue without/i').first();
            if (await skip.isVisible({ timeout: 2_000 }).catch(() => false)) await skip.click();
        }

        // Confirm we moved off the vehicle screen
        await expect(page.locator('text=Select your vehicle')).toBeHidden({ timeout: 8_000 });
    });

    // ── 9. Issue selection screen ─────────────────────────────────────────────
    await test.step('Select issue type and continue', async () => {
        // After vehicle selection the app navigates to issue-selection.tsx
        await waitForText(page, 'Indicate the issue', 10_000);

        // Fill in the description textarea
        const descBox = page.getByPlaceholder("Describe what's happening with your vehicle");
        await descBox.waitFor({ state: 'visible', timeout: 5_000 });
        await descBox.fill('Battery dead — E2E test');

        // Also tap a pre-defined issue chip to ensure validation passes
        await page.getByText('Battery / Starting issue').first().click();

        // Click Continue
        await page.getByText('Continue').first().click();

        // Confirm we left the issue screen
        await expect(page.getByText('Indicate the issue')).toBeHidden({ timeout: 8_000 });
    });

    // ── 10. Add-details screen ────────────────────────────────────────────────
    await test.step('Fill additional details and click "Confirm Issue"', async () => {
        await page.waitForURL(/add-details/, { timeout: 10_000 });
        await waitForText(page, 'Indicate more issue details', 8_000);

        const detailBox = page.getByPlaceholder('Type here...');
        await detailBox.waitFor({ state: 'visible', timeout: 5_000 });
        await detailBox.fill('Battery dead — E2E test');

        await page.getByText('Confirm Issue').first().click();
    });

    // ── 11. Location-map screen ───────────────────────────────────────────────
    await test.step('Confirm location on map', async () => {
        // react-native-maps may not render in a headless browser but the
        // "Confirm Location" button is always present in the DOM.
        await page.waitForURL(/location-map/, { timeout: 10_000 });
        const confirmBtn = page.getByText('Confirm Location').first();
        await confirmBtn.waitFor({ state: 'visible', timeout: 10_000 });
        await confirmBtn.click();
    });

    // ── 12. Confirm and submit ────────────────────────────────────────────────
    let requestId: string | null = null;
    await test.step('Confirm request and capture ID', async () => {
        // Wait for the unique heading on the confirmation screen
        await waitForText(page, 'Confirm assistance request', 10_000);

        const [response] = await Promise.all([
            page.waitForResponse(
                r => r.url().includes('/api/assistance') && r.request().method() === 'POST',
                { timeout: 15_000 }
            ),
            page.getByText('Confirm and Request').first().click(),
        ]);

        const body = await response.json().catch(() => ({}));
        requestId = (body as any)?.id ?? null;
        expect(requestId).toBeTruthy();
        console.log('  → request id:', requestId);
        console.log('  → api url hit:', response.url());
    });

    // ── 13. Searching — wait for bot to offer (up to 45 s) ───────────────────
    await test.step('Wait for bot mechanic to respond', async () => {
        // The searching screen auto-navigates to mechanic-found when status=offered.
        // The mechanic-found screen heading is "Select your best match".
        await page.waitForURL(/mechanic-found/, { timeout: 45_000 });
        await waitForText(page, 'Select your best match', 10_000);
    });

    // ── 14. Accept the mechanic offer ─────────────────────────────────────────
    await test.step('Click "Confirm and Request"', async () => {
        await page.locator('text=Confirm and Request').first().click();
        // App navigates to appointment detail
        await page.waitForURL(/appointments/, { timeout: 15_000 });
        await waitForText(page, /accepted/i, 10_000);
    });

    // ── 14a. Open chat and exchange a message with the bot mechanic ───────────
    await test.step('Send a chat message and wait for bot reply', async () => {
        // Click "Message" button on the appointment info tab
        await page.getByText('Message').first().click();
        await page.waitForURL(/\/chat\//, { timeout: 10_000 });

        // Type a message in the chat input
        const chatInput = page.getByPlaceholder('Write Here...');
        await chatInput.waitFor({ state: 'visible', timeout: 8_000 });
        await chatInput.fill('Hello, how long until you arrive?');

        // The send button renders as an <img> (lucide icon), not a <button>.
        // It is the immediate following sibling of the text input in the DOM.
        await page.locator('input[placeholder="Write Here..."]')
            .locator('xpath=following-sibling::*[1]')
            .click();

        // Verify our message appears in the chat
        await waitForText(page, 'Hello, how long until you arrive?', 5_000);
        console.log('  → user message sent');

        // Wait for bot reply (bot delays 1.5–3.5 s).
        // Check document.body.innerText for any phrase from BOT_CHAT_REPLIES.
        await page.waitForFunction(() => {
            const text = document.body.innerText;
            return [
                'On my way', 'Got it', 'No problem', 'Understood',
                'Thanks for the details', "I've seen this issue",
                'Just leaving now', 'Can you make sure',
                'Almost there', 'Noted.', 'heading your way',
                'have the parts', 'drive over', 'traffic looks',
                'accessible', 'tools needed',
            ].some(phrase => text.includes(phrase));
        }, undefined, { timeout: 12_000 });
        console.log('  → bot reply received');

        // Navigate back to the appointment detail
        await page.goto(`/appointments/${requestId}`);
        await page.waitForURL(/appointments/, { timeout: 10_000 });
    });

    // ── 15. Cancel the request ────────────────────────────────────────────────
    await test.step('Cancel the request', async () => {
        const cancelTrigger = page.locator('text=/cancel request/i').first();
        await cancelTrigger.waitFor({ state: 'visible', timeout: 10_000 });
        await cancelTrigger.click();

        // Cancellation modal — confirm with the exact button label
        await waitForText(page, 'Cancel Request', 6_000);
        await page.getByText('Yes, Cancel').first().click();

        // ── cancel-reason screen: select a reason then click Done ─────────────
        await page.waitForURL(/cancel-reason/, { timeout: 10_000 });
        await waitForText(page, 'Before you go', 8_000);
        await page.getByText('Other').first().click();
        await page.getByText('Done').first().click();

        // Should navigate to appointments tab after Done
        await page.waitForURL(/\/(tabs\/appointments|appointments)/, { timeout: 15_000 });
    });

    // ── 15a. Verify cancellation in the backend ───────────────────────────────
    await test.step('Verify appointment is cancelled in the backend', async () => {
        // Poll the API directly (Node context) to confirm status = 'canceled'
        // Both assistance_requests and appointments are updated on cancel.
        let finalStatus = '';
        for (let i = 0; i < 10; i++) {
            const res = await fetch(`${API_URL}/api/assistance/${requestId}`);
            if (res.ok) {
                const data: any = await res.json();
                finalStatus = data.status ?? '';
                if (finalStatus === 'canceled') break;
            }
            await new Promise(r => setTimeout(r, 1_000));
        }
        console.log(`  → appointment ${requestId} final status: ${finalStatus}`);
        expect(finalStatus).toBe('canceled');
    });

    console.log('\n  ✅ Full E2E browser test passed.\n');
});
