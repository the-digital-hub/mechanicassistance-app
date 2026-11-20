import { RequestTypeTabs } from '@/components/dashboard/MechanicHomeBlocks';
import { AppointmentCard } from '@/components/ui/AppointmentCard';
import { Appointment, isCancelledStatus, useAppointments } from '@/context/AppointmentsContext';
import { useUser } from '@/context/UserContext';
import { useHiddenAppointments } from '@/hooks/useHiddenAppointments';
import { ScrollPressGuardContext, useScrollPressGuard } from '@/hooks/useScrollPressGuard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDown, ArrowUp, Trash2, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Text, TouchableOpacity, View } from 'react-native';
import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';

export default function AppointmentsScreen() {
    const { t } = useTranslation();
    const { getUpcoming, getPendingApproval, getPast, refresh, appointments: allAppointments } = useAppointments();
    const router = useRouter();
    const { user } = useUser();
    const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
    const { scrollProps, guard } = useScrollPressGuard();

    const [selectedTab, setSelectedTab] = useState<'upcoming' | 'pending' | 'past'>('upcoming');
    const [pastFilter, setPastFilter] = useState<'completed' | 'cancelled'>('completed');
    // Per filter: newest first (desc, the default) or oldest first (asc).
    const [pastOrder, setPastOrder] = useState<Record<'completed' | 'cancelled', 'desc' | 'asc'>>({ completed: 'desc', cancelled: 'desc' });
    const [cancelModalVisible, setCancelModalVisible] = useState(false);
    const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
    const { hidden, hide } = useHiddenAppointments(user?.id);
    const [removeId, setRemoveId] = useState<string | null>(null);

    // Arriving with ?tab=pending (e.g. right after a mechanic sends an offer) opens that tab once.
    useEffect(() => {
        if (tabParam === 'pending' || tabParam === 'upcoming' || tabParam === 'past') {
            setSelectedTab(tabParam);
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
    // A cancelled appointment the person removed is not shown (see useHiddenAppointments).
    const pastAll = getPast().filter((a) => !(hidden.has(a.id) && isCancelledStatus(a.status)));
    const pastCount = pastAll.length;
    const completedCount = pastAll.filter((a) => !isCancelledStatus(a.status)).length;
    const cancelledCount = pastAll.length - completedCount;
    // Default newest first: a finished job by when it ended, a cancelled one by when it was cancelled.
    const pastTime = (a: Appointment) => Date.parse((isCancelledStatus(a.status) ? a.cancelledAt : a.completedAt) ?? a.updatedAt ?? '') || 0;
    const pastShown = pastAll
        .filter((a) => (pastFilter === 'cancelled') === isCancelledStatus(a.status))
        .sort((a, b) => (pastOrder[pastFilter] === 'desc' ? pastTime(b) - pastTime(a) : pastTime(a) - pastTime(b)));
    // Only tabs that hold something are shown; if the selected one empties out, fall back to the first that has items.
    const tabs = ([
        { id: 'upcoming', label: t('appointments.list.upcoming'), count: upcomingCount },
        { id: 'pending', label: t('appointments.list.pendingApproval'), count: pendingCount, alert: true },
        { id: 'past', label: t('appointments.list.past'), count: pastCount },
    ] as const).filter((tab) => tab.count > 0);
    const activeTab = tabs.some((tab) => tab.id === selectedTab) ? selectedTab : tabs[0]?.id ?? 'upcoming';
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
                        <Text className="text-gray-900 font-outfit-medium text-3xl">{t(user?.role === 'mechanic' ? 'appointments.list.title' : 'appointments.list.titleOwner')}</Text>

                        {/* Tab Switcher: only tabs with items, each at its natural width */}
                        {tabs.length > 0 && (
                            <View style={{ marginTop: 16 }}>
                                <RequestTypeTabs tabs={tabs} selected={activeTab} onSelect={setSelectedTab} horizontalInset={40} />
                            </View>
                        )}

                        {/* Past has its own Completed / Cancelled selector, which says the same thing. */}
                        {activeTab !== 'past' && (
                            <Text className="font-outfit-regular text-[13px] mt-2.5" style={{ color: '#6B7490' }}>
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
                        {activeTab === 'past' && isCancelledStatus(item.status) ? (
                            <TouchableOpacity
                                onPress={() => setRemoveId(item.id)}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                className="flex-row items-center justify-center"
                                style={{ gap: 8, height: 44, borderTopWidth: 1, borderTopColor: '#EEF1F7' }}
                                testID={`remove-cancelled-${item.id}`}
                            >
                                <Trash2 size={18} color="#B4584F" />
                                <Text className="font-outfit-semibold" style={{ fontSize: 15, color: '#B4584F' }}>{t('appointments.list.removeCancelled')}</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                )}
                contentContainerStyle={{ paddingBottom: 20 }}
                ListEmptyComponent={
                    <View className="items-center justify-center py-10">
                        <Text className="font-outfit-medium text-[15px]" style={{ color: '#0B1530' }}>{activeTab === 'upcoming'
                            ? t('appointments.list.noUpcoming')
                            : activeTab === 'pending'
                                ? t('appointments.list.noPendingApproval')
                                : pastFilter === 'cancelled'
                                    ? t('appointments.list.noCancelled')
                                    : t('appointments.list.noCompleted')}</Text>
                    </View>
                }
            />

            {/* Remove a cancelled appointment from the list */}
            <Modal supportedOrientations={MODAL_ORIENTATIONS} transparent visible={removeId !== null} animationType="fade" onRequestClose={() => setRemoveId(null)}>
                <View className="flex-1 justify-center items-center bg-black/40 px-6">
                    <View className="bg-white rounded-2xl w-full p-6 items-center shadow-lg">
                        <Text className="text-xl font-outfit-bold text-blue-900 mb-2 text-center">{t('appointments.list.removeTitle')}</Text>
                        <Text className="text-gray-500 text-center font-outfit-regular mb-6" style={{ fontSize: 16 }}>{t('appointments.list.removeMessage')}</Text>
                        <View className="flex-row gap-4 w-full">
                            <TouchableOpacity className="flex-1 py-3 border border-gray-200 rounded-lg" onPress={() => setRemoveId(null)}>
                                <Text className="text-center font-outfit-bold text-gray-700">{t('appointments.list.no')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 py-3 rounded-lg"
                                style={{ backgroundColor: '#D96B6B' }}
                                onPress={() => { if (removeId) hide(removeId); setRemoveId(null); }}
                                testID="remove-cancelled-confirm"
                            >
                                <Text className="text-center font-outfit-bold text-white">{t('appointments.list.removeConfirm')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Cancel Confirmation Modal */}
            <Modal supportedOrientations={MODAL_ORIENTATIONS}
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
