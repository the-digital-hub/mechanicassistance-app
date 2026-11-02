import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface VehicleFormSectionProps {
    title: string;
    /** One line under the title, e.g. why the section matters. */
    hint?: string;
    open: boolean;
    onToggle: () => void;
    /** Marks the header when a field inside fails validation. */
    hasError?: boolean;
    children: ReactNode;
}

/** A collapsible card grouping the fields of one part of the vehicle form. */
export function VehicleFormSection({ title, hint, open, onToggle, hasError, children }: VehicleFormSectionProps) {
    return (
        <View
            className="bg-white rounded-2xl mb-4"
            style={{
                borderWidth: 1,
                borderColor: hasError ? '#FCA5A5' : '#E5E7EB',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 2,
            }}
        >
            <TouchableOpacity
                onPress={onToggle}
                activeOpacity={0.7}
                className="flex-row items-center justify-between px-4 py-4"
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
            >
                <View className="flex-1 pr-3">
                    <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest uppercase">{title}</Text>
                    {hint ? <Text className="text-gray-500 font-outfit-regular text-xs mt-1">{hint}</Text> : null}
                </View>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#0047AB" />
            </TouchableOpacity>
            {open ? <View className="px-4 pb-4 gap-4">{children}</View> : null}
        </View>
    );
}
