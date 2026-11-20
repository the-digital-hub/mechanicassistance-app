import { ROUNDED_HEADER } from '@/lib/ui/header';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/** Background of the native header: the rounded, lifted surface of lib/ui/header.ts (`headerBackground`). */
export function RoundedHeaderBackground() {
    return <View style={[StyleSheet.absoluteFill, ROUNDED_HEADER]} />;
}
