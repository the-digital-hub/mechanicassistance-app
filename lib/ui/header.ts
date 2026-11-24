import { Platform, type ViewStyle } from 'react-native';

/** The tinted page behind every header and the floating tab bar. */
export const HEADER_BG = '#F6F8FC';
/** The page colour: what shows behind the rounded header corners and around the floating tab bar. */
export const PAGE_BG = '#F6F8FC';

/**
 * How far the page runs under the header's rounded lower edge (= its corner radius), so what scrolls shows through the corners and the shadow
 * falls on it. Screens start this much higher than the header's bottom; their own top padding absorbs it.
 */
export const HEADER_OVERLAP = 14;

/**
 * Header of every screen: the same tint, but with the bottom corners rounded and a soft shadow instead of a hairline, so it reads as a
 * surface lifted over the page. Spread it into a header's style (the wizard headers) or use <RoundedHeaderBackground /> for the native one.
 */
export const ROUNDED_HEADER: ViewStyle = {
    backgroundColor: HEADER_BG,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    shadowColor: '#0B1F5C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 6,
    // In-flow headers (the wizard steps) lie over the page's first rows, like the transparent native header does.
    marginBottom: -HEADER_OVERLAP,
    zIndex: 10,
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

/**
 * The tab bar as a floating pill: white, fully rounded, with side margins and room under it, a soft shadow all around. (It still has a row of
 * its own, so nothing scrolls under it, and nothing is drawn over the footers above it.) ATTACHED_TAB_BAR above is the old one.
 */
export const PILL_HEIGHT = Platform.OS === 'ios' ? 64 : 60;
export const FLOATING_TAB_BAR: ViewStyle = {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    borderRadius: 32,
    marginHorizontal: 16,
    marginTop: 6,
    paddingTop: 0,
    shadowColor: '#0B1F5C',
    // The shadow falls downward only, so it never reaches the fixed footers that end just above the bar.
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 10,
};

/** Height of the tab bar (the safe area at the bottom included). The layout and the slide animation of the bar share it. */
export const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 68;
