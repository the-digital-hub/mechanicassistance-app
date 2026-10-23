/** Minutes a video call lasts when the server did not say (older backend). The hub sets the real value. */
export const DEFAULT_CALL_MINUTES = 45;

/** Seconds after the time is up before the server ends the call, when the server did not say. The hub sets the real value. */
export const DEFAULT_GRACE_SECONDS = 120;

/** How long the call may run, in seconds: its base plus the extra time the owner bought. */
export function contractedSeconds(
    state: { contractedMinutes?: number; baseMinutes?: number } | null | undefined,
): number {
    return (state?.contractedMinutes ?? state?.baseMinutes ?? DEFAULT_CALL_MINUTES) * 60;
}

/** Seconds the call may keep going once its time is up, before the server ends it. */
export function graceSecondsOf(state: { graceSeconds?: number } | null | undefined): number {
    return state?.graceSeconds ?? DEFAULT_GRACE_SECONDS;
}
