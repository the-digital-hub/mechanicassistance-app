import { NotificationBell } from '@/components/NotificationBell';
import { useRouter } from 'expo-router';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';

/**
 * The notifications bell for the headers that are drawn inside a screen (the wizard steps), where the native header's bell is not there. It
 * takes the place of the empty spacer on the right, so the title stays centred, and opens the inbox.
 */
export function HeaderBell({ width = 24 }: { width?: number }) {
    const router = useRouter();
    return (
        <View style={{ width, alignItems: 'flex-end' }}>
            <TouchableOpacity
                onPress={() => router.push('/(tabs)/notifications')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
                testID="header-bell"
            >
                <NotificationBell size={22} />
            </TouchableOpacity>
        </View>
    );
}
