import { ROUNDED_HEADER } from '@/lib/ui/header';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Background of the native header: the rounded, lifted surface of lib/ui/header.ts (`headerBackground`). It fills the header, so its own
 * height is the header's real height (it reports it, the screens start from there).
 */
export function RoundedHeaderBackground({ onHeight }: { onHeight?: (height: number) => void }) {
    return <View style={[StyleSheet.absoluteFill, ROUNDED_HEADER, { marginBottom: 0 }]} onLayout={(e) => onHeight?.(e.nativeEvent.layout.height)} />;
}
