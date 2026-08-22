import { ApiError } from "../api/types";

/**
 * Machine-readable outcomes the OTP screens branch on.
 *
 * The backend puts a `code` in the error envelope precisely so the app never has
 * to match on message text again — the old flow inspected Firebase strings like
 * `auth/too-many-requests`, which broke silently whenever the wording changed.
 */
export type AuthErrorCode =
    | "invalid_code"
    | "code_expired"
    | "too_many_attempts"
    | "rate_limited"
    | "phone_invalid"
    | "country_not_supported"
    | "session_expired"
    | "already_registered"
    | "network"
    | "unknown";

export interface AuthError {
    code: AuthErrorCode;
    /** Seconds to wait, when the backend said. */
    retryAfterSeconds?: number;
    /** Guesses left on this challenge, when the backend said. */
    attemptsRemaining?: number;
}

/** Maps a backend error code onto ours. Unlisted codes fall through to status. */
const BY_BACKEND_CODE: Record<string, AuthErrorCode> = {
    OTP_INVALID: "invalid_code",
    OTP_EXHAUSTED: "too_many_attempts",
    RATE_LIMITED: "rate_limited",
    PHONE_INVALID: "phone_invalid",
    COUNTRY_NOT_SUPPORTED: "country_not_supported",
    SESSION_EXPIRED: "session_expired",
};

const BY_STATUS: Record<number, AuthErrorCode> = {
    400: "phone_invalid",
    401: "invalid_code",
    403: "country_not_supported",
    409: "already_registered",
    429: "rate_limited",
};

export function toAuthError(error: unknown): AuthError {
    if (!(error instanceof ApiError)) {
        // No envelope at all: the request never reached the API.
        return { code: "network" };
    }

    const payload = asRecord(error.apiError);
    const backendCode = typeof payload?.code === "string" ? payload.code : undefined;

    const code: AuthErrorCode =
        (backendCode ? BY_BACKEND_CODE[backendCode] : undefined) ??
        BY_STATUS[error.statusCode] ??
        "unknown";

    return {
        code,
        ...numberField(payload, "retryAfterSeconds"),
        ...numberField(payload, "attemptsRemaining"),
    };
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === "object"
        ? (value as Record<string, unknown>)
        : null;
}

function numberField(
    payload: Record<string, unknown> | null,
    field: "retryAfterSeconds" | "attemptsRemaining",
): Partial<AuthError> {
    const value = payload?.[field];
    return typeof value === "number" ? { [field]: value } : {};
}
