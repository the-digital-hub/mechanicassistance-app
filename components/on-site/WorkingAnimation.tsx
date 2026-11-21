import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Easing, Text, View } from 'react-native';

import { OS } from '@/components/on-site/ui';

/**
 * Something alive while the technician works: a ring that breathes, a gear that turns slowly and a wrench that swings over it.
 * Only transforms and opacity, so it runs on the native driver and costs next to nothing.
 */
export function WorkingAnimation({ label }: { label: string }) {
    const turn = React.useRef(new Animated.Value(0)).current;
    const swing = React.useRef(new Animated.Value(0)).current;
    const breathe = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        const gear = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }));
        const wrench = Animated.loop(Animated.sequence([
            Animated.timing(swing, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(swing, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]));
        const ring = Animated.loop(Animated.sequence([
            Animated.timing(breathe, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(breathe, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]));
        gear.start();
        wrench.start();
        ring.start();
        return () => {
            gear.stop();
            wrench.stop();
            ring.stop();
        };
    }, [turn, swing, breathe]);

    const gearRotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    const wrenchRotate = swing.interpolate({ inputRange: [0, 1], outputRange: ['-28deg', '14deg'] });
    const ringScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] });
    const ringOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.15] });

    return (
        <View className="items-center" style={{ marginTop: 22, marginBottom: 6 }} accessibilityLabel={label} testID="working-animation">
            <View className="items-center justify-center" style={{ width: 170, height: 150 }}>
                <Animated.View style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#CFDDFB', opacity: ringOpacity, transform: [{ scale: ringScale }] }} />
                <View className="items-center justify-center" style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: '#E6EEFF' }}>
                    <Animated.View style={{ transform: [{ rotate: gearRotate }] }}>
                        <Ionicons name="settings" size={76} color="#BFD2FA" />
                    </Animated.View>
                    <Animated.View style={{ position: 'absolute', transform: [{ rotate: wrenchRotate }] }}>
                        <Ionicons name="construct" size={44} color={OS.blue} />
                    </Animated.View>
                </View>
            </View>
            <Text className="font-outfit-semibold text-center" style={{ fontSize: 15, lineHeight: 21, color: OS.muted, marginTop: 4 }}>{label}</Text>
        </View>
    );
}
