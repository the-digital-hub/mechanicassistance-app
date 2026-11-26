/**
 * The membership is FREE in the first App Store release: nothing is charged, no price, code or "Pay" button is shown (an in-app payment that
 * unlocks features would have to go through In-App Purchase, App Store guideline 3.1.1).
 *
 * To bring paid plans back, set this to `false`: everything the plan did before (the prices, the per-vehicle fleet, the promo codes, the
 * payment with card or earnings, the renewal) is still in `plan.ts` and the screens, and the tests for it run with this off. First decide
 * how it will be charged (In-App Purchase, or whatever the guidelines allow by then) and replace the simulated payment in `plan.ts`
 * (see "AN" in docs/backlog-backend.md).
 */
export const MEMBERSHIP_FREE_AT_LAUNCH = true;
