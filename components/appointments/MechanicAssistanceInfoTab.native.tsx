import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { formatEtaTime, useAppointmentEta } from '@/hooks/useAppointmentEta';

interface MechanicAssistanceInfoTabProps {
    appointment: any;
    onScan: () => void;
}

export function MechanicAssistanceInfoTab({ appointment, onScan }: MechanicAssistanceInfoTabProps) {
    const mapRef = React.useRef<MapView | null>(null);
    const [mechanicCoords, setMechanicCoords] = React.useState<{ latitude: number; longitude: number } | null>(null);

    // Request location coords are the client's chosen point (default address or
    // the spot they dropped on the map) — always the destination reference.
    const requestCoords =
        appointment?.locationLat != null && appointment?.locationLng != null
            ? { latitude: appointment.locationLat, longitude: appointment.locationLng }
            : null;

    // Live ETA / arrival hour (shared with the client via the same hook).
    const { minutesAway, etaTime, loading: etaLoading } = useAppointmentEta(
        appointment?.id,
        appointment?.status,
    );

    // Always position the mechanic with their own current location.
    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;
                const loc = await Location.getCurrentPositionAsync({});
                if (!cancelled) {
                    setMechanicCoords({
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                    });
                }
            } catch {
                // no-op: mechanic marker simply won't render
            }
        })();
        return () => { cancelled = true; };
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

    return (
        <View className="gap-6">
            {/* Blue Header Banner */}
            <View className="bg-blue-600 rounded-xl p-4 flex-row items-center gap-3">
                <View className="bg-white/20 p-2 rounded-full">
                    <Ionicons name="construct" size={24} color="white" />
                </View>
                <Text className="text-white font-outfit-bold text-lg">
                    {appointment.assistanceType === 'witness' ? 'ACCIDENT ASSISTANCE' :
                        appointment.type === 'immediate' ? 'Immediate Assistance' :
                            appointment.type === 'videocall' || appointment.type === 'video' ? 'Video Call Assistance' :
                                'Scheduled Assistance'}
                </Text>
            </View>

            {/* Assistance Details */}
            <View className="gap-4">
                <View>
                    <Text className="font-outfit-bold text-gray-900 text-base">Assistance:</Text>
                    <Text className="text-gray-600 font-outfit-regular">{appointment.title}</Text>
                </View>

                {/* Arrival ETA — live, shared with the client */}
                <View>
                    <Text className="font-outfit-bold text-gray-900 text-base">Arrival time:</Text>
                    <Text className="text-gray-600 font-outfit-regular">
                        {etaLoading
                            ? 'Calculating...'
                            : minutesAway !== null
                                ? `${minutesAway} min away`
                                : 'On the way'}
                    </Text>
                </View>

                <View>
                    <Text className="font-outfit-bold text-gray-900 text-base">Estimated arrival:</Text>
                    <Text className="text-gray-600 font-outfit-regular">
                        {etaTime ? formatEtaTime(etaTime) : etaLoading ? '—' : 'Pending'}
                    </Text>
                </View>

                <View>
                    <Text className="font-outfit-bold text-gray-900 text-base">Car:</Text>
                    <Text className="text-gray-600 font-outfit-regular">{appointment.car}</Text>
                </View>

                <View>
                    <Text className="font-outfit-bold text-gray-900 text-base">Notes:</Text>
                    <Text className="text-gray-600 font-outfit-regular leading-5">
                        {appointment.notes || 'No notes provided.'}
                    </Text>
                </View>

                {/* Photos Carousel */}
                {appointment.photos && appointment.photos.length > 0 && (
                    <View>
                        <Text className="font-outfit-bold text-gray-900 text-base mb-2">Photos:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
                            {appointment.photos.map((photo: string, index: number) => (
                                <Image
                                    key={index}
                                    source={{ uri: photo }}
                                    className="w-24 h-24 rounded-lg bg-gray-100"
                                    resizeMode="cover"
                                />
                            ))}
                        </ScrollView>
                    </View>
                )}

                <View>
                    <Text className="font-outfit-bold text-gray-900 text-base">Address:</Text>
                    <Text className="text-gray-600 font-outfit-regular">{appointment.address}</Text>
                    {/* Map View — request pin (client location) + mechanic pin (own GPS) */}
                    <View className="h-48 rounded-xl mt-2 overflow-hidden bg-gray-200">
                        {requestCoords ? (
                            <MapView
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
                            </MapView>
                        ) : (
                            <View className="flex-1 items-center justify-center">
                                <Ionicons name="map-outline" size={32} color="#9CA3AF" />
                                <Text className="text-gray-500 font-outfit-regular mt-2">Location not available</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>

            {/* Scan QR Button */}
            <View className="mt-2">
                <Text className="font-outfit-bold text-gray-900 text-base mb-2">When you arrive on-site:</Text>
                <TouchableOpacity
                    onPress={onScan}
                    className="bg-blue-800 w-full py-3 rounded-lg flex-row items-center justify-center gap-2"
                >
                    <Ionicons name="qr-code-outline" size={20} color="white" />
                    <Text className="text-white font-outfit-bold text-base">Scan QR</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
