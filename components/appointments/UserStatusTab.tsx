import React from 'react';
import { AttachmentStrip } from './AttachmentStrip';
import { parseAttachments } from '@/lib/media/attachments';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

export function UserStatusTab({ appointment }: { appointment: any; mechanicCoords?: { latitude: number; longitude: number } | null; routePolyline?: string | null }) {
    const { t } = useTranslation();
    if (!appointment) return null;

    const attachments = parseAttachments(appointment.photos);

    const currentStatus = appointment.currentStatus || appointment.status || 'Pending';
    const isEnRoute = currentStatus.toLowerCase().includes('way') || currentStatus.toLowerCase().includes('route');
    const isArrived = currentStatus.toLowerCase().includes('arrived');
    const statusColor = isArrived ? '#059669' : isEnRoute ? '#2563EB' : '#6B7280';

    return (
        <View className="gap-6" testID="user-status-tab">
            <View className="gap-4">
                <View>
                    <Text className="font-outfit-bold text-blue-900">{t('appointments.userStatus.currentStatus')}</Text>
                    <Text className="font-outfit-bold text-lg" style={{ color: statusColor }}>
                        {currentStatus.toUpperCase()}
                    </Text>
                </View>

                <View>
                    <Text className="font-outfit-bold text-blue-900">{t('appointments.userStatus.vehicle')}</Text>
                    <Text className="text-gray-600 font-outfit-regular">{appointment.car || '—'}</Text>
                </View>

                <View>
                    <Text className="font-outfit-bold text-blue-900">{t('appointments.userStatus.address')}</Text>
                    <Text className="text-gray-600 font-outfit-regular">{appointment.address || '—'}</Text>
                </View>

                {appointment.notes ? (
                    <View>
                        <Text className="font-outfit-bold text-blue-900">{t('appointments.userStatus.notes')}</Text>
                        <Text className="text-gray-600 font-outfit-regular">{appointment.notes}</Text>
                    </View>
                ) : null}

                {attachments.length > 0 && (
                    <View>
                        <Text className="font-outfit-bold text-blue-900 mb-2">
                            {t('appointments.userStatus.submittedPhotos', { count: attachments.length })}
                        </Text>
                        <AttachmentStrip photos={appointment.photos} />
                    </View>
                )}
            </View>
        </View>
    );
}
