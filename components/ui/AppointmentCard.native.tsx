import { Appointment } from '@/context/AppointmentsContext';
import { useUser } from '@/context/UserContext';
import { haversineDistanceKm } from '@/lib/utils';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Car, MapPin, MessageSquare, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker } from 'react-native-maps';
import { MAP_PROVIDER } from '@/lib/maps/provider';
import { BANNER_COLORS, TYPE_BAR_ACTIVE, TYPE_BAR_PAST, getCardState, getTypeBar, isPastState } from './appointmentCardTheme';

interface AppointmentCardProps {
    appointment: Appointment;
    onCancel: (id: string) => void;
}

export function AppointmentCard({ appointment, onCancel }: AppointmentCardProps) {
    const router = useRouter();
    const { t } = useTranslation();
    const { user } = useUser();
    const isPending = appointment.status === 'pending';

    const [distanceKm, setDistanceKm] = useState<number | null>(null);

    useEffect(() => {
        if (!appointment.locationLat || !appointment.locationLng) return;
        Location.getLastKnownPositionAsync().then((pos) => {
            if (pos) {
                const km = haversineDistanceKm(
                    pos.coords.latitude,
                    pos.coords.longitude,
                    appointment.locationLat!,
                    appointment.locationLng!,
                );
                setDistanceKm(km);
            }
        }).catch(() => { /* permission not granted yet — leave null */ });
    }, [appointment.locationLat, appointment.locationLng]);

    const state = getCardState(appointment.status);
    const isPast = isPastState(state);
    const banner = BANNER_COLORS[state];
    const typeBar = getTypeBar(appointment);
    const Icon = typeBar.icon;

    /**
     * A row still sourced from assistance_requests has no appointment detail
     * screen — /appointments/[id] assumes an accepted job. Send each role to the
     * screen that can actually act on the request.
     */
    const openDetail = () => {
        if (appointment.source === 'assistance') {
            if (user?.role === 'mechanic') {
                router.push({
                    pathname: '/(tabs)/assist/[id]' as any,
                    params: {
                        id: appointment.id,
                        type: appointment.type,
                        assistanceType: appointment.assistanceType ?? '',
                        title: appointment.title,
                        car: appointment.car,
                        address: appointment.address,
                        zip: appointment.zip ?? '',
                        budget: appointment.budget ?? '',
                        userId: appointment.userId ?? '',
                        locationLat: appointment.locationLat ?? '',
                        locationLng: appointment.locationLng ?? '',
                        vehicleIssues: JSON.stringify(appointment.vehicleIssues ?? []),
                        status: appointment.status,
                    },
                });
                return;
            }
            if (appointment.status === 'offered') {
                router.push({
                    pathname: '/request-assistance/mechanic-found' as any,
                    params: { requestId: appointment.id },
                });
                return;
            }
            router.push('/request-assistance/searching' as any);
            return;
        }
        router.navigate(`/appointments/${appointment.id}`);
    };


    return (
        <TouchableOpacity
            className="bg-white rounded-2xl overflow-hidden"
            onPress={openDetail}
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

            <View className="px-4 pt-4 pb-4">
                <Text className="text-xl font-outfit-bold text-gray-900 mb-1">
                    {t(`appointments.list.card.title.${state}`)}
                </Text>

                <View className="flex-row items-center mb-3">
                    <Car size={14} color="#9CA3AF" />
                    <Text className="text-gray-400 text-sm font-outfit-regular ml-2">{t('appointments.list.card.vehicleId')} </Text>
                    <Text className="text-gray-800 text-sm font-outfit-bold flex-shrink" numberOfLines={1}>{appointment.car}</Text>
                </View>

                {/* Map View */}
                <View className="h-32 bg-gray-100 rounded-xl mb-3 relative overflow-hidden border border-gray-200">
                    {appointment.locationLat && appointment.locationLng ? (
                        <MapView
                            provider={MAP_PROVIDER}
                            style={{ flex: 1 }}
                            initialRegion={{
                                latitude: appointment.locationLat,
                                longitude: appointment.locationLng,
                                latitudeDelta: 0.01,
                                longitudeDelta: 0.01,
                            }}
                            scrollEnabled={false}
                            zoomEnabled={false}
                            rotateEnabled={false}
                            pitchEnabled={false}
                        >
                            <Marker
                                coordinate={{
                                    latitude: appointment.locationLat,
                                    longitude: appointment.locationLng,
                                }}
                            />
                        </MapView>
                    ) : (
                        <View className="flex-1 items-center justify-center">
                            <MapPin size={24} color="#9CA3AF" />
                            <Text className="text-gray-400 font-outfit-regular text-xs mt-1">{t('appointments.list.card.locationNotAvailable')}</Text>
                        </View>
                    )}
                </View>

                <Text className="text-base font-outfit-bold text-gray-900 mb-1">{appointment.address}</Text>
                <View className="flex-row items-center mb-4">
                    <MapPin size={12} color="#6B7280" />
                    <Text className="text-gray-500 text-xs ml-1">
                        {distanceKm != null
                            ? t('appointments.list.card.distance', { km: distanceKm.toFixed(1) })
                            : t('appointments.list.card.distanceNA')}
                    </Text>
                </View>

                {isPast ? (
                    <View
                        className="self-start rounded-[10px] py-3 px-4 items-center justify-center"
                        style={{ backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' }}
                    >
                        <Text className="text-gray-900 font-outfit-bold text-sm">
                            {t('appointments.list.card.paid', { amount: appointment.budget })}
                        </Text>
                    </View>
                ) : (
                    <>
                        <View className="flex-row gap-3">
                            <View
                                className="w-1/3 rounded-[10px] py-3 items-center justify-center"
                                style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' }}
                            >
                                <Text className="font-outfit-bold text-sm" style={{ color: '#081E72' }} numberOfLines={1}>
                                    {t('appointments.list.card.budget', { amount: appointment.budget })}
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => !isPending && router.push(`/chat/${appointment.id}`)}
                                activeOpacity={0.8}
                                disabled={isPending}
                                className="flex-1"
                            >
                                <LinearGradient
                                    colors={isPending ? ['#D1D5DB', '#D1D5DB'] : ['#2B66F8', '#081E72']}
                                    start={{ x: 0, y: 1 }}
                                    end={{ x: 1, y: 0 }}
                                    style={{
                                        borderRadius: 10,
                                        paddingVertical: 12,
                                        paddingHorizontal: 12,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <MessageSquare size={16} color={isPending ? '#9CA3AF' : 'white'} />
                                    <Text className="font-outfit-bold text-sm ml-2" style={{ color: isPending ? '#9CA3AF' : 'white' }}>
                                        {t('appointments.list.card.message')}
                                    </Text>
                                </LinearGradient>
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
