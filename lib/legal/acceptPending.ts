import Constants from 'expo-constants';

import { legalDAO } from '@/lib/dao/LegalDAO';

import { policiesForRole } from './policies';

/**
 * Records the acceptance of the legal texts the person agreed to when they ticked the box at sign-up (Terms, Privacy Policy and the content
 * rules): the versions pending for the role they signed up as. The server has no public endpoint for the text shown before the account
 * exists, so this runs with the session just created (`/api/legal`, backend 25/26-nov).
 *
 * It never throws and never holds up the sign-up: a version that is no longer the current one (409) or that is not for this person (404)
 * stays pending, and the profile shows it as "Update" to accept from there. Resolves with how many were recorded.
 */
export async function acceptPendingPolicies(role?: string | null): Promise<number> {
    try {
        const { pending } = policiesForRole(await legalDAO.policies(), role);
        const appVersion = Constants.expoConfig?.version;
        let recorded = 0;
        for (const policy of pending) {
            try {
                await legalDAO.accept(policy.id, appVersion);
                recorded += 1;
            } catch {
                // Left for the profile's "Update".
            }
        }
        return recorded;
    } catch {
        return 0;
    }
}
