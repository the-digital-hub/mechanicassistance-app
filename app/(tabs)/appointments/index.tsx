import { AppointmentCard } from '@/components/ui/AppointmentCard';
import { Appointment, isCancelledStatus, useAppointments } from '@/context/AppointmentsContext';
import { ScrollPressGuardContext, useScrollPressGuard } from '@/hooks/useScrollPressGuard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDown, ArrowUp, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Text, TouchableOpacity, View } from 'react-native';

export default function AppointmentsScreen() {
    const { t } = useTranslation();
    const { getUpcoming, getPendingApproval, getPast, refresh, appointments: allAppointments } = useAppointments();
    const router = useRouter();
    const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
    const { scrollProps, guard } = useScrollPressGuard();

    const [activeTab, setActiveTab] = useState<'upcoming' | 'pending' | 'past'>('upcoming');
    const [pastFilter, setPastFilter] = useState<'completed' | 'cancelled'>('completed');
    // Per filter: newest first (desc, the default) or oldest first (asc).
    const [pastOrder, setPastOrder] = useState<Record<'completed' | 'cancelled', 'desc' | 'asc'>>({ completed: 'desc', cancelled: 'desc' });
    const [cancelModalVisible, setCancelModalVisible] = useState(false);
    const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

    // Arriving with ?tab=pending (e.g. right after a mechanic sends an offer) opens that tab once.
    useEffect(() => {
        if (tabParam === 'pending' || tabParam === 'upcoming' || tabParam === 'past') {
            setActiveTab(tabParam);
            router.setParams({ tab: undefined });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabParam]);

    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [])
    );

    const upcomingCount = getUpcoming().length;
    const pendingCount = getPendingApproval().length;
    const pastCount = getPast().length;
    const pastAll = getPast();
    const completedCount = pastAll.filter((a) => !isCancelledStatus(a.status)).length;
    const cancelledCount = pastAll.length - completedCount;
    // Default newest first: a finished job by when it ended, a cancelled one by when it was cancelled.
    const pastTime = (a: Appointment) => Date.parse((isCancelledStatus(a.status) ? a.cancelledAt : a.completedAt) ?? a.updatedAt ?? '') || 0;
    const pastShown = pastAll
        .filter((a) => (pastFilter === 'cancelled') === isCancelledStatus(a.status))
        .sort((a, b) => (pastOrder[pastFilter] === 'desc' ? pastTime(b) - pastTime(a) : pastTime(a) - pastTime(b)));
    const appointments = activeTab === 'upcoming'
        ? getUpcoming()
        : activeTab === 'pending'
            ? getPendingApproval()
            : pastShown;

    // The badge is a live summary, so it never repeats the title below it.
    const badgeLabel = upcomingCount > 0
        ? t('appointments.list.badgeStatus.active', { count: upcomingCount })
        : pendingCount > 0
            ? t('appointments.list.badgeStatus.pending', { count: pendingCount })
            : t('appointments.list.badgeStatus.caughtUp');

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
                        <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                          <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                          <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                            {badgeLabel}
                          </Text>
                        </View>

                        {/* Title */}
                        <Text className="text-gray-900 font-outfit-medium text-3xl">{t('appointments.list.title')}</Text>

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
                                            className="font-outfit-medium text-[13.5px]"
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

                        {/* Past has its own Completed / Cancelled selector, which says the same thing. */}
                        {activeTab !== 'past' && (
                            <Text className="font-outfit-regular text-[12.5px] mt-2.5" style={{ color: '#6B7490' }}>
                                {t(`appointments.list.hint.${activeTab}`)}
                            </Text>
                        )}

                        {activeTab === 'past' && (
                            <View className="flex-row justify-end" style={{ marginTop: 12, gap: 8 }}>
                                {([
                                    { key: 'completed', label: t('appointments.list.pastFilter.completed'), count: completedCount },
                                    { key: 'cancelled', label: t('appointments.list.pastFilter.cancelled'), count: cancelledCount },
                                ] as const).map((f) => {
                                    const on = pastFilter === f.key;
                                    const asc = pastOrder[f.key] === 'asc';
                                    const Arrow = asc ? ArrowUp : ArrowDown;
                                    const color = on ? '#1E56E3' : '#6B7490';
                                    return (
                                        // The whole pill is the button: a first tap selects it, tapping the
                                        // selected one flips its order (the arrow only shows which way it goes).
                                        <TouchableOpacity
                                            key={f.key}
                                            onPress={() => {
                                                if (on) {
                                                    setPastOrder((prev) => ({ ...prev, [f.key]: prev[f.key] === 'desc' ? 'asc' : 'desc' }));
                                                } else {
                                                    setPastFilter(f.key);
                                                }
                                            }}
                                            activeOpacity={0.7}
                                            className="flex-row items-center"
                                            style={{ gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: on ? '#EAF1FF' : 'transparent' }}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: on }}
                                            accessibilityLabel={`${f.label}, ${asc ? t('appointments.list.sort.oldestFirst') : t('appointments.list.sort.newestFirst')}`}
                                        >
                                            <Text className="font-outfit-medium text-[13px]" style={{ color }}>
                                                {f.label} · {f.count}
                                            </Text>
                                            <Arrow size={14} color={color} />
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
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
                        <Text className="font-outfit-medium text-[14.5px]" style={{ color: '#0B1530' }}>{activeTab === 'upcoming'
                            ? t('appointments.list.noUpcoming')
                            : activeTab === 'pending'
                                ? t('appointments.list.noPendingApproval')
                                : pastFilter === 'cancelled'
                                    ? t('appointments.list.noCancelled')
                                    : t('appointments.list.noCompleted')}</Text>
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
