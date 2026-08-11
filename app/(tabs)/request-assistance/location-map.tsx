import { Button } from '@/components/ui/Button';
import MapView, { Marker, Region } from '@/components/ui/Map';
import { useUser } from '@/context/UserContext';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function LocationMapScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { type, vehicleId, description, issues, details, photos, selectedAddress } = params;
    const { user } = useUser();

    // Helper to find address by type from the addresses array
    const homeAddress = user?.addresses?.find(a => a.type === 'home') ?? user?.addresses?.[0];
    const workAddress = user?.addresses?.find(a => a.type === 'work') ?? user?.addresses?.[1];

    const [region, setRegion] = useState<Region | null>(null);
    const [marker, setMarker] = useState<{ latitude: number; longitude: number } | null>(null);
    const [locationName, setLocationName] = useState(t('requestAssistance.locationMap.myCurrentLocation'));
    const [locationZip, setLocationZip] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isResolving, setIsResolving] = useState(false);
    // Block map-pan handler briefly after pin drag to avoid overwriting the dropped position.
    const dragJustEndedRef = React.useRef(false);
    const dragCooldownRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const getTitle = () => {
        switch (type) {
            case 'immediate': return t('requestAssistance.header.immediate');
            case 'scheduled': return t('requestAssistance.header.scheduled');
            case 'videocall': return t('requestAssistance.header.videoCall');
            case 'witness': return t('requestAssistance.header.accident');
            default: return t('requestAssistance.header.default');
        }
    };

    const getBadgeText = () => {
        switch (type) {
            case 'immediate': return t('requestAssistance.badge.immediate');
            case 'scheduled': return t('requestAssistance.badge.scheduled');
            case 'videocall': return t('requestAssistance.badge.videoCall');
            case 'witness': return t('requestAssistance.badge.accident');
            default: return t('requestAssistance.badge.default');
        }
    };

    const updateRegionFromLocation = async (location: Location.LocationObject) => {
        const newRegion = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
        };
        setRegion(newRegion);
        setMarker(location.coords);

        // Reverse geocode initial location
        const addrs = await Location.reverseGeocodeAsync(location.coords);
        if (addrs && addrs[0]) {
            const a = addrs[0];
            const address = `${a.streetNumber || ''} ${a.street || ''}, ${a.city || ''}, ${a.region || ''}`.trim().replace(/^, |, $/g, '').replace(/, ,/g, ',');
            setLocationName(address || t('requestAssistance.locationMap.myCurrentLocation'));
            setLocationZip(a.postalCode || '');
        }

        setIsLoading(false);
    };

    useEffect(() => {
        (async () => {
            // If we returned from address search with a selected address, geocode it
            if (selectedAddress) {
                // In a real app we would geocode this address string to coords.
                // For now, let's just mock it or try to forward geocode if we had a library.
                // Since we don't have a configured geocoder, we might have to rely on the search screen returning coords.
                // Let's assume the search screen returns coords if possible, or we defaults.
                // If selectedAddress is passed, we might need to parse it or it might be JSON.
                try {
                    const parsed = JSON.parse(selectedAddress as string);
                    if (parsed.lat && parsed.lon) {
                        const newRegion = {
                            latitude: parseFloat(parsed.lat),
                            longitude: parseFloat(parsed.lon),
                            latitudeDelta: 0.005,
                            longitudeDelta: 0.005,
                        };
                        setRegion(newRegion);
                        setMarker({ latitude: newRegion.latitude, longitude: newRegion.longitude });
                        setLocationName(parsed.label || t('requestAssistance.locationMap.selectedLocation'));
                        setLocationZip(parsed.zip || '');
                        setIsLoading(false);
                        return;
                    }
                } catch (e) {
                    // Not JSON or invalid, proceed to current location
                }
            }

            if (Platform.OS === 'web') {
                // On web, we might not need explicit permission request in the same way, or it might fail if not https/secure context
                try {
                    let location = await Location.getCurrentPositionAsync({});
                    updateRegionFromLocation(location);
                } catch (e) {
                    console.log("Web location error or denied", e);
                    // Fallback to default if location fails on web
                    const defaultRegion = {
                        latitude: 37.78825,
                        longitude: -122.4324,
                        latitudeDelta: 0.0922,
                        longitudeDelta: 0.0421,
                    };
                    setRegion(defaultRegion);
                    setMarker({ latitude: defaultRegion.latitude, longitude: defaultRegion.longitude });
                    setIsLoading(false);
                }
                return;
            }

            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                alert(t('requestAssistance.locationMap.permissionDenied'));
                setIsLoading(false);
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            updateRegionFromLocation(location);
        })();
    }, [selectedAddress]);

    const resolveLocation = async (coords: { latitude: number; longitude: number }) => {
        setIsResolving(true);
        try {
            const addrs = await Location.reverseGeocodeAsync(coords);
            if (addrs && addrs[0]) {
                const a = addrs[0];
                const address = `${a.streetNumber || ''} ${a.street || ''}, ${a.city || ''}, ${a.region || ''}`.trim().replace(/^, |, $/g, '').replace(/, ,/g, ',');
                setLocationName(address || t('requestAssistance.locationMap.customLocation'));
                setLocationZip(a.postalCode || '');
            }
        } catch (e) {
            console.error("Reverse geocode failed", e);
        } finally {
            setIsResolving(false);
        }
    };

    const handleConfirm = () => {
        if (!marker) return;

        // scheduled/videocall requests need a date, so they get an extra step;
        // immediate/witness are served right away and go straight to review.
        const needsDate = type === 'scheduled' || type === 'videocall';

        router.push({
            pathname: needsDate
                ? '/request-assistance/date-time'
                : '/request-assistance/confirmation',
            params: {
                ...params,
                latitude: marker.latitude,
                longitude: marker.longitude,
                addressLabel: locationName,
                locationZip: locationZip,
                // If we have a full address string from search, pass it, otherwise we use the label
                finalAddress: typeof selectedAddress === 'string' && selectedAddress.startsWith('{') ? JSON.parse(selectedAddress).label : locationName
            }
        });
    };

    /** Geocode an Address object (street + city + state + zip) and move the map pin there. */
    const geocodeAndSetAddress = async (address: { street?: string; city?: string; state?: string; zip?: string }, label: string) => {
        const query = [address.street, address.city, address.state, address.zip]
            .filter(Boolean)
            .join(', ');
        if (!query) {
            alert(t('requestAssistance.locationMap.noAddressDetails'));
            return;
        }
        try {
            const results = await Location.geocodeAsync(query);
            if (results && results.length > 0) {
                const { latitude, longitude } = results[0];
                setRegion({ latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 });
                setMarker({ latitude, longitude });
                setLocationName(label);
                setLocationZip(address.zip || '');
            } else {
                alert(t('requestAssistance.locationMap.coordsNotFound', { query }));
            }
        } catch (e) {
            console.error('Geocoding failed', e);
            alert(t('requestAssistance.locationMap.resolveFailed'));
        }
    };

    return (
        <View className="flex-1 bg-white">
            {/* Custom Header */}
            <View className="px-6 pt-20 pb-2 flex-row items-center justify-between z-10" style={{ backgroundColor: '#F4F5FA', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 3, borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB' }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <View className="w-10 h-10 rounded-full justify-center items-center" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
                        <ChevronLeft size={20} color="#0047AB" />
                    </View>
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Outfit_500Medium', fontSize: 18, color: '#1A1A1A', flex: 1, textAlign: 'center' }}>
                    {getTitle()}
                </Text>
                <View className="w-6" />
            </View>

            <ScrollView className="flex-1">
                <View className="px-6 pt-6">
                    <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                            {getBadgeText()}
                        </Text>
                    </View>

                    <Text className="text-gray-900 font-outfit-medium text-3xl mb-2">{t('requestAssistance.locationMap.title')}</Text>

                    <Text className="text-gray-500 font-outfit-regular text-base mb-6">
                        {t('requestAssistance.locationMap.subtitle')}
                    </Text>

                    <TouchableOpacity
                        onPress={() => router.push({
                            pathname: '/request-assistance/location-address',
                            params: params // Pass through existing params
                        })}
                        className="bg-white rounded-xl p-3 flex-row items-center shadow-sm border border-gray-200 mb-6"
                    >
                        <Search size={20} color="#9CA3AF" className="mr-2" />
                        <Text className="text-gray-400 font-outfit-regular">{t('requestAssistance.locationMap.searchAddress')}</Text>
                    </TouchableOpacity>
                </View>

                {isLoading || !region ? (
                    <View className="h-64 justify-center items-center">
                        <ActivityIndicator size="large" color="#0047AB" />
                    </View>
                ) : (
                    <View className="h-80 mb-6 mx-6 rounded-xl overflow-hidden">
                        <MapView
                            style={{ flex: 1 }}
                            initialRegion={region}
                            region={region}
                            onRegionChangeComplete={(r) => {
                                if (dragJustEndedRef.current) return;
                                setRegion(r);
                                setMarker({ latitude: r.latitude, longitude: r.longitude });
                                resolveLocation({ latitude: r.latitude, longitude: r.longitude });
                            }}
                        >
                            <Marker
                                coordinate={marker!}
                                draggable
                                onDragEnd={(e) => {
                                    const coords = e.nativeEvent.coordinate;
                                    setMarker(coords);
                                    resolveLocation(coords);
                                    // Lock out the pan handler briefly so it doesn't
                                    // snap the marker back to the map centre.
                                    dragJustEndedRef.current = true;
                                    if (dragCooldownRef.current) clearTimeout(dragCooldownRef.current);
                                    dragCooldownRef.current = setTimeout(() => {
                                        dragJustEndedRef.current = false;
                                    }, 600);
                                }}
                            />
                        </MapView>
                    </View>
                )}

                <View className="px-6 pb-6">
                    <View className="flex-row gap-4 mb-6">
                        <TouchableOpacity
                            onPress={() => {
                                if (homeAddress) {
                                    geocodeAndSetAddress(
                                        homeAddress,
                                        `${homeAddress.street || ''}, ${homeAddress.city || ''}`.trim().replace(/^,\s*/, '')
                                    );
                                } else {
                                    alert(t('requestAssistance.locationMap.noHomeAddress'));
                                }
                            }}
                            className="flex-1 bg-gray-50 p-4 rounded-xl border border-gray-100 relative"
                        >
                            <View className="flex-row justify-between items-start mb-1">
                                <Text className="text-blue-900 font-outfit-bold">{t('requestAssistance.locationMap.home')}</Text>
                            </View>
                            <Text numberOfLines={1} className="text-gray-500 text-xs">
                                {homeAddress ? `${homeAddress.street || ''}, ${homeAddress.city || ''}` : t('requestAssistance.locationMap.notSet')}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => {
                                if (workAddress) {
                                    geocodeAndSetAddress(
                                        workAddress,
                                        `${workAddress.street || ''}, ${workAddress.city || ''}`.trim().replace(/^,\s*/, '')
                                    );
                                } else {
                                    alert(t('requestAssistance.locationMap.noWorkAddress'));
                                }
                            }}
                            className="flex-1 bg-gray-50 p-4 rounded-xl border border-gray-100 relative"
                        >
                            <View className="flex-row justify-between items-start mb-1">
                                <Text className="text-blue-900 font-outfit-bold">{t('requestAssistance.locationMap.work')}</Text>
                            </View>
                            <Text numberOfLines={1} className="text-gray-500 text-xs">
                                {workAddress ? `${workAddress.street || ''}, ${workAddress.city || ''}` : t('requestAssistance.locationMap.notSet')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <Text className="text-gray-600 font-outfit-medium text-sm mb-2">{t('requestAssistance.locationMap.selectedLocationLabel')}</Text>
                    <Text className="text-gray-900 font-outfit-bold text-base mb-6">{locationName}</Text>

                    <TouchableOpacity
                        onPress={handleConfirm}
                        disabled={!marker}
                        activeOpacity={0.8}
                    >
                        {!marker ? (
                            <View className="bg-slate-200 rounded-lg p-4 items-center justify-center">
                                <Text className="text-gray-500 font-outfit-bold text-center">{t('requestAssistance.locationMap.confirmLocation')}</Text>
                            </View>
                        ) : (
                            <LinearGradient
                                colors={['#2B66F8', '#081E72']}
                                start={{ x: 0, y: 1 }}
                                end={{ x: 1, y: 0 }}
                                style={{
                                    borderRadius: 10,
                                    paddingVertical: 16,
                                    paddingHorizontal: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Text className="text-white font-outfit-bold text-center mr-2">{t('requestAssistance.locationMap.confirmLocation')}</Text>
                                <ChevronRight size={20} color="white" />
                            </LinearGradient>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}
