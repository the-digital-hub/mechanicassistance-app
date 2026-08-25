import { apiClient } from "../api/apiClient";
import type { UserData } from "../dao/interfaces";
import { saveCachedUser, saveSignupToken, saveTokens } from "./session";

export type OtpPurpose = "login" | "signup";

export interface OtpChallenge {
    requestId: string;
    /** Seconds until the code stops working. */
    expiresIn: number;
    /** Seconds before a resend is allowed. */
    resendAfter: number;
    codeLength: number;
}

/**
 * What a successful verification produced.
 *
 * A discriminated union rather than an optional-field bag: the two outcomes lead
 * to completely different screens, and this makes it impossible to read one as
 * the other. It also replaces the module-level `pendingConfirmation` the Firebase
 * module kept — the phone number is now the only handle a screen needs to hold.
 */
export type OtpVerification =
    | { kind: "session"; user: UserData }
    | { kind: "signup"; signupToken: string; expiresIn: number };

interface RawSessionResult {
    kind: "session";
    accessToken: string;
    refreshToken: string;
    user: UserData;
}

interface RawSignupResult {
    kind: "signup";
    signupToken: string;
    expiresIn: number;
}

/**
 * Asks for a code.
 *
 * Always resolves for a well-formed number in a supported country, whether or
 * not a message was actually sent — the backend answers identically so the
 * endpoint cannot be used to discover which numbers have accounts. So a
 * resolved promise means "we accepted the request", never "an SMS is on its way".
 */
export async function requestOtp(
    phoneE164: string,
    purpose: OtpPurpose = "login",
): Promise<OtpChallenge> {
    return apiClient.post<OtpChallenge>("/api/auth/otp/request", {
        phone: phoneE164,
        purpose,
    });
}

/**
 * Asks for a new code on an existing challenge.
 *
 * Takes the phone number again because the backend stores only a hash of it, and
 * checks the two match before sending anything.
 */
export async function resendOtp(
    requestId: string,
    phoneE164: string,
): Promise<OtpChallenge> {
    return apiClient.post<OtpChallenge>("/api/auth/otp/resend", {
        requestId,
        phone: phoneE164,
    });
}

/**
 * Checks a code.
 *
 * On a login challenge the tokens are stored here, so callers only have to deal
 * with the resulting user. On a signup challenge the scoped token is stored
 * instead, which is what lets the rest of the wizard upload documents and create
 * the account before any session exists.
 */
export async function verifyOtp(
    requestId: string,
    phoneE164: string,
    code: string,
): Promise<OtpVerification> {
    const result = await apiClient.post<RawSessionResult | RawSignupResult>(
        "/api/auth/otp/verify",
        { requestId, phone: phoneE164, code },
    );

    if (result.kind === "signup") {
        await saveSignupToken(result.signupToken);
        return {
            kind: "signup",
            signupToken: result.signupToken,
            expiresIn: result.expiresIn,
        };
    }

    await saveTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
    });
    await saveCachedUser(result.user);

    return { kind: "session", user: result.user };
}

/** Formats 10 local digits as the E.164 the backend expects. */
export function toE164(localDigits: string): string {
    return `+1${localDigits}`;
}
