import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Animated, Easing, Text, View } from 'react-native';

import { OS } from '@/components/on-site/ui';
import { TYPE } from '@/lib/ui/type';

/**
 * The wait while the diagnostic is checked, made to be looked at if it lasts: a ring that breathes around a clipboard, the title and
 * what is being checked as a short list whose items tick off one after another (the last keeps working until the screen moves on).
 * Only transforms and opacity, on the native driver.
 */
export function ValidatingAnimation({ title, subtitle, steps }: { title: string; subtitle: string; steps: string[] }) {
    const breathe = React.useRef(new Animated.Value(0)).current;
    const [done, setDone] = React.useState(0);

    React.useEffect(() => {
        const loop = Animated.loop(Animated.sequence([
            Animated.timing(breathe, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(breathe, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]));
        loop.start();
        return () => loop.stop();
    }, [breathe]);

    // One more item is ticked every moment; the last one stays "in progress".
    React.useEffect(() => {
        if (done >= steps.length - 1) return;
        const id = setTimeout(() => setDone((d) => d + 1), 1100);
        return () => clearTimeout(id);
    }, [done, steps.length]);

    const outer = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] });
    const outerOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.12] });
    const inner = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

    return (
        <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 28 }} accessibilityLabel={title} testID="validating-animation">
            <View className="items-center justify-center" style={{ width: 190, height: 170 }}>
                <Animated.View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: '#CFDDFB', opacity: outerOpacity, transform: [{ scale: outer }] }} />
                <Animated.View className="items-center justify-center" style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: '#E6EEFF', transform: [{ scale: inner }] }}>
                    <Ionicons name="clipboard-outline" size={52} color={OS.blue} />
                </Animated.View>
            </View>

            <Text className="font-outfit-bold text-center" style={{ ...TYPE.question, color: OS.text, marginTop: 6 }}>{title}</Text>
            <Text className="font-outfit-regular text-center" style={{ ...TYPE.helper, color: OS.muted, marginTop: 6 }}>{subtitle}</Text>

            <View style={{ alignSelf: 'stretch', marginTop: 26, padding: 16, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: OS.border, gap: 14 }}>
                {steps.map((label, i) => {
                    const finished = i < done;
                    const current = i === done;
                    return (
                        <View key={label} className="flex-row items-center" style={{ gap: 12, opacity: finished || current ? 1 : 0.4 }}>
                            <View className="items-center justify-center" style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: finished ? '#16A34A' : OS.blueSoft }}>
                                {finished ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : current ? <ActivityIndicator size="small" color={OS.blue} style={{ transform: [{ scale: 0.7 }] }} /> : null}
                            </View>
                            <Text className={finished || current ? 'font-outfit-semibold' : 'font-outfit-regular'} style={{ ...TYPE.option, flex: 1, color: OS.text }}>{label}</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}
