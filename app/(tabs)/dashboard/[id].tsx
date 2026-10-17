import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { useAppointments } from '@/context/AppointmentsContext';
import { useVerifiedAction } from '@/hooks/useVerifiedAction';
import { useAvailableToOffer } from '@/hooks/useAvailableToOffer';
import { useUser } from '@/context/UserContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import * as Location from 'expo-location';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, Clock, Navigation, HelpCircle } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { FixedLocationMap } from '@/components/ui/FixedLocationMap';
import { approximateArea, coarseAddress } from '@/lib/maps/approximateLocation';
import { apiClient } from '@/lib/api/apiClient';
import { videoCallStartLabel } from '@/lib/video/videoCallTime';

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
    const { id, type, assistanceType, title, car, address, zip, budget, userId, locationLat, locationLng, date } = useLocalSearchParams();
    const router = useRouter();
    const navigation = useNavigation();
    const { t, i18n } = useTranslation();
    const { user } = useUser();
    const { appointments } = useAppointments();

    const isImmediate = type === 'immediate' || type === 'videocall' || type === 'witness' || assistanceType === 'witness';
    const isVideo = type === 'videocall';

    const reqLat = parseFloat(locationLat as string);
    const reqLng = parseFloat(locationLng as string);
    const hasLocation = !isNaN(reqLat) && !isNaN(reqLng);

    const [showConfirm, setShowConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [etaText, setEtaText] = useState<string | null>(null);
    const [distKm, setDistKm] = useState<number | null>(null);

    // Selection States
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isDateOpen, setIsDateOpen] = useState(false);

    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [isTimeOpen, setIsTimeOpen] = useState(false);

    const DATES = [t('requestDetail.mockDates.date1'), t('requestDetail.mockDates.date2'), t('requestDetail.mockDates.date3')];
    const TIMES = ['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '04:00 PM'];

    // Distance + ETA from the mechanic's current location to the client's
    // approximate zone — the request is not accepted yet, so never the exact
    // point: an exact distance from a known position would give it back.
    useEffect(() => {
        // A video call is remote: no route, distance or ETA to work out.
        if (!hasLocation || isVideo) return;

        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;
                const loc = await Location.getCurrentPositionAsync({});
                const { latitude, longitude } = loc.coords;
                const zone = approximateArea(reqLat, reqLng, String(id));

                // Rough placeholder while the road-based figures load below —
                // straight-line distance at an assumed average speed.
                const km = haversineKm(latitude, longitude, zone.latitude, zone.longitude);
                setDistKm(km);
                const minutes = (km * 1.3 / 25) * 60;
                setEtaText(formatEta(minutes));

                // Fetch the route from backend (Google Directions API) — also
                // returns the accurate distance/ETA, so use those instead of
                // the estimate above.
                const route: any = await apiClient.get(
                    `/api/appointments/route?fromLat=${latitude}&fromLng=${longitude}&toLat=${zone.latitude}&toLng=${zone.longitude}`
                ).catch(() => null);
                if (route?.available) {
                    if (typeof route.distanceKm === 'number') setDistKm(route.distanceKm);
                    if (typeof route.minutesAway === 'number') setEtaText(formatEta(route.minutesAway));
                }
            } catch {
                // no-op: ETA and distance stay null
            }
        })();
    }, [locationLat, locationLng, isVideo]);

    const gate = useVerifiedAction();
    const ensureAvailable = useAvailableToOffer();

    // Offering on a request needs a verified identity — see useVerifiedAction.
    // This only opens the confirmation modal: nothing reaches the backend until
    // the mechanic confirms, and no timer resolves the modal on its own.
    const handleAccept = gate('offer', async () => {
        if (!isImmediate && (!selectedDate || !selectedTime)) {
            alert(t('requestDetail.selectDateTimeAlert'));
            return;
        }
        if (!(await ensureAvailable())) return;
        setShowConfirm(true);
    });

    const handleConfirmAccept = async () => {
        if (submitting) return;

        const appointmentId = Array.isArray(id) ? id[0] : id || '';
        setSubmitting(true);

        try {
            if (user?.role === 'mechanic' && user?.id) {
                // A video call has no arrival time: the backend ignores `eta` on one anyway.
                await assistanceDAO.updateStatus(appointmentId, user.id, 'offered', etaText && !isVideo ? { eta: etaText } : undefined);
            }
            setShowConfirm(false);

            // Navigate to Appointments tab
            router.replace('/(tabs)/appointments');

            // Reset the Assist stack to the root (List View)
            navigation.dispatch(
                CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'index' }],
                })
            );
        } catch (error: any) {
            setShowConfirm(false);
            alert(t('requestDetail.acceptFailed', { error: error.message || 'Unknown error' }));
        } finally {
            setSubmitting(false);
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
                        {!isVideo && (
                            <View>
                                <Text className="font-outfit-bold text-gray-900 mb-1">{t('dashboardDetail.address')}</Text>
                                {/* Area only (city / zip): the street is not shown before accept */}
                                <Text className="font-outfit-regular text-gray-600">
                                    {coarseAddress(String(address ?? ''), typeof zip === 'string' ? zip : undefined)}
                                </Text>
                            </View>
                        )}
                        <View>
                            <Text className="font-outfit-bold text-gray-900 mb-1">{t('dashboardDetail.estimatedPrice')}</Text>
                            <Text className="font-outfit-bold text-blue-600 text-lg">{budget}</Text>
                        </View>
                        {isVideo && (
                            <View className="flex-row items-center gap-2 bg-blue-50 rounded-xl px-4 py-3" testID="video-call-when">
                                <Clock size={16} color="#0047AB" />
                                <Text className="font-outfit-bold text-blue-900">
                                    {t('requestDetail.videoCallWhen')}: {videoCallStartLabel(typeof date === 'string' ? date : undefined, i18n.language) ?? t('requestDetail.videoCallNow')}
                                </Text>
                            </View>
                        )}
                        {!isVideo && (etaText || distKm !== null) && (
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

                    {/* Client's area only — the exact point is not shown before accept */}
                    {hasLocation && !isVideo && (
                        <View className="mb-6">
                            <FixedLocationMap
                                latitude={reqLat}
                                longitude={reqLng}
                                approximate
                                seed={String(id)}
                                height={200}
                            />
                            <Text className="font-outfit-medium text-[11px] mt-1.5" style={{ color: '#8C96AE' }}>
                                {t('appointments.list.card.approximateArea')}
                            </Text>
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

            <ConfirmationModal
                visible={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleConfirmAccept}
                icon={HelpCircle}
                iconColor="#1E56E3"
                title={t('requestDetail.confirmOfferTitle')}
                message={isVideo
                    ? t('requestDetail.confirmOfferVideoCall', { title })
                    : isImmediate
                    ? t('requestDetail.confirmOfferImmediate', { title })
                    : t('requestDetail.confirmOfferScheduled', { date: selectedDate, time: selectedTime })
                }
                confirmText={submitting ? t('requestDetail.sendingOffer') : t('requestDetail.confirmOffer')}
                cancelText={t('requestDetail.cancel')}
            />
        </View>
    );
}
