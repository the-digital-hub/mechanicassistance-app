import { AppointmentCard } from '@/components/ui/AppointmentCard';
import { useAppointments } from '@/context/AppointmentsContext';
import { useFocusEffect, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Text, TouchableOpacity, View } from 'react-native';

export default function AppointmentsScreen() {
    const { t } = useTranslation();
    const { getUpcoming, getPendingApproval, getPast, refresh, appointments: allAppointments } = useAppointments();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<'upcoming' | 'pending' | 'past'>('upcoming');
    const [cancelModalVisible, setCancelModalVisible] = useState(false);
    const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [])
    );

    const upcomingCount = getUpcoming().length;
    const pendingCount = getPendingApproval().length;
    const pastCount = getPast().length;
    const appointments = activeTab === 'upcoming'
        ? getUpcoming()
        : activeTab === 'pending'
            ? getPendingApproval()
            : getPast();

    const handleCancelRequest = (id: string) => {
        setSelectedAppointmentId(id);
        setCancelModalVisible(true);
    };

    const confirmCancel = () => {
        setCancelModalVisible(false);
        if (selectedAppointmentId) {
            router.push({
                pathname: '/appointments/cancel-reason' as any,
                params: { id: selectedAppointmentId }
            });
        }
    };

    return (
        <View className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
            <FlatList
                data={appointments}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={
                    <View className="px-6 pt-4 pb-4">
                        {/* Section Badge */}
                        <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                          <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                          <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                            {t('appointments.list.badge')}
                          </Text>
                        </View>

                        {/* Title */}
                        <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">{t('appointments.list.title')}</Text>

                        {/* Subtitle */}
                        <Text className="text-gray-500 font-outfit-regular text-base mb-6">
                          {t('appointments.list.subtitle')}
                        </Text>

                        {/* Tab Switcher */}
                        <View className="flex-row gap-2 p-1 rounded-2xl" style={{ backgroundColor: '#EDF1F7' }}>
                            {([
                                { key: 'upcoming', label: t('appointments.list.upcoming'), count: upcomingCount },
                                { key: 'pending', label: t('appointments.list.pendingApproval'), count: pendingCount },
                                { key: 'past', label: t('appointments.list.past'), count: pastCount },
                            ] as const).map((tab) => {
                                const isActive = activeTab === tab.key;
                                return (
                                    <TouchableOpacity
                                        key={tab.key}
                                        className="flex-1 flex-row items-center justify-center gap-1.5 py-3 px-1 rounded-xl"
                                        style={{ backgroundColor: isActive ? '#FFFFFF' : 'transparent' }}
                                        onPress={() => setActiveTab(tab.key)}
                                    >
                                        <Text
                                            className="font-outfit-bold text-sm"
                                            numberOfLines={1}
                                            style={{ color: isActive ? '#1E56E3' : '#9CA3AF' }}
                                        >
                                            {tab.label}
                                        </Text>
                                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: isActive ? '#1E56E3' : '#E5E7EB', justifyContent: 'center', alignItems: 'center' }}>
                                            <Text className="font-outfit-bold text-[11px]" style={{ color: isActive ? '#FFFFFF' : '#9CA3AF', lineHeight: 14 }}>{tab.count}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                }
                renderItem={({ item }) => (
                    <View
                        className="px-6 mb-4"
                        style={{
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.12,
                            shadowRadius: 8,
                            elevation: 6,
                        }}
                    >
                        <AppointmentCard
                            appointment={item}
                            onCancel={handleCancelRequest}
                        />
                    </View>
                )}
                contentContainerStyle={{ paddingBottom: 20 }}
                ListEmptyComponent={
                    <View className="items-center justify-center py-10">
                        <Text className="text-gray-400 font-outfit-medium">{activeTab === 'upcoming'
                            ? t('appointments.list.noUpcoming')
                            : activeTab === 'pending'
                                ? t('appointments.list.noPendingApproval')
                                : t('appointments.list.noPast')}</Text>
                    </View>
                }
            />

            {/* Cancel Confirmation Modal */}
            <Modal
                transparent={true}
                visible={cancelModalVisible}
                animationType="fade"
                onRequestClose={() => setCancelModalVisible(false)}
            >
                <View className="flex-1 justify-center items-center bg-black/40 px-6">
                    <View className="bg-white rounded-2xl w-full p-6 items-center shadow-lg">
                        <View className="w-16 h-16 rounded-full border-2 border-red-500 items-center justify-center mb-4">
                            <X size={32} color="#EF4444" />
                        </View>

                        <Text className="text-xl font-outfit-bold text-blue-900 mb-2">{t('appointments.list.cancelModalTitle')}</Text>
                        <Text className="text-gray-500 text-center font-outfit-regular mb-6">
                            {t('appointments.list.cancelModalMessage')}
                        </Text>

                        <View className="flex-row gap-4 w-full">
                            <TouchableOpacity
                                className="flex-1 py-3 border border-gray-200 rounded-lg"
                                onPress={() => setCancelModalVisible(false)}
                            >
                                <Text className="text-center font-outfit-bold text-gray-700">{t('appointments.list.no')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 py-3 bg-blue-700 rounded-lg"
                                onPress={confirmCancel}
                            >
                                <Text className="text-center font-outfit-bold text-white">{t('appointments.list.yesCancel')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
