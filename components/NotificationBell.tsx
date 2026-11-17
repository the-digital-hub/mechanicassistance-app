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
    // The bubble is as wide as its text needs: a lone digit is a circle, "99+" a pill.
    const width = label.length === 1 ? 22 : label.length === 2 ? 28 : 36;

    return (
        <View accessibilityLabel={unread > 0 ? `${unread} unread notifications` : 'Notifications'}>
            <Bell size={size} color={color} />
            {unread > 0 && (
                <View
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        top: -9,
                        right: -12,
                        width,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: '#EF4444',
                        borderWidth: 1.5,
                        borderColor: '#FFFFFF',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    {/* Fixed width per digit count and no numberOfLines: the number is never cut ("3.."). */}
                    <Text
                        style={{ color: '#FFFFFF', fontSize: 13, lineHeight: 16, fontFamily: 'Outfit_700Bold', textAlign: 'center', includeFontPadding: false }}
                    >
                        {label}
                    </Text>
                </View>
            )}
        </View>
    );
}
