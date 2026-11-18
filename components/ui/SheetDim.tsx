import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * The dimmed backdrop of a bottom sheet, covering the whole screen. Put it first inside the Modal: if the dim were
 * only the tappable area above the sheet, the corners beside the sheet's rounded top would show the page undimmed.
 */
export function SheetDim({ color = 'rgba(11,21,48,0.45)' }: { color?: string }) {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color }]} />;
}
