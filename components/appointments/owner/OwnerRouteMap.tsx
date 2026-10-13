import { AO } from '@/components/offer/OfferSections';
import { googleDirectionsUrl, LatLng } from '@/lib/maps/polyline';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text } from 'react-native';

export interface OwnerRouteMapProps {
    destination: LatLng | null;
    mechanic: LatLng | null;
    polyline: string | null;
    height?: number;
}

/** Web has no react-native-maps: same frame, a link to the route in Google Maps. */
export function OwnerRouteMap({ destination, mechanic, height = 190 }: OwnerRouteMapProps) {
    const { t } = useTranslation();
    return (
        <Pressable
            disabled={!destination}
            onPress={() => destination && Linking.openURL(googleDirectionsUrl(mechanic, destination))}
            style={{ height, borderRadius: 14, borderWidth: 1, borderColor: AO.border, backgroundColor: '#E8EDF5', alignItems: 'center', justifyContent: 'center' }}
            testID="owner-route-map"
        >
            <Ionicons name="map-outline" size={28} color={AO.mutedLight} />
            <Text className="font-outfit-bold" style={{ color: destination ? AO.blue : AO.muted, marginTop: 6, fontSize: 12 }}>
                {destination ? t('appointments.ownerAccepted.openInMaps') : t('appointments.userStatus.locationNotAvailable')}
            </Text>
        </Pressable>
    );
}
