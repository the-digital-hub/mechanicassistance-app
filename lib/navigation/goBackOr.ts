import type { Href, Router } from 'expo-router';

/**
 * Go back when there is somewhere to go back to, otherwise land on `fallback`.
 *
 * A screen opened from a push notification, a cold-start deep link or another
 * tab can be the first screen of its stack: a bare `router.back()` then either
 * does nothing or bubbles up to the tab navigator and drops the user on another
 * tab. Every custom back button that can be reached that way goes through here.
 */
export function goBackOr(router: Router, fallback: Href): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
