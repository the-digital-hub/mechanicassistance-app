import type { TFunction } from "i18next";
import { toAuthError, type AuthErrorCode } from "./errors";

/** i18n key for each outcome. */
const MESSAGE_KEYS: Record<AuthErrorCode, string> = {
    invalid_code: "login.invalidCode",
    code_expired: "login.codeExpiredMessage",
    too_many_attempts: "login.attemptsExhaustedMessage",
    rate_limited: "login.rateLimitedMessage",
    phone_invalid: "login.invalidNumberMessage",
    country_not_supported: "login.countryNotSupportedMessage",
    session_expired: "login.sessionExpiredMessage",
    already_registered: "setup.phone.alreadyRegistered",
    network: "login.networkErrorMessage",
    unknown: "login.sendCodeFailed",
};

/**
 * Turns any thrown value into a message for the user.
 *
 * Centralized so no screen goes back to matching on message text — the old flow
 * looked for substrings like `auth/too-many-requests`, which silently stopped
 * working whenever the wording changed.
 */
export function describeAuthError(error: unknown, t: TFunction): string {
    const { code, retryAfterSeconds, attemptsRemaining } = toAuthError(error);

    if (code === "rate_limited" && retryAfterSeconds) {
        return t("login.rateLimitedWithWait", {
            seconds: retryAfterSeconds,
        });
    }

    if (code === "invalid_code" && typeof attemptsRemaining === "number") {
        return t("login.invalidCodeWithAttempts", { count: attemptsRemaining });
    }

    return t(MESSAGE_KEYS[code]);
}
