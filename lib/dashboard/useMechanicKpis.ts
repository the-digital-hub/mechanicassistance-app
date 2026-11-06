import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { appointmentDAO } from '@/lib/dao/AppointmentDAO';
import { earningsDAO } from '@/lib/dao/EarningsDAO';
import type { MechanicStats } from '@/lib/dao/interfaces';

import { localDayBounds, sumNetEarnings } from './mechanicKpis';

/**
 * What the mechanic dashboard shows besides the job count: net earned today
 * (billing, local day) and the rating customers gave. Each is null while
 * loading or when its service could not be reached — never a made-up number;
 * a failed reload keeps the last good value.
 * Reloads on focus and whenever `refreshKey` changes (e.g. a job was finished).
 */
export function useMechanicKpis(enabled: boolean, refreshKey: unknown) {
    const [earnedToday, setEarnedToday] = useState<number | null>(null);
    const [stats, setStats] = useState<MechanicStats | null>(null);

    const reload = useCallback(() => {
        if (!enabled) return;
        earningsDAO
            .list(localDayBounds())
            .then((res) => setEarnedToday(sumNetEarnings(res.items)))
            .catch(() => undefined);
        appointmentDAO
            .getMyStats()
            .then(setStats)
            .catch(() => undefined);
    }, [enabled]);

    useFocusEffect(reload);

    useEffect(() => {
        reload();
    }, [reload, refreshKey]);

    return { earnedToday, stats };
}
