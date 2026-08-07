import { useAppointments } from '@/context/AppointmentsContext';
import { useUser } from '@/context/UserContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import * as Location from 'expo-location';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, Clock, Navigation, CheckCircle } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
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

export default function AssistDetailScreen() {
    const { id, type, assistanceType, title, car, address, zip, budget, userId, locationLat, locationLng } = useLocalSearchParams();
    const router = useRouter();
    const navigation = useNavigation();
    const { t } = useTranslation();
    const { user } = useUser();
    const { appointments } = useAppointments();

    const isImmediate = type === 'immediate' || type === 'videocall' || type === 'witness' || assistanceType === 'witness';
    const isVideo = type === 'videocall';

    const reqLat = parseFloat(locationLat as string);
    const reqLng = parseFloat(locationLng as string);
    const hasLocation = !isNaN(reqLat) && !isNaN(reqLng);

    const [showNotification, setShowNotification] = useState(false);
    const [etaText, setEtaText] = useState<string | null>(null);
    const [distKm, setDistKm] = useState<number | null>(null);
    const [mechanicCoords, setMechanicCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [routePolyline, setRoutePolyline] = useState<string | null>(null);
    const mapRef = useRef<MapView | null>(null);

    // Selection States
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isDateOpen, setIsDateOpen] = useState(false);

    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [isTimeOpen, setIsTimeOpen] = useState(false);

    const DATES = [t('requestDetail.mockDates.date1'), t('requestDetail.mockDates.date2'), t('requestDetail.mockDates.date3')];
    const TIMES = ['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '04:00 PM'];

    // Re-fit map when mechanic coords become available (async after location fetch).
    useEffect(() => {
        if (!mechanicCoords || !hasLocation) return;
        mapRef.current?.fitToCoordinates(
            [{ latitude: reqLat, longitude: reqLng }, mechanicCoords],
            { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true },
        );
    }, [mechanicCoords]);

    // Calculate distance + ETA from mechanic's current location to the request location,
    // then fetch the Google Directions route polyline for the map.
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

                // Fetch route polyline from backend (Google Directions API).
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

    const handleAccept = async () => {
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

                // Navigate to Appointments tab immediately
                router.replace('/(tabs)/appointments');

                // Reset the Assist stack to the root (List View)
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
    };

    return (
        <View className="flex-1 bg-white">
            <ScrollView className="flex-1">
                {/* Header Section */}
                <View className={`px-4 py-4 ${isVideo ? 'bg-cyan-600' : 'bg-blue-600'}`}>
                    <Text className="text-white font-outfit-bold text-lg text-center">
                        {assistanceType === 'witness' ? t('requestAssistance.header.accident') : isVideo ? t('requestAssistance.header.videoCall') : isImmediate ? t('requestAssistance.header.immediate') : t('requestAssistance.header.scheduled')}
                    </Text>
                </View>

                <View className="p-6">
                    {/* Details Info */}
                    <View className="mb-6 gap-4">
                        <View>
                            <Text className="font-outfit-bold text-gray-900 mb-1">{t('dashboardDetail.assistanceNeeded')}</Text>
                            <Text className="font-outfit-regular text-gray-600">{title}</Text>
                        </View>
                        <View>
                            <Text className="font-outfit-bold text-gray-900 mb-1">{t('dashboardDetail.car')}</Text>
                            <Text className="font-outfit-regular text-gray-600">{car}</Text>
                        </View>
                        <View>
                            <Text className="font-outfit-bold text-gray-900 mb-1">{t('dashboardDetail.address')}</Text>
                            <Text className="font-outfit-regular text-gray-600">{address}</Text>
                        </View>
                        <View>
                            <Text className="font-outfit-bold text-gray-900 mb-1">{t('dashboardDetail.estimatedPrice')}</Text>
                            <Text className="font-outfit-bold text-blue-600 text-lg">{budget}</Text>
                        </View>
                        {(etaText || distKm !== null) && (
                            <View className="flex-row items-center gap-2 bg-blue-50 rounded-xl px-4 py-3">
                                <Navigation size={16} color="#0047AB" />
                                {distKm !== null && (
                                    <Text className="font-outfit-bold text-blue-900">{distKm.toFixed(1)} km</Text>
                                )}
                                {etaText && (
                                    <Text className="font-outfit-bold text-blue-900">· ETA: {etaText}</Text>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Route map: client pin (red) + mechanic pin (blue) + polyline */}
                    {hasLocation && (
                        <View className="mb-6 rounded-xl overflow-hidden" style={{ height: 200 }}>
                            <MapView
                                provider={MAP_PROVIDER}
                                ref={mapRef}
                                style={{ flex: 1 }}
                                initialRegion={{
                                    latitude: reqLat,
                                    longitude: reqLng,
                                    latitudeDelta: 0.05,
                                    longitudeDelta: 0.05,
                                }}
                                onMapReady={() => {
                                    const coords = [
                                        { latitude: reqLat, longitude: reqLng },
                                        ...(mechanicCoords ? [mechanicCoords] : []),
                                    ];
                                    if (coords.length >= 2) {
                                        mapRef.current?.fitToCoordinates(coords, {
                                            edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                                            animated: false,
                                        });
                                    }
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

                    {/* Date Selector (Only if scheduled) */}
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
                        className={`w-full py-4 rounded-xl items-center shadow-sm ${isImmediate || (selectedDate && selectedTime) ? 'bg-emerald-500' : 'bg-gray-300'}`}
                        onPress={handleAccept}
                        disabled={!isImmediate && (!selectedDate || !selectedTime)}
                    >
                        <Text className="text-white font-outfit-bold text-lg">{t('requestDetail.acceptRequest')}</Text>
                    </TouchableOpacity>

                    <Text className="text-center text-[10px] text-gray-400 mt-4">
                        {t('dashboardDetail.posted', { date: '07/07/2026 - 03:15 AM' })}{'\n'}{t('dashboardDetail.idLabel', { id: '34532-2384-33327' })}
                    </Text>
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
