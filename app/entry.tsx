/**
 * The entry decision (signed in → dashboard, a registration left half-way → resume it, otherwise onboarding) under a path of its own.
 * `/` cannot be used to come back to it: `app/index.tsx` and `app/(tabs)/index.tsx` (the Profile) both answer to `/`, and navigating
 * there from inside the tabs landed on the Profile screen, spinning forever when nobody is signed in.
 */
export { default } from './index';
