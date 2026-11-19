import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

/**
 * A soft radar: two rings that spread out of a round tile and fade, to say "this is live". The tile holds
 * whatever icon is passed in. It is the pulse the old lobby screen had, small enough to sit in a card.
 */
export function LiveRadar({ size = 44, color = '#2B66F8', children }: { size?: number; color?: string; children?: React.ReactNode }) {
    const first = useSharedValue(0);
    const second = useSharedValue(0);
    useEffect(() => {
        const loop = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false);
        first.value = loop;
        second.value = withDelay(900, withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false));
    }, [first, second]);

    const ring = (progress: typeof first) =>
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useAnimatedStyle(() => ({
            transform: [{ scale: 1 + progress.value * 0.9 }],
            opacity: 0.35 * (1 - progress.value),
        }));
    const firstStyle = ring(first);
    const secondStyle = ring(second);
    const ringBase = { position: 'absolute' as const, width: size, height: size, borderRadius: size / 2, backgroundColor: color };

    return (
        <View style={{ width: size * 1.9, height: size * 1.9, alignItems: 'center', justifyContent: 'center' }} testID="live-radar">
            <Animated.View style={[ringBase, firstStyle]} />
            <Animated.View style={[ringBase, secondStyle]} />
            <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
        </View>
    );
}
