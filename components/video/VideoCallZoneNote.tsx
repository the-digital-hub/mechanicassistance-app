import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { videoCallZones } from '@/lib/video/videoCallTime';
import { TYPE } from '@/lib/ui/type';

const K = 'appointments.videoCall.zone';

/**
 * For the technician, on a booked video call: the time is always shown on this phone's clock, with its
 * zone. When the owner booked from another time zone, both clocks are spelled out so nobody shows up an
 * hour (or three) off. Nothing for a call asked for "now".
 */
export function VideoCallZoneNote({ call, compact = false }: {
    call: { date?: string | null; startNow?: boolean | null; timezone?: string | null } | null | undefined;
    compact?: boolean;
}) {
    const { t, i18n } = useTranslation();
    const zones = videoCallZones(call, i18n.language);
    if (!zones) return null;

    if (!zones.theirs) {
        return (
            <Text className="font-outfit-regular" style={{ fontSize: 13, lineHeight: 18, color: '#6B7490', marginTop: compact ? 4 : 8 }} testID="zone-same">
                {t(`${K}.same`, { zone: zones.zone })}
            </Text>
        );
    }
    return (
        <View
            style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, backgroundColor: '#FFF4E5', borderWidth: 1, borderColor: '#F7DDB0', marginTop: compact ? 8 : 12 }}
            testID="zone-differs"
        >
            <Ionicons name="globe-outline" size={20} color="#C26A0A" style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
                <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, lineHeight: 22, color: '#0B1530' }}>{t(`${K}.differsTitle`)}</Text>
                <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: '#6B7490', marginTop: 2 }}>
                    {t(`${K}.differsYou`, { time: zones.mine })}
                </Text>
                <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: '#6B7490' }}>
                    {t(`${K}.differsThem`, { time: zones.theirs })}
                </Text>
            </View>
        </View>
    );
}
