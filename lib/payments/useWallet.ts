import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { type Wallet, walletDAO } from '@/lib/dao/WalletDAO';

/**
 * The signed-in customer's prepaid wallet, reloaded every time the screen gets
 * focus. `reload` reads it again after a top-up. Pass `enabled = false` on
 * screens a mechanic also opens: they pay nothing. Null while loading or when
 * billing cannot be reached — callers then fall back to the cards.
 */
export function useWallet(enabled = true) {
    const [wallet, setWallet] = useState<Wallet | null>(null);

    const reload = useCallback(async () => {
        if (!enabled) return null;
        try {
            const next = await walletDAO.getMine();
            setWallet(next);
            return next;
        } catch {
            return null;
        }
    }, [enabled]);

    useFocusEffect(
        useCallback(() => {
            reload();
        }, [reload]),
    );

    return { wallet, setWallet, reload };
}
