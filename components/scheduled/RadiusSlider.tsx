import { TYPE } from '@/lib/ui/type';
import { MapPin } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';

import { MAX_RADIUS_MILES, MIN_RADIUS_MILES } from '@/lib/scheduled/draft';
import { CARD_STYLE, SC } from './ui';

const THUMB = 24;

/** Miles from a touch position along the track, clamped to the slider's range. */
export function milesAt(x: number, width: number): number {
    if (width <= THUMB) return MIN_RADIUS_MILES;
    // The thumb's centre travels between half a thumb from each end.
    const pct = Math.min(1, Math.max(0, (x - THUMB / 2) / (width - THUMB)));
    return Math.round(MIN_RADIUS_MILES + pct * (MAX_RADIUS_MILES - MIN_RADIUS_MILES));
}

/** Search radius for repair shops: a map-like preview whose circle grows with the value, and a drag slider. */
export function RadiusSlider({ value, onChange, label, unit }: { value: number; onChange: (miles: number) => void; label: string; unit: string }) {
    const trackRef = useRef<View>(null);
    const left = useRef(0);
    const width = useRef(0);
    const [w, setW] = useState(0);

    const pct = (value - MIN_RADIUS_MILES) / (MAX_RADIUS_MILES - MIN_RADIUS_MILES);
    const circle = 64 + pct * 56;

    const pan = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderTerminationRequest: () => false,
                onPanResponderGrant: (e) => {
                    trackRef.current?.measureInWindow((x) => {
                        left.current = x;
                    });
                    // First touch: the position inside the track is known right away.
                    onChange(milesAt(e.nativeEvent.locationX, width.current));
                },
                onPanResponderMove: (_e, g) => onChange(milesAt(g.moveX - left.current, width.current)),
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [onChange],
    );

    return (
        <View style={{ ...CARD_STYLE, padding: 14 }}>
            <View className="items-center justify-center" style={{ height: 104, borderRadius: 14, overflow: 'hidden', backgroundColor: '#E4ECFB', borderWidth: 1, borderColor: '#DCE7FA' }}>
                <View style={{ position: 'absolute', left: 0, right: 0, top: 44, height: 3, backgroundColor: '#FFFFFF', opacity: 0.9, transform: [{ rotate: '-4deg' }] }} />
                <View style={{ position: 'absolute', top: 0, bottom: 0, left: '40%', width: 3, backgroundColor: '#FFFFFF', opacity: 0.9, transform: [{ rotate: '8deg' }] }} />
                <View style={{ width: circle, height: circle, borderRadius: circle / 2, backgroundColor: 'rgba(30,86,227,0.16)', borderWidth: 2, borderColor: SC.blue }} />
                <View style={{ position: 'absolute' }}>
                    <MapPin size={24} color={SC.blue} fill="#FFFFFF" />
                </View>
            </View>
            <View className="flex-row items-baseline justify-between" style={{ marginTop: 14 }}>
                <Text className="font-outfit-semibold" style={{ ...TYPE.helper, color: SC.muted }}>{label}</Text>
                <Text>
                    <Text className="font-outfit-bold" style={{ fontSize: 24, letterSpacing: -0.6, color: SC.blueDark }}>{value}</Text>
                    <Text className="font-outfit-bold" style={{ ...TYPE.helper, color: SC.muted }}>{` ${unit}`}</Text>
                </Text>
            </View>
            <View
                ref={trackRef}
                onLayout={(e) => {
                    width.current = e.nativeEvent.layout.width;
                    setW(e.nativeEvent.layout.width);
                }}
                accessibilityRole="adjustable"
                accessibilityLabel={label}
                accessibilityValue={{ min: MIN_RADIUS_MILES, max: MAX_RADIUS_MILES, now: value }}
                accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                onAccessibilityAction={(e) => onChange(Math.min(MAX_RADIUS_MILES, Math.max(MIN_RADIUS_MILES, value + (e.nativeEvent.actionName === 'increment' ? 5 : -5))))}
                // A tall target: the drag starts anywhere in this band, not only on the thin line.
                style={{ height: 56, justifyContent: 'center', marginTop: 0 }}
                {...pan.panHandlers}
            >
                <View pointerEvents="none" style={{ height: 4, borderRadius: 4, backgroundColor: SC.blueSoft }} />
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, width: `${pct * 100}%`, height: 4, borderRadius: 4, backgroundColor: SC.blue }} />
                <View
                    pointerEvents="none"
                    style={{ position: 'absolute', left: Math.max(0, pct * (w - THUMB)), width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: SC.blue, shadowColor: SC.blue, shadowOpacity: 0.35, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 3 }}
                />
            </View>
        </View>
    );
}
