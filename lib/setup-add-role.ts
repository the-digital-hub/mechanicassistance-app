import { getSessionUserId } from './auth/session';
import type { Address, AppRole, UserData } from './dao/interfaces';
import { userDAO } from './dao/UserDAO';
import { getSetupProgress, mergeSetupProgress } from './storage';

/**
 * The "add a role" variant of the signup wizard.
 *
 * Signing up with a phone that already has an account does not create a second
 * account: OTP verify returns a session for the existing one, and the wizard
 * then adds the chosen role to it (POST /api/roles/self/add-role) instead of
 * creating a user (POST /api/users). Picking a role the account already holds
 * skips the wizard and signs straight in with that role active.
 *
 * The session tokens are stored on verify but NOT adopted into UserContext, so
 * the app does not jump into the tabs halfway through the wizard. This state,
 * kept under `addRole` in the setup progress, is what tells every step which
 * variant it is in.
 */
export interface AddRoleState {
    /** Roles the account held when the phone was verified. */
    roles: string[];
    primaryRole: AppRole;
    userId?: string;
    /** The account's current email: the availability check must not flag it as taken. */
    email?: string;
    /** The account's addresses, offered on the address step as "use this". */
    existingAddresses?: Address[];
    /** Role the pre-fill was seeded for; choosing another role re-seeds. */
    prefilledFor?: AppRole;
}

export function getAddRoleState(progress: Record<string, unknown> | null | undefined): AddRoleState | null {
    const state = progress?.addRole as AddRoleState | undefined;
    return state && Array.isArray(state.roles) ? state : null;
}

export function holdsRole(state: AddRoleState, role: AppRole): boolean {
    return state.roles.includes(role);
}

/**
 * Marks the wizard as adding a role. A marker left by an earlier attempt keeps
 * its pre-fill state, so re-verifying after a failure does not wipe what was
 * already typed.
 */
export async function startAddRole(roles: string[], primaryRole: AppRole): Promise<void> {
    const previous = getAddRoleState(await getSetupProgress());
    await mergeSetupProgress({ addRole: { ...previous, roles, primaryRole } satisfies AddRoleState });
}

/** Drops the add-role marker, so a later signup for a new phone is a plain one. */
export async function clearAddRole(): Promise<void> {
    await mergeSetupProgress({ addRole: undefined });
}

/** The backend sends an ISO date; the wizard's DatePicker works in MM/DD/YYYY. */
function toPickerDate(dob: string | undefined): string {
    if (!dob) return '';
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
    return iso ? `${iso[2]}/${iso[3]}/${iso[1]}` : dob;
}

function isIdentityApproved(user: UserData): boolean {
    const verification = user.identityVerification;
    return !!verification && (verification.identityVerified === true || verification.status === 'Approved');
}

/**
 * Seeds the wizard with what the account already has, once per chosen role.
 *
 * Everything stays editable. What is seeded:
 *   - basic info (name, surname, email, date of birth, photo);
 *   - identity, when already approved — the step is then skipped, and the
 *     verification is not sent again (see `prefilled`);
 *   - the account's addresses, as suggestions only. The new role's address
 *     starts empty because it may differ from the other role's.
 *
 * Vehicles are not seeded: add-role only ever adds, so sending the existing
 * ones back would duplicate them. The vehicle step adds new ones only.
 *
 * Written with `mergeSetupProgress` so it does not count as progress.
 */
export async function prefillForAddRole(role: AppRole): Promise<void> {
    const progress = await getSetupProgress();
    const state = getAddRoleState(progress);
    if (!state || state.prefilledFor === role) return;

    const userId = state.userId ?? (await getSessionUserId());
    if (!userId) return;

    const user = await userDAO.getById(userId);
    if (!user) return;

    const verification = user.identityVerification;

    await mergeSetupProgress({
        basicInfo: {
            name: user.name ?? '',
            surname: user.surname ?? '',
            email: user.email ?? '',
            dob: toPickerDate(user.dob),
            profileImage: user.profileImage ?? '',
        },
        identity:
            verification && isIdentityApproved(user)
                ? { verificationId: verification.verificationId, status: verification.status, prefilled: true }
                : undefined,
        address: undefined,
        addRole: {
            ...state,
            userId,
            email: user.email,
            existingAddresses: user.addresses ?? [],
            prefilledFor: role,
        } satisfies AddRoleState,
    });
}
