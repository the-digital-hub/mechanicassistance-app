import { Check } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { OwnerSheet } from '@/components/dashboard/OwnerHomeBlocks';
import { TYPE } from '@/lib/ui/type';

export type StatusId = 'available' | 'busy' | 'offline';

const C = { blue: '#1E56E3', blueSofter: '#F4F8FF', text: '#0B1530', muted: '#6B7490', border: '#E4EAF5' };
const DOT: Record<StatusId, { color: string; bg: string }> = {
    available: { color: '#10B981', bg: '#E6F7EF' },
    busy: { color: '#F97316', bg: '#FFF1E6' },
    offline: { color: '#9CA3AF', bg: '#F1F3F7' },
};

/**
 * The technician's "Change your status" sheet (Available / Busy / Offline), one for every screen that offers it: the same sheet
 * as the other pickers (the dim fades in, the panel slides up) and the same option cards as "Switch role".
 */
export function MechanicStatusSheet({ visible, title, current, options, onPick, onClose }: {
    visible: boolean;
    title: string;
    current: StatusId;
    options: { id: StatusId; label: string; description: string }[];
    onPick: (id: StatusId) => void;
    onClose: () => void;
}) {
    return (
        <OwnerSheet visible={visible} title={title} onClose={onClose}>
            <View style={{ gap: 10 }} testID="status-sheet">
                {options.map((o) => {
                    const on = o.id === current;
                    return (
                        <TouchableOpacity
                            key={o.id}
                            onPress={() => {
                                onPick(o.id);
                                onClose();
                            }}
                            activeOpacity={0.8}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: on }}
                            testID={`status-option-${o.id}`}
                            className="flex-row items-center"
                            style={{ gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 16, backgroundColor: on ? C.blueSofter : '#FFFFFF', borderWidth: on ? 1.5 : 1, borderColor: on ? C.blue : C.border }}
                        >
                            <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: DOT[o.id].bg }}>
                                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: DOT[o.id].color }} />
                            </View>
                            <View className="flex-1">
                                <Text className="font-outfit-bold" style={{ ...TYPE.question, color: C.text }}>{o.label}</Text>
                                <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: C.muted, marginTop: 2 }}>{o.description}</Text>
                            </View>
                            <View className="items-center justify-center" style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: on ? C.blue : 'transparent', borderWidth: on ? 0 : 1.5, borderColor: C.border }}>
                                {on ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </OwnerSheet>
    );
}
