import { useEffect, useState } from "react";

/**
 * Seconds remaining until an absolute deadline.
 *
 * Takes an epoch-ms deadline rather than a duration to tick down. A duration
 * would drift and, worse, would resume from where it paused after the app spent
 * time in the background — showing a resend as still blocked long after it was
 * allowed, or a code as still valid after it expired.
 *
 * Pass null to stop the timer.
 */
export function useCountdown(deadlineMs: number | null): number {
    const [secondsLeft, setSecondsLeft] = useState(() => remaining(deadlineMs));

    useEffect(() => {
        setSecondsLeft(remaining(deadlineMs));
        if (deadlineMs === null) return;

        const id = setInterval(() => {
            const next = remaining(deadlineMs);
            setSecondsLeft(next);
            if (next <= 0) clearInterval(id);
        }, 1000);

        return () => clearInterval(id);
    }, [deadlineMs]);

    return secondsLeft;
}

function remaining(deadlineMs: number | null): number {
    if (deadlineMs === null) return 0;
    return Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
}

/** Formats a countdown as m:ss, or just seconds when under a minute. */
export function formatCountdown(seconds: number): string {
    if (seconds < 60) return String(seconds);

    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes}:${String(rest).padStart(2, "0")}`;
}
