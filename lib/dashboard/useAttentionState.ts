import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { addDismissed } from './attention';

const KEY = 'dashboard.attention.v1';

interface Stored {
    dismissed: string[];
    collapsed: boolean;
}

/**
 * Per-account state of "Needs your attention": which alerts were hidden and whether the
 * section is collapsed. Both survive restarts. A hidden alert stays hidden until a
 * different one shows up (see `visibleAttention`).
 */
export function useAttentionState(scope: string | undefined) {
    const [dismissed, setDismissed] = useState<string[]>([]);
    const [collapsed, setCollapsed] = useState(false);
    const latest = useRef<Stored>({ dismissed: [], collapsed: false });

    useEffect(() => {
        if (!scope) return;
        let alive = true;
        AsyncStorage.getItem(`${KEY}.${scope}`)
            .then((raw) => {
                if (!alive || !raw) return;
                const parsed = JSON.parse(raw) as Partial<Stored>;
                const next = { dismissed: parsed.dismissed ?? [], collapsed: !!parsed.collapsed };
                latest.current = next;
                setDismissed(next.dismissed);
                setCollapsed(next.collapsed);
            })
            .catch(() => undefined);
        return () => {
            alive = false;
        };
    }, [scope]);

    const persist = useCallback(
        (next: Stored) => {
            latest.current = next;
            if (scope) AsyncStorage.setItem(`${KEY}.${scope}`, JSON.stringify(next)).catch(() => undefined);
        },
        [scope],
    );

    const dismiss = useCallback(
        (key: string) => {
            const next = { ...latest.current, dismissed: addDismissed(latest.current.dismissed, key) };
            setDismissed(next.dismissed);
            persist(next);
        },
        [persist],
    );

    const toggleCollapsed = useCallback(() => {
        const next = { ...latest.current, collapsed: !latest.current.collapsed };
        setCollapsed(next.collapsed);
        persist(next);
    }, [persist]);

    const dismissedSet = useMemo(() => new Set(dismissed), [dismissed]);
    return { dismissed: dismissedSet, collapsed, dismiss, toggleCollapsed };
}
