import { useMechanicStatus } from '@/context/MechanicStatusContext';
import { BellOff } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

/**
 * Shown above the mechanic's request feed when they are not available: the
 * list still holds every request nobody has taken, but no new-request push is
 * sent to them until they go available again.
 */
export function MechanicFeedStatusBanner() {
    const { t } = useTranslation();
    const { mechanicStatus, setMechanicStatus, isUpdatingStatus } = useMechanicStatus();

    if (mechanicStatus === 'available') return null;

    const key = mechanicStatus === 'offline' ? 'offline' : 'busy';

    return (
        <View className="rounded-2xl p-4 mb-4 flex-row items-start" style={{ backgroundColor: '#F4F8FF', borderWidth: 1, borderColor: '#E1EAFB' }}>
            <BellOff size={20} color="#0047AB" style={{ marginTop: 2 }} />
            <View className="flex-1 ml-3">
                <Text className="text-gray-900 font-outfit-semibold text-sm">
                    {t(`dashboard.mechanic.feedBanner.${key}Title`)}
                </Text>
                <Text className="text-gray-600 font-outfit-regular text-sm mt-1">
                    {t(`dashboard.mechanic.feedBanner.${key}Message`)}
                </Text>
                <TouchableOpacity
                    onPress={() => { setMechanicStatus('available').catch(() => undefined); }}
                    disabled={isUpdatingStatus}
                    className="mt-3 self-start px-3 py-2 rounded-lg"
                    style={{ backgroundColor: '#0047AB', opacity: isUpdatingStatus ? 0.6 : 1 }}
                >
                    {isUpdatingStatus ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text className="text-white font-outfit-bold text-sm">
                            {t('dashboard.mechanic.feedBanner.goAvailable')}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}
