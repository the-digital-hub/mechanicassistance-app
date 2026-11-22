import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { OS } from '@/components/on-site/ui';

/**
 * Something alive while the technician works: a ring that breathes, a gear that turns slowly and a wrench that swings over it.
 * Only transforms and opacity, so it runs on the native driver and costs next to nothing.
 */
export function WorkingAnimation({ label, size = 148 }: { label: string; /** Side of the square it lives in. */ size?: number }) {
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
    const ringScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] });
    const ringOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.06] });

    // Everything scales from the size of the box: the ring (the biggest part, 124 of 148 at rest, 1.12x when it breathes) always fits in it.
    const k = size / 148;
    return (
        // Lives inside the blue timer card, so it is drawn in white tones. The ring that breathes never grows past its box, so it cannot
        // spread over what is around it.
        <View className="items-center justify-center" style={{ width: size, height: size }} accessibilityLabel={label} testID="working-animation">
            <Animated.View style={{ position: 'absolute', width: 124 * k, height: 124 * k, borderRadius: 62 * k, backgroundColor: '#FFFFFF', opacity: ringOpacity, transform: [{ scale: ringScale }] }} />
            <View className="items-center justify-center" style={{ width: 104 * k, height: 104 * k, borderRadius: 52 * k, backgroundColor: 'rgba(255,255,255,0.16)' }}>
                <Animated.View style={{ transform: [{ rotate: gearRotate }] }}>
                    <Ionicons name="settings" size={70 * k} color="rgba(255,255,255,0.38)" />
                </Animated.View>
                <Animated.View style={{ position: 'absolute', transform: [{ rotate: wrenchRotate }] }}>
                    <Ionicons name="construct" size={40 * k} color="#FFFFFF" />
                </Animated.View>
            </View>
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

/**
 * A short reminder of good practice while the work goes on: one page at a time, swiped with the finger, and it moves on by itself every few
 * seconds (the count restarts after a swipe, so it never snaps away from under the finger).
 */
export function TipCard() {
    const { t } = useTranslation();
    const [index, setIndex] = React.useState(0);
    const [width, setWidth] = React.useState(0);
    const scroller = React.useRef<ScrollView>(null);
    const goTo = React.useCallback((i: number, animated = true) => {
        scroller.current?.scrollTo({ x: i * width, animated });
    }, [width]);
    // Every 6 s, the next tip; `index` in the deps restarts the count after a swipe.
    React.useEffect(() => {
        if (width <= 0) return undefined;
        const timer = setInterval(() => {
            const next = (index + 1) % TIPS.length;
            goTo(next);
            setIndex(next);
        }, 6000);
        return () => clearInterval(timer);
    }, [index, width, goTo]);
    const onSwipeEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (width > 0) setIndex(Math.max(0, Math.min(TIPS.length - 1, Math.round(e.nativeEvent.contentOffset.x / width))));
    };
    return (
        <View style={{ alignSelf: 'stretch', paddingVertical: 14, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: OS.borderSoft }} testID="working-tip">
            <View onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
                <ScrollView
                    ref={scroller}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={onSwipeEnd}
                    scrollEventThrottle={16}
                    bounces={false}
                >
                    {TIPS.map((tip) => (
                        <View key={tip.key} className="flex-row items-center" style={{ width: width || undefined, paddingHorizontal: 14, gap: 12 }}>
                            <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: OS.blueSoft }}>
                                <Ionicons name={tip.icon} size={22} color={OS.blue} />
                            </View>
                            <View className="flex-1" style={{ minWidth: 0 }}>
                                <Text className="font-outfit-bold uppercase" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 0.8, color: OS.blue }}>{t('appointments.onSite.resolve.tipLabel')}</Text>
                                <Text className="font-outfit-semibold" style={{ fontSize: 16, lineHeight: 22, color: OS.text }}>{t(`appointments.onSite.resolve.tips.${tip.key}`)}</Text>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </View>
            <View className="flex-row self-center" style={{ gap: 5, marginTop: 12 }}>
                {TIPS.map((x, i) => (
                    <TouchableOpacity key={x.key} onPress={() => { setIndex(i); goTo(i); }} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${i + 1} / ${TIPS.length}`}>
                        <View style={{ width: i === index ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? OS.blue : '#D5DCEB' }} />
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}
