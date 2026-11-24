import { HeaderBell } from '@/components/HeaderBell';
import { FONT } from '@/lib/ui/fonts';
import { Footer } from '@/components/scheduled/ui';
import { ROUNDED_HEADER } from '@/lib/ui/header';
import { RequestSteps, stepEyebrow } from '@/components/ui/RequestSteps';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import { Button } from '@/components/ui/Button';
import MapView, { Marker, Region } from '@/components/ui/Map';
import { useUser } from '@/context/UserContext';
import { addressDisplayName, addressesForRole } from '@/lib/address';
import type { ParsedAddress } from '@/lib/places';
import * as Location from 'expo-location';
import { getCurrentPositionOrNull } from '@/lib/location/currentPosition';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Briefcase, ChevronDown, ChevronLeft, Home, MapPin } from 'lucide-react-native';
import { OwnerSheet, SheetOption } from '@/components/dashboard/OwnerHomeBlocks';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Keyboard, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { appAlert } from '@/lib/ui/appAlert';

export default function LocationMapScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { type, vehicleId, description, issues, details, photos } = params;
    const { user } = useUser();

    // Helper to find address by type from the addresses array. Only the active
    // role's addresses and the shared ones count.
    const roleAddresses = addressesForRole(user?.addresses, user?.role);
    const homeAddress = roleAddresses.find(a => a.type === 'home') ?? roleAddresses[0];
    const workAddress = roleAddresses.find(a => a.type === 'work') ?? roleAddresses.find(a => a !== homeAddress);

    const [region, setRegion] = useState<Region | null>(null);
    const [marker, setMarker] = useState<{ latitude: number; longitude: number } | null>(null);
    const [locationName, setLocationName] = useState(t('requestAssistance.locationMap.myCurrentLocation'));
    const [locationZip, setLocationZip] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickedAddressId, setPickedAddressId] = useState<string | null>(null);
    const [isResolving, setIsResolving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    /** Last address picked from the autocomplete — keeps Google's formatted string. */
    const [selectedFull, setSelectedFull] = useState<ParsedAddress | null>(null);
    // Block the map-pan handler briefly after we move the pin ourselves (drag or
    // programmatic recentre), so its reverse-geocode doesn't overwrite the label.
    const suppressRegionRef = React.useRef(false);
    const suppressCooldownRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const suppressRegionSync = (ms = 600) => {
        suppressRegionRef.current = true;
        if (suppressCooldownRef.current) clearTimeout(suppressCooldownRef.current);
        suppressCooldownRef.current = setTimeout(() => {
            suppressRegionRef.current = false;
        }, ms);
    };

    const getTitle = () => {
        switch (type) {
            case 'immediate': return t('requestAssistance.header.immediate');
            case 'scheduled': return t('requestAssistance.header.scheduled');
            case 'videocall': return t('requestAssistance.header.videoCall');
            case 'witness': return t('requestAssistance.header.accident');
            default: return t('requestAssistance.header.default');
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
                appAlert(t('requestAssistance.locationMap.permissionDenied'));
                setIsLoading(false);
                return;
            }

            const location = await getCurrentPositionOrNull();
            if (!location) {
                // No fix (GPS off or no signal): open the map over the country so the address search or a tap can still set the place.
                appAlert(t('requestAssistance.locationMap.unavailable'));
                setRegion({ latitude: 39.8, longitude: -98.6, latitudeDelta: 30, longitudeDelta: 30 });
                setIsLoading(false);
                return;
            }
            updateRegionFromLocation(location);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const resolveLocation = async (coords: { latitude: number; longitude: number }) => {
        // The pin no longer matches the searched address — drop it so `handleConfirm`
        // doesn't send a formatted string for a place the user moved away from.
        setSelectedFull(null);
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
                // Prefer Google's formatted string when the pin came from a search.
                finalAddress: selectedFull?.formatted ?? locationName
            }
        });
    };

    /**
     * A suggestion was picked in the inline search box: move the pin here without
     * leaving the screen. Places details normally carry coordinates; the rare
     * result that doesn't falls back to geocoding the address text.
     */
    const handleSelectAddress = async (address: ParsedAddress) => {
        const label =
            address.formatted ||
            `${address.street}, ${address.city} ${address.zip}`.trim();
        // The place is on the map now: the keyboard has nothing left to do.
        Keyboard.dismiss();
        setSelectedFull(address);
        setSearchQuery(label);
        await geocodeAndSetAddress(address, label);
    };

    /**
     * Move the map pin to a saved Address. Addresses created through Google
     * Places autocomplete already carry coordinates, so use them directly and
     * geocode only the older ones that predate that.
     */
    const geocodeAndSetAddress = async (
        address: { street?: string; city?: string; state?: string; zip?: string; locationLat?: number; locationLng?: number },
        label: string,
    ) => {
        if (address.locationLat !== undefined && address.locationLng !== undefined) {
            const latitude = address.locationLat;
            const longitude = address.locationLng;
            suppressRegionSync();
            setRegion({ latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 });
            setMarker({ latitude, longitude });
            setLocationName(label);
            setLocationZip(address.zip || '');
            return;
        }

        const query = [address.street, address.city, address.state, address.zip]
            .filter(Boolean)
            .join(', ');
        if (!query) {
            appAlert(t('requestAssistance.locationMap.noAddressDetails'));
            return;
        }
        try {
            const results = await Location.geocodeAsync(query);
            if (results && results.length > 0) {
                const { latitude, longitude } = results[0];
                suppressRegionSync();
                setRegion({ latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 });
                setMarker({ latitude, longitude });
                setLocationName(label);
                setLocationZip(address.zip || '');
            } else {
                appAlert(t('requestAssistance.locationMap.coordsNotFound', { query }));
            }
        } catch (e) {
            console.error('Geocoding failed', e);
            appAlert(t('requestAssistance.locationMap.resolveFailed'));
        }
    };

    return (
        <View className="flex-1 bg-white">
            {/* Custom Header */}
            <View className="px-6 pt-20 pb-2 flex-row items-center justify-between z-10" style={[ROUNDED_HEADER, { paddingTop: 63 }]}>
                <TouchableOpacity onPress={() => router.back()}>
                    <View className="rounded-full justify-center items-center" style={{ width: 30, height: 30, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
                        <ChevronLeft size={16} color="#0047AB" />
                    </View>
                </TouchableOpacity>
                <Text style={{ fontFamily: FONT.medium, fontSize: 18, color: '#1A1A1A', flex: 1, textAlign: 'center' }}>
                    {getTitle()}
                </Text>
                <HeaderBell />
            </View>
            <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
                <View className="px-6 pt-4">
                        <RequestSteps type={params.type} step="location" flush />
                    <View className="flex-row items-center justify-between" style={{ marginBottom: 16 }}>
                        <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                            <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                            <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                                {stepEyebrow(t, params.type, 'location')}
                            </Text>
                        </View>
                    </View>

                    <Text className="text-gray-900 font-outfit-medium text-3xl mb-2">{t('requestAssistance.locationMap.title')}</Text>

                    <Text className="text-gray-500 font-outfit-regular text-base mb-6">
                        {t('requestAssistance.locationMap.subtitle')}
                    </Text>

                    {/* Inline search: picking a suggestion recentres the map below,
                        without pushing a separate screen onto the wizard stack. */}
                    <View className="mb-6 z-50">
                        <AddressAutocomplete
                            value={searchQuery}
                            onChangeText={(text) => {
                                setSearchQuery(text);
                                setSelectedFull(null);
                            }}
                            onSelect={handleSelectAddress}
                            placeholder={t('requestAssistance.locationMap.searchAddress')}
                            containerClassName="bg-white border border-gray-200 rounded-xl"
                        />
                    </View>
                </View>

                {isLoading || !region ? (
                    <View className="h-64 justify-center items-center">
                        <ActivityIndicator size="large" color="#0047AB" />
                    </View>
                ) : (
                    <View className="h-80 mb-6 mx-6 rounded-xl overflow-hidden" style={{ borderWidth: 1.5, borderColor: '#D6E0F2' }}>
                        <MapView
                            style={{ flex: 1 }}
                            initialRegion={region}
                            region={region}
                            onRegionChangeComplete={(r) => {
                                if (suppressRegionRef.current) return;
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
                                    suppressRegionSync();
                                }}
                            />
                        </MapView>
                    </View>
                )}

                <View className="px-6 pb-6">
                    {/* The chosen place is one selector: tapping it opens the saved addresses from below (no Home / Work cards taking room here). */}
                    <TouchableOpacity
                        onPress={() => { Keyboard.dismiss(); setPickerOpen(true); }}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('requestAssistance.locationMap.selectedLocationLabel')}: ${locationName}. ${t('requestAssistance.locationMap.change')}`}
                        className="flex-row items-center bg-gray-50 p-4 rounded-xl border border-gray-100"
                        style={{ gap: 12 }}
                        testID="selected-location-card"
                    >
                        <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#E6EEFF' }}>
                            <MapPin size={22} color="#0047AB" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-blue-900 font-outfit-bold mb-0.5">{t('requestAssistance.locationMap.selectedLocationLabel')}</Text>
                            <Text className="text-gray-900 font-outfit-semibold text-base" numberOfLines={2}>{locationName}</Text>
                        </View>
                        <View className="flex-row items-center" style={{ gap: 2 }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 15, color: '#1E56E3' }}>{t('requestAssistance.locationMap.change')}</Text>
                            <ChevronDown size={18} color="#1E56E3" />
                        </View>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <OwnerSheet
                visible={pickerOpen}
                title={t('requestAssistance.locationMap.pickTitle')}
                subtitle={t('requestAssistance.locationMap.pickSubtitle')}
                onClose={() => setPickerOpen(false)}
            >
                <View style={{ gap: 10 }} testID="location-picker">
                    {roleAddresses.length === 0 ? (
                        <Text className="text-gray-500 font-outfit-regular text-base">{t('requestAssistance.locationMap.noSaved')}</Text>
                    ) : roleAddresses.map((a) => {
                        const line = `${a.street || ''}, ${a.city || ''}`.trim().replace(/^,\s*/, '');
                        const name = addressDisplayName(a, t) ?? (a.type === 'work' ? t('requestAssistance.locationMap.work') : t('requestAssistance.locationMap.home'));
                        return (
                            <SheetOption
                                key={a.id ?? line}
                                icon={a.type === 'work' ? Briefcase : Home}
                                title={name}
                                subtitle={line}
                                selected={!!a.id && a.id === pickedAddressId}
                                onPress={() => {
                                    setPickedAddressId(a.id ?? null);
                                    setPickerOpen(false);
                                    void geocodeAndSetAddress(a, line);
                                }}
                            />
                        );
                    })}
                </View>
            </OwnerSheet>

            <Footer label={t('requestAssistance.locationMap.confirmLocation')} disabled={!marker} onPress={handleConfirm} />
        </View>
    );
}
