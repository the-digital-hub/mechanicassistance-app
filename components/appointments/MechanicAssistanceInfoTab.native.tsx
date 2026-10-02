import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { DetailCard, DetailRow } from './DetailCard';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { MAP_PROVIDER } from '@/lib/maps/provider';
import { formatEtaTime, useAppointmentEta } from '@/hooks/useAppointmentEta';
import { useSocket } from '@/context/SocketContext';

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

interface MechanicAssistanceInfoTabProps {
    appointment: any;
}

export function MechanicAssistanceInfoTab({ appointment }: MechanicAssistanceInfoTabProps) {
    const { t } = useTranslation();
    const mapRef = React.useRef<MapView | null>(null);
    const [mechanicCoords, setMechanicCoords] = React.useState<{ latitude: number; longitude: number } | null>(null);
    const { sendMessage } = useSocket();

    // Request location coords are the client's chosen point (default address or
    // the spot they dropped on the map) — always the destination reference.
    const requestCoords =
        appointment?.locationLat != null && appointment?.locationLng != null
            ? { latitude: appointment.locationLat, longitude: appointment.locationLng }
            : null;

    // Live ETA / arrival hour (shared with the client via the same hook).
    const { minutesAway, etaTime, loading: etaLoading, polyline } = useAppointmentEta(
        appointment?.id,
        appointment?.status,
    );

    // Track mechanic's live position — watch continuously so the marker moves as they drive.
    React.useEffect(() => {
        let sub: Location.LocationSubscription | null = null;
        let cancelled = false;
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;
                if (cancelled) return;
                sub = await Location.watchPositionAsync(
                    { timeInterval: 4_000, distanceInterval: 5 },
                    (loc) => {
                        if (cancelled) return;
                        const { latitude, longitude } = loc.coords;
                        setMechanicCoords({ latitude, longitude });
                        if (appointment?.id) {
                            sendMessage('mechanic_location_update', {
                                appointmentId: appointment.id,
                                lat: latitude,
                                lng: longitude,
                            });
                        }
                    },
                );
            } catch {
                // no-op: mechanic marker simply won't render
            }
        })();
        return () => {
            cancelled = true;
            sub?.remove();
        };
    }, []);

    // Frame both pins (mechanic + request) once we have them.
    const fitMarkers = React.useCallback(() => {
        const coords = [requestCoords, mechanicCoords].filter(Boolean) as {
            latitude: number;
            longitude: number;
        }[];
        if (coords.length >= 2) {
            mapRef.current?.fitToCoordinates(coords, {
                edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                animated: true,
            });
        }
    }, [requestCoords, mechanicCoords]);

    React.useEffect(() => {
        fitMarkers();
    }, [fitMarkers]);

    const arrivalValue = etaLoading
        ? t('appointments.detail.info.calculating')
        : minutesAway !== null
            ? t('appointments.detail.info.minAway', { minutes: minutesAway })
            : t('appointments.detail.info.onTheWay');
    const etaValue = etaTime ? formatEtaTime(etaTime) : etaLoading ? '—' : t('appointments.detail.info.pending');
    const issueValue = appointment.vehicleIssues?.length
        ? appointment.vehicleIssues.map((i: { name: string }) => i.name).join(', ')
        : '—';

    return (
        <View className="gap-3.5">
            {/* Trip logistics — grouped with the map right below */}
            <DetailCard>
                <DetailRow icon="time-outline" label={t('appointments.detail.info.arrivalTime')} value={arrivalValue} />
                <DetailRow icon="calendar-outline" label={t('appointments.detail.info.estimatedArrival')} value={etaValue} />
                <DetailRow icon="location-outline" label={t('appointments.detail.info.address')} value={appointment.address} last />
            </DetailCard>

            {/* Map View — request pin (client location) + mechanic pin (own GPS) */}
            <View className="h-48 overflow-hidden bg-gray-200" style={{ borderRadius: 18, borderWidth: 1, borderColor: '#EEF2FA' }}>
                {requestCoords ? (
                    <MapView
                        provider={MAP_PROVIDER}
                        ref={mapRef}
                        style={{ width: '100%', height: '100%' }}
                        onMapReady={fitMarkers}
                        initialRegion={{
                            latitude: requestCoords.latitude,
                            longitude: requestCoords.longitude,
                            latitudeDelta: 0.05,
                            longitudeDelta: 0.05,
                        }}
                    >
                        <Marker
                            coordinate={requestCoords}
                            title={appointment.address || 'Request location'}
                            description="Client location"
                            pinColor="red"
                        />
                        {mechanicCoords && (
                            <Marker
                                coordinate={mechanicCoords}
                                title="Your location"
                                pinColor="blue"
                            />
                        )}
                        {polyline && (
                            <Polyline
                                coordinates={decodePolyline(polyline)}
                                strokeColor="#2563EB"
                                strokeWidth={4}
                            />
                        )}
                    </MapView>
                ) : (
                    <View className="flex-1 items-center justify-center">
                        <Ionicons name="map-outline" size={32} color="#9CA3AF" />
                        <Text className="text-gray-500 font-outfit-regular mt-2">{t('appointments.detail.info.locationNotAvailable')}</Text>
                    </View>
                )}
            </View>

            {/* Vehicle details */}
            <DetailCard>
                <DetailRow icon="car-outline" label={t('appointments.detail.info.car')} value={appointment.car} />
                <DetailRow icon="construct-outline" label={t('appointments.detail.info.carIssue')} value={issueValue} />
                <DetailRow
                    icon="document-text-outline"
                    label={t('appointments.detail.info.notes')}
                    value={appointment.notes || t('appointments.detail.info.noNotes')}
                    last
                />
            </DetailCard>
        </View>
    );
}
