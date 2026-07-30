import { ConfigService } from '@/lib/config/ConfigService';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, Text, View } from 'react-native';

export function UserStatusTab({ appointment }: { appointment: any; mechanicCoords?: { latitude: number; longitude: number } | null; routePolyline?: string | null }) {
    const { t } = useTranslation();
    if (!appointment) return null;

    const photos: string[] = Array.isArray(appointment.photos)
        ? appointment.photos
        : typeof appointment.photos === 'string'
            ? JSON.parse(appointment.photos || '[]')
            : [];

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

                {photos.length > 0 && (
                    <View>
                        <Text className="font-outfit-bold text-blue-900 mb-2">
                            {t('appointments.userStatus.submittedPhotos', { count: photos.length })}
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {photos.map((uri, index) => {
                                // Resolve relative paths against the API base URL
                                const src = uri.startsWith('http') ? uri : `${ConfigService.getApiBaseUrl()}${uri}`;
                                return (
                                    <Image
                                        key={index}
                                        source={{ uri: src }}
                                        style={{
                                            width: 110,
                                            height: 110,
                                            borderRadius: 10,
                                            marginRight: 10,
                                            backgroundColor: '#F3F4F6',
                                        }}
                                        resizeMode="cover"
                                    />
                                );
                            })}
                        </ScrollView>
                    </View>
                )}
            </View>
        </View>
    );
}
