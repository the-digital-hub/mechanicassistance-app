import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { addDismissed } from './attention';

const KEY = 'dashboard.attention.v1';

interface Stored {
    collapsed: boolean;
}

/**
 * What was hidden, per account and role, for as long as the app stays open: a module-level store, so it survives leaving the dashboard and
 * coming back, but not closing the app. A hidden alert is a "later", never a "never".
 */
const HIDDEN_THIS_SESSION: Record<string, string[]> = {};

/**
 * Per-account state of "Needs your attention": which alerts were hidden (until the app is reopened, or until a different alert shows up, see
 * `visibleAttention`) and whether the section is collapsed (this one survives restarts). Hidden alerts can be brought back (`restore`) and
 * their list opened (`showHidden`).
 */
export function useAttentionState(scope: string | undefined) {
    const [dismissed, setDismissed] = useState<string[]>(() => (scope ? HIDDEN_THIS_SESSION[scope] ?? [] : []));
    const [collapsed, setCollapsed] = useState(false);
    const [showHidden, setShowHidden] = useState(false);
    const latest = useRef<Stored>({ collapsed: false });

    useEffect(() => {
        setDismissed(scope ? HIDDEN_THIS_SESSION[scope] ?? [] : []);
        if (!scope) return;
        let alive = true;
        AsyncStorage.getItem(`${KEY}.${scope}`)
            .then((raw) => {
                if (!alive || !raw) return;
                const parsed = JSON.parse(raw) as Partial<Stored>;
                latest.current = { collapsed: !!parsed.collapsed };
                setCollapsed(latest.current.collapsed);
            })
            .catch(() => undefined);
        return () => {
            alive = false;
        };
    }, [scope]);

    const store = useCallback(
        (next: string[]) => {
            if (scope) HIDDEN_THIS_SESSION[scope] = next;
            setDismissed(next);
        },
        [scope],
    );

    const dismiss = useCallback((key: string) => store(addDismissed(scope ? HIDDEN_THIS_SESSION[scope] ?? [] : [], key)), [scope, store]);
    const restore = useCallback((key: string) => store((scope ? HIDDEN_THIS_SESSION[scope] ?? [] : []).filter((k) => k !== key)), [scope, store]);

    const toggleCollapsed = useCallback(() => {
        const next = { collapsed: !latest.current.collapsed };
        latest.current = next;
        setCollapsed(next.collapsed);
        if (scope) AsyncStorage.setItem(`${KEY}.${scope}`, JSON.stringify(next)).catch(() => undefined);
    }, [scope]);

    const toggleShowHidden = useCallback(() => setShowHidden((v) => !v), []);

    const dismissedSet = useMemo(() => new Set(dismissed), [dismissed]);
    return { dismissed: dismissedSet, collapsed, dismiss, restore, showHidden, toggleShowHidden, toggleCollapsed };
}
