import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/** The brand blues, top to bottom. The native splash image (assets/images/splash-bg.png) uses the same stops. */
export const BRAND_GRADIENT = ['#2459DB', '#1840A8', '#0D2D86'] as const;

/**
 * Brand backdrop: one soft blue gradient, no lights. Shared by the splash and
 * the signed-out screens so the hand-off between them is seamless.
 */
export function MeshBackground({ children }: { children?: React.ReactNode }) {
    return (
        <View style={StyleSheet.absoluteFill}>
            <LinearGradient
                colors={BRAND_GRADIENT}
                locations={[0, 0.55, 1]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            {children}
        </View>
    );
}
