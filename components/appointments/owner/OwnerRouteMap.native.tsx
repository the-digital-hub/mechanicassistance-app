import { AO } from '@/components/offer/OfferSections';
import { MAP_PROVIDER } from '@/lib/maps/provider';
import { decodePolyline, googleDirectionsUrl, LatLng } from '@/lib/maps/polyline';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

export interface OwnerRouteMapProps {
    destination: LatLng | null;
    mechanic: LatLng | null;
    polyline: string | null;
    height?: number;
}

/**
 * The mechanic's route to the customer, inside the ETA card: road route from
 * the backend's Directions call, live mechanic dot, red pin for the customer.
 * Static inside the scroll view; a tap opens the route in Google Maps.
 */
export function OwnerRouteMap({ destination, mechanic, polyline, height = 190 }: OwnerRouteMapProps) {
    const { t } = useTranslation();
    const mapRef = React.useRef<MapView | null>(null);
    const route = React.useMemo(() => (polyline ? decodePolyline(polyline) : []), [polyline]);

    const fit = React.useCallback(() => {
        const coords = [destination, mechanic, ...route].filter(Boolean) as LatLng[];
        if (coords.length >= 2) {
            mapRef.current?.fitToCoordinates(coords, {
                edgePadding: { top: 36, right: 36, bottom: 36, left: 36 },
                animated: true,
            });
        }
    }, [destination?.latitude, destination?.longitude, mechanic?.latitude, mechanic?.longitude, route]);

    React.useEffect(() => {
        fit();
    }, [fit]);

    const frame = { height, borderRadius: 14, overflow: 'hidden' as const, borderWidth: 1, borderColor: AO.border, backgroundColor: '#E8EDF5' };

    if (!destination) {
        return (
            <View style={[frame, { alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="map-outline" size={28} color={AO.mutedLight} />
                <Text className="font-outfit-regular" style={{ color: AO.muted, marginTop: 6, fontSize: 12 }}>
                    {t('appointments.userStatus.locationNotAvailable')}
                </Text>
            </View>
        );
    }

    return (
        <Pressable
            style={frame}
            onPress={() => Linking.openURL(googleDirectionsUrl(mechanic, destination))}
            accessibilityRole="link"
            accessibilityLabel={t('appointments.ownerAccepted.openInMaps')}
            testID="owner-route-map"
        >
            <View pointerEvents="none" style={{ flex: 1 }}>
                <MapView
                    provider={MAP_PROVIDER}
                    ref={mapRef}
                    style={{ flex: 1 }}
                    onMapReady={fit}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    toolbarEnabled={false}
                    showsCompass={false}
                    initialRegion={{ ...destination, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
                >
                    {route.length > 1 && <Polyline coordinates={route} strokeColor={AO.blue} strokeWidth={4} />}
                    <Marker coordinate={destination} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
                        <Ionicons name="location" size={30} color={AO.red} />
                    </Marker>
                    {mechanic && (
                        <Marker coordinate={mechanic} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(30,86,227,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: AO.blue, borderWidth: 2.5, borderColor: '#fff' }} />
                            </View>
                        </Marker>
                    )}
                </MapView>
            </View>
            <View style={{ position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.92)' }}>
                <Ionicons name="navigate-outline" size={11} color={AO.blue} />
                <Text className="font-outfit-bold" style={{ fontSize: 10.5, color: AO.blue }}>{t('appointments.ownerAccepted.openInMaps')}</Text>
            </View>
        </Pressable>
    );
}
