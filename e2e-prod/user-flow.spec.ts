/**
 * Mechanic App — Full E2E Browser Test against Railway PRODUCTION
 *
 * Same flow as e2e/user-flow.spec.ts but points at the Railway backend.
 *
 * Prerequisites:
 *   1. Railway backend running: https://mechanic-production-e8ce.up.railway.app
 *   2. Expo web running locally: npm run web   (or set APP_URL for a remote build)
 *
 * Run:
 *   npm run test:e2e:prod
 *   npm run test:e2e:prod:headed          ← visible browser
 *   APP_URL=https://... npm run test:e2e:prod  ← custom app URL
 */

import { expect, Page, test } from '@playwright/test';

const API_URL    = process.env.API_URL    || 'https://mechanic-production-e8ce.up.railway.app';
const TEST_PHONE = '+11111111111';

// ─── helpers ─────────────────────────────────────────────────────────────────

async function waitForText(page: Page, text: string | RegExp, timeout = 20_000) {
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
async function callApi<T>(path: string, body: unknown, bearer?: string): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        method:  'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        },
        body:    JSON.stringify(body),
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.success) {
        throw new Error(`POST ${path} → ${res.status} ${JSON.stringify(payload?.error ?? payload)}`);
    }
    return payload.data as T;
}

/**
 * Obtains a session against a deployed backend.
 *
 * Prefers E2E_REFRESH_TOKEN: a real deployment has test numbers disabled and
 * sends real SMS, so the dev OTP bypass is unavailable there by design. Supply a
 * refresh token captured from a dedicated test account, and this trades it for a
 * fresh pair (rotation means the token is single-use, so export a new one after
 * each run — or point API_URL at staging and use the OTP path below).
 */
async function signInAsTestUser(): Promise<TestSession> {
    const seeded = process.env.E2E_REFRESH_TOKEN;

    if (seeded) {
        const pair = await callApi<{ accessToken: string; refreshToken: string }>(
            '/api/auth/refresh',
            { refreshToken: seeded },
        );
        const user = await callApi<TestSession>('/api/auth/session/exchange', {}, pair.accessToken)
            .catch(() => null);

        return {
            ...pair,
            user: user?.user ?? {},
        };
    }

    // Fallback for a staging target that still has the dev bypass enabled.
    const challenge = await callApi<{ requestId: string; devCode?: string }>(
        '/api/auth/otp/request',
        { phone: TEST_PHONE, purpose: 'login' },
    );

    if (!challenge.devCode) {
        throw new Error(
            'No devCode in the OTP response, so this target sends real SMS. ' +
            'Set E2E_REFRESH_TOKEN to a token from a dedicated test account, ' +
            'or point API_URL at an environment with OTP_TEST_NUMBERS_ENABLED=true.',
        );
    }

    return callApi<TestSession>('/api/auth/otp/verify', {
        requestId: challenge.requestId,
        phone:     TEST_PHONE,
        code:      challenge.devCode,
    });
}

// ─── test ─────────────────────────────────────────────────────────────────────

test('Full user journey (PROD): session inject → edit profile → request → accept → cancel', async ({ page }) => {

    // ── 0. Fetch user from API (Node context, not browser) ───────────────────
    let session: TestSession;
    await test.step('Fetch test user from Railway backend', async () => {
        session = await signInAsTestUser();
        expect(session.accessToken).toBeTruthy();
        console.log(`  → user: ${session.user.name ?? '(unknown)'}  id: ${session.user.id ?? '(unknown)'}`);
    });

    // ── 1. Inject session + force Railway API config ────────────────────────
    await test.step('Inject session into localStorage (bypass Firebase)', async () => {
        const prodBootstrap = {
            envs: {
                prod: { apiBaseUrl: API_URL, wsUrl: API_URL.replace('https', 'wss').replace('http', 'ws') },
            },
        };
        await page.route('https://bootstrap.mechanicapp.com/config', route =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(prodBootstrap) })
        );

        await page.addInitScript(({ session, apiUrl }) => {
            try {
                const serialised = JSON.stringify(session.user);
                localStorage.setItem('user_session', serialised);
                localStorage.setItem('@AsyncStorage:user_session', serialised);

                // Both tokens are required: a cached user with no token reads as
                // signed out, and an access token with no refresh token beside it
                // is treated as a pre-refresh-token session to be exchanged.
                for (const [key, value] of [
                    ['access_token', session.accessToken],
                    ['refresh_token', session.refreshToken],
                ]) {
                    localStorage.setItem(key, value);
                    localStorage.setItem(`@AsyncStorage:${key}`, value);
                }

                const wsUrl = apiUrl.replace('https', 'wss').replace('http', 'ws');
                const prodConfig = JSON.stringify({
                    envs: {
                        prod: { apiBaseUrl: apiUrl, wsUrl },
                    },
                });
                localStorage.setItem('@mechanic:remoteConfigCache', prodConfig);
                localStorage.setItem('@AsyncStorage:@mechanic:remoteConfigCache', prodConfig);
            } catch { /* storage blocked — test will fail later with a clear message */ }
        }, { session: session!, apiUrl: API_URL });
    });

    // ── 2. Load app — should land on tabs (already logged in) ────────────────
    await test.step('Load app — expect to land on main tabs', async () => {
        await page.goto('/');
        await page.waitForURL(/\/(tabs|assist|appointments|index)/, { timeout: 30_000 });
        console.log('  → landed on:', page.url());
    });

    // ── 3. Navigate to Profile → Personal Information ────────────────────────
    await test.step('Open Personal Information screen', async () => {
        await page.goto('/personal-info');
        await waitForText(page, 'Personal information');
    });

    // ── 4. Update address fields ──────────────────────────────────────────────
    await test.step('Fill address: 956 Golden Cane Dr, Weston FL 33327', async () => {
        const streetInput = page.locator('input[placeholder*="street" i], input[placeholder*="address" i], input[placeholder*="Enter" i]').first();
        if (await streetInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await streetInput.click({ clickCount: 3 });
            await streetInput.fill('956 Golden Cane Dr');
            await page.waitForTimeout(1_500);
            const suggestion = page.locator('div').filter({ hasText: /956 Golden Cane/i }).nth(1);
            if (await suggestion.isVisible({ timeout: 4_000 }).catch(() => false)) {
                await suggestion.click();
            }
        }

        const allInputs = await page.locator('input').all();
        for (const inp of allInputs) {
            const ph = (await inp.getAttribute('placeholder') ?? '').toLowerCase();
            if (/zip|postal|3313|3332/.test(ph)) {
                await inp.click({ clickCount: 3 });
                await inp.fill('33327');
                break;
            }
        }

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
        await waitForText(page, 'Select your vehicle', 10_000);

        const vehicleCard = page.locator('div')
            .filter({ hasText: /model|make|year|\bNO PLATE\b/i })
            .filter({ hasNotText: /add a vehicle/i })
            .first();

        try {
            await vehicleCard.waitFor({ state: 'visible', timeout: 8_000 });
            await vehicleCard.click();
        } catch {
            const skip = page.locator('text=/skip|continue without/i').first();
            if (await skip.isVisible({ timeout: 2_000 }).catch(() => false)) await skip.click();
        }

        await expect(page.locator('text=Select your vehicle')).toBeHidden({ timeout: 8_000 });
    });

    // ── 9. Issue selection screen ─────────────────────────────────────────────
    await test.step('Select issue type and continue', async () => {
        await waitForText(page, 'Indicate the issue', 10_000);

        const descBox = page.getByPlaceholder("Describe what's happening with your vehicle");
        await descBox.waitFor({ state: 'visible', timeout: 5_000 });
        await descBox.fill('Battery dead — E2E prod test');

        await page.getByText('Battery / Starting issue').first().click();

        await page.getByText('Continue').first().click();

        await expect(page.getByText('Indicate the issue')).toBeHidden({ timeout: 8_000 });
    });

    // ── 10. Add-details screen ────────────────────────────────────────────────
    await test.step('Fill additional details and click "Confirm Issue"', async () => {
        await page.waitForURL(/add-details/, { timeout: 10_000 });
        await waitForText(page, 'Indicate more issue details', 8_000);

        const detailBox = page.getByPlaceholder('Type here...');
        await detailBox.waitFor({ state: 'visible', timeout: 5_000 });
        await detailBox.fill('Battery dead — E2E prod test');

        await page.getByText('Confirm Issue').first().click();
    });

    // ── 11. Location-map screen ───────────────────────────────────────────────
    await test.step('Confirm location on map', async () => {
        await page.waitForURL(/location-map/, { timeout: 10_000 });
        const confirmBtn = page.getByText('Confirm Location').first();
        await confirmBtn.waitFor({ state: 'visible', timeout: 10_000 });
        await confirmBtn.click();
    });

    // ── 12. Confirm and submit ────────────────────────────────────────────────
    let requestId: string | null = null;
    await test.step('Confirm request and capture ID', async () => {
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

    // ── 13. Searching — wait for bot to offer (up to 60 s for prod latency) ──
    await test.step('Wait for bot mechanic to respond', async () => {
        await page.waitForURL(/mechanic-found/, { timeout: 60_000 });
        await waitForText(page, 'Select your best match', 10_000);
    });

    // ── 14. Accept the mechanic offer ─────────────────────────────────────────
    await test.step('Click "Confirm and Request"', async () => {
        await page.locator('text=Confirm and Request').first().click();
        await page.waitForURL(/appointments/, { timeout: 15_000 });
        await waitForText(page, /accepted/i, 10_000);
    });

    // ── 14a. Open chat and exchange a message with the bot mechanic ───────────
    await test.step('Send a chat message and wait for bot reply', async () => {
        await page.getByText('Message').first().click();
        await page.waitForURL(/\/chat\//, { timeout: 10_000 });

        const chatInput = page.getByPlaceholder('Write Here...');
        await chatInput.waitFor({ state: 'visible', timeout: 8_000 });
        await chatInput.fill('Hello, how long until you arrive?');

        await page.locator('input[placeholder="Write Here..."]')
            .locator('xpath=following-sibling::*[1]')
            .click();

        await waitForText(page, 'Hello, how long until you arrive?', 5_000);
        console.log('  → user message sent');

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
        }, undefined, { timeout: 15_000 });
        console.log('  → bot reply received');

        await page.goto(`/appointments/${requestId}`);
        await page.waitForURL(/appointments/, { timeout: 10_000 });
    });

    // ── 15. Cancel the request ────────────────────────────────────────────────
    await test.step('Cancel the request', async () => {
        const cancelTrigger = page.locator('text=/cancel request/i').first();
        await cancelTrigger.waitFor({ state: 'visible', timeout: 10_000 });
        await cancelTrigger.click();

        await waitForText(page, 'Cancel Request', 6_000);
        await page.getByText('Yes, Cancel').first().click();

        await page.waitForURL(/cancel-reason/, { timeout: 10_000 });
        await waitForText(page, 'Before you go', 8_000);
        await page.getByText('Other').first().click();
        await page.getByText('Done').first().click();

        await page.waitForURL(/\/(tabs\/appointments|appointments)/, { timeout: 15_000 });
    });

    // ── 15a. Verify cancellation in the backend ───────────────────────────────
    await test.step('Verify appointment is cancelled in the backend', async () => {
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

    console.log('\n  ✅ Full E2E PROD browser test passed.\n');
});
