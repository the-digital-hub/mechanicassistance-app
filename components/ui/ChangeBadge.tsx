import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

/**
 * "Change" next to a value that can be swapped (the payment card of a request): a small soft-blue pill, the same
 * everywhere, instead of a loose blue word. With `onPress` it is a button; without, just the badge (inside a row
 * that is already tappable).
 */
export function ChangeBadge({ onPress, label }: { onPress?: () => void; label?: string }) {
    const { t } = useTranslation();
    const pill = (
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#E8F0FD' }}>
            <Text className="font-outfit-bold" style={{ fontSize: 13, color: '#1E56E3' }}>{label ?? t('requestAssistance.mechanicFound.change')}</Text>
        </View>
    );
    if (!onPress) return pill;
    return (
        <TouchableOpacity onPress={onPress} hitSlop={8} accessibilityRole="button" testID="change-badge">
            {pill}
        </TouchableOpacity>
    );
}
