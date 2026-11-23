/**
 * Where each screen of the registration sits, so the badge on top can say "Step 4 of 9". The order mirrors lib/setup-resume.ts:
 *   User:     phone → code → role → basic info → address → vehicle
 *   Mechanic: phone → code → role → basic info → identity → address → ASE → availability → documents
 * The number of steps depends on the role, which is only known once it is chosen (step 3): before that a step shows its number alone.
 * dealer-info and expertise are optional detours, not steps.
 */
export type SetupScreen =
    | 'phone' | 'otp' | 'role' | 'basic-info' | 'identity' | 'address' | 'credentials' | 'availability' | 'legal-documents' | 'vehicle-info';

const USER_FLOW: SetupScreen[] = ['phone', 'otp', 'role', 'basic-info', 'address', 'vehicle-info'];
const MECHANIC_FLOW: SetupScreen[] = ['phone', 'otp', 'role', 'basic-info', 'identity', 'address', 'credentials', 'availability', 'legal-documents'];

/** The screens of the registration, in order, for a role (before the role is chosen the owner's shorter flow stands in). */
export function setupFlow(role: 'user' | 'mechanic' | null | undefined): SetupScreen[] {
    return role === 'mechanic' ? MECHANIC_FLOW : USER_FLOW;
}

export interface SetupStep {
    n: number;
    /** Undefined while the role (and so the length of the flow) is not known yet. */
    total?: number;
}

export function setupStep(screen: SetupScreen, role: 'user' | 'mechanic' | null | undefined): SetupStep | null {
    if (role) {
        const flow = role === 'mechanic' ? MECHANIC_FLOW : USER_FLOW;
        const i = flow.indexOf(screen);
        return i >= 0 ? { n: i + 1, total: flow.length } : null;
    }
    // No role yet: the three first steps are the same for both flows.
    const i = USER_FLOW.indexOf(screen);
    return i >= 0 && i < 3 ? { n: i + 1 } : null;
}
