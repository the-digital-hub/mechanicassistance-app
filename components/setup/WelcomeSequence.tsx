import { BadgeCheck, BellRing, Car, ClipboardCheck, MapPinned, ShieldCheck, Star, Video, Wallet, Wrench, type LucideIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Image, NativeScrollEvent, NativeSyntheticEvent, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { EmptyStateIcon } from '@/components/ui/EmptyStateIcon';

const INK = { text: '#0B1530', muted: '#6B7490', blue: '#1E56E3', blueSoft: '#EAF1FF', line: '#EEF2FA' };

/** What each role can do from here: one short tip per line, swiped like the tips in the on-site work screen. */
const TIPS: Record<'user' | 'mechanic', { key: string; icon: LucideIcon }[]> = {
    user: [
        { key: 'request', icon: BellRing },
        { key: 'track', icon: MapPinned },
        { key: 'compare', icon: ShieldCheck },
        { key: 'video', icon: Video },
        { key: 'vehicles', icon: Car },
    ],
    mechanic: [
        { key: 'available', icon: BellRing },
        { key: 'quote', icon: ClipboardCheck },
        { key: 'steps', icon: Wrench },
        { key: 'paid', icon: Wallet },
        { key: 'rating', icon: Star },
    ],
};

/** How long the logo greets before it turns into the check. */
const WELCOME_MS = 3200;

/**
 * The end of the registration. First the brand greets ("Welcome to our platform"): soft rings breathe out from behind the logo, it turns
 * in with a bounce and the words rise in one after the other. Then the logo gives way to the animated check (the one the empty states
 * use) and the words change to "Congratulations"; underneath, tips of what this role can do from here.
 */
export function WelcomeSequence({ role, subtitle }: { role: 'user' | 'mechanic'; subtitle: string }) {
    const { t } = useTranslation();
    const [phase, setPhase] = React.useState<'welcome' | 'done'>('welcome');
    const logo = React.useRef(new Animated.Value(0)).current; // 0 → 1 in, 1 → 2 out
    const pulse = React.useRef(new Animated.Value(0)).current; // the rings, looping while the brand greets
    const title = React.useRef(new Animated.Value(0)).current;
    const sub = React.useRef(new Animated.Value(0)).current;
    const tips = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        const rings = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1900, easing: Easing.out(Easing.quad), useNativeDriver: true }));
        rings.start();
        Animated.parallel([
            Animated.spring(logo, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
            Animated.timing(title, { toValue: 1, duration: 520, delay: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(sub, { toValue: 1, duration: 520, delay: 640, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start();
        const timer = setTimeout(() => {
            // The logo grows a little and fades while the words let go; then the check takes its place.
            Animated.parallel([
                Animated.timing(logo, { toValue: 2, duration: 420, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
                Animated.timing(title, { toValue: 0, duration: 280, useNativeDriver: true }),
                Animated.timing(sub, { toValue: 0, duration: 280, useNativeDriver: true }),
            ]).start(() => {
                rings.stop();
                setPhase('done');
                Animated.parallel([
                    Animated.timing(title, { toValue: 1, duration: 480, delay: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                    Animated.timing(sub, { toValue: 1, duration: 480, delay: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                    Animated.timing(tips, { toValue: 1, duration: 560, delay: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                ]).start();
            });
        }, WELCOME_MS);
        return () => {
            clearTimeout(timer);
            rings.stop();
        };
    }, [logo, pulse, title, sub, tips]);

    const rise = (v: Animated.Value) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] });
    const welcome = phase === 'welcome';
    return (
        <View className="flex-1 justify-center" style={{ padding: 20 }}>
            <View className="items-center">
                {/* One box for both: the logo while it greets, the check once it is done. */}
                <View className="items-center justify-center" style={{ width: 176, height: 176 }}>
                    {welcome ? (
                        <>
                            {[0, 0.5].map((offset) => {
                                const v = Animated.modulo(Animated.add(pulse, offset), 1);
                                return (
                                    <Animated.View
                                        key={offset}
                                        pointerEvents="none"
                                        style={{
                                            position: 'absolute',
                                            width: 120,
                                            height: 120,
                                            borderRadius: 60,
                                            borderWidth: 2,
                                            borderColor: '#9DBBF7',
                                            opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.7, 0] }),
                                            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.45] }) }],
                                        }}
                                    />
                                );
                            })}
                            <Animated.View
                                style={{
                                    opacity: logo.interpolate({ inputRange: [0, 0.6, 1, 2], outputRange: [0, 1, 1, 0] }),
                                    transform: [
                                        { scale: logo.interpolate({ inputRange: [0, 1, 2], outputRange: [0.4, 1, 1.4] }) },
                                        { rotate: logo.interpolate({ inputRange: [0, 1, 2], outputRange: ['-90deg', '0deg', '25deg'] }) },
                                    ],
                                }}
                            >
                                <Image source={require('@/assets/images/mechanic_assistance_isologo.png')} style={{ width: 120, height: 120 }} resizeMode="contain" testID="welcome-logo" />
                            </Animated.View>
                        </>
                    ) : (
                        <View style={{ transform: [{ scale: 1.25 }] }}>
                            <EmptyStateIcon icon={BadgeCheck} />
                        </View>
                    )}
                </View>

                <Animated.Text className="font-outfit-bold text-center" style={{ fontSize: 32, lineHeight: 38, letterSpacing: -0.8, color: INK.text, marginTop: 20, paddingHorizontal: 8, ...rise(title) }} testID="welcome-title">
                    {welcome ? t('setup.success.welcomeTitle') : t('setup.success.congratulations')}
                </Animated.Text>
                <Animated.Text className="font-outfit-regular text-center" style={{ fontSize: 18, lineHeight: 26, color: INK.muted, marginTop: 10, paddingHorizontal: 12, ...rise(sub) }}>
                    {welcome ? t('setup.success.welcomeSub') : subtitle}
                </Animated.Text>
            </View>

            {/* What they can do here: appears once the greeting is over. */}
            <Animated.View style={{ marginTop: 32, ...rise(tips) }} pointerEvents={welcome ? 'none' : 'auto'}>
                <WelcomeTips role={role} />
            </Animated.View>
        </View>
    );
}

/** Swipeable tips: one page at a time with the finger, moving on by itself every few seconds (restarts after a swipe). */
function WelcomeTips({ role }: { role: 'user' | 'mechanic' }) {
    const { t } = useTranslation();
    const list = TIPS[role];
    const [index, setIndex] = React.useState(0);
    const [width, setWidth] = React.useState(0);
    const scroller = React.useRef<ScrollView>(null);
    const goTo = React.useCallback((i: number) => scroller.current?.scrollTo({ x: i * width, animated: true }), [width]);
    React.useEffect(() => {
        if (width <= 0) return undefined;
        const timer = setInterval(() => {
            const next = (index + 1) % list.length;
            goTo(next);
            setIndex(next);
        }, 5000);
        return () => clearInterval(timer);
    }, [index, width, goTo, list.length]);
    const onSwipeEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (width > 0) setIndex(Math.max(0, Math.min(list.length - 1, Math.round(e.nativeEvent.contentOffset.x / width))));
    };
    return (
        <View style={{ paddingVertical: 18, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: INK.line }} testID="welcome-tips">
            <View onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
                <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onSwipeEnd} scrollEventThrottle={16} bounces={false}>
                    {list.map(({ key, icon: Icon }) => (
                        <View key={key} className="flex-row items-center" style={{ width: width || undefined, paddingHorizontal: 16, gap: 14 }}>
                            <View className="items-center justify-center" style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: INK.blueSoft }}>
                                <Icon size={26} color={INK.blue} />
                            </View>
                            <View className="flex-1" style={{ minWidth: 0 }}>
                                <Text className="font-outfit-bold uppercase" style={{ fontSize: 13, lineHeight: 18, letterSpacing: 1, color: INK.blue }}>{t(`setup.success.tips.${role}.${key}.title`)}</Text>
                                <Text className="font-outfit-semibold" style={{ fontSize: 18, lineHeight: 24, color: INK.text }}>{t(`setup.success.tips.${role}.${key}.text`)}</Text>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </View>
            <View className="flex-row self-center" style={{ gap: 5, marginTop: 12 }}>
                {list.map((x, i) => (
                    <TouchableOpacity key={x.key} onPress={() => { setIndex(i); goTo(i); }} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${i + 1} / ${list.length}`}>
                        <View style={{ width: i === index ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? INK.blue : '#D5DCEB' }} />
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}
