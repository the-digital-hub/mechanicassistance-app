import { apiClient, getFreshAccessToken } from "../api/apiClient";
import { ApiError } from "../api/types";
import { saveTokens } from "./session";

interface EmailChangeChallenge {
    /** Seconds the code stays valid (900 = 15 minutes). */
    expiresIn: number;
}

interface RawEmailChangeSession {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

/** `/api/auth` routes never refresh on their own, so make sure the access token is live first. */
async function requireLiveSession(): Promise<void> {
    if (!(await getFreshAccessToken())) {
        throw new ApiError(401, "Session expired", { code: "SESSION_EXPIRED" });
    }
}

/**
 * Emails a 6-digit code to the address the signed-in person wants to use.
 * Also adds an email to an account that had none. Like the phone change, a
 * resolved promise means "accepted", not "sent": nothing is sent when the
 * address belongs to another account, and the answer is identical so the
 * endpoint cannot reveal which addresses are registered. Max 5 requests/hour.
 */
export async function requestEmailChange(email: string): Promise<EmailChangeChallenge> {
    await requireLiveSession();
    return apiClient.post<EmailChangeChallenge>("/api/auth/email-change/request", { email });
}

/**
 * Checks the code and makes the address the account's email. The backend signs
 * out every other session and answers with a new pair for this device, which
 * replaces the current one. Callers still put the new email into the user in state.
 */
export async function confirmEmailChange(email: string, code: string): Promise<void> {
    await requireLiveSession();
    const session = await apiClient.post<RawEmailChangeSession>(
        "/api/auth/email-change/confirm",
        { email, code },
    );
    await saveTokens({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
    });
}
