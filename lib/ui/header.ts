import { Platform, type ViewStyle } from 'react-native';

/** The tinted page behind every header and the floating tab bar. */
export const HEADER_BG = '#F4F5FA';
/** The page colour: what shows behind the rounded header corners and around the floating tab bar. */
export const PAGE_BG = '#F6F8FC';

/**
 * Header of every screen: the same tint, but with the bottom corners rounded and a soft shadow instead of a hairline, so it reads as a
 * surface lifted over the page. Spread it into a header's style (the wizard headers) or use <RoundedHeaderBackground /> for the native one.
 */
export const ROUNDED_HEADER: ViewStyle = {
    backgroundColor: HEADER_BG,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    shadowColor: '#0B1F5C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 6,
};

/**
 * The tab bar is attached to the bottom edge: full width, white, top corners rounded and a soft shadow rising from it, the same language as
 * the fixed footers. It is a row of its own (the screens end where it starts), so nothing slides under it.
 */
export const ATTACHED_TAB_BAR: ViewStyle = {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    shadowColor: '#0B1F5C',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 16,
};

/** Height of the tab bar (the safe area at the bottom included). The layout and the slide animation of the bar share it. */
export const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;
