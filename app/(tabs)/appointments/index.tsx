import { AppointmentsFilterBar } from '@/components/appointments/AppointmentsFilters';
import { AppointmentsHome } from '@/components/appointments/AppointmentsHome';
import { OffersSection } from '@/components/appointments/OffersSection';
import { RequestTypeTabs } from '@/components/dashboard/MechanicHomeBlocks';
import { applyFilters, DEFAULT_FILTERS, isFiltering, matchesQuery, type AppointmentFilters } from '@/lib/appointments/filters';
import { AppointmentCard } from '@/components/ui/AppointmentCard';
import { isCancelledStatus, useAppointments } from '@/context/AppointmentsContext';
import { useUser } from '@/context/UserContext';
import { useSocket } from '@/context/SocketContext';
import { useHiddenAppointments } from '@/hooks/useHiddenAppointments';
import { quotesWaiting } from '@/lib/scheduled/quotes';
import { useMarketplaceFeed } from '@/lib/scheduled/useMarketplaceFeed';
import { ScrollPressGuardContext, useScrollPressGuard } from '@/hooks/useScrollPressGuard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Text, TouchableOpacity, View } from 'react-native';
import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';

/** How many appointments a page of the list holds. */
const PAGE_SIZE = 15;

export default function AppointmentsScreen() {
    const { t } = useTranslation();
    const { getUpcoming, getPendingApproval, getPast, refresh } = useAppointments();
    const router = useRouter();
    const { user } = useUser();
    const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
    const { scrollProps, guard } = useScrollPressGuard();
    const { lastMessage } = useSocket();
    // A technician's quotes waiting for the customer: counted in the summary shown when nothing is coming up.
    const quotesFeed = useMarketplaceFeed(user?.role === 'mechanic', lastMessage);

    // Offers are not a tab: they are pinned on top of Upcoming. The tabs are what is coming and what is over.
    const [selectedTab, setSelectedTab] = useState<'upcoming' | 'past'>('upcoming');
    const [filters, setFilters] = useState<AppointmentFilters>(DEFAULT_FILTERS);
    const [cancelModalVisible, setCancelModalVisible] = useState(false);
    const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
    const { hidden, hide } = useHiddenAppointments(user?.id);
    const [removeId, setRemoveId] = useState<string | null>(null);

    // Arriving with ?tab=pending (e.g. right after a mechanic sends an offer) opens that tab once.
    useEffect(() => {
        if (tabParam === 'pending' || tabParam === 'upcoming' || tabParam === 'past') {
            // "pending" (right after a technician sends an offer) is the offers block on top of Upcoming.
            setSelectedTab(tabParam === 'past' ? 'past' : 'upcoming');
            router.setParams({ tab: undefined });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabParam]);

    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [])
    );

    const upcomingAll = getUpcoming();
    const offersAll = getPendingApproval();
    const upcomingCount = upcomingAll.length;
    const pendingCount = offersAll.length;
    // A cancelled appointment the person removed is not shown (see useHiddenAppointments).
    const pastAll = getPast().filter((a) => !(hidden.has(a.id) && isCancelledStatus(a.status)));
    const pastCount = pastAll.length;
    // Both tabs are always there: with nothing coming up the person lands on Upcoming's summary, not on the history.
    const tabs: { id: 'upcoming' | 'past'; label: string; count: number }[] = [
        { id: 'upcoming', label: t('appointments.list.upcoming'), count: upcomingCount + pendingCount },
        { id: 'past', label: t('appointments.list.past'), count: pastCount },
    ];
    const activeTab = selectedTab;
    const appointments = applyFilters(activeTab === 'past' ? pastAll : upcomingAll, filters, activeTab);
    // The offers on top answer to the search only: they are the most urgent, so a date or status filter never hides them.
    const offersShown = activeTab === 'upcoming' ? offersAll.filter((a) => matchesQuery(a, filters.query)) : [];
    const filtering = isFiltering(filters, activeTab);
    // Nothing coming up and nothing filtered: the summary is what is shown, so there is nothing to search or filter yet.
    const showHome = activeTab === 'upcoming' && upcomingCount + pendingCount === 0 && !filtering;
    const showFilters = !showHome;
    const cancelledCount = pastAll.filter((a) => isCancelledStatus(a.status)).length;

    // Long lists (a technician's whole history) come in pages: the first screens are light and "Show more" brings the next ones.
    const [pageCount, setPageCount] = useState(1);
    useEffect(() => {
        setPageCount(1);
    }, [activeTab, filters]);
    const visibleAppointments = appointments.slice(0, pageCount * PAGE_SIZE);
    const remaining = appointments.length - visibleAppointments.length;

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
                data={visibleAppointments}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={
                    <>
                    <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 }}>
                        {/* Section Badge */}
                        <View style={{ marginTop: 14 }}>
                          <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                          <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                          <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                            {badgeLabel}
                          </Text>
                        </View>
                        </View>

                        {/* Title */}
                        <Text className="text-gray-900 font-outfit-medium text-3xl">{t(user?.role === 'mechanic' ? 'appointments.list.title' : 'appointments.list.titleOwner')}</Text>

                        {/* Tab switcher: Upcoming and Past, always, so the history is one tap away and never the first thing shown */}
                            <View style={{ marginTop: 16 }}>
                                <RequestTypeTabs tabs={tabs} selected={activeTab} onSelect={setSelectedTab} horizontalInset={40} />
                            </View>

                        {showFilters ? (
                        <View style={{ marginTop: 16 }}>
                            <AppointmentsFilterBar filters={filters} onChange={setFilters} scope={activeTab} resultCount={appointments.length + offersShown.length} />
                        </View>
                        ) : null}
                    </View>
                    <OffersSection appointments={offersShown} isMechanic={user?.role === 'mechanic'} onCancel={handleCancelRequest} />
                    </>
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
                ListFooterComponent={remaining > 0 ? (
                    <View style={{ paddingHorizontal: 20, paddingTop: 2 }}>
                        <TouchableOpacity
                            onPress={() => setPageCount((n) => n + 1)}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            className="items-center justify-center"
                            style={{ minHeight: 52, borderRadius: 14, backgroundColor: '#E6EAF2' }}
                            testID="appointments-show-more"
                        >
                            <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#4A5470' }}>{t('appointments.list.showMore', { count: Math.min(PAGE_SIZE, remaining), left: remaining })}</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}
                ListEmptyComponent={showHome ? (
                    <AppointmentsHome
                        isMechanic={user?.role === 'mechanic'}
                        completed={pastCount - cancelledCount}
                        cancelled={cancelledCount}
                        quotes={quotesWaiting(quotesFeed.items).length}
                        onOpenPast={() => setSelectedTab('past')}
                        onOpenQuotes={() => router.push({ pathname: '/(tabs)/assist', params: { filter: 'quotes' } } as never)}
                    />
                ) : offersShown.length > 0 && !filtering ? null : (
                    <View className="items-center justify-center py-10" style={{ gap: 12 }}>
                        <Text className="font-outfit-medium text-[15px] text-center" style={{ color: '#0B1530' }}>{filtering
                            ? t('appointments.filters.noMatches')
                            : activeTab === 'upcoming'
                                ? t('appointments.list.noUpcoming')
                                : t('appointments.list.noCompleted')}</Text>
                        {filtering ? (
                            <TouchableOpacity onPress={() => setFilters(DEFAULT_FILTERS)} accessibilityRole="button" className="items-center justify-center" style={{ minHeight: 44, paddingHorizontal: 18, borderRadius: 14, backgroundColor: '#EAF1FF' }} testID="appointments-empty-clear">
                                <Text className="font-outfit-bold" style={{ fontSize: 15, color: '#1E56E3' }}>{t('appointments.filters.clear')}</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                )}
            />

            {/* Remove a cancelled appointment from the list */}
            <Modal supportedOrientations={MODAL_ORIENTATIONS} transparent visible={removeId !== null} animationType="fade" onRequestClose={() => setRemoveId(null)}>
                <View className="flex-1 justify-center items-center bg-black/40 px-6">
                    <View className="bg-white rounded-2xl w-full p-6 items-center shadow-lg">
                        <Text className="text-xl font-outfit-bold text-blue-900 mb-2 text-center">{t('appointments.list.removeTitle')}</Text>
                        <Text className="text-gray-500 text-center font-outfit-regular mb-6" style={{ fontSize: 16 }}>{t('appointments.list.removeMessage')}</Text>
                        <View className="w-full" style={{ gap: 8 }}>
                            <TouchableOpacity
                                style={{ minHeight: 52, borderRadius: 14, backgroundColor: '#D96B6B', alignItems: 'center', justifyContent: 'center' }}
                                onPress={() => { if (removeId) hide(removeId); setRemoveId(null); }}
                                testID="remove-cancelled-confirm"
                            >
                                <Text className="text-center font-outfit-bold text-white" style={{ fontSize: 16 }}>{t('appointments.list.removeConfirm')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={{ minHeight: 52, borderRadius: 14, backgroundColor: '#E6EAF2', alignItems: 'center', justifyContent: 'center' }} onPress={() => setRemoveId(null)}>
                                <Text className="text-center font-outfit-bold" style={{ fontSize: 16, color: '#4A5470' }}>{t('appointments.list.no')}</Text>
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

                        <View className="w-full" style={{ gap: 8 }}>
                            <TouchableOpacity
                                style={{ minHeight: 52, borderRadius: 14, backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center' }}
                                onPress={confirmCancel}
                            >
                                <Text className="text-center font-outfit-bold text-white" style={{ fontSize: 16 }}>{t('appointments.list.yesCancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={{ minHeight: 52, borderRadius: 14, backgroundColor: '#E6EAF2', alignItems: 'center', justifyContent: 'center' }}
                                onPress={() => setCancelModalVisible(false)}
                            >
                                <Text className="text-center font-outfit-bold" style={{ fontSize: 16, color: '#4A5470' }}>{t('appointments.list.no')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
        </ScrollPressGuardContext.Provider>
    );
}
