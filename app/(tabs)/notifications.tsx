import { useTabBarInset } from '@/components/ui/RoundedTabBar';
import { useNotifications } from '@/context/NotificationsContext';
import { useUser } from '@/context/UserContext';
import { ApiError } from '@/lib/api/types';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { routeForPush } from '@/lib/notifications/push';
import { useRouter } from 'expo-router';
import {
    AlarmClock,
    Bell,
    Car,
    CircleCheck,
    CircleDollarSign,
    CircleX,
    CornerUpRight,
    Flag,
    MapPin,
    MessageSquareMore,
    MoreHorizontal,
    Scale,
    ScanSearch,
    Star,
    Trash2,
    TriangleAlert,
    Video,
    Wrench,
    type LucideIcon,
} from 'lucide-react-native';
import { useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, LayoutAnimation, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { appAlert } from '@/lib/ui/appAlert';
import { groupOfKind, NotificationsActionsSheet, NotificationsToolbar, type NotificationGroup } from '@/components/notifications/NotificationsToolbar';

// Tile palette from the Notification Center design: icon color + soft tint.
const TONES = {
    blue: { fg: '#1E56E3', bg: '#EAF1FF' },
    green: { fg: '#0E8A5F', bg: '#E6F7EF' },
    violet: { fg: '#6D4AE0', bg: '#F0EBFF' },
    orange: { fg: '#C26A0A', bg: '#FFF4E5' },
    red: { fg: '#D93636', bg: '#FDECEC' },
} as const;

type KindIcon = { Icon: LucideIcon; tone: keyof typeof TONES };

const KIND_ICON: Record<string, KindIcon> = {
    new_request: { Icon: Car, tone: 'blue' },
    mechanic_found: { Icon: Wrench, tone: 'blue' },
    request_status: { Icon: MapPin, tone: 'blue' },
    service_redirected: { Icon: CornerUpRight, tone: 'blue' },
    obd_reminder: { Icon: ScanSearch, tone: 'blue' },
    offer_accepted: { Icon: CircleCheck, tone: 'green' },
    video_call_confirmed: { Icon: CircleCheck, tone: 'green' },
    video_call_resolved: { Icon: Scale, tone: 'green' },
    video_call: { Icon: Video, tone: 'violet' },
    video_call_finished: { Icon: Flag, tone: 'violet' },
    video_call_reminder: { Icon: AlarmClock, tone: 'violet' },
    review_requested: { Icon: Star, tone: 'orange' },
    video_call_disputed: { Icon: TriangleAlert, tone: 'orange' },
    request_canceled: { Icon: CircleX, tone: 'red' },
    // In the design but not sent by the backend yet; ready for when these kinds exist.
    message: { Icon: MessageSquareMore, tone: 'orange' },
    payment: { Icon: CircleDollarSign, tone: 'green' },
};

const DEFAULT_ICON: KindIcon = { Icon: Bell, tone: 'blue' };

function NotificationIcon({ kind, unread }: { kind: string; unread: boolean }) {
    const { Icon, tone } = KIND_ICON[kind] ?? DEFAULT_ICON;
    const { fg, bg } = TONES[tone];
    return (
        <View style={{ position: 'relative' }}>
            <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} color={fg} strokeWidth={1.8} />
            </View>
            {unread && (
                <View
                    style={{
                        position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5,
                        backgroundColor: '#1E56E3', borderWidth: 2, borderColor: '#fff',
                    }}
                />
            )}
        </View>
    );
}

/** What a swipe to the left uncovers: a red button. Nothing is deleted until it is pressed. */
function DeleteAction({ onPress }: { onPress: () => void }) {
    const { t } = useTranslation();
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('notifications.delete')}
            style={{ width: 96, backgroundColor: '#E5484D', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            testID="notification-delete"
        >
            <Trash2 size={22} color="#FFFFFF" />
            <Text className="font-outfit-semibold" style={{ fontSize: 13, color: '#FFFFFF' }}>{t('notifications.delete')}</Text>
        </TouchableOpacity>
    );
}

export default function NotificationsScreen() {
  const tabInset = useTabBarInset();
    const router = useRouter();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
    const [query, setQuery] = useState('');
    const [groups, setGroups] = useState<NotificationGroup[]>([]);
    const [actionsOpen, setActionsOpen] = useState(false);
    const {
        notifications,
        deleteNotifications,
        deleteAll,
        markAllRead,
        totals,
        hasMore,
        loadingMore,
        loadMore,
        setUnreadOnly,
    } = useNotifications();
    const { user } = useUser();

    // A swipe must only delete: a touch that ends a swipe, or lands on the row that slides
    // up into the freed space, must not open the notification it was not aimed at.
    const pressBlockedUntil = useRef(0);
    const blockPresses = (ms = 700) => { pressBlockedUntil.current = Date.now() + ms; };

    const deleteAndReport = async (ids: string[] | 'all') => {
        // Rows below glide up and the removed one fades, instead of vanishing at once.
        LayoutAnimation.configureNext({
            duration: 320,
            update: { type: LayoutAnimation.Types.easeInEaseOut },
            delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
        });
        const result = ids === 'all'
            ? await deleteAll(activeTab === 'unread')
            : await deleteNotifications(ids);
        if (result.ok) return;
        // A status means the server answered: the connection is fine, so say so.
        const message = result.status
            ? t('notifications.deleteFailedServer', { status: result.status })
            : t('notifications.deleteFailedMessage');
        if (Platform.OS === 'web') {
            window.alert(message);
        } else {
            appAlert(t('notifications.deleteFailedTitle'), message);
        }
    };

    const handleDelete = (id: string) => {
        const performDelete = () => void deleteAndReport([id]);

        if (Platform.OS === 'web') {
            if (window.confirm(t('notifications.deleteConfirmMessage'))) {
                performDelete();
            }
        } else {
            appAlert(
                t('notifications.deleteConfirmTitle'),
                t('notifications.deleteConfirmMessage'),
                [
                    { text: t('notifications.cancel'), style: 'cancel' },
                    { text: t('notifications.delete'), style: 'destructive', onPress: performDelete }
                ]
            );
        }
    };

    // The tab, then what it is about (the filter) and the words typed in the search box.
    const needle = query.trim().toLowerCase();
    const filtering = needle.length > 0 || groups.length > 0;
    const filteredNotifications = (activeTab === 'all' ? notifications : notifications.filter(n => n.unread))
        .filter((n) => groups.length === 0 || groups.includes(groupOfKind(n.kind)))
        .filter((n) => !needle || `${n.title} ${n.body}`.toLowerCase().includes(needle));

    // "Delete all" reaches every notification on the server, not only the loaded ones: ask first.
    const handleDeleteAll = () => {
        if (totals.all === 0) return;
        const performDelete = () => void deleteAndReport('all');
        const message = activeTab === 'unread'
            ? t('notifications.deleteAllUnreadConfirmMessage', { count: totals.unread })
            : t('notifications.deleteAllConfirmMessage', { count: totals.all });
        if (Platform.OS === 'web') {
            if (window.confirm(message)) performDelete();
        } else {
            appAlert(t('notifications.deleteAllConfirmTitle'), message, [
                { text: t('notifications.cancel'), style: 'cancel' },
                { text: t('notifications.delete'), style: 'destructive', onPress: performDelete },
            ]);
        }
    };

    const selectTab = (id: 'all' | 'unread') => {
        setActiveTab(id);
        setUnreadOnly(id === 'unread');
    };

    // Older notifications load as the list nears its end.
    const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
        if (hasMore && layoutMeasurement.height + contentOffset.y >= contentSize.height - 200) {
            void loadMore();
        }
    };

    // Notifications whose moment has passed (the offer was answered, expired or the request ended): shown dimmed.
    const [endedIds, setEndedIds] = useState<Set<string>>(new Set());
    const markEnded = (id: string) => setEndedIds((prev) => new Set(prev).add(id));
    const [openingId, setOpeningId] = useState<string | null>(null);

    /**
     * "A technician was found" is an offer that lives for a few minutes: by the time it is tapped it may have been confirmed,
     * lapsed or cancelled, and its screen has nothing to show for any of those. So the request is looked at first and the person
     * goes where it stands now: the offer while it still is one, the appointment once it is booked, the search again if the hold
     * ran out, and a short explanation when it is over.
     */
    const openOffer = async (notif: typeof notifications[0]) => {
        if (!notif.requestId || openingId) return;
        setOpeningId(notif.id);
        try {
            const req = await assistanceDAO.getById(notif.requestId);
            const status = req?.status;
            if (status === 'offered') {
                router.push({ pathname: '/request-assistance/mechanic-found', params: { requestId: notif.requestId } }, { withAnchor: true });
            } else if (status === 'pending') {
                markEnded(notif.id);
                router.push({ pathname: '/request-assistance/searching', params: { requestId: notif.requestId, type: req?.assistanceType ?? req?.type } });
            } else if (status === 'cancelled' || status === 'canceled' || !req) {
                markEnded(notif.id);
                appAlert(t('notifications.offerEndedTitle'), t('notifications.offerEndedMessage'));
            } else {
                // Accepted and beyond: the request is a booked appointment now.
                markEnded(notif.id);
                router.push({ pathname: '/appointments/[id]', params: { id: notif.requestId } }, { withAnchor: true });
            }
        } catch (error) {
            if (error instanceof ApiError && (error.statusCode === 404 || error.statusCode === 403)) {
                markEnded(notif.id);
                appAlert(t('notifications.offerEndedTitle'), t('notifications.offerEndedMessage'));
            } else {
                appAlert(t('notifications.openFailedTitle'), t('notifications.openFailedMessage'));
            }
        } finally {
            setOpeningId(null);
        }
    };

    // Same destination as tapping the push itself.
    const handleNotificationPress = (notif: typeof notifications[0]) => {
        if (Date.now() < pressBlockedUntil.current) return;
        if (!user?.id || !user.role) return;
        if (notif.type === 'mechanic_found' && notif.requestId) {
            void openOffer(notif);
            return;
        }
        const route = routeForPush(
            {
                kind: notif.kind,
                requestId: notif.requestId,
                appointmentId: notif.appointmentId,
                status: notif.status,
            },
            { id: user.id, role: user.role },
        );
        if (route) router.push(route, { withAnchor: true });
    };

    return (
        <GestureHandlerRootView className="flex-1" style={{ flex: 1, backgroundColor: '#F6F8FC' }}>
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={200} contentContainerStyle={{ paddingBottom: tabInset }}>
                <View className="px-6 pt-4 pb-4">
                    {/* Section Badge */}
                    <View style={{ marginTop: 18 }}>
                      <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                            {t('notifications.badge')}
                        </Text>
                    </View>
                    </View>

                    {/* Title */}
                    <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">{t('notifications.title')}</Text>

                    {/* Subtitle */}
                    <Text className="text-gray-500 font-outfit-regular text-base mb-6">
                        {t('notifications.subtitle')}
                    </Text>
                </View>

                {/* Tabs */}
                <View className="px-6 flex-row items-center justify-between mb-3">
                    <View className="flex-row" style={{ gap: 8 }}>
                        {([['all', t('notifications.all'), totals.all], ['unread', t('notifications.unread'), totals.unread]] as const).map(([id, label, count]) => {
                            const on = activeTab === id;
                            return (
                                <TouchableOpacity
                                    key={id}
                                    onPress={() => selectTab(id)}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: on }}
                                    style={{ paddingHorizontal: 15, paddingVertical: 9, borderRadius: 100, backgroundColor: on ? '#1E56E3' : '#FFFFFF', borderWidth: on ? 0 : 1, borderColor: '#E3E8F2' }}
                                >
                                    <Text className="font-outfit-bold" style={{ fontSize: 15, color: on ? '#FFFFFF' : '#0B1530' }}>
                                        {label}{count > 0 ? `  ${count}` : ''}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    {/* One button for what can be done to the whole inbox (mark all as read, delete all). */}
                    <TouchableOpacity
                        onPress={() => setActionsOpen(true)}
                        accessibilityRole="button"
                        accessibilityLabel={t('notifications.actionsTitle')}
                        style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#E6EAF2', alignItems: 'center', justifyContent: 'center' }}
                        testID="notifications-actions"
                    >
                        <MoreHorizontal size={20} color="#4A5470" />
                    </TouchableOpacity>
                </View>

                <View className="px-6 mb-3">
                    <NotificationsToolbar query={query} onQuery={setQuery} groups={groups} onGroups={setGroups} />
                </View>

                {/* List */}
                <View className="mb-10">
                    {filteredNotifications.length === 0 ? (
                        <View className="px-6 py-16 items-center">
                            <View className="mb-4">
                                <Bell size={40} color="#8C96AE" strokeWidth={1.5} />
                            </View>
                            <Text className="text-gray-400 font-outfit-medium text-base text-center">{filtering ? t('notifications.noResults') : t('notifications.empty')}</Text>
                            <Text className="text-gray-300 font-outfit-regular text-sm text-center mt-1">
                                {filtering ? t('notifications.noResultsHint') : t('notifications.emptyHint')}
                            </Text>
                        </View>
                    ) : (
                        filteredNotifications.map((notif) => (
                            // Swipe to the left to uncover Delete; it stays open until Delete is pressed (or the row is swiped back).
                            <Swipeable
                                key={notif.id}
                                friction={1.2}
                                overshootRight={false}
                                rightThreshold={40}
                                animationOptions={{ damping: 30, stiffness: 170, mass: 1 }}
                                onSwipeableOpenStartDrag={() => blockPresses()}
                                onSwipeableCloseStartDrag={() => blockPresses()}
                                renderRightActions={() => <DeleteAction onPress={() => { blockPresses(); void deleteAndReport([notif.id]); }} />}
                                onSwipeableOpen={() => blockPresses()}
                                containerStyle={{ backgroundColor: '#E5484D' }}
                            >
                            <TouchableOpacity
                                className={`px-6 py-5 border-b border-gray-50 flex-row gap-4 ${notif.unread ? 'bg-blue-50/30' : ''}`}
                                style={{ backgroundColor: notif.unread ? '#F2F7FF' : '#F6F8FC', opacity: endedIds.has(notif.id) ? 0.6 : 1 }}
                                onPress={() => handleNotificationPress(notif)}
                                activeOpacity={notif.requestId ? 0.7 : 1}
                                accessibilityActions={[{ name: 'delete', label: t('notifications.delete') }]}
                                onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'delete') handleDelete(notif.id); }}
                            >
                                {/* Icon */}
                                <NotificationIcon kind={notif.kind} unread={notif.unread} />

                                {/* Content: the title and the time share the first line; the text under them has the whole width. */}
                                <View className="flex-1">
                                    <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
                                        <Text className="flex-1 text-gray-900 font-outfit-bold text-lg" style={{ lineHeight: 24 }}>{notif.title}</Text>
                                        <View className="flex-row items-center" style={{ gap: 8 }}>
                                            <Text
                                                className={notif.unread ? 'font-outfit-bold' : 'font-outfit-medium'}
                                                style={{ fontSize: 13, color: notif.unread ? '#1E56E3' : '#9CA3AF' }}
                                            >
                                                {notif.time}
                                            </Text>
                                            <TouchableOpacity
                                                onPress={() => handleDelete(notif.id)}
                                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                                accessibilityRole="button"
                                                accessibilityLabel={t('notifications.delete')}
                                            >
                                                <MoreHorizontal size={18} color="#4B5563" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    <Text className="text-gray-500 font-outfit-regular text-[16.5px] leading-6" style={{ marginTop: 2 }}>{notif.body}</Text>
                                    {notif.type === 'mechanic_found' && notif.requestId && (
                                        endedIds.has(notif.id)
                                            ? <Text className="text-gray-400 font-outfit-medium text-[15px] mt-1">{t('notifications.offerEnded')}</Text>
                                            : <Text className="text-blue-500 font-outfit-medium text-[15px] mt-1">{openingId === notif.id ? t('notifications.opening') : t('notifications.tapToView')}</Text>
                                    )}
                                </View>
                            </TouchableOpacity>
                            </Swipeable>
                        ))
                    )}
                    {loadingMore && (
                        <View className="py-6 items-center">
                            <ActivityIndicator color="#1E56E3" />
                        </View>
                    )}
                </View>
            </ScrollView>
            <NotificationsActionsSheet
                visible={actionsOpen}
                onClose={() => setActionsOpen(false)}
                unread={totals.unread}
                total={totals.all}
                onMarkAllRead={markAllRead}
                onDeleteAll={handleDeleteAll}
            />
        </GestureHandlerRootView>
    );
}
