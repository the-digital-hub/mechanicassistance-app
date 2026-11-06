import { apiClient, getFreshAccessToken } from "../api/apiClient";
import { ApiError } from "../api/types";
import type { OtpChallenge } from "./otp";
import { saveTokens } from "./session";

interface RawPhoneChangeSession {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

/**
 * These routes sit under `/api/auth`, where apiClient deliberately never
 * refreshes (that is what prevents refresh loops). But they need a live access
 * token, and the access token is short-lived: without this, a person who left
 * the screen open would get a 401 that reads as "wrong code".
 */
async function requireLiveSession(): Promise<void> {
    if (!(await getFreshAccessToken())) {
        throw new ApiError(401, "Session expired", { code: "SESSION_EXPIRED" });
    }
}

/**
 * Sends a code to the number the signed-in person wants to sign in with.
 *
 * Works the same whether the account has no phone yet (it was created with
 * Google or Apple) or is replacing one. Like `requestOtp`, a resolved promise
 * means "accepted", not "sent": the backend sends nothing when the number
 * already belongs to another account, and answers identically so the endpoint
 * cannot be used to find out which numbers are registered.
 *
 * A resend goes through the ordinary `resendOtp` — it works on any challenge.
 */
export async function requestPhoneChange(phoneE164: string): Promise<OtpChallenge> {
    await requireLiveSession();
    return apiClient.post<OtpChallenge>("/api/auth/phone-change/request", {
        phone: phoneE164,
    });
}

/**
 * Checks the code and makes the number the account's phone.
 *
 * The backend signs out every other session and answers with a new pair for
 * this device, which replaces the current one here — the old tokens stop
 * working. Callers still have to put the new phone into the user in state.
 */
export async function confirmPhoneChange(
    requestId: string,
    phoneE164: string,
    code: string,
): Promise<void> {
    await requireLiveSession();
    const session = await apiClient.post<RawPhoneChangeSession>(
        "/api/auth/phone-change/confirm",
        { requestId, phone: phoneE164, code },
    );
    await saveTokens({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
    });
}
