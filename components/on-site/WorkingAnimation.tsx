import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
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
        // The animation and, under it, the tip: the "working on the vehicle" line lives in the blue timer card above.
        <View className="items-center" style={{ paddingTop: 4, paddingHorizontal: 32 }} accessibilityLabel={label} testID="working-animation">
            <View className="items-center justify-center" style={{ width: 170, height: 136 }}>
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
            <TipCard />
        </View>
    );
}

const TIPS: { key: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { key: 'photos', icon: 'camera-outline' },
    { key: 'talk', icon: 'chatbubbles-outline' },
    { key: 'fluids', icon: 'water-outline' },
    { key: 'test', icon: 'checkmark-done-outline' },
    { key: 'clean', icon: 'sparkles-outline' },
];

/** A short reminder of good practice while the work goes on: one at a time, a new one every few seconds, with a soft cross-fade. */
function TipCard() {
    const { t } = useTranslation();
    const [index, setIndex] = React.useState(0);
    const fade = React.useRef(new Animated.Value(1)).current;
    React.useEffect(() => {
        const timer = setInterval(() => {
            Animated.timing(fade, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => {
                setIndex((i) => (i + 1) % TIPS.length);
                Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
            });
        }, 6000);
        return () => clearInterval(timer);
    }, [fade]);
    const tip = TIPS[index];
    return (
        <View style={{ marginTop: 6, alignSelf: 'stretch', padding: 14, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: OS.borderSoft }} testID="working-tip">
            <Animated.View className="flex-row items-center" style={{ gap: 12, opacity: fade }}>
                <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: OS.blueSoft }}>
                    <Ionicons name={tip.icon} size={22} color={OS.blue} />
                </View>
                <View className="flex-1" style={{ minWidth: 0 }}>
                    <Text className="font-outfit-bold uppercase" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 0.8, color: OS.blue }}>{t('appointments.onSite.resolve.tipLabel')}</Text>
                    <Text className="font-outfit-semibold" style={{ fontSize: 16, lineHeight: 22, color: OS.text }}>{t(`appointments.onSite.resolve.tips.${tip.key}`)}</Text>
                </View>
            </Animated.View>
            <View className="flex-row self-center" style={{ gap: 5, marginTop: 12 }}>
                {TIPS.map((x, i) => (
                    <View key={x.key} style={{ width: i === index ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? OS.blue : '#D5DCEB' }} />
                ))}
            </View>
        </View>
    );
}
