import { useAppointments } from '@/context/AppointmentsContext';
import { useSocket } from '@/context/SocketContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goBackOr } from '@/lib/navigation/goBackOr';
import { LinearGradient } from 'expo-linear-gradient';
import { Circle, Info } from 'lucide-react-native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { TYPE } from '@/lib/ui/type';

const REASON_IDS = [
    'noLongerAvailable',
    'tooFarAway',
    'acceptedAnotherJob',
    'vehicleIssue',
    'missingTools',
    'personalEmergency',
    'other',
];

export default function CancelReasonScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { id } = useLocalSearchParams();
    const { cancelAppointment } = useAppointments();
    const { clearChatHistory } = useSocket();
    const [selectedReason, setSelectedReason] = useState<string | null>(null);

    const REASONS = REASON_IDS.map((reasonId) => t(`appointments.cancelReason.reasons.${reasonId}`));

    const handleDone = async () => {
        if (selectedReason && id) {
            const appointmentId = Array.isArray(id) ? id[0] : id;
            await cancelAppointment(appointmentId, selectedReason);
            clearChatHistory(appointmentId);
            router.navigate('/(tabs)/appointments');
        }
    };

    return (
        <View className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                <View className="px-6 pt-4">
                    {/* Section Badge */}
                    <View style={{ marginTop: 18 }}>
                      <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                        <Text className="font-outfit-bold" style={{ ...TYPE.eyebrow, color: '#1E56E3' }}>
                            {t('appointments.cancelReason.badge')}
                        </Text>
                    </View>
                    </View>

                    {/* Title */}
                    <Text className="font-outfit-bold mb-2" style={{ fontSize: 26, lineHeight: 31, letterSpacing: -0.7, color: '#0B1530' }}>
                        {t('appointments.cancelReason.title')}
                    </Text>

                    {/* Subtitle */}
                    <Text className="font-outfit-regular mb-6" style={{ ...TYPE.helper, color: '#6B7490' }}>
                        {t('appointments.cancelReason.subtitle')}
                    </Text>

                    {/* Reasons List — one card, rows separated by thin dividers */}
                    <View className="bg-white rounded-2xl border border-gray-200 mb-6 overflow-hidden">
                        {REASONS.map((reason, index) => {
                            const selected = selectedReason === reason;
                            return (
                                <TouchableOpacity
                                    key={reason}
                                    onPress={() => setSelectedReason(reason)}
                                    activeOpacity={0.7}
                                    className={`px-4 flex-row items-center gap-3 ${selected ? 'bg-blue-50' : ''}`}
                                    style={[{ minHeight: 56 }, index > 0 ? { borderTopWidth: 1, borderTopColor: '#EEF2FA' } : null]}
                                >
                                    <Circle
                                        size={20}
                                        color={selected ? '#0047AB' : '#D1D5DB'}
                                        fill={selected ? '#0047AB' : 'transparent'}
                                    />
                                    <Text className="flex-1 font-outfit-medium" style={{ ...TYPE.option, color: selected ? '#0B2A8E' : '#0B1530' }}>
                                        {reason}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Buttons */}
                    <View className="gap-3">
                        {/* Cancel Request Button */}
                        <TouchableOpacity
                            onPress={handleDone}
                            disabled={!selectedReason}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={selectedReason ? ['#EF4444', '#DC2626'] : ['#FECACA', '#FECACA']}
                                start={{ x: 0, y: 1 }}
                                end={{ x: 1, y: 0 }}
                                style={{
                                    borderRadius: 14,
                                    minHeight: 54,
                                    paddingHorizontal: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: selectedReason ? 1 : 0.6,
                                }}
                            >
                                <Text className="text-white font-outfit-bold text-center" style={TYPE.button}>{t('appointments.list.cancelModalTitle')}</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Keep Request Button */}
                        <TouchableOpacity
                            onPress={() => goBackOr(router, '/(tabs)/appointments')}
                            activeOpacity={0.8}
                        >
                            <View
                                style={{
                                    borderRadius: 14,
                                    minHeight: 54,
                                    paddingHorizontal: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#EFF6FF',
                                }}
                            >
                                <Text className="font-outfit-bold text-center" style={{ ...TYPE.button, color: '#1E56E3' }}>{t('appointments.cancelReason.keepRequest')}</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Consequence, as a footnote under the buttons: quiet, but read before confirming. */}
                    <View className="flex-row items-start gap-2.5 mt-5 px-1">
                        <Info size={16} color="#8C96AE" style={{ marginTop: 2 }} />
                        <Text className="flex-1 font-outfit-regular" style={{ ...TYPE.helper, color: '#6B7490' }}>
                            {t('appointments.cancelReason.infoMessage')}
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
