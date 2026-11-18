import React from 'react';
import { View } from 'react-native';

/** The small grab bar at the top of a bottom sheet. */
export function SheetHandle() {
    return <View className="self-center" style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#DCE3F0', marginBottom: 14 }} />;
}
