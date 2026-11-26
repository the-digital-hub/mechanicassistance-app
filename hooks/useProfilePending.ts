import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useVerification } from '@/context/VerificationContext';
import { useMembershipDue } from '@/hooks/useMembershipDue';
import type { UserData } from '@/lib/dao/interfaces';
import { mechanicDocumentsDAO } from '@/lib/dao/MechanicDocumentsDAO';
import { legalDAO } from '@/lib/dao/LegalDAO';
import { policiesForRole } from '@/lib/legal/policies';

/** What is still pending in the profile, by item (each is false while it is not known: nothing is claimed that is not sure). */
export interface ProfilePending {
    /** Identity check with Didit (technician). */
    identity: boolean;
    /** ASE certification not verified (technician). */
    ase: boolean;
    /** No legal documents uploaded yet (technician). */
    legal: boolean;
    /** The plan of the role is not paid (both roles). */
    membership: boolean;
    /** A legal text has a new version to accept. */
    privacy: boolean;
}

/**
 * The pending things inside the profile menu, so the menu can say so on the group that holds them (a pill with how many) and on the row
 * itself. Read again each time the profile is reached, so what was just done is gone from here.
 */
export function useProfilePending(user: UserData | null | undefined): ProfilePending {
    const isTechnician = user?.role === 'mechanic';
    const role = user?.role;
    const { isApproved, hasLoaded } = useVerification();
    const membershipDue = useMembershipDue(user?.id, user?.role === 'mechanic' ? 'mechanic' : user ? 'user' : undefined, !!user);
    const [hasDocuments, setHasDocuments] = useState<boolean | null>(null);
    const [hasLegalPending, setHasLegalPending] = useState(false);
    useFocusEffect(
        useCallback(() => {
            if (!user?.id) return undefined;
            let active = true;
            legalDAO.policies().then((p) => { if (active) setHasLegalPending(policiesForRole(p, role).hasPending); }).catch(() => undefined);
            return () => { active = false; };
        }, [user?.id, role]),
    );
    useFocusEffect(
        useCallback(() => {
            if (!isTechnician) return undefined;
            let active = true;
            mechanicDocumentsDAO.list().then((l) => { if (active) setHasDocuments(l.length > 0); }).catch(() => undefined);
            return () => { active = false; };
        }, [isTechnician]),
    );
    return {
        identity: isTechnician && hasLoaded && !isApproved,
        ase: isTechnician && user?.mechanicDetails?.aseStatus !== 'verified',
        legal: isTechnician && hasDocuments === false,
        membership: !!membershipDue,
        privacy: hasLegalPending,
    };
}
