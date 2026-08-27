/**
 * Determines the next setup screen to resume based on saved progress.
 *
 * The setup flow saves `lastStep` to AsyncStorage each time the user
 * advances. This module maps that step to the next screen in the flow,
 * accounting for role-specific branching.
 *
 * Flow (mirrors the router.push calls in each screen — keep both in sync):
 *   User:     phone → otp → role → basic-info → address → vehicle-info → success
 *   Mechanic: phone → otp → role → basic-info → identity → address → credentials → availability → legal-documents → success
 *
 * dealer-info and expertise are only reachable through the header "Skip"
 * buttons in app/setup/_layout.tsx, so they are not part of the forward flow —
 * they only appear here as steps a user can resume *from*.
 *
 * The `identity` step is Didit identity verification (KYC), not a document
 * upload: it stores the verificationId that POST /api/users links the account to.
 *
 * `legal-documents` (liability insurance + business licence) is the last
 * mechanic step and is skippable, so its progress entry is written even when
 * empty — otherwise a resume would drop the mechanic back on a step they
 * deliberately skipped.
 * It only appears in the mechanic flow — verification is optional for users, who
 * can start it later from the profile screen — so `basicInfo` branches on role.
 */

interface SetupProgress {
  lastStep: string;
  role?: { role: 'user' | 'mechanic' };
  [key: string]: unknown;
}

/** Steps with a single, role-independent next screen */
const LINEAR_STEPS: Record<string, string> = {
  phone: '/setup/otp',
  otp: '/setup/role-selection',
  role: '/setup/basic-info',
  identity: '/setup/address',
  credentials: '/setup/availability',
  expertise: '/setup/availability',
  availability: '/setup/legal-documents',
  legalDocuments: '/setup/success',
  vehicles: '/setup/success',
};

/** Steps where the next screen depends on the selected role */
const BRANCHING_STEPS: Record<string, Record<string, string>> = {
  basicInfo: {
    user: '/setup/address',
    mechanic: '/setup/identity',
  },
  address: {
    user: '/setup/vehicle-info',
    mechanic: '/setup/credentials',
  },
  dealerInfo: {
    user: '/setup/vehicle-info',
    mechanic: '/setup/expertise',
  },
};

/**
 * Given the saved setup progress, returns the route the user should
 * resume at — i.e. the screen that follows `lastStep`.
 *
 * Returns null if no resume is needed (no lastStep or unrecognised step).
 */
export function getSetupResumeRoute(progress: SetupProgress): string | null {
  const { lastStep } = progress;
  if (!lastStep) return null;

  // Check role-branching steps first
  if (lastStep in BRANCHING_STEPS) {
    const role = progress.role?.role ?? 'user';
    return BRANCHING_STEPS[lastStep][role] ?? '/setup';
  }

  return LINEAR_STEPS[lastStep] ?? '/setup';
}
