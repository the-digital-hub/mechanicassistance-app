import { FONT } from '@/lib/ui/fonts';
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
    // The backend's total, not the loaded page (which holds at most 30).
    const { totals } = useNotifications();
    const unread = totals.unread;
    const label = unread > 99 ? '99+' : String(unread);
    // The bubble is as wide as its text needs: a lone digit is a circle, "99+" a pill.
    const width = label.length === 1 ? 22 : label.length === 2 ? 28 : 36;

    return (
        // The bubble hangs 17 beyond the bell: with one, the bell steps left by that much (+3) so the bubble's right edge
        // lands on the screen's 24 px side margin instead of outside the grid.
        <View accessibilityLabel={unread > 0 ? `${unread} unread notifications` : 'Notifications'} style={{ marginRight: unread > 0 ? 20 : 0 }}>
            <Bell size={size} color={color} />
            {unread > 0 && (
                <View
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        top: -9,
                        right: -17,
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
                        style={{ color: '#FFFFFF', fontSize: 13, lineHeight: 16, fontFamily: FONT.bold, textAlign: 'center', includeFontPadding: false }}
                    >
                        {label}
                    </Text>
                </View>
            )}
        </View>
    );
}
