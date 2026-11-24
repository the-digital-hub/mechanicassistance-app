import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Image as SvgImage, Mask, RadialGradient, Stop } from 'react-native-svg';

import { MeshBackground } from './MeshBackground';

const { width } = Dimensions.get('window');
const RING = 150; // isologo size on screen
// Clock-wipe mask: a circle whose stroke is as wide as its radius fills the whole disk as it is "drawn".
const MASK_R = RING / 4;
const CIRC = 2 * Math.PI * MASK_R;
const WORD_W = Math.min(width * 0.72, 300);
const WORD_H = WORD_W * (51 / 947);
const WORD_GAP = 28;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Brand splash shown once at launch: the isologo draws itself with a circular sweep,
 * then settles with a soft pulse of light, the name rises underneath and
 * the whole thing fades out. `onReady` fires when it is first laid out (hide
 * the native splash then, so the hand-off has no white flash); `onFinish`
 * when it has faded away.
 */
export function AnimatedSplash({ onReady, onFinish }: { onReady?: () => void; onFinish: () => void }) {
    const trace = useRef(new Animated.Value(0)).current;
    const mark = useRef(new Animated.Value(0)).current;
    const word = useRef(new Animated.Value(0)).current;
    const pulse = useRef(new Animated.Value(0)).current;
    const out = useRef(new Animated.Value(1)).current;
    const zoom = useRef(new Animated.Value(0)).current;
    const started = useRef(false);

    const start = () => {
        if (started.current) return;
        started.current = true;
        onReady?.();
        Animated.sequence([
            Animated.parallel([
                Animated.timing(trace, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
                Animated.spring(mark, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
                Animated.sequence([
                    Animated.delay(850),
                    Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                ]),
                Animated.sequence([
                    Animated.delay(1000),
                    Animated.timing(word, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                ]),
            ]),
            Animated.delay(450),
            // No travelling: the logo eases slightly toward the viewer while everything dissolves.
            Animated.parallel([
                Animated.timing(out, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
                Animated.timing(zoom, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]),
        ]).start(({ finished }) => finished && onFinish());
    };

    useEffect(() => {
        // Safety net: never leave the overlay up if layout never fires.
        const id = setTimeout(start, 800);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const dashOffset = trace.interpolate({ inputRange: [0, 1], outputRange: [CIRC, 0] });

    return (
        <Animated.View pointerEvents="auto" style={[StyleSheet.absoluteFill, { opacity: out, zIndex: 999 }]} onLayout={start}>
            <MeshBackground />
            <Animated.View style={[styles.center, { transform: [{ scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) }] }]} pointerEvents="none">
                {/* Pulse of light behind the mark */}
                <Animated.View
                    style={[
                        styles.pulse,
                        {
                            opacity: pulse.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.7, 0] }),
                            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.2] }) }],
                        },
                    ]}
                >
                    <Svg width={220} height={220}>
                        <Defs>
                            <RadialGradient id="pulseGlow" cx="50%" cy="50%" r="50%">
                                <Stop offset="0%" stopColor="#8CF1E9" stopOpacity={0.9} />
                                <Stop offset="60%" stopColor="#8CF1E9" stopOpacity={0.25} />
                                <Stop offset="100%" stopColor="#8CF1E9" stopOpacity={0} />
                            </RadialGradient>
                        </Defs>
                        <Circle cx={110} cy={110} r={110} fill="url(#pulseGlow)" />
                    </Svg>
                </Animated.View>
                <Animated.View
                    style={{
                        width: RING,
                        height: RING,
                        transform: [{ scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
                    }}
                >
                    <Svg width={RING} height={RING}>
                        <Defs>
                            <Mask id="sweep" x="0" y="0" width={RING} height={RING} maskUnits="userSpaceOnUse">
                                <AnimatedCircle
                                    cx={RING / 2}
                                    cy={RING / 2}
                                    r={MASK_R}
                                    stroke="#FFFFFF"
                                    strokeWidth={RING / 2}
                                    fill="none"
                                    strokeDasharray={`${CIRC} ${CIRC}`}
                                    strokeDashoffset={dashOffset}
                                    rotation={-90}
                                    origin={`${RING / 2}, ${RING / 2}`}
                                />
                            </Mask>
                        </Defs>
                        <SvgImage
                            href={require('@/assets/images/brand_ring_white.png')}
                            x={0}
                            y={0}
                            width={RING}
                            height={RING}
                            preserveAspectRatio="xMidYMid meet"
                            mask="url(#sweep)"
                        />
                    </Svg>
                </Animated.View>
                <Animated.Image
                    source={require('@/assets/images/brand_wordmark_white.png')}
                    style={{
                        width: WORD_W,
                        height: WORD_H,
                        marginTop: WORD_GAP,
                        opacity: word,
                        transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
                    }}
                    resizeMode="contain"
                />
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
    pulse: {
        position: 'absolute',
        width: 220,
        height: 220,
    },
});
