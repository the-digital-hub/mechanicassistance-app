import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

/** The segmented selector of the wallet (same look as the vehicle owner's Activity / Payments / Cards): one thing at a time under the totals. */
export function EarningsTabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
    return (
        <View className="flex-row" style={{ marginBottom: 16, padding: 4, borderRadius: 16, backgroundColor: '#EEF2FA' }} accessibilityRole="tablist">
            {tabs.map((item) => {
                const on = value === item.id;
                return (
                    <TouchableOpacity
                        key={item.id}
                        onPress={() => onChange(item.id)}
                        activeOpacity={0.8}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: on }}
                        className="flex-1 items-center justify-center"
                        style={on
                            ? { minHeight: 46, borderRadius: 12, backgroundColor: '#FFFFFF', shadowColor: '#0E2F8A', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }
                            : { minHeight: 46, borderRadius: 12 }}
                        testID={`earnings-tab-${item.id}`}
                    >
                        <Text className="font-outfit-bold" style={{ fontSize: 15, color: on ? '#0047AB' : '#8C96AE' }} numberOfLines={1}>{item.label}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}
