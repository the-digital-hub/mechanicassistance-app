import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { DetailCard, DetailRow } from './DetailCard';
// Leaflet CSS is injected via link tag in component

interface MechanicAssistanceInfoTabProps {
    appointment: any;
}

const ClientSideMap = ({ appointment }: { appointment: any }) => {
    const [LeafletComponents, setLeafletComponents] = useState<any>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const L = require('leaflet');
            const { MapContainer, TileLayer, Marker, Popup } = require('react-leaflet');

            // Fix Leaflet icons
            if (!L.Icon.Default.prototype._getIconUrl_fixed) {
                delete L.Icon.Default.prototype._getIconUrl;
                L.Icon.Default.mergeOptions({
                    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                });
                L.Icon.Default.prototype._getIconUrl_fixed = true;
            }

            setLeafletComponents({ MapContainer, TileLayer, Marker, Popup });
        }
    }, []);

    if (!appointment.locationLat || !appointment.locationLng) {
        return (
            <View className="flex-1 items-center justify-center h-full">
                <Ionicons name="map-outline" size={32} color="#9CA3AF" />
                <Text className="text-gray-500 font-outfit-regular mt-2">Location not available</Text>
            </View>
        );
    }

    if (!LeafletComponents) return null;

    const { MapContainer, TileLayer, Marker, Popup } = LeafletComponents;

    return (
        <>
            <link
                rel="stylesheet"
                href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
                integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
                crossOrigin=""
            />
            <MapContainer
                center={[appointment.locationLat, appointment.locationLng]}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[appointment.locationLat, appointment.locationLng]}>
                    <Popup>
                        {appointment.address}
                    </Popup>
                </Marker>
            </MapContainer>
        </>
    );
};

export function MechanicAssistanceInfoTab({ appointment }: MechanicAssistanceInfoTabProps) {
    const { t } = useTranslation();
    const issueValue = appointment.vehicleIssues?.length
        ? appointment.vehicleIssues.map((i: { name: string }) => i.name).join(', ')
        : '—';

    return (
        <View className="gap-3.5">
            {/* Trip logistics — grouped with the map right below */}
            <DetailCard>
                <DetailRow icon="location-outline" label={t('appointments.detail.info.address')} value={appointment.address} last />
            </DetailCard>

            {/* React Leaflet Map for Web */}
            <View style={{ height: 200, width: '100%', borderRadius: 18, overflow: 'hidden', backgroundColor: '#E5E7EB' }}>
                <ClientSideMap appointment={appointment} />
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
