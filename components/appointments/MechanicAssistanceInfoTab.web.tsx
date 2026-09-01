import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { AttachmentStrip } from './AttachmentStrip';
import { parseAttachments } from '@/lib/media/attachments';
import { Text, TouchableOpacity, View } from 'react-native';
// Leaflet CSS is injected via link tag in component

interface MechanicAssistanceInfoTabProps {
    appointment: any;
    onScan: () => void;
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

export function MechanicAssistanceInfoTab({ appointment, onScan }: MechanicAssistanceInfoTabProps) {
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

                <View>
                    <Text className="font-outfit-bold text-gray-900 text-base">Time since accepted:</Text>
                    <Text className="text-gray-600 font-outfit-regular">02:30 (Simulated)</Text>
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
                {parseAttachments(appointment.photos).length > 0 && (
                    <View>
                        <Text className="font-outfit-bold text-gray-900 text-base mb-2">Photos:</Text>
                        <AttachmentStrip photos={appointment.photos} size={96} />
                    </View>
                )}

                <View>
                    <Text className="font-outfit-bold text-gray-900 text-base">Address:</Text>
                    <Text className="text-gray-600 font-outfit-regular">{appointment.address}</Text>
                    {/* React Leaflet Map for Web */}
                    <View style={{ height: 200, width: '100%', borderRadius: 12, overflow: 'hidden', marginTop: 8, backgroundColor: '#E5E7EB' }}>
                        <ClientSideMap appointment={appointment} />
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
