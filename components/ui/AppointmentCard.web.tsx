import { Appointment } from '@/context/AppointmentsContext';
import { useRouter } from 'expo-router';
import { Car, MapPin, MessageSquare, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { BANNER_COLORS, TYPE_BAR_ACTIVE, TYPE_BAR_PAST, getCardState, getTypeBar, isPastState } from './appointmentCardTheme';
// Leaflet CSS is injected via link tag in render

// Internal component to load Leaflet only on client side
const ClientSideMap = ({ appointment, emptyLabel }: { appointment: Appointment; emptyLabel: string }) => {
    const [LeafletComponents, setLeafletComponents] = useState<any>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const L = require('leaflet');
            const { MapContainer, TileLayer, Marker } = require('react-leaflet');

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

            setLeafletComponents({ MapContainer, TileLayer, Marker });
        }
    }, []);

    if (!appointment.locationLat || !appointment.locationLng) {
        return (
            <View className="flex-1 items-center justify-center h-full">
                <MapPin size={24} color="#9CA3AF" />
                <Text className="text-gray-400 font-outfit-regular text-xs mt-1">{emptyLabel}</Text>
            </View>
        );
    }

    if (!LeafletComponents) return null;

    const { MapContainer, TileLayer, Marker } = LeafletComponents;

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
                zoom={14}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
                dragging={false}
                zoomControl={false}
                attributionControl={false}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[appointment.locationLat, appointment.locationLng]} />
            </MapContainer>
            {/* Overlay to intercept clicks */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1000, backgroundColor: 'transparent' }} />
        </>
    );
};

interface AppointmentCardProps {
    appointment: Appointment;
    onCancel: (id: string) => void;
}

export function AppointmentCard({ appointment, onCancel }: AppointmentCardProps) {
    const router = useRouter();
    const { t } = useTranslation();
    const isPending = appointment.status === 'pending';
    const state = getCardState(appointment.status);
    const isPast = isPastState(state);
    const banner = BANNER_COLORS[state];
    const typeBar = getTypeBar(appointment);
    const Icon = typeBar.icon;

    return (
        <TouchableOpacity
            className="bg-white rounded-2xl overflow-hidden mb-4 shadow-sm border border-gray-100"
            onPress={() => router.navigate(`/appointments/${appointment.id}`)}
            activeOpacity={0.7}
        >
            {/* Status banner */}
            <View className="px-3 py-3 items-center" style={{ backgroundColor: banner.bg }}>
                <Text className="font-outfit-bold text-[10px] uppercase tracking-widest" style={{ color: banner.label }}>
                    {t('appointments.list.card.statusLabel')}
                </Text>
                <Text className="font-outfit-bold text-base uppercase" style={{ color: banner.title }}>
                    {t(`appointments.list.card.status.${state}`)}
                </Text>
                <Text className="font-outfit-medium text-xs" style={{ color: banner.hint }}>
                    {t(`appointments.list.card.status.${state}Hint`)}
                </Text>
            </View>

            {/* Type bar */}
            <View
                className="px-4 py-3 flex-row items-center justify-between"
                style={{ backgroundColor: isPast ? TYPE_BAR_PAST : TYPE_BAR_ACTIVE }}
            >
                <View className="flex-row items-center gap-2">
                    <Icon size={16} color="white" />
                    <Text className="text-white font-outfit-bold text-base">{t(typeBar.labelKey)}</Text>
                </View>
                <Text className="text-white/80 font-outfit-medium text-xs">#{appointment.id.slice(0, 8)}</Text>
            </View>

            <View className="p-4">
                <Text className="text-xl font-outfit-bold text-gray-900 mb-1">
                    {t(`appointments.list.card.title.${state}`)}
                </Text>

                <View className="flex-row items-center mb-3">
                    <Car size={14} color="#9CA3AF" />
                    <Text className="text-gray-400 text-sm font-outfit-regular ml-2">{t('appointments.list.card.vehicleId')} </Text>
                    <Text className="text-gray-800 text-sm font-outfit-bold flex-shrink" numberOfLines={1}>{appointment.car}</Text>
                </View>

                {/* React Leaflet Map for Web */}
                <View style={{ height: 128, width: '100%', borderRadius: 12, overflow: 'hidden', marginBottom: 12, backgroundColor: '#F3F4F6', position: 'relative' }}>
                    <ClientSideMap appointment={appointment} emptyLabel={t('appointments.list.card.locationNotAvailable')} />
                </View>

                <Text className="text-base font-outfit-bold text-gray-900 mb-1">{appointment.address}</Text>
                <View className="flex-row items-center mb-4">
                    <MapPin size={12} color="#6B7280" />
                    <Text className="text-gray-500 text-xs ml-1">{t('appointments.list.card.distanceNA')}</Text>
                </View>

                {isPast ? (
                    <View className="self-start bg-gray-100 border border-gray-200 rounded-lg py-2 px-4 items-center justify-center">
                        <Text className="text-gray-900 font-outfit-bold text-sm">
                            {t('appointments.list.card.paid', { amount: appointment.budget })}
                        </Text>
                    </View>
                ) : (
                    <>
                        <View className="flex-row gap-3">
                            <View className="w-1/3 bg-white border border-gray-200 rounded-lg py-2 items-center justify-center">
                                <Text className="text-blue-900 font-outfit-bold text-sm" numberOfLines={1}>
                                    {t('appointments.list.card.budget', { amount: appointment.budget })}
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => !isPending && router.push(`/chat/${appointment.id}`)}
                                className={`flex-1 rounded-lg py-2 flex-row items-center justify-center gap-2 ${isPending ? 'bg-gray-300' : 'bg-blue-700'}`}
                                disabled={isPending}
                            >
                                <MessageSquare size={16} color="white" />
                                <Text className="text-white font-outfit-bold text-sm">{t('appointments.list.card.message')}</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity onPress={() => onCancel(appointment.id)} className="mt-4 items-center flex-row justify-center">
                            <Trash2 size={12} color="#9CA3AF" />
                            <Text className="text-gray-400 font-outfit-medium text-xs ml-1">{t('appointments.list.card.cancelRequest')}</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </TouchableOpacity>
    );
}
