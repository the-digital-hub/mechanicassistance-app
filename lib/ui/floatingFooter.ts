import type { ViewStyle } from 'react-native';

/**
 * Fixed bottom action bar ("sticky footer") used across the app: a white sheet
 * with rounded top corners and a soft upward shadow instead of a hard divider
 * line. Spread it into the wrapper's style; override `paddingBottom` on screens
 * that have no tab bar below (the tab bar already covers the safe area).
 */
export const FLOATING_FOOTER: ViewStyle = {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#0B1F5C',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 16,
};

/**
 * Soft blue glow under the primary gradient button inside a floating footer. It has to fit in the footer's bottom padding (18): what spills
 * past the footer is cut at its edge, and over the white strip of the tab bar that cut shows as a hard line.
 */
export const FLOATING_CTA: ViewStyle = {
    borderRadius: 16,
    shadowColor: '#2B66F8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 5,
};

/**
 * The green of the buttons that confirm: the last action of a process that loads data (confirm the request, send the offer, save, pay).
 * Continue / Next steps along the way stay blue; green says "this finishes it".
 */
export const CONFIRM_GRADIENT = ['#10B981', '#047857'] as const;

/** FLOATING_CTA with the glow in green, for a confirm button inside a floating footer. */
export const CONFIRM_CTA: ViewStyle = { ...FLOATING_CTA, shadowColor: '#10B981' };
