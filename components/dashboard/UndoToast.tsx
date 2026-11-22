import React from 'react';
import { Animated, Easing, Text, TouchableOpacity } from 'react-native';

/**
 * A small notice at the bottom with one action ("Undo"), for something that was just done and can be taken back. It fades in, stays a few
 * seconds and goes away by itself. `id` changes with each notice, so a new one restarts the time.
 */
export function UndoToast({ id, label, actionLabel, onAction, onDone, bottom = 104 }: {
    /** `null` hides it. */
    id: string | null;
    label: string;
    actionLabel: string;
    onAction: () => void;
    onDone: () => void;
    bottom?: number;
}) {
    const progress = React.useRef(new Animated.Value(0)).current;
    React.useEffect(() => {
        if (!id) return undefined;
        progress.setValue(0);
        Animated.timing(progress, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        const timer = setTimeout(() => {
            Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
                if (finished) onDone();
            });
        }, 5000);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);
    if (!id) return null;
    return (
        <Animated.View
            pointerEvents="box-none"
            style={{ position: 'absolute', left: 16, right: 16, bottom, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}
            testID="undo-toast"
        >
            <Animated.View className="flex-row items-center justify-between" style={{ backgroundColor: '#111A33', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, gap: 12 }}>
                <Text className="font-outfit-semibold flex-1" style={{ fontSize: 15, lineHeight: 20, color: '#FFFFFF' }} numberOfLines={2}>{label}</Text>
                <TouchableOpacity onPress={onAction} hitSlop={10} accessibilityRole="button" testID="undo-toast-action">
                    <Text className="font-outfit-bold" style={{ fontSize: 15, color: '#9FC0FF' }}>{actionLabel}</Text>
                </TouchableOpacity>
            </Animated.View>
        </Animated.View>
    );
}
