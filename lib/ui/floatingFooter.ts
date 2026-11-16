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
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#0B1F5C',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 16,
};

/** Soft blue glow under the primary gradient button inside a floating footer. */
export const FLOATING_CTA: ViewStyle = {
    borderRadius: 16,
    shadowColor: '#2B66F8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
};
