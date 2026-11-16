import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

interface BlobProps {
    size: number;
    color: string;
    opacity: number;
    left: number;
    top: number;
    driftX: number;
    driftY: number;
    duration: number;
    delay?: number;
}

/** A soft radial light that drifts slowly back and forth. */
function Blob({ size, color, opacity, left, top, driftX, driftY, duration, delay = 0 }: BlobProps) {
    const t = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(t, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                Animated.timing(t, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [t, duration, delay]);

    const id = `g-${color.replace('#', '')}-${size}`;
    return (
        <Animated.View
            pointerEvents="none"
            style={{
                position: 'absolute',
                left,
                top,
                width: size,
                height: size,
                transform: [
                    { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, driftX] }) },
                    { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, driftY] }) },
                    { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
                ],
            }}
        >
            <Svg width={size} height={size}>
                <Defs>
                    <RadialGradient id={id} cx="50%" cy="50%" r="50%">
                        <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
                        <Stop offset="55%" stopColor={color} stopOpacity={opacity * 0.35} />
                        <Stop offset="100%" stopColor={color} stopOpacity={0} />
                    </RadialGradient>
                </Defs>
                <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
            </Svg>
        </Animated.View>
    );
}

/**
 * Brand backdrop: a deep blue base with soft cyan / violet / blue lights that
 * drift slowly (a "mesh gradient"). Shared by the splash and the onboarding so
 * the hand-off between them is seamless.
 */
export function MeshBackground({ children }: { children?: React.ReactNode }) {
    return (
        <View style={StyleSheet.absoluteFill}>
            <LinearGradient
                colors={['#1E56E3', '#0B2A8E', '#061A66']}
                locations={[0, 0.55, 1]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <Blob size={width * 1.3} color="#4FC3F7" opacity={0.55} left={-width * 0.5} top={-height * 0.08} driftX={60} driftY={40} duration={7000} />
            <Blob size={width * 1.2} color="#7C5CFF" opacity={0.5} left={width * 0.25} top={height * 0.55} driftX={-70} driftY={-50} duration={8500} delay={800} />
            <Blob size={width * 1.0} color="#3D8BFF" opacity={0.5} left={width * 0.3} top={height * 0.12} driftX={-40} driftY={60} duration={9500} delay={400} />
            <Blob size={width * 0.8} color="#8CF1E9" opacity={0.32} left={-width * 0.25} top={height * 0.62} driftX={50} driftY={-30} duration={10000} delay={1200} />
            {children}
        </View>
    );
}
