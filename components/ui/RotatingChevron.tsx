import { ChevronRight } from 'lucide-react-native';
import React from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

/** The arrow of a dropdown: it points right when closed and turns down, smoothly, as it opens. */
export function RotatingChevron({ open, size = 24, color = '#0047AB' }: { open: boolean; size?: number; color?: string }) {
    const turn = useSharedValue(open ? 1 : 0);
    React.useEffect(() => {
        turn.value = withTiming(open ? 1 : 0, { duration: 220 });
    }, [open, turn]);
    const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 90}deg` }] }));
    return (
        <Animated.View style={style}>
            <ChevronRight size={size} color={color} />
        </Animated.View>
    );
}
