import { useUser } from '@/context/UserContext';
import { useVerifiedAction } from '@/hooks/useVerifiedAction';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import * as Location from 'expo-location';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Calendar, Clock, Navigation, CheckCircle, ChevronLeft, Zap, Car, Wrench, Lock, ArrowUpRight, DollarSign } from 'lucide-react-native';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { MAP_PROVIDER } from '@/lib/maps/provider';
import { apiClient } from '@/lib/api/apiClient';
import { LinearGradient } from 'expo-linear-gradient';

function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
    const points: { latitude: number; longitude: number }[] = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
        let b: number, shift = 0, result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lat += result & 1 ? ~(result >> 1) : result >> 1;
        shift = 0; result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lng += result & 1 ? ~(result >> 1) : result >> 1;
        points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatEta(minutes: number): string {
    if (minutes < 1) return '1 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

export default function RequestDetailScreen() {
    const { id, type, assistanceType, title, car, address, zip, budget, price, userId, locationLat, locationLng, vehicleIssues, date } = useLocalSearchParams();

    const vehicleIssueNames: string = React.useMemo(() => {
        try {
            const parsed = JSON.parse(String(vehicleIssues || '[]')) as { name: string }[];
            return parsed.map((i) => i.name).join(', ');
        } catch {
            return '';
        }
    }, [vehicleIssues]);
    const router = useRouter();
    const navigation = useNavigation();
    const { user } = useUser();
    const { t } = useTranslation();

    useFocusEffect(
        useCallback(() => {
            navigation.setOptions({
                title: t('requestDetail.headerTitle'),
                headerLeft: () => (
                    <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 16 }}>
                        <ChevronLeft size={24} color="#0047AB" />
                    </TouchableOpacity>
                ),
            });
        }, [navigation, router])
    );

    const isImmediate = type === 'immediate' || type === 'videocall' || type === 'witness' || assistanceType === 'witness';
    const isVideo = type === 'videocall';
    const isUrgent = type === 'immediate' || type === 'witness' || assistanceType === 'witness';

    // Relative time from the request timestamp. Falls back to "Just now" when the
    // param is missing or not a parseable date (the backend may not send it).
    const formatTimeAgo = (raw?: string) => {
        if (!raw) return t('requestDetail.timeAgo.justNow');
        const then = new Date(raw).getTime();
        if (isNaN(then)) return t('requestDetail.timeAgo.justNow');
        const mins = Math.floor((Date.now() - then) / 60000);
        if (mins < 1) return t('requestDetail.timeAgo.justNow');
        if (mins < 60) return t('requestDetail.timeAgo.minutes', { count: mins });
        const hours = Math.floor(mins / 60);
        if (hours < 24) return t('requestDetail.timeAgo.hours', { count: hours });
        return t('requestDetail.timeAgo.days', { count: Math.floor(hours / 24) });
    };
    const timeAgo = formatTimeAgo(typeof date === 'string' ? date : undefined);

    const serviceLabel = assistanceType === 'witness'
        ? t('requestAssistance.header.accident')
        : isVideo
            ? t('requestAssistance.header.videoCall')
            : isImmediate
                ? t('requestAssistance.header.immediate')
                : t('requestAssistance.header.scheduled');

    // Split full address into a hidden street line and a public city/state line.
    const addressParts = String(address || '').split(',').map((p) => p.trim()).filter(Boolean);
    const cityLine = addressParts.length > 1
        ? `${addressParts.slice(1).join(', ')}${zip ? ` · ${zip}` : ''}`
        : String(address || '');

    const reqLat = parseFloat(locationLat as string);
    const reqLng = parseFloat(locationLng as string);
    const hasLocation = !isNaN(reqLat) && !isNaN(reqLng);

    const [showNotification, setShowNotification] = useState(false);
    const [etaText, setEtaText] = useState<string | null>(null);
    const [distKm, setDistKm] = useState<number | null>(null);
    const [mechanicCoords, setMechanicCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [routePolyline, setRoutePolyline] = useState<string | null>(null);
    const mapRef = useRef<MapView | null>(null);

    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isDateOpen, setIsDateOpen] = useState(false);

    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [isTimeOpen, setIsTimeOpen] = useState(false);

    const DATES = [
        t('requestDetail.mockDates.date1'),
        t('requestDetail.mockDates.date2'),
        t('requestDetail.mockDates.date3'),
    ];
    const TIMES = ['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '04:00 PM'];

    // Only zoom out to fit both pins when the mechanic is actually in the
    // request's vicinity — otherwise (e.g. testing far from the request city)
    // fitting both points zooms the small embedded map out to a whole
    // country/continent, which isn't useful. Past that distance we just keep
    // the map centered on the request location.
    const NEARBY_KM_THRESHOLD = 100;
    useEffect(() => {
        if (!mechanicCoords || !hasLocation) return;
        if (distKm === null || distKm > NEARBY_KM_THRESHOLD) return;
        mapRef.current?.fitToCoordinates(
            [{ latitude: reqLat, longitude: reqLng }, mechanicCoords],
            { edgePadding: { top: 20, right: 20, bottom: 20, left: 20 }, animated: true },
        );
    }, [mechanicCoords, distKm]);

    useEffect(() => {
        if (!hasLocation) return;

        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;
                const loc = await Location.getCurrentPositionAsync({});
                const { latitude, longitude } = loc.coords;

                const km = haversineKm(latitude, longitude, reqLat, reqLng);
                setDistKm(km);
                const minutes = (km * 1.3 / 25) * 60;
                setEtaText(formatEta(minutes));
                setMechanicCoords({ latitude, longitude });

                const route: any = await apiClient.get(
                    `/api/appointments/route?fromLat=${latitude}&fromLng=${longitude}&toLat=${reqLat}&toLng=${reqLng}`
                ).catch(() => null);
                if (route?.available && route?.polyline) {
                    setRoutePolyline(route.polyline);
                }
            } catch {
                // no-op: ETA and distance stay null
            }
        })();
    }, [locationLat, locationLng]);

    const gate = useVerifiedAction();

    // Offering on a request needs a verified identity — see useVerifiedAction.
    const handleAccept = gate('offer', async () => {
        if (!isImmediate && (!selectedDate || !selectedTime)) {
            alert(t('requestDetail.selectDateTimeAlert'));
            return;
        }

        const appointmentId = Array.isArray(id) ? id[0] : id || '';

        try {
            if (user?.role === 'mechanic' && user?.id) {
                await assistanceDAO.updateStatus(appointmentId, user.id, 'offered', etaText ? { eta: etaText } : undefined);
            }
            setShowNotification(true);
            setTimeout(() => {
                setShowNotification(false);
                router.replace('/(tabs)/appointments');
                navigation.dispatch(
                    CommonActions.reset({
                        index: 0,
                        routes: [{ name: 'index' }],
                    })
                );
            }, 2000);
        } catch (error: any) {
            alert(t('requestDetail.acceptFailed', { error: error.message || 'Unknown error' }));
        }
    });

    return (
        <View className="flex-1" style={{ backgroundColor: '#F4F6FC' }}>
            <ScrollView className="flex-1">
                <View className="p-6">
                    {/* Section Badge */}
                    <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                            {t('requestDetail.badge')}
                        </Text>
                    </View>

                    {/* Title */}
                    <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
                        {t('requestDetail.title')}
                    </Text>

                    {/* Subtitle */}
                    <Text className="text-gray-500 font-outfit-regular text-base mb-2">
                        {t('requestDetail.subtitle')}
                    </Text>
                </View>

                <View className="px-6">
                    {/* Header Card: service, urgency, budget */}
                    <View
                        className="bg-white rounded-2xl p-5 mb-4 flex-row items-center"
                        style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 }}
                    >
                        <View
                            className="w-14 h-14 rounded-2xl justify-center items-center mr-4"
                            style={{ backgroundColor: isUrgent ? '#FEE2E2' : '#E9F1FF' }}
                        >
                            <Zap size={26} color={isUrgent ? '#EF4444' : '#0047AB'} fill={isUrgent ? '#EF4444' : '#0047AB'} />
                        </View>
                        <View className="flex-1">
                            <View className="flex-row items-center gap-2">
                                <Text className="font-outfit-bold text-lg text-gray-900" numberOfLines={1}>{serviceLabel}</Text>
                                {isUrgent && (
                                    <View className="px-2 py-0.5 rounded-md" style={{ backgroundColor: '#FEE2E2' }}>
                                        <Text className="font-outfit-bold text-[11px] tracking-widest" style={{ color: '#EF4444' }}>{t('requestDetail.urgent')}</Text>
                                    </View>
                                )}
                            </View>
                            <View className="flex-row items-center gap-1 mt-1">
                                <Clock size={13} color="#9CA3AF" />
                                <Text className="font-outfit-regular text-sm text-gray-500">{timeAgo}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Details Card: budget, vehicle, assistance, address */}
                    <View
                        className="bg-white rounded-2xl mb-4"
                        style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 }}
                    >
                        {/* Budget */}
                        <View className="flex-row items-center px-5 py-4 border-b border-gray-100">
                            <View className="w-11 h-11 rounded-xl justify-center items-center mr-4" style={{ backgroundColor: '#E9F1FF' }}>
                                <DollarSign size={20} color="#0047AB" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-outfit-semibold text-xs tracking-widest text-gray-400 mb-0.5">{t('requestDetail.budget')}</Text>
                                <Text className="font-outfit-bold text-base text-gray-900">{price ? `$${price}` : budget}</Text>
                            </View>
                        </View>

                        {/* Vehicle */}
                        <View className="flex-row items-center px-5 py-4 border-b border-gray-100">
                            <View className="w-11 h-11 rounded-xl justify-center items-center mr-4" style={{ backgroundColor: '#E9F1FF' }}>
                                <Car size={20} color="#0047AB" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-outfit-semibold text-xs tracking-widest text-gray-400 mb-0.5">{t('requestDetail.vehicle')}</Text>
                                <Text className="font-outfit-bold text-base text-gray-900">{car}</Text>
                            </View>
                        </View>

                        {/* Vehicle issue */}
                        {!!vehicleIssueNames && (
                            <View className="flex-row items-center px-5 py-4 border-b border-gray-100">
                                <View className="w-11 h-11 rounded-xl justify-center items-center mr-4" style={{ backgroundColor: '#E9F1FF' }}>
                                    <Wrench size={20} color="#0047AB" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-outfit-semibold text-xs tracking-widest text-gray-400 mb-0.5">{t('requestDetail.vehicleIssue')}</Text>
                                    <Text className="font-outfit-bold text-base text-gray-900">{vehicleIssueNames}</Text>
                                </View>
                            </View>
                        )}

                        {/* Assistance needed */}
                        <View className="flex-row items-center px-5 py-4 border-b border-gray-100">
                            <View className="w-11 h-11 rounded-xl justify-center items-center mr-4" style={{ backgroundColor: '#E9F1FF' }}>
                                <Wrench size={20} color="#0047AB" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-outfit-semibold text-xs tracking-widest text-gray-400 mb-0.5">{t('requestDetail.assistanceNeeded')}</Text>
                                <Text className="font-outfit-bold text-base text-gray-900">{title}</Text>
                            </View>
                        </View>

                        {/* Address */}
                        <View className="flex-row px-5 py-4">
                            <View className="w-11 h-11 rounded-xl justify-center items-center mr-4" style={{ backgroundColor: '#E9F1FF' }}>
                                <Lock size={20} color="#0047AB" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-outfit-semibold text-xs tracking-widest text-gray-400 mb-1.5">{t('requestDetail.address')}</Text>
                                {/* Redacted street — unlocks after accept */}
                                <View className="h-4 rounded-md mb-1.5" style={{ backgroundColor: '#E5E7EB', width: '75%' }} />
                                <Text className="font-outfit-bold text-base text-gray-900">{cityLine}</Text>
                                <Text className="font-outfit-regular text-sm text-gray-400 mt-0.5">{t('requestDetail.addressUnlock')}</Text>
                            </View>
                        </View>

                        {/* Address map — client pin (+ own GPS pin / route once available) */}
                        {hasLocation && (
                            <View className="mx-5 mb-5 rounded-xl overflow-hidden" style={{ height: 160 }}>
                                <MapView
                                    provider={MAP_PROVIDER}
                                    ref={mapRef}
                                    style={{ flex: 1 }}
                                    initialRegion={{
                                        latitude: reqLat,
                                        longitude: reqLng,
                                        latitudeDelta: 0.09,
                                        longitudeDelta: 0.09,
                                    }}
                                    onMapReady={() => {
                                        // Only fit the mechanic's pin in too if they're actually nearby —
                                        // see the effect above for why.
                                        if (!mechanicCoords || distKm === null || distKm > NEARBY_KM_THRESHOLD) return;
                                        mapRef.current?.fitToCoordinates(
                                            [{ latitude: reqLat, longitude: reqLng }, mechanicCoords],
                                            {
                                                edgePadding: { top: 20, right: 20, bottom: 20, left: 20 },
                                                animated: false,
                                            }
                                        );
                                    }}
                                >
                                    <Marker
                                        coordinate={{ latitude: reqLat, longitude: reqLng }}
                                        title={t('requestDetail.clientLocation')}
                                        pinColor="red"
                                    />
                                    {mechanicCoords && (
                                        <Marker
                                            coordinate={mechanicCoords}
                                            title={t('requestDetail.yourLocation')}
                                            pinColor="blue"
                                        />
                                    )}
                                    {routePolyline && (
                                        <Polyline
                                            coordinates={decodePolyline(routePolyline)}
                                            strokeColor="#2563EB"
                                            strokeWidth={4}
                                        />
                                    )}
                                </MapView>
                            </View>
                        )}
                    </View>

                    {/* Distance / ETA Card */}
                    {(etaText || distKm !== null) && (
                        <View className="flex-row rounded-2xl mb-4 overflow-hidden" style={{ backgroundColor: '#E9F1FF', borderWidth: 1, borderColor: '#C7D7F5' }}>
                            <View className="flex-1 flex-row items-center p-4">
                                <View className="w-11 h-11 rounded-xl bg-white justify-center items-center mr-3">
                                    <ArrowUpRight size={20} color="#0047AB" />
                                </View>
                                <View>
                                    <Text className="font-outfit-semibold text-xs tracking-widest text-blue-500 mb-0.5">{t('requestDetail.distance')}</Text>
                                    <Text className="font-outfit-bold text-lg text-gray-900">{distKm !== null ? `${(distKm * 0.621371).toFixed(1)} mi` : '—'}</Text>
                                </View>
                            </View>
                            <View style={{ width: 1, backgroundColor: '#C7D7F5' }} className="my-4" />
                            <View className="flex-1 flex-row items-center p-4">
                                <View className="w-11 h-11 rounded-xl bg-white justify-center items-center mr-3">
                                    <Clock size={20} color="#0047AB" />
                                </View>
                                <View>
                                    <Text className="font-outfit-semibold text-xs tracking-widest text-blue-500 mb-0.5">{t('requestDetail.eta')}</Text>
                                    <Text className="font-outfit-bold text-lg text-gray-900">{etaText || '—'}</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Date Selector */}
                    {!isImmediate && (
                        <>
                            <View className="mb-6 z-20">
                                <Text className="font-outfit-bold text-gray-900 mb-2">{t('requestDetail.dayAvailability')}</Text>
                                <TouchableOpacity
                                    className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 flex-row justify-between items-center"
                                    onPress={() => { setIsDateOpen(!isDateOpen); setIsTimeOpen(false); }}
                                >
                                    <Text className={selectedDate ? "text-gray-900 font-outfit-medium" : "text-gray-500 font-outfit-regular"}>
                                        {selectedDate || t('requestDetail.selectDate')}
                                    </Text>
                                    <Calendar size={18} color="#9CA3AF" />
                                </TouchableOpacity>

                                {isDateOpen && (
                                    <View className="mt-1 bg-white border border-gray-100 rounded-lg shadow-sm absolute top-full w-full z-10">
                                        {DATES.map((day) => (
                                            <TouchableOpacity
                                                key={day}
                                                className="p-3 border-b border-gray-50 last:border-0"
                                                onPress={() => { setSelectedDate(day); setIsDateOpen(false); }}
                                            >
                                                <Text className="text-gray-700 font-outfit-regular">{day}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            {/* Time Selector */}
                            <View className="mb-8 z-10">
                                <Text className="font-outfit-bold text-gray-900 mb-2">{t('requestDetail.selectTimeTitle')}</Text>
                                <TouchableOpacity
                                    className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 flex-row justify-between items-center"
                                    onPress={() => { setIsTimeOpen(!isTimeOpen); setIsDateOpen(false); }}
                                >
                                    <Text className={selectedTime ? "text-gray-900 font-outfit-medium" : "text-gray-500 font-outfit-regular"}>
                                        {selectedTime || t('requestDetail.selectTime')}
                                    </Text>
                                    <Clock size={16} color="#9CA3AF" />
                                </TouchableOpacity>

                                {isTimeOpen && (
                                    <View className="mt-1 bg-white border border-gray-100 rounded-lg shadow-sm absolute top-full w-full z-10">
                                        {TIMES.map((time) => (
                                            <TouchableOpacity
                                                key={time}
                                                className="p-3 border-b border-gray-50 last:border-0"
                                                onPress={() => { setSelectedTime(time); setIsTimeOpen(false); }}
                                            >
                                                <Text className="text-gray-700 font-outfit-regular">{time}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                        </>
                    )}

                    <TouchableOpacity
                        onPress={handleAccept}
                        disabled={!isImmediate && (!selectedDate || !selectedTime)}
                        activeOpacity={0.8}
                    >
                        {isImmediate || (selectedDate && selectedTime) ? (
                            <LinearGradient
                                colors={['#10B981', '#047857']}
                                start={{ x: 0, y: 1 }}
                                end={{ x: 1, y: 0 }}
                                style={{
                                    borderRadius: 12,
                                    paddingVertical: 16,
                                    paddingHorizontal: 16,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Text className="text-white font-outfit-bold text-lg">{t('requestDetail.acceptRequest')}</Text>
                            </LinearGradient>
                        ) : (
                            <View className="w-full py-4 rounded-xl items-center bg-gray-300">
                                <Text className="text-white font-outfit-bold text-lg">{t('requestDetail.acceptRequest')}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Notification Modal */}
            {showNotification && (
                <View className="absolute top-0 left-0 right-0 bottom-0 justify-center items-center bg-black/50 px-6 z-50">
                    <View className="bg-white w-full rounded-2xl p-6 items-center" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 }}>
                        <View className="w-16 h-16 bg-emerald-50 rounded-full justify-center items-center mb-4">
                            <CheckCircle size={40} color="#10B981" />
                        </View>
                        <Text className="text-lg font-outfit-bold text-gray-900 mb-2 text-center">
                            {t('requestDetail.offerAccepted')}
                        </Text>
                        <Text className="text-gray-500 font-outfit-regular text-sm text-center mb-6">
                            {isImmediate
                                ? t('requestDetail.acceptedImmediate', { title })
                                : t('requestDetail.acceptedScheduled', { date: selectedDate, time: selectedTime })
                            }
                        </Text>
                        <View className="w-full flex-row gap-3">
                            <TouchableOpacity
                                className="flex-1 py-3 rounded-lg border border-gray-300 bg-white items-center"
                                onPress={() => setShowNotification(false)}
                            >
                                <Text className="text-gray-900 font-outfit-bold text-base">{t('requestDetail.dismiss')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1"
                                onPress={() => {
                                    setShowNotification(false);
                                    router.replace('/(tabs)/appointments');
                                    navigation.dispatch(
                                        CommonActions.reset({
                                            index: 0,
                                            routes: [{ name: 'index' }],
                                        })
                                    );
                                }}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={['#2B66F8', '#081E72']}
                                    start={{ x: 0, y: 1 }}
                                    end={{ x: 1, y: 0 }}
                                    style={{
                                        borderRadius: 8,
                                        paddingVertical: 12,
                                        paddingHorizontal: 16,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Text className="text-white font-outfit-bold text-base">{t('requestDetail.ok')}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
}
