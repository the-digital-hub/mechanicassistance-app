import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { legalDAO } from '@/lib/dao/LegalDAO';
import { policiesForRole } from '@/lib/legal/policies';

/**
 * Whether a legal text (Terms, Privacy Policy…) has a new version this person has to accept in the role in use (`GET /api/legal/policies`,
 * backend 25/26-nov: `hasPending`, reduced to the role). Read again each time the screen is reached, so accepting clears it. False while it
 * is not known: nothing is claimed that is not sure.
 */
export function useLegalPending(userId: string | undefined, role: string | undefined, enabled = true): boolean {
    const [pending, setPending] = useState(false);
    useFocusEffect(
        useCallback(() => {
            if (!enabled || !userId) return undefined;
            let active = true;
            legalDAO.policies().then((p) => { if (active) setPending(policiesForRole(p, role).hasPending); }).catch(() => undefined);
            return () => { active = false; };
        }, [enabled, userId, role]),
    );
    return pending;
}
