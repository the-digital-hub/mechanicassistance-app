import type { ViewStyle } from 'react-native';

/**
 * Container of every bottom sheet: white, generously rounded on top (28, like the fixed footers) and a soft
 * shadow upward so it lifts off the dimmed page. Spread it, then add its own padding / max height.
 */
export const SHEET: ViewStyle = {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#0B1F5C',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 16,
};
