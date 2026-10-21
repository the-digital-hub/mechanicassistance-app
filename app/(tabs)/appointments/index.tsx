import { AppointmentCard } from '@/components/ui/AppointmentCard';
import { useAppointments } from '@/context/AppointmentsContext';
import { ScrollPressGuardContext, useScrollPressGuard } from '@/hooks/useScrollPressGuard';
import { useFocusEffect, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Text, TouchableOpacity, View } from 'react-native';

export default function AppointmentsScreen() {
    const { t } = useTranslation();
    const { getUpcoming, getPendingApproval, getPast, refresh, appointments: allAppointments } = useAppointments();
    const router = useRouter();
    const { scrollProps, guard } = useScrollPressGuard();

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
        <ScrollPressGuardContext.Provider value={guard}>
        <View className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
            <FlatList
                {...scrollProps}
                data={appointments}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={
                    <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 }}>
                        {/* Section Badge */}
                        <View className="flex-row items-center rounded-full" style={{ gap: 6, marginBottom: 12, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#EAF1FF', alignSelf: 'flex-start' }}>
                          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#1E56E3' }} />
                          <Text className="font-outfit-bold text-[10.5px]" style={{ color: '#1E56E3', letterSpacing: 1.3 }}>
                            {t('appointments.list.badge')}
                          </Text>
                        </View>

                        {/* Title */}
                        <Text className="font-outfit-bold text-[26px]" style={{ color: '#0B1530', letterSpacing: -0.7, lineHeight: 29 }}>{t('appointments.list.title')}</Text>

                        {/* Tab Switcher */}
                        <View className="flex-row" style={{ marginTop: 16, gap: 4, padding: 4, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4EAF5' }}>
                            {([
                                { key: 'upcoming', label: t('appointments.list.upcoming'), count: upcomingCount },
                                { key: 'pending', label: t('appointments.list.pendingApproval'), count: pendingCount },
                                { key: 'past', label: t('appointments.list.past'), count: pastCount },
                            ] as const).map((tab) => {
                                const isActive = activeTab === tab.key;
                                // Pending asks for a decision: its count stays red while unselected.
                                const badgeBg = isActive ? 'rgba(255,255,255,0.22)' : tab.key === 'pending' ? '#E53E3E' : '#E4EAF5';
                                const badgeFg = isActive || tab.key === 'pending' ? '#FFFFFF' : '#6B7490';
                                return (
                                    <TouchableOpacity
                                        key={tab.key}
                                        className="flex-1 flex-row items-center justify-center"
                                        style={{
                                            gap: 6,
                                            paddingVertical: 10,
                                            paddingHorizontal: 4,
                                            borderRadius: 11,
                                            backgroundColor: isActive ? '#1E56E3' : 'transparent',
                                            ...(isActive && { shadowColor: '#1E56E3', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 }),
                                        }}
                                        onPress={() => setActiveTab(tab.key)}
                                    >
                                        <Text
                                            className="font-outfit-bold text-[13.5px]"
                                            numberOfLines={1}
                                            style={{ color: isActive ? '#FFFFFF' : '#6B7490' }}
                                        >
                                            {tab.label}
                                        </Text>
                                        {tab.count > 0 && (
                                            <View style={{ minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: badgeBg, justifyContent: 'center', alignItems: 'center' }}>
                                                <Text className="font-outfit-bold text-[10.5px]" style={{ color: badgeFg, lineHeight: 13 }}>{tab.count}</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <Text className="font-outfit-regular text-[12.5px] mt-2.5" style={{ color: '#6B7490' }}>
                            {t(`appointments.list.hint.${activeTab}`)}
                        </Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View
                        style={{
                            paddingHorizontal: 20,
                            marginBottom: 14,
                            shadowColor: '#0E2F8A',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.06,
                            shadowRadius: 14,
                            elevation: 3,
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
                        <Text className="font-outfit-bold text-[14.5px]" style={{ color: '#0B1530' }}>{activeTab === 'upcoming'
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
        </ScrollPressGuardContext.Provider>
    );
}
