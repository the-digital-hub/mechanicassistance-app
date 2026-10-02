import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** White rounded card that groups DetailRows. */
export function DetailCard({ children }: { children: React.ReactNode }) {
    return (
        <View
            className="bg-white"
            style={{
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#EEF2FA',
                shadowColor: '#0E2F8A',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.06,
                shadowRadius: 14,
                elevation: 2,
            }}
        >
            {children}
        </View>
    );
}

interface DetailRowProps {
    icon: IconName;
    label: string;
    value: React.ReactNode;
    last?: boolean;
}

/** Icon tile + uppercase label + bold value, separated by a hairline. */
export function DetailRow({ icon, label, value, last }: DetailRowProps) {
    return (
        <View
            className="flex-row items-center gap-3 px-4 py-3"
            style={last ? undefined : { borderBottomWidth: 1, borderBottomColor: '#EEF2FA' }}
        >
            <View
                className="items-center justify-center"
                style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: '#EAF1FF' }}
            >
                <Ionicons name={icon} size={18} color="#1E56E3" />
            </View>
            <View className="flex-1">
                <Text className="font-outfit-medium text-[11px] uppercase mb-0.5" style={{ color: '#6B7490' }}>
                    {label}
                </Text>
                <Text className="font-outfit-bold text-[15px] leading-5" style={{ color: '#0B1530' }}>
                    {value}
                </Text>
            </View>
        </View>
    );
}
