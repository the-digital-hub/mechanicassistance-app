import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { usePathname } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { PAGE_BG, TAB_BAR_HEIGHT } from '@/lib/ui/header';
import { setTabBarHidden, useTabBarHidden } from '@/lib/ui/tabBarVisibility';

/** Screens that end in a fixed white footer (the wizard steps, the quote and check-in flows), and the ones with a white page of their own. */
const WHITE_PATHS = /^\/(request-assistance(\/.+)?|assist\/scheduled.*|dashboard\/filter|privacy|appointments\/check-in.*|addresses.*)$/;

/** Height of what stays when the bar is tucked away: just a handle at the very edge. */
const TIP_HEIGHT = 12;

/** How long the bar takes to go down or come up. */
const SLIDE_MS = 260;

const SHADOW = {
    shadowColor: '#0B1F5C',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 16,
} as const;

/**
 * The bottom tab bar, attached to the edge with rounded top corners. What shows behind those two small corners is the backdrop of this row:
 * white under a white fixed footer (so the footer's white carries into the bar with no notch) and the page colour elsewhere.
 *
 * Scrolling down a list slides the bar down and leaves a small handle; scrolling up, tapping the handle or changing screen slides it back.
 * The row shrinks with it, so the screen above grows into the freed room in the same movement.
 */
export function RoundedTabBar(props: BottomTabBarProps) {
    const pathname = usePathname();
    const hidden = useTabBarHidden();
    // On Android (edge-to-edge) the system buttons / gesture bar sit over the bottom of the screen: the bar grows by their height, so its icons stay above them. iOS's 88 already includes it.
    const insets = useSafeAreaInsets();
    const bottomInset = Platform.OS === 'android' ? insets.bottom : 0;
    const fullHeight = TAB_BAR_HEIGHT + bottomInset;
    const backdrop = WHITE_PATHS.test(pathname) ? '#FFFFFF' : PAGE_BG;

    // 0 = the whole bar, 1 = only the handle.
    const progress = useSharedValue(hidden ? 1 : 0);
    useEffect(() => {
        progress.value = withTiming(hidden ? 1 : 0, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) });
    }, [hidden, progress]);

    // A new screen always starts with the bar in view.
    useEffect(() => {
        setTabBarHidden(false);
    }, [pathname]);

    const row = useAnimatedStyle(() => ({ height: interpolate(progress.value, [0, 1], [fullHeight, TIP_HEIGHT]) }));
    const tip = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0.4, 1], [0, 1], 'clamp') }));

    return (
        <Animated.View style={[{ backgroundColor: backdrop }, row]}>
            {/* The bar keeps its full height and hangs from the top of the row: as the row shrinks, it slides down and out of the screen. */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: fullHeight }} pointerEvents={hidden ? 'none' : 'auto'}>
                <BottomTabBar {...props} />
            </View>
            <Animated.View
                pointerEvents={hidden ? 'auto' : 'none'}
                style={[
                    { position: 'absolute', top: 0, left: 0, right: 0, height: TIP_HEIGHT, backgroundColor: '#FFFFFF', borderTopLeftRadius: 12, borderTopRightRadius: 12, ...SHADOW },
                    tip,
                ]}
            >
                <TouchableOpacity
                    onPress={() => setTabBarHidden(false)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Show navigation"
                    hitSlop={{ top: 22, bottom: 0, left: 60, right: 60 }}
                    style={{ height: TIP_HEIGHT, alignItems: 'center' }}
                    testID="tab-bar-tip"
                >
                    <View style={{ width: 30, height: 3, borderRadius: 2, backgroundColor: '#C9D3E6', marginTop: 4 }} />
                </TouchableOpacity>
            </Animated.View>
        </Animated.View>
    );
}
