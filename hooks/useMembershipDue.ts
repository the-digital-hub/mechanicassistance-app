import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { vehicleDAO } from '@/lib/dao/VehicleDAO';
import { loadMembership } from '@/lib/membership/plan';

/**
 * The amount of the plan while the sign-up is not finished (the plan is not paid and there is something to pay), as "$60.00"; null when
 * it is paid, covered by a code, or not known yet. Read again each time the screen is reached, so paying in Membership clears the tip.
 */
export function useMembershipDue(userId: string | undefined, role: 'mechanic' | 'user' | undefined, enabled: boolean): string | null {
    const [due, setDue] = useState<string | null>(null);
    useFocusEffect(
        useCallback(() => {
            if (!enabled || !userId || !role) return undefined;
            let active = true;
            // The owner's plan is per vehicle: it is read with their vehicles (and not known if those cannot be read).
            const vehicles = role === 'user' ? vehicleDAO.getByUser(userId) : Promise.resolve(undefined);
            vehicles
                .then((list) => loadMembership(role, userId, null, list))
                .then((plan) => { if (active) setDue(!plan.payment && plan.amount > 0 ? `$${plan.amount.toFixed(2)}` : null); })
                .catch(() => undefined);
            return () => { active = false; };
        }, [enabled, userId, role]),
    );
    return due;
}
