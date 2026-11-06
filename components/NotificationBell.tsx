import { useNotifications } from '@/context/NotificationsContext';
import { Bell } from 'lucide-react-native';
import React from 'react';
import { Text, View } from 'react-native';

/**
 * The bell icon with a red bubble carrying how many inbox notifications are
 * still unread. Nothing is drawn on top when the count is zero; above 99 it
 * reads "99+".
 */
export function NotificationBell({ size = 24, color = '#0047AB' }: { size?: number; color?: string }) {
    const { notifications } = useNotifications();
    const unread = notifications.reduce((n, item) => (item.unread ? n + 1 : n), 0);
    const label = unread > 99 ? '99+' : String(unread);

    return (
        <View accessibilityLabel={unread > 0 ? `${unread} unread notifications` : 'Notifications'}>
            <Bell size={size} color={color} />
            {unread > 0 && (
                <View
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        top: -6,
                        right: -8,
                        minWidth: 18,
                        height: 18,
                        paddingHorizontal: 4,
                        borderRadius: 9,
                        backgroundColor: '#EF4444',
                        borderWidth: 1.5,
                        borderColor: '#FFFFFF',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <Text
                        style={{ color: '#FFFFFF', fontSize: 10, lineHeight: 12, fontFamily: 'Outfit_600SemiBold' }}
                        numberOfLines={1}
                    >
                        {label}
                    </Text>
                </View>
            )}
        </View>
    );
}
