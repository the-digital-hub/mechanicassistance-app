import { Ionicons } from '@expo/vector-icons';
import { ConfigService } from '@/lib/config/ConfigService';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { MAP_PROVIDER } from '@/lib/maps/provider';

function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
    const points: { latitude: number; longitude: number }[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    while (index < encoded.length) {
        let b: number;
        let shift = 0;
        let result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lat += result & 1 ? ~(result >> 1) : result >> 1;
        shift = 0; result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lng += result & 1 ? ~(result >> 1) : result >> 1;
        points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
}


export function UserStatusTab({ appointment, mechanicCoords, routePolyline }: { appointment: any; mechanicCoords?: { latitude: number; longitude: number } | null; routePolyline?: string | null }) {
    const { t } = useTranslation();
    if (!appointment) return null;

    const mapRef = React.useRef<MapView | null>(null);

    const photos: string[] = Array.isArray(appointment.photos)
        ? appointment.photos
        : typeof appointment.photos === 'string'
            ? JSON.parse(appointment.photos || '[]')
            : [];

    const currentStatus = appointment.currentStatus || appointment.status || 'Pending';
    const isEnRoute = currentStatus.toLowerCase().includes('way') || currentStatus.toLowerCase().includes('route');
    const isArrived = currentStatus.toLowerCase().includes('arrived');
    const statusColor = isArrived ? '#059669' : isEnRoute ? '#2563EB' : '#6B7280';

    const clientCoords =
        appointment.locationLat && appointment.locationLng
            ? { latitude: appointment.locationLat, longitude: appointment.locationLng }
            : null;

    const hasCoords = !!clientCoords;

    const fitMarkers = React.useCallback(() => {
        const coords = [clientCoords, mechanicCoords].filter(Boolean) as { latitude: number; longitude: number }[];
        if (coords.length >= 2) {
            mapRef.current?.fitToCoordinates(coords, {
                edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
                animated: true,
            });
        }
    }, [clientCoords?.latitude, clientCoords?.longitude, mechanicCoords?.latitude, mechanicCoords?.longitude]);

    React.useEffect(() => {
        fitMarkers();
    }, [fitMarkers]);

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
                    <Text className="font-outfit-bold text-blue-900">Vehicle issue:</Text>
                    <Text className="text-gray-600 font-outfit-regular">
                        {appointment.vehicleIssues?.length ? appointment.vehicleIssues.map((i: { name: string }) => i.name).join(', ') : '—'}
                    </Text>
                </View>

                <View>
                    <Text className="font-outfit-bold text-blue-900">{t('appointments.userStatus.address')}</Text>
                    <Text className="text-gray-600 font-outfit-regular">{appointment.address || '—'}</Text>
                    {/* Map — client pin (red) + mechanic live pin (blue) */}
                    <View style={{ height: 220, borderRadius: 12, overflow: 'hidden', marginTop: 8, backgroundColor: '#E5E7EB' }}>
                        {hasCoords ? (
                            <MapView
                                provider={MAP_PROVIDER}
                                ref={mapRef}
                                style={{ width: '100%', height: '100%' }}
                                onMapReady={fitMarkers}
                                initialRegion={{
                                    latitude: clientCoords!.latitude,
                                    longitude: clientCoords!.longitude,
                                    latitudeDelta: 0.05,
                                    longitudeDelta: 0.05,
                                }}
                            >
                                <Marker
                                    coordinate={clientCoords!}
                                    title={appointment.address || t('appointments.userStatus.yourLocation')}
                                    description={t('appointments.userStatus.yourLocation')}
                                    pinColor="red"
                                />
                                {mechanicCoords && (
                                    <Marker
                                        coordinate={mechanicCoords}
                                        title={t('appointments.userStatus.mechanic')}
                                        description={t('appointments.userStatus.mechanicLocation')}
                                        pinColor="blue"
                                    />
                                )}
                                {routePolyline && (
                                    <Polyline
                                        coordinates={decodePolyline(routePolyline)}
                                        strokeColor="#2563EB"
                                        strokeWidth={4}
                                    />
                                )}
                            </MapView>
                        ) : (
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="map-outline" size={32} color="#9CA3AF" />
                                <Text style={{ color: '#6B7280', marginTop: 8, fontFamily: 'Outfit_400Regular' }}>
                                    {t('appointments.userStatus.locationNotAvailable')}
                                </Text>
                            </View>
                        )}
                    </View>
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
