import { useNotifications } from '@/context/NotificationsContext';
import { useUser } from '@/context/UserContext';
import { routeForPush } from '@/lib/notifications/push';
import { useRouter } from 'expo-router';
import {
    AlarmClock,
    Bell,
    Car,
    Check,
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
    X,
    type LucideIcon,
} from 'lucide-react-native';
import { useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useTranslation } from 'react-i18next';
import { LayoutAnimation, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { appAlert } from '@/lib/ui/appAlert';

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

/** What a swipe to the left uncovers: a red tile that says what letting go will do. */
function DeleteAction() {
    const { t } = useTranslation();
    return (
        <View style={{ width: 96, backgroundColor: '#E5484D', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Trash2 size={22} color="#FFFFFF" />
            <Text className="font-outfit-semibold" style={{ fontSize: 13, color: '#FFFFFF' }}>{t('notifications.delete')}</Text>
        </View>
    );
}

export default function NotificationsScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
    const { notifications, deleteNotifications, markAllRead } = useNotifications();
    const { user } = useUser();

    // A swipe must only delete: a touch that ends a swipe, or lands on the row that slides
    // up into the freed space, must not open the notification it was not aimed at.
    const pressBlockedUntil = useRef(0);
    const blockPresses = (ms = 700) => { pressBlockedUntil.current = Date.now() + ms; };

    const deleteAndReport = async (ids: string[]) => {
        // Rows below glide up and the removed one fades, instead of vanishing at once.
        LayoutAnimation.configureNext({
            duration: 320,
            update: { type: LayoutAnimation.Types.easeInEaseOut },
            delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
        });
        const result = await deleteNotifications(ids);
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

    const filteredNotifications = activeTab === 'all'
        ? notifications
        : notifications.filter(n => n.unread);

    const unreadCount = notifications.filter(n => n.unread).length;

    // Same destination as tapping the push itself.
    const handleNotificationPress = (notif: typeof notifications[0]) => {
        if (Date.now() < pressBlockedUntil.current) return;
        if (!user?.id || !user.role) return;
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
        <GestureHandlerRootView className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <View className="px-6 pt-4 pb-4">
                    {/* Section Badge */}
                    <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                            {t('notifications.badge')}
                        </Text>
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
                        {([['all', t('notifications.all'), notifications.length], ['unread', t('notifications.unread'), unreadCount]] as const).map(([id, label, count]) => {
                            const on = activeTab === id;
                            return (
                                <TouchableOpacity
                                    key={id}
                                    onPress={() => setActiveTab(id)}
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
                    <View className="flex-row gap-4">
                        <TouchableOpacity onPress={markAllRead}>
                            <Check size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => void deleteAndReport(filteredNotifications.map(n => n.id))}>
                            <X size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* List */}
                <View className="mb-10">
                    {filteredNotifications.length === 0 ? (
                        <View className="px-6 py-16 items-center">
                            <View className="mb-4">
                                <Bell size={40} color="#8C96AE" strokeWidth={1.5} />
                            </View>
                            <Text className="text-gray-400 font-outfit-medium text-base text-center">{t('notifications.empty')}</Text>
                            <Text className="text-gray-300 font-outfit-regular text-sm text-center mt-1">
                                {t('notifications.emptyHint')}
                            </Text>
                        </View>
                    ) : (
                        filteredNotifications.map((notif) => (
                            // Swipe to the left to delete: letting go past the halfway mark removes it.
                            <Swipeable
                                key={notif.id}
                                friction={1.2}
                                overshootRight={false}
                                rightThreshold={72}
                                animationOptions={{ damping: 30, stiffness: 170, mass: 1 }}
                                onSwipeableOpenStartDrag={() => blockPresses()}
                                onSwipeableCloseStartDrag={() => blockPresses()}
                                renderRightActions={() => <DeleteAction />}
                                onSwipeableOpen={() => { blockPresses(); void deleteAndReport([notif.id]); }}
                                containerStyle={{ backgroundColor: '#E5484D' }}
                            >
                            <TouchableOpacity
                                className={`px-6 py-5 border-b border-gray-50 flex-row gap-4 ${notif.unread ? 'bg-blue-50/30' : ''}`}
                                style={{ backgroundColor: notif.unread ? '#F2F7FF' : '#F6F8FC' }}
                                onPress={() => handleNotificationPress(notif)}
                                activeOpacity={notif.requestId ? 0.7 : 1}
                            >
                                {/* Icon */}
                                <NotificationIcon kind={notif.kind} unread={notif.unread} />

                                {/* Content */}
                                <View className="flex-1">
                                    <View className="flex-row justify-between items-start mb-1">
                                        <View className="flex-1 pr-2">
                                            <Text className="text-gray-900 font-outfit-bold text-lg mb-1">{notif.title}</Text>
                                            <Text className="text-gray-500 font-outfit-regular text-[16.5px] leading-6">{notif.body}</Text>
                                            {notif.type === 'mechanic_found' && notif.requestId && (
                                                <Text className="text-blue-500 font-outfit-medium text-[15px] mt-1">{t('notifications.tapToView')}</Text>
                                            )}
                                        </View>
                                        <View className="items-end min-w-[30px]">
                                            <Text className="text-gray-400 text-[13px] mb-2">{notif.time}</Text>
                                            <TouchableOpacity
                                                onPress={() => handleDelete(notif.id)}
                                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                            >
                                                <MoreHorizontal size={18} color="#4B5563" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            </TouchableOpacity>
                            </Swipeable>
                        ))
                    )}
                </View>
            </ScrollView>
        </GestureHandlerRootView>
    );
}
