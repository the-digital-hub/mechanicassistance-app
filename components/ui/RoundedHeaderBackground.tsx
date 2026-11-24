import { PAGE_BG, ROUNDED_HEADER } from '@/lib/ui/header';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/** How far the fade reaches below the header (the tab bar's fade, upside down). */
const FADE_HEIGHT = 15;

/**
 * Background of the native header: the rounded, lifted surface of lib/ui/header.ts (`headerBackground`). It fills the header, so its own
 * height is the header's real height (it reports it, the screens start from there). Under its lower edge the page melts away: what scrolls
 * up under the header fades out instead of being cut off by a line.
 */
export function RoundedHeaderBackground({ onHeight }: { onHeight?: (height: number) => void }) {
    return (
        <View style={[StyleSheet.absoluteFill, ROUNDED_HEADER, { marginBottom: 0 }]} onLayout={(e) => onHeight?.(e.nativeEvent.layout.height)}>
            <LinearGradient
                pointerEvents="none"
                colors={['rgba(246,248,252,0.95)', 'rgba(246,248,252,0.55)', 'rgba(246,248,252,0)']}
                locations={[0, 0.45, 1]}
                style={{ position: 'absolute', top: '100%', left: 0, right: 0, height: FADE_HEIGHT }}
            />
        </View>
    );
}
