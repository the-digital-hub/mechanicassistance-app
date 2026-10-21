import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { connectDAO } from '@/lib/dao/ConnectDAO';
import { earningsDAO } from '@/lib/dao/EarningsDAO';
import type {
    AssistanceSummary,
    ConnectStatus,
    EarningsFilters,
    EarningsSummary,
    MechanicEarning,
    Payout,
} from '@/lib/dao/interfaces';

/** One earnings row with what the job was, when appointments-service could tell. */
export interface EarningRow extends MechanicEarning {
    job: AssistanceSummary | null;
}

/**
 * The mechanic's earnings for the given filters, joined with the title and
 * address of each job, plus the all-time totals. Reloads on focus and when the
 * filters change. `error` is set when billing could not be reached; a failed
 * job lookup only leaves `job` null ("Request details unavailable").
 */
export function useEarnings(filters: EarningsFilters) {
    const [rows, setRows] = useState<EarningRow[] | null>(null);
    const [summary, setSummary] = useState<EarningsSummary | null>(null);
    const [error, setError] = useState(false);
    const key = JSON.stringify(filters);
    // Ignores answers to filters that were replaced while loading.
    const latest = useRef(key);

    const reload = useCallback(async () => {
        latest.current = key;
        setError(false);
        try {
            const res = await earningsDAO.list(JSON.parse(key) as EarningsFilters);
            const jobs = await assistanceDAO
                .summaries(res.items.map((e) => e.assistanceRequestId))
                .catch(() => [] as AssistanceSummary[]);
            if (latest.current !== key) return;
            const byId = new Map(jobs.map((j) => [j.id, j]));
            setSummary(res.summary);
            setRows(res.items.map((e) => ({ ...e, job: byId.get(e.assistanceRequestId) ?? null })));
        } catch {
            if (latest.current !== key) return;
            setError(true);
            setRows((prev) => prev ?? []);
        }
    }, [key]);

    useFocusEffect(
        useCallback(() => {
            reload();
        }, [reload]),
    );

    return { rows, summary, error, reload };
}

/** The latest payouts (first page). Null while loading. */
export function usePayouts() {
    const [payouts, setPayouts] = useState<Payout[] | null>(null);

    const reload = useCallback(async () => {
        try {
            const page = await earningsDAO.payouts(1, 25);
            setPayouts(page.items);
        } catch {
            setPayouts((prev) => prev ?? []);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            reload();
        }, [reload]),
    );

    return { payouts, reload };
}

/**
 * The Stripe payout account's state. Read again whenever the app comes back to
 * the front, which is how the screen notices the mechanic finished onboarding
 * in the browser.
 */
export function useConnectStatus() {
    const [status, setStatus] = useState<ConnectStatus | null>(null);
    const [error, setError] = useState(false);

    const reload = useCallback(async () => {
        try {
            setStatus(await connectDAO.status());
            setError(false);
        } catch {
            setError(true);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            reload();
        }, [reload]),
    );

    useEffect(() => {
        const sub = AppState.addEventListener('change', (next) => {
            if (next === 'active') reload();
        });
        return () => sub.remove();
    }, [reload]);

    return { status, error, reload };
}
