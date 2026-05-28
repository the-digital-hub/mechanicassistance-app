import { Button } from '@/components/ui/Button';
import MapView, { Marker, Region } from '@/components/ui/Map';
import { useUser } from '@/context/UserContext';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Search } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';

export default function LocationMapScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { type, vehicleId, description, issues, details, photos, selectedAddress } = params;
    const { user } = useUser();

    // Helper to find address by type from the addresses array
    const homeAddress = user?.addresses?.find(a => a.type === 'home') ?? user?.addresses?.[0];
    const workAddress = user?.addresses?.find(a => a.type === 'work') ?? user?.addresses?.[1];

    const [region, setRegion] = useState<Region | null>(null);
    const [marker, setMarker] = useState<{ latitude: number; longitude: number } | null>(null);
    const [locationName, setLocationName] = useState('My Current Location');
    const [locationZip, setLocationZip] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isResolving, setIsResolving] = useState(false);

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
            setLocationName(address || 'My Current Location');
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
                        setLocationName(parsed.label || 'Selected Location');
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
                alert('Permission to access location was denied');
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
                setLocationName(address || 'Custom Location');
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

        router.push({
            pathname: '/request-assistance/confirmation',
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
            alert('No address details available. Please add an address in your profile.');
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
                alert(`Could not find coordinates for "${query}". Please search manually.`);
            }
        } catch (e) {
            console.error('Geocoding failed', e);
            alert('Could not resolve address. Please search manually.');
        }
    };

    return (
        <View className="flex-1 bg-white">
            {/* Header */}
            <View className="px-6 pt-14 pb-4 border-b border-gray-100 flex-row items-center z-10 bg-white">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <ChevronLeft size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text className="text-xl font-outfit-bold text-[#0F172A] flex-1 text-center">
                    Assistance
                </Text>
                <TouchableOpacity onPress={() => router.replace('/(tabs)/assist')} className="ml-4">
                    <Text className="text-red-500 font-outfit-medium text-xs">Cancel</Text>
                </TouchableOpacity>
            </View>
            <View className="px-6 pb-2 pb-4">
                <Text className="text-blue-600 font-outfit-bold text-lg text-center">
                    Request a mechanic
                </Text>
                <Text className="text-gray-900 text-sm font-outfit-bold text-center mb-4">
                    Indicate your location
                </Text>

                <TouchableOpacity
                    onPress={() => router.push({
                        pathname: '/request-assistance/location-address',
                        params: params // Pass through existing params
                    })}
                    className="bg-white rounded-xl p-3 flex-row items-center shadow-sm border border-gray-200"
                >
                    <Search size={20} color="#9CA3AF" className="mr-2" />
                    <Text className="text-gray-400 font-outfit-regular">Search Address</Text>
                </TouchableOpacity>
            </View>

            <View className="flex-1 relative">
                {isLoading || !region ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator size="large" color="#0047AB" />
                    </View>
                ) : (
                    <MapView
                        style={{ flex: 1 }}
                        initialRegion={region}
                        region={region}
                        onRegionChangeComplete={(r) => {
                            setRegion(r);
                            setMarker({ latitude: r.latitude, longitude: r.longitude });
                            // Ideally reverse geocode here to update text, but skipping for perf/api limits
                        }}
                    >
                        {/* We put a fixed marker in center or let it move with map? 
                             The prompt says "draggable pin". Usually this means pin stays center and map moves, OR pin is draggable.
                             react-native-maps Marker has `draggable`.
                         */}
                        <Marker
                            coordinate={marker!}
                            draggable
                            onDragEnd={(e) => {
                                const coords = e.nativeEvent.coordinate;
                                setMarker(coords);
                                resolveLocation(coords);
                            }}
                        />
                    </MapView>
                )}

                {/* Overlays */}


                {/* Bottom Panel */}
                <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 shadow-lg">
                    <View className="items-center mb-4">
                        <View className="bg-gray-200 w-12 h-1 rounded-full" />
                    </View>

                    <View className="flex-row gap-4 mb-6">
                        <TouchableOpacity
                            onPress={() => {
                                if (homeAddress) {
                                    geocodeAndSetAddress(
                                        homeAddress,
                                        `${homeAddress.street || ''}, ${homeAddress.city || ''}`.trim().replace(/^,\s*/, '')
                                    );
                                } else {
                                    alert('No home address saved. Add one in your profile settings.');
                                }
                            }}
                            className="flex-1 bg-gray-50 p-4 rounded-xl border border-gray-100 relative"
                        >
                            <View className="flex-row justify-between items-start mb-1">
                                <Text className="text-blue-900 font-outfit-bold">Home</Text>
                            </View>
                            <Text numberOfLines={1} className="text-gray-500 text-xs">
                                {homeAddress ? `${homeAddress.street || ''}, ${homeAddress.city || ''}` : 'Not set'}
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
                                    alert('No work address saved. Add one in your profile settings.');
                                }
                            }}
                            className="flex-1 bg-gray-50 p-4 rounded-xl border border-gray-100 relative"
                        >
                            <View className="flex-row justify-between items-start mb-1">
                                <Text className="text-blue-900 font-outfit-bold">Work</Text>
                            </View>
                            <Text numberOfLines={1} className="text-gray-500 text-xs">
                                {workAddress ? `${workAddress.street || ''}, ${workAddress.city || ''}` : 'Not set'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View className="mb-6">
                        <Text className="text-blue-600 font-outfit-bold text-xs text-center mb-2 uppercase tracking-wider">
                            Your location
                        </Text>
                        <Text className="text-xl font-outfit-bold text-center text-gray-900">
                            {locationName}
                        </Text>
                        {locationZip ? (
                            <Text className="text-sm font-outfit-regular text-center text-gray-500 mt-1">
                                Zip Code: {locationZip}
                            </Text>
                        ) : null}
                    </View>

                    <Button onPress={handleConfirm} className="bg-blue-700 rounded-xl">
                        Confirm Location
                    </Button>
                </View>
            </View>
        </View>
    );
}
