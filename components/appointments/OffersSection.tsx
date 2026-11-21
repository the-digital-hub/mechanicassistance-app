import { Zap } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AppointmentCard } from '@/components/ui/AppointmentCard';
import type { Appointment } from '@/context/AppointmentsContext';

/**
 * The assistances still in their offer period, pinned above the list: they are held for a limited time, so they come first, in their own
 * heading with a count and the cards (each with its clock), whatever else is filtered below.
 */
export function OffersSection({ appointments, isMechanic, onCancel }: {
    appointments: Appointment[];
    isMechanic: boolean;
    onCancel: (id: string) => void;
}) {
    const { t } = useTranslation();
    if (appointments.length === 0) return null;
    return (
        // No box around the cards (a card inside a card): the heading sits on the page and the offers are cards like the rest of the list.
        <View style={{ marginHorizontal: 20, marginBottom: 6, gap: 14 }} testID="offers-section">
            <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFEFC9' }}>
                    <Zap size={20} color="#8A5200" />
                </View>
                <View className="flex-1">
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                        <Text className="font-outfit-bold" style={{ fontSize: 17, lineHeight: 22, color: '#0B1530' }}>{t('appointments.filters.offersTitle')}</Text>
                        <View className="items-center justify-center" style={{ minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, backgroundColor: '#8A5200' }} testID="offers-count">
                            <Text className="font-outfit-bold" style={{ fontSize: 13, lineHeight: 16, color: '#FFFFFF' }}>{appointments.length}</Text>
                        </View>
                    </View>
                    <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: '#6B7490', marginTop: 1 }}>
                        {t(isMechanic ? 'appointments.filters.offersSubMechanic' : 'appointments.filters.offersSubOwner')}
                    </Text>
                </View>
            </View>
            {appointments.map((a) => (
                <AppointmentCard key={a.id} appointment={a} onCancel={onCancel} />
            ))}
        </View>
    );
}
