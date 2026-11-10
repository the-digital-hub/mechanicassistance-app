import { AO } from '@/components/offer/OfferSections';
import { MAP_PROVIDER } from '@/lib/maps/provider';
import { decodePolyline, googleDirectionsUrl, LatLng } from '@/lib/maps/polyline';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface OwnerRouteMapProps {
    destination: LatLng | null;
    mechanic: LatLng | null;
    polyline: string | null;
    height?: number;
}

/** Frames the customer pin, the mechanic and the road route between them. */
function useFitRoute(mapRef: React.RefObject<MapView | null>, destination: LatLng | null, mechanic: LatLng | null, route: LatLng[], padding: number) {
    return React.useCallback(() => {
        const coords = [destination, mechanic, ...route].filter(Boolean) as LatLng[];
        if (coords.length >= 2) {
            mapRef.current?.fitToCoordinates(coords, {
                edgePadding: { top: padding, right: padding, bottom: padding, left: padding },
                animated: true,
            });
        }
    }, [mapRef, destination?.latitude, destination?.longitude, mechanic?.latitude, mechanic?.longitude, route, padding]);
}

/** Road route, red pin for the customer, live dot for the mechanic: shared by the card and the full-screen map. */
function RouteLayers({ destination, mechanic, route }: { destination: LatLng; mechanic: LatLng | null; route: LatLng[] }) {
    return (
        <>
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
        </>
    );
}

const floating = { backgroundColor: 'rgba(255,255,255,0.95)', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 };

/**
 * The route in a card over the dimmed screen, so the owner follows the mechanic
 * without leaving the app: pan and zoom freely; tapping outside closes it.
 * It keeps refitting as the mechanic moves until the owner pans; recenter resumes that.
 */
function RouteMapSheet({ destination, mechanic, route, onClose }: { destination: LatLng; mechanic: LatLng | null; route: LatLng[]; onClose: () => void }) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const mapRef = React.useRef<MapView | null>(null);
    const followRef = React.useRef(true);
    const fit = useFitRoute(mapRef, destination, mechanic, route, 48);

    React.useEffect(() => {
        if (followRef.current) fit();
    }, [fit]);

    const recenter = () => {
        followRef.current = true;
        fit();
    };

    return (
        <View
            style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', paddingHorizontal: 16, paddingTop: insets.top + 88, paddingBottom: insets.bottom + 84 }}
            testID="owner-route-map-fullscreen"
        >
            {/* The dimmed app behind the card: a tap there closes it. */}
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} testID="owner-route-map-backdrop" />

            <View style={{ flex: 1, borderRadius: 22, overflow: 'hidden', backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 18, paddingRight: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: AO.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="navigate" size={16} color={AO.blue} />
                        <Text className="font-outfit-bold" style={{ fontSize: 16, color: AO.text }}>{t('appointments.ownerAccepted.mapTitle')}</Text>
                    </View>
                    <Pressable
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel={t('appointments.ownerAccepted.closeMap')}
                        hitSlop={8}
                        style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F4F9' }}
                        testID="owner-route-map-close"
                    >
                        <Ionicons name="close" size={20} color={AO.text} />
                    </Pressable>
                </View>

                <View style={{ flex: 1, backgroundColor: '#E8EDF5' }}>
                    <MapView
                        provider={MAP_PROVIDER}
                        ref={mapRef}
                        style={{ flex: 1 }}
                        onMapReady={fit}
                        onPanDrag={() => {
                            followRef.current = false;
                        }}
                        toolbarEnabled={false}
                        showsCompass={false}
                        initialRegion={{ ...destination, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
                    >
                        <RouteLayers destination={destination} mechanic={mechanic} route={route} />
                    </MapView>

                    <View style={{ position: 'absolute', bottom: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Pressable
                            onPress={() => Linking.openURL(googleDirectionsUrl(mechanic, destination))}
                            accessibilityRole="link"
                            style={[floating, { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 100 }]}
                            testID="owner-route-map-open-in-maps"
                        >
                            <Ionicons name="navigate-outline" size={15} color={AO.blue} />
                            <Text className="font-outfit-bold" style={{ fontSize: 13, color: AO.blue }}>{t('appointments.ownerAccepted.openInMaps')}</Text>
                        </Pressable>
                        <Pressable
                            onPress={recenter}
                            accessibilityRole="button"
                            accessibilityLabel={t('appointments.ownerAccepted.recenter')}
                            style={[floating, { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }]}
                            testID="owner-route-map-recenter"
                        >
                            <Ionicons name="locate-outline" size={21} color={AO.blue} />
                        </Pressable>
                    </View>
                </View>
            </View>
        </View>
    );
}

/**
 * The mechanic's route to the customer, inside the ETA card: road route from
 * the backend's Directions call, live mechanic dot, red pin for the customer.
 * Static inside the scroll view; a tap opens it full screen.
 */
export function OwnerRouteMap({ destination, mechanic, polyline, height = 190 }: OwnerRouteMapProps) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = React.useState(false);
    const mapRef = React.useRef<MapView | null>(null);
    const route = React.useMemo(() => (polyline ? decodePolyline(polyline) : []), [polyline]);
    const fit = useFitRoute(mapRef, destination, mechanic, route, 36);

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
        <>
            <Pressable
                style={frame}
                onPress={() => setExpanded(true)}
                accessibilityRole="button"
                accessibilityLabel={t('appointments.ownerAccepted.expandMap')}
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
                        <RouteLayers destination={destination} mechanic={mechanic} route={route} />
                    </MapView>
                </View>
                <View style={{ position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.92)' }}>
                    <Ionicons name="expand-outline" size={11} color={AO.blue} />
                    <Text className="font-outfit-bold" style={{ fontSize: 10.5, color: AO.blue }}>{t('appointments.ownerAccepted.expandMap')}</Text>
                </View>
            </Pressable>
            <Modal visible={expanded} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setExpanded(false)}>
                <RouteMapSheet destination={destination} mechanic={mechanic} route={route} onClose={() => setExpanded(false)} />
            </Modal>
        </>
    );
}
