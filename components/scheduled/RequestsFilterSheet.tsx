import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import { SlideModal } from '@/components/ui/SlideModal';
import { SHEET } from '@/lib/ui/sheet';
import { TYPE } from '@/lib/ui/type';

const C = { blue: '#1E56E3', soft: '#EAF1FF', text: '#0B1530', muted: '#6B7490' };

export interface FilterOption {
    id: string;
    label: string;
    /** How many it has; left out when the option is an order, not a kind. */
    count?: number;
}

/**
 * The options of the new-requests list in a sheet from below (the same pattern as the Appointments and earnings filters): the kind of
 * request as pills with how many each has, applied together with "Apply" and cleared with "Clear".
 */
export function RequestsFilterSheet({ visible, onClose, options, value, onApply, title, defaultId = 'all' }: {
    visible: boolean;
    onClose: () => void;
    options: FilterOption[];
    value: string;
    onApply: (id: string) => void;
    /** The name of the section ("Type of request", "Order"). */
    title?: string;
    /** What "Clear" goes back to. */
    defaultId?: string;
}) {
    const { t } = useTranslation();
    const { height } = useWindowDimensions();
    const [draft, setDraft] = React.useState(value);
    React.useEffect(() => {
        if (visible) setDraft(value);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    return (
        <SlideModal visible={visible} onClose={onClose}>
            <View style={{ ...SHEET, paddingTop: 16 }} testID="requests-filter-sheet">
                <View className="flex-row items-center justify-between" style={{ paddingHorizontal: 20 }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 22, letterSpacing: -0.4, color: C.text }}>{t('appointments.filters.sheetTitle')}</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" className="items-center justify-center" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#EEF1F6' }}>
                        <X size={16} color="#4B5563" />
                    </TouchableOpacity>
                </View>
                <ScrollView style={{ flexGrow: 0, maxHeight: height * 0.6 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
                    <Text className="font-outfit-bold" style={{ ...TYPE.question, color: C.text, marginTop: 18, marginBottom: 10 }}>{title ?? t('assist.typeTitle')}</Text>
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                        {options.map((o) => {
                            const on = draft === o.id;
                            return (
                                <TouchableOpacity
                                    key={o.id}
                                    onPress={() => setDraft(o.id)}
                                    activeOpacity={0.8}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: on }}
                                    className="flex-row items-center"
                                    style={{ gap: 8, minHeight: 40, paddingHorizontal: 14, borderRadius: 100, backgroundColor: on ? C.blue : C.soft }}
                                    testID={`requests-filter-${o.id}`}
                                >
                                    <Text className="font-outfit-bold" style={{ fontSize: 14, color: on ? '#FFFFFF' : C.blue }}>{o.label}</Text>
                                    {o.count !== undefined ? <Text className="font-outfit-bold" style={{ fontSize: 14, color: on ? 'rgba(255,255,255,0.8)' : C.muted }}>{o.count}</Text> : null}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </ScrollView>

                {/* Stacked: the action on top, the way out under it. */}
                <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 30, gap: 8 }}>
                    <TouchableOpacity onPress={() => onApply(draft)} activeOpacity={0.85} accessibilityRole="button" testID="requests-filter-apply">
                        <LinearGradient colors={['#2B66F8', '#081E72']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                            <Text className="font-outfit-bold text-white" style={TYPE.button}>{t('appointments.filters.apply')}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setDraft(defaultId)}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        className="items-center justify-center"
                        style={{ minHeight: 56, borderRadius: 14, backgroundColor: '#E6EAF2' }}
                        testID="requests-filter-clear"
                    >
                        <Text className="font-outfit-bold" style={{ ...TYPE.button, color: '#4A5470' }}>{t('appointments.filters.clear')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SlideModal>
    );
}
