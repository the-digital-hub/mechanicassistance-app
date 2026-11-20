import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const keyOf = (userId: string) => `hiddenAppointments:${userId}`;

/**
 * Cancelled appointments the person removed from their past list. The server has no "delete" for an appointment (the
 * other party and the records keep it), so this is a per-account list kept on the phone: the appointment is simply
 * not shown any more.
 */
export function useHiddenAppointments(userId?: string) {
    const [hidden, setHidden] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!userId) return;
        let alive = true;
        AsyncStorage.getItem(keyOf(userId))
            .then((raw) => {
                if (alive && raw) setHidden(new Set(JSON.parse(raw) as string[]));
            })
            .catch(() => undefined);
        return () => {
            alive = false;
        };
    }, [userId]);

    const hide = useCallback(
        (id: string) => {
            setHidden((prev) => {
                const next = new Set(prev).add(id);
                if (userId) void AsyncStorage.setItem(keyOf(userId), JSON.stringify([...next])).catch(() => undefined);
                return next;
            });
        },
        [userId],
    );

    return { hidden, hide };
}
