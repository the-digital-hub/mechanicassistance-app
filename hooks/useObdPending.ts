import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Appointment } from '@/context/AppointmentsContext';
import { onSiteDAO } from '@/lib/dao/OnSiteDAO';

/** Only recent closed visits count: an old one without a report is history, not a task. */
const WINDOW_DAYS = 14;
/** The visit is read one by one, so only the newest few are checked. */
const MAX_CHECKED = 6;
const CLOSED = ['completed', 'awaiting_confirmation', 'disputed'];

/**
 * The technician's closed on-site visits that still have no scanner (OBD) report, newest first: what "Needs your attention" reminds about.
 * The visit is asked from the server for the newest few closed ones and re-checked each time the screen comes into focus (so an upload
 * made since then clears it).
 */
export function useObdPending(appointments: readonly Appointment[], enabled: boolean, reloadKey = 0): Appointment[] {
    const candidates = useMemo(() => {
        const since = Date.now() - WINDOW_DAYS * 86_400_000;
        return appointments
            .filter((a) => a.source === 'appointment' && (a.assistanceType ?? a.type) !== 'videocall' && CLOSED.includes(a.status))
            .filter((a) => {
                const at = Date.parse(a.completedAt ?? a.updatedAt ?? '');
                return Number.isFinite(at) && at >= since;
            })
            .sort((a, b) => Date.parse(b.completedAt ?? b.updatedAt ?? '') - Date.parse(a.completedAt ?? a.updatedAt ?? ''))
            .slice(0, MAX_CHECKED);
    }, [appointments]);
    const key = candidates.map((a) => a.id).join(',');

    const [tick, setTick] = useState(0);
    useFocusEffect(useCallback(() => { setTick((n) => n + 1); }, []));

    const [missing, setMissing] = useState<string[]>([]);
    useEffect(() => {
        if (!enabled || candidates.length === 0) {
            setMissing([]);
            return undefined;
        }
        let cancelled = false;
        Promise.all(
            candidates.map((a) =>
                onSiteDAO.get(a.id)
                    .then((visit) => (visit?.closedAt && (visit.obdStatus === 'none' || visit.obdStatus === 'failed') ? a.id : null))
                    .catch(() => null),
            ),
        ).then((ids) => { if (!cancelled) setMissing(ids.filter((id): id is string => !!id)); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, key, tick, reloadKey]);

    return useMemo(() => candidates.filter((a) => missing.includes(a.id)), [candidates, missing]);
}
