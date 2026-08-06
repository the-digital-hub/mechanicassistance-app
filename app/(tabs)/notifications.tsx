import { useNotifications } from '@/context/NotificationsContext';
import { useRouter } from 'expo-router';
import { Check, MoreHorizontal, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function NotificationsScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
    const { notifications, deleteNotification, markAllRead } = useNotifications();

    const handleDelete = (id: string) => {
        const performDelete = () => deleteNotification(id);

        if (Platform.OS === 'web') {
            if (window.confirm(t('notifications.deleteConfirmMessage'))) {
                performDelete();
            }
        } else {
            Alert.alert(
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

    const getIcon = (type: string) => {
        switch (type) {
            case 'mechanic_found': return '🔧';
            case 'offer_accepted': return '✅';
            case 'job_canceled': return '❌';
            default: return '🔔';
        }
    };

    const handleNotificationPress = (notif: typeof notifications[0]) => {
        if (notif.type === 'mechanic_found' && notif.requestId) {
            router.push({
                pathname: '/request-assistance/mechanic-found',
                params: { requestId: notif.requestId }
            });
        }
    };

    return (
        <View className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
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
                <View className="px-6 flex-row items-center justify-between mb-2">
                    <View className="flex-row gap-6">
                        <TouchableOpacity
                            onPress={() => setActiveTab('all')}
                            className={`pb-2 ${activeTab === 'all' ? 'border-b-2 border-blue-600' : ''}`}
                        >
                            <Text className={`font-outfit-bold ${activeTab === 'all' ? 'text-blue-900' : 'text-gray-400'}`}>
                                {t('notifications.all')} {notifications.length > 0 && <Text className="text-[10px] ml-1">{notifications.length}</Text>}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveTab('unread')}
                            className={`pb-2 ${activeTab === 'unread' ? 'border-b-2 border-blue-600' : ''}`}
                        >
                            <Text className={`font-outfit-bold ${activeTab === 'unread' ? 'text-blue-900' : 'text-gray-400'}`}>
                                {t('notifications.unread')} {unreadCount > 0 && <Text className="text-[10px] ml-1">{unreadCount}</Text>}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <View className="flex-row gap-4">
                        <TouchableOpacity onPress={markAllRead}>
                            <Check size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => filteredNotifications.forEach(n => deleteNotification(n.id))}>
                            <X size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* List */}
                <View className="mb-10">
                    {filteredNotifications.length === 0 ? (
                        <View className="px-6 py-16 items-center">
                            <Text className="text-4xl mb-4">🔔</Text>
                            <Text className="text-gray-400 font-outfit-medium text-base text-center">{t('notifications.empty')}</Text>
                            <Text className="text-gray-300 font-outfit-regular text-sm text-center mt-1">
                                {t('notifications.emptyHint')}
                            </Text>
                        </View>
                    ) : (
                        filteredNotifications.map((notif) => (
                            <TouchableOpacity
                                key={notif.id}
                                className={`px-6 py-5 border-b border-gray-50 flex-row gap-4 ${notif.unread ? 'bg-blue-50/30' : ''}`}
                                onPress={() => handleNotificationPress(notif)}
                                activeOpacity={notif.requestId ? 0.7 : 1}
                            >
                                {/* Icon */}
                                <View className="relative">
                                    <View className="w-10 h-10 rounded-full items-center justify-center bg-blue-50 border border-blue-100">
                                        <Text className="text-lg">{getIcon(notif.type)}</Text>
                                    </View>
                                    {notif.unread && (
                                        <View className="absolute -left-1 top-3 w-2 h-2 bg-blue-600 rounded-full border border-white" />
                                    )}
                                </View>

                                {/* Content */}
                                <View className="flex-1">
                                    <View className="flex-row justify-between items-start mb-1">
                                        <View className="flex-1 pr-2">
                                            <Text className="text-gray-900 font-outfit-bold text-sm mb-0.5">{notif.title}</Text>
                                            <Text className="text-gray-500 font-outfit-regular text-[13px] leading-4">{notif.body}</Text>
                                            {notif.type === 'mechanic_found' && notif.requestId && (
                                                <Text className="text-blue-500 font-outfit-medium text-xs mt-1">{t('notifications.tapToView')}</Text>
                                            )}
                                        </View>
                                        <View className="items-end min-w-[30px]">
                                            <Text className="text-gray-400 text-[10px] mb-2">{notif.time}</Text>
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
                        ))
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
