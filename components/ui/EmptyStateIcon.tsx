import { useFocusEffect } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import React, { useCallback, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

/**
 * The circle-in-a-circle that tops every empty state ("Nothing coming up", "No requests right now"): the same size everywhere.
 * Every time the screen is reached it plays a short entrance: the halo opens, the white disc pops in with a little bounce, the icon
 * turns in on it, and a soft ring breathes out once so the eye lands there.
 */
export function EmptyStateIcon({ icon: Icon }: { icon: LucideIcon }) {
    const halo = useRef(new Animated.Value(0)).current;
    const disc = useRef(new Animated.Value(0)).current;
    const glyph = useRef(new Animated.Value(0)).current;
    const ring = useRef(new Animated.Value(0)).current;

    useFocusEffect(
        useCallback(() => {
            halo.setValue(0);
            disc.setValue(0);
            glyph.setValue(0);
            ring.setValue(0);
            const run = Animated.parallel([
                Animated.timing(halo, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                Animated.sequence([Animated.delay(140), Animated.spring(disc, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true })]),
                Animated.sequence([Animated.delay(320), Animated.spring(glyph, { toValue: 1, friction: 6, tension: 140, useNativeDriver: true })]),
                Animated.sequence([Animated.delay(520), Animated.timing(ring, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true })]),
            ]);
            run.start();
            return () => run.stop();
        }, [halo, disc, glyph, ring]),
    );

    return (
        <View className="items-center justify-center" style={{ width: 112, height: 112 }}>
            <Animated.View
                style={{
                    position: 'absolute',
                    width: 112,
                    height: 112,
                    borderRadius: 56,
                    backgroundColor: '#EAF1FF',
                    opacity: halo,
                    transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
                }}
            />
            {/* One soft ring that breathes out and fades. */}
            <Animated.View
                pointerEvents="none"
                style={{
                    position: 'absolute',
                    width: 112,
                    height: 112,
                    borderRadius: 56,
                    borderWidth: 2,
                    borderColor: '#BFD3FA',
                    opacity: ring.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.8, 0] }),
                    transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.45] }) }],
                }}
            />
            <Animated.View
                className="items-center justify-center"
                style={{
                    width: 76,
                    height: 76,
                    borderRadius: 38,
                    backgroundColor: '#FFFFFF',
                    shadowColor: '#0E2F8A',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.12,
                    shadowRadius: 12,
                    elevation: 4,
                    opacity: disc,
                    transform: [{ scale: disc.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
                }}
            >
                <Animated.View
                    style={{
                        opacity: glyph,
                        transform: [
                            { scale: glyph.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
                            { rotate: glyph.interpolate({ inputRange: [0, 1], outputRange: ['-35deg', '0deg'] }) },
                        ],
                    }}
                >
                    <Icon size={34} color="#1E56E3" />
                </Animated.View>
            </Animated.View>
        </View>
    );
}
