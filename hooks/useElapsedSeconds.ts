import { useEffect, useState } from "react";

/**
 * Seconds elapsed since an absolute start time.
 *
 * Takes an epoch-ms start rather than counting ticks, for the same reason as
 * useCountdown: ticks pause while the app is in the background, so a counter
 * would resume behind the real time.
 *
 * Pass null to stop the timer (returns 0).
 */
export function useElapsedSeconds(startMs: number | null): number {
    const [elapsed, setElapsed] = useState(() => since(startMs));

    useEffect(() => {
        setElapsed(since(startMs));
        if (startMs === null) return;

        const id = setInterval(() => setElapsed(since(startMs)), 1000);
        return () => clearInterval(id);
    }, [startMs]);

    return elapsed;
}

function since(startMs: number | null): number {
    if (startMs === null) return 0;
    return Math.max(0, Math.floor((Date.now() - startMs) / 1000));
}

/** Formats elapsed time as mm:ss, or h:mm:ss from one hour on. */
export function formatElapsed(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const rest = total % 60;
    const mmss = `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
    return hours > 0 ? `${hours}:${mmss}` : mmss;
}
