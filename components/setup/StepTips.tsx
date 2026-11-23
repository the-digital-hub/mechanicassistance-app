import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { TYPE } from '@/lib/ui/type';

const INK = { text: '#0B1530', blue: '#1E56E3', blueSoft: '#EAF1FF', line: '#EEF2FA' };

export interface StepTip {
    key: string;
    icon: LucideIcon;
    /** Small uppercase label above the text ("STEP 1"). */
    label: string;
    text: string;
}

/**
 * A few short steps shown like the tips of the on-site work screen: one page at a time, swiped with the finger, moving on by itself
 * every few seconds (the count restarts after a swipe) and with tappable dots.
 */
export function StepTips({ steps, intervalMs = 5000, testID }: { steps: StepTip[]; intervalMs?: number; testID?: string }) {
    const [index, setIndex] = React.useState(0);
    const [width, setWidth] = React.useState(0);
    const scroller = React.useRef<ScrollView>(null);
    const goTo = React.useCallback((i: number) => scroller.current?.scrollTo({ x: i * width, animated: true }), [width]);
    React.useEffect(() => {
        if (width <= 0) return undefined;
        const timer = setInterval(() => {
            const next = (index + 1) % steps.length;
            goTo(next);
            setIndex(next);
        }, intervalMs);
        return () => clearInterval(timer);
    }, [index, width, goTo, steps.length, intervalMs]);
    const onSwipeEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (width > 0) setIndex(Math.max(0, Math.min(steps.length - 1, Math.round(e.nativeEvent.contentOffset.x / width))));
    };
    return (
        <View style={{ paddingVertical: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: INK.line }} testID={testID}>
            <View onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
                <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onSwipeEnd} scrollEventThrottle={16} bounces={false}>
                    {steps.map(({ key, icon: Icon, label, text }) => (
                        <View key={key} className="flex-row items-center" style={{ width: width || undefined, paddingHorizontal: 14, gap: 12 }}>
                            <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: INK.blueSoft }}>
                                <Icon size={24} color={INK.blue} />
                            </View>
                            <View className="flex-1" style={{ minWidth: 0 }}>
                                <Text className="font-outfit-bold uppercase" style={{ ...TYPE.eyebrow, letterSpacing: 0.8, color: INK.blue }}>{label}</Text>
                                <Text className="font-outfit-semibold" style={{ fontSize: 16, lineHeight: 22, color: INK.text }}>{text}</Text>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </View>
            <View className="flex-row self-center" style={{ gap: 5, marginTop: 12 }}>
                {steps.map((x, i) => (
                    <TouchableOpacity key={x.key} onPress={() => { setIndex(i); goTo(i); }} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${i + 1} / ${steps.length}`}>
                        <View style={{ width: i === index ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? INK.blue : '#D5DCEB' }} />
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}
