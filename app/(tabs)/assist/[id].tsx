import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { useAppointments, type Appointment } from '@/context/AppointmentsContext';
import { useUser } from '@/context/UserContext';
import { useVerifiedAction } from '@/hooks/useVerifiedAction';
import { useAvailableToOffer } from '@/hooks/useAvailableToOffer';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import * as Location from 'expo-location';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { goBackOr } from '@/lib/navigation/goBackOr';
import { HeaderBackButton } from '@/components/ui/HeaderBackButton';
import { Calendar, Clock, Navigation, HelpCircle, Zap, Car, Wrench, Lock, ArrowUpRight, DollarSign, Video, Timer, ShieldCheck } from 'lucide-react-native';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { AssistanceRequest } from '@/lib/dao/interfaces';
import { FixedLocationMap } from '@/components/ui/FixedLocationMap';
import { approximateArea } from '@/lib/maps/approximateLocation';
import { apiClient } from '@/lib/api/apiClient';
import { VideoCallZoneNote } from '@/components/video/VideoCallZoneNote';
import { videoCallStartLabel } from '@/lib/video/videoCallTime';
import { videoCallDAO } from '@/lib/dao/VideoCallDAO';
import { DEFAULT_CALL_MINUTES } from '@/lib/video/callLength';
import { LinearGradient } from 'expo-linear-gradient';
import { RequestIssueText } from '@/components/ui/RequestIssueText';
import { appAlert } from '@/lib/ui/appAlert';
import { ApiError } from '@/lib/api/types';
import { useSocket } from '@/context/SocketContext';

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

// Distance / ETA (and video-call time) card: a quiet white card, with the brand blue only on the icons.
const HERO_CARD = { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#EEF2FA', marginBottom: 16, overflow: 'hidden' as const, shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 };
const HERO_ICON = { backgroundColor: '#EAF1FF' };
const HERO_ICON_COLOR = '#1E56E3';
const HERO_LABEL = { color: '#6B7490' };
const HERO_VALUE = { color: '#0B1530' };
const HERO_SUB = { color: '#6B7490' };

export default function RequestDetailScreen() {
    const params = useLocalSearchParams();
    const { id, vehicleIssues } = params;

    // The feed and the appointment cards pass the whole request as params; a
    // tapped push only carries the id. Then the request is loaded here, and each
    // field falls back to it.
    const needsFetch = !!id && !params.type;
    const [fetched, setFetched] = useState<AssistanceRequest | null>(null);
    const [loadingRequest, setLoadingRequest] = useState(needsFetch);
    useEffect(() => {
        if (!needsFetch) return;
        let cancelled = false;
        assistanceDAO
            .getById(String(Array.isArray(id) ? id[0] : id))
            .then((r) => { if (!cancelled) setFetched(r); })
            .catch((err) => console.warn('[assist] request load failed:', (err as Error).message))
            .finally(() => { if (!cancelled) setLoadingRequest(false); });
        return () => { cancelled = true; };
    }, [id, needsFetch]);

    const field = (key: keyof AssistanceRequest) => {
        const fromParams = params[key as string];
        if (fromParams !== undefined && fromParams !== '') return fromParams;
        const value = fetched?.[key];
        return value === undefined || value === null ? undefined : String(value);
    };
    const type = field('type');
    const assistanceType = field('assistanceType');
    const title = field('title');
    const notes = field('notes');
    const car = field('car');
    const address = field('address');
    const zip = field('zip');
    const budget = field('budget');
    const price = field('price');
    const locationLat = field('locationLat');
    const locationLng = field('locationLng');
    const date = params.date || fetched?.date || fetched?.updatedAt;
    const status = field('status');

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
    const { markOffered } = useAppointments();
    const { t, i18n } = useTranslation();

    useFocusEffect(
        useCallback(() => {
            navigation.setOptions({
                title: t('requestDetail.headerTitle'),
                headerLeft: () => <HeaderBackButton onPress={() => goBackOr(router, '/(tabs)/assist')} />,
            });
        }, [navigation, router])
    );

    // Reached from the Appointments "Pending" tab, the request may already carry
    // this mechanic's offer — there is nothing left to accept.
    const alreadyOffered = status === 'offered';
    // Opened from an old push, the request may have been taken or canceled since.
    const noLongerAvailableByStatus = !!status && status !== 'pending' && status !== 'offered';

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

    const [showConfirm, setShowConfirm] = useState(false);
    // How long the call lasts: what the owner chose (`durationMinutes` on the request), else the
    // hub's default; the fallback covers older requests, older backends and offline.
    const [loadedMinutes, setLoadedMinutes] = useState<number | null>(null);
    const chosenMinutes = Number(field('durationMinutes')) || loadedMinutes;
    const [defaultMinutes, setDefaultMinutes] = useState(DEFAULT_CALL_MINUTES);
    useEffect(() => {
        if (!isVideo || chosenMinutes) return;
        let mounted = true;
        const requestId = String(Array.isArray(id) ? id[0] : id);
        assistanceDAO
            .getById(requestId)
            .then((r) => {
                if (mounted && r?.durationMinutes) setLoadedMinutes(r.durationMinutes);
                else return videoCallDAO.getNow().then((n) => { if (mounted && n?.baseMinutes) setDefaultMinutes(n.baseMinutes); });
            })
            .catch((err) => console.warn('[assist] call length failed; using default', err));
        return () => {
            mounted = false;
        };
    }, [isVideo, chosenMinutes, id]);
    const callMinutes = chosenMinutes ?? defaultMinutes;
    const [submitting, setSubmitting] = useState(false);
    const [declining, setDeclining] = useState(false);
    const [etaText, setEtaText] = useState<string | null>(null);
    const [distKm, setDistKm] = useState<number | null>(null);

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

    useEffect(() => {
        // A video call is remote: no route, distance or ETA to work out.
        if (!hasLocation || isVideo) return;

        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;
                const loc = await Location.getCurrentPositionAsync({});
                const { latitude, longitude } = loc.coords;

                // Measured to the approximate zone, not the client's real point:
                // an exact distance from a known position would give it back.
                // The request is not accepted yet, so the mechanic gets the area only.
                const zone = approximateArea(reqLat, reqLng, String(id));

                // Rough placeholder while the road-based figures load below —
                // straight-line distance at an assumed average speed.
                const km = haversineKm(latitude, longitude, zone.latitude, zone.longitude);
                setDistKm(km);
                const minutes = (km * 1.3 / 25) * 60;
                setEtaText(formatEta(minutes));

                // Backend asks Google Directions for the real road route, which
                // returns a more accurate distance/ETA than the estimate above.
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

    // Another technician can be confirmed by the owner while this screen is open (or before it was opened). The screen
    // checks the request again when it opens, when the app comes back, when an update arrives, every few seconds, and
    // right before an offer is sent, and says so instead of leaving a button that does nothing.
    const requestId = String(Array.isArray(id) ? id[0] : id ?? '');
    const { lastMessage } = useSocket();
    const [taken, setTaken] = useState(false);
    const takenAlerted = useRef(false);
    const markTaken = useCallback(() => {
        setTaken(true);
        setShowConfirm(false);
        if (takenAlerted.current) return;
        takenAlerted.current = true;
        appAlert(
            t(isVideo ? 'requestDetail.takenTitleVideo' : 'requestDetail.takenTitle'),
            t(isVideo ? 'requestDetail.takenMessageVideo' : 'requestDetail.takenMessage'),
            [{ text: t('requestDetail.takenOk'), onPress: () => goBackOr(router, '/(tabs)/assist') }],
            { tone: 'warning', icon: 'people-outline', cancelable: false },
        );
    }, [isVideo, router, t]);
    /** True while the request can still be offered on; false (and the notice shown) once someone else has it. */
    const checkStillOpen = useCallback(async (): Promise<boolean> => {
        if (!requestId) return true;
        try {
            const current = await assistanceDAO.getById(requestId);
            if (!current?.status) return true;
            const open = current.status === 'pending' || current.status === 'offered';
            const mine = !!current.mechanicId && current.mechanicId === user?.id;
            if (!open && !mine) {
                markTaken();
                return false;
            }
            return true;
        } catch (err) {
            // Gone, or no longer visible to this technician: the same as taken. A bad connection is not.
            if (err instanceof ApiError && [403, 404, 409].includes(err.statusCode)) {
                markTaken();
                return false;
            }
            return true;
        }
    }, [requestId, user?.id, markTaken]);

    useFocusEffect(
        useCallback(() => {
            if (taken || status === 'offered') return undefined;
            checkStillOpen();
            const timer = setInterval(checkStillOpen, 15000);
            return () => clearInterval(timer);
        }, [checkStillOpen, taken, status]),
    );
    useEffect(() => {
        if (taken || !lastMessage) return;
        if (['assistance_update', 'appointment_update', 'app_resumed', 'socket_connect'].includes(lastMessage.type)) checkStillOpen();
    }, [lastMessage, taken, checkStillOpen]);

    const noLongerAvailable = noLongerAvailableByStatus || taken;

    const gate = useVerifiedAction();
    const ensureAvailable = useAvailableToOffer();

    // Offering on a request needs a verified identity — see useVerifiedAction.
    // This only opens the confirmation modal: nothing reaches the backend until
    // the mechanic confirms, and no timer resolves the modal on its own.
    const handleAccept = gate('offer', async () => {
        if (!isImmediate && (!selectedDate || !selectedTime)) {
            appAlert(t('requestDetail.selectDateTimeAlert'));
            return;
        }
        if (!(await ensureAvailable())) return;
        if (!(await checkStillOpen())) return;
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
            // Show it under Pending at once: Appointments reloads from the server on focus,
            // which takes a few round trips, and until then the tab would look empty.
            const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
            markOffered({
                id: appointmentId,
                type: (one(type) ?? 'immediate') as Appointment['type'],
                assistanceType: one(assistanceType),
                title: one(title) ?? '',
                date: String(date ?? ''),
                time: etaText || 'Pending',
                car: one(car) ?? '',
                address: one(address) ?? '',
                notes: one(notes),
                budget: one(budget) ?? '',
                status: 'offered',
                zip: one(zip),
                mechanicId: user?.id,
                eta: etaText || undefined,
                locationLat: locationLat ? Number(one(locationLat)) : undefined,
                locationLng: locationLng ? Number(one(locationLng)) : undefined,
            });
            // A sent offer is `offered`: it waits for the owner under Pending, not Upcoming.
            router.replace({ pathname: '/(tabs)/appointments', params: { tab: 'pending' } });
            navigation.dispatch(
                CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'index' }],
                })
            );
        } catch (error: any) {
            setShowConfirm(false);
            if (error instanceof ApiError && [403, 404, 409].includes(error.statusCode) && !(await checkStillOpen())) return;
            appAlert(t('requestDetail.acceptFailed', { error: error.message || 'Unknown error' }));
        } finally {
            setSubmitting(false);
        }
    };

    // Hides the request from this mechanic's feed (server-side, temporal) and
    // goes back. The request stays open for other mechanics.
    const handleDecline = async () => {
        if (declining || submitting) return;
        const requestId = Array.isArray(id) ? id[0] : id || '';
        setDeclining(true);
        try {
            await assistanceDAO.reject(requestId);
            goBackOr(router, '/(tabs)/assist');
        } catch (error: any) {
            appAlert(t('requestDetail.declineFailed', { error: error.message || 'Unknown error' }));
        } finally {
            setDeclining(false);
        }
    };

    if (loadingRequest) {
        return (
            <View className="flex-1 justify-center items-center" style={{ backgroundColor: '#F4F6FC' }}>
                <ActivityIndicator size="large" color="#0047AB" />
            </View>
        );
    }

    return (
        <View className="flex-1" style={{ backgroundColor: '#F4F6FC' }}>
            <ScrollView className="flex-1">
                <View className="p-6">
                    {/* Section Badge */}
                    <View style={{ marginTop: 11 }}>
                      <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                            {t('requestDetail.badge')}
                        </Text>
                    </View>
                    </View>

                    {/* Title */}
                    <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
                        {t('requestDetail.title')}
                    </Text>

                    {/* Subtitle */}
                    <Text className="text-gray-500 font-outfit-regular text-base mb-2">
                        {t(isVideo ? 'requestDetail.subtitleVideo' : 'requestDetail.subtitle')}
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
                            {isVideo ? (
                                <Video size={26} color="#0047AB" />
                            ) : (
                                <Zap size={26} color={isUrgent ? '#EF4444' : '#0047AB'} fill={isUrgent ? '#EF4444' : '#0047AB'} />
                            )}
                        </View>
                        <View className="flex-1">
                            <View className="flex-row items-center gap-2">
                                <Text className="font-outfit-bold text-lg text-gray-900" numberOfLines={1}>{serviceLabel}</Text>
                                {isUrgent && (
                                    <View className="px-2 py-0.5 rounded-md" style={{ backgroundColor: '#FEE2E2' }}>
                                        <Text className="font-outfit-bold text-[12px] tracking-widest" style={{ color: '#EF4444' }}>{t('requestDetail.urgent')}</Text>
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
                                <Text className="font-outfit-semibold text-xs tracking-widest text-gray-400 mb-0.5">{t(isVideo ? 'requestDetail.videoPrice' : 'requestDetail.budget')}</Text>
                                <Text className="font-outfit-bold text-base text-gray-900">
                                    {isVideo && fetched?.providerBreakdown?.total
                                        ? `$${fetched.providerBreakdown.total}`
                                        : price ? `$${price}` : budget}
                                </Text>
                            </View>
                        </View>

                        {/* Video call: how long it lasts, the length the owner chose */}
                        {isVideo ? (
                            <View className="flex-row items-center px-5 py-4 border-b border-gray-100">
                                <View className="w-11 h-11 rounded-xl justify-center items-center mr-4" style={{ backgroundColor: '#E9F1FF' }}>
                                    <Timer size={20} color="#0047AB" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-outfit-semibold text-xs tracking-widest text-gray-400 mb-0.5">{t('requestDetail.videoDuration')}</Text>
                                    <Text className="font-outfit-bold text-base text-gray-900" testID="video-call-duration">
                                        {t('requestDetail.videoDurationValue', { count: callMinutes })}
                                    </Text>
                                </View>
                            </View>
                        ) : null}

                        {/* Video call: when it is booked for (instead of distance / ETA), one more row of the same card */}
                        {isVideo ? (
                            <View className="flex-row items-center px-5 py-4 border-b border-gray-100" testID="video-call-when">
                                <View className="w-11 h-11 rounded-xl justify-center items-center mr-4" style={{ backgroundColor: '#E9F1FF' }}>
                                    <Clock size={20} color="#0047AB" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-outfit-semibold text-xs tracking-widest text-gray-400 mb-0.5">{t('requestDetail.videoCallWhen')}</Text>
                                    <Text className="font-outfit-bold text-base text-gray-900">
                                        {videoCallStartLabel(typeof date === 'string' ? date : undefined, i18n.language) ?? t('requestDetail.videoCallNow')}
                                    </Text>
                                    <View style={{ marginTop: 6 }}>
                                        <VideoCallZoneNote
                                            compact
                                            call={{
                                                date: typeof date === 'string' && videoCallStartLabel(date, i18n.language) ? date : null,
                                                timezone: (fetched as { timezone?: string } | null)?.timezone ?? (typeof params.timezone === 'string' ? params.timezone : null),
                                            }}
                                        />
                                    </View>
                                </View>
                            </View>
                        ) : null}

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
                        <View className={`flex-row items-center px-5 py-4 ${isVideo ? '' : 'border-b border-gray-100'}`}>
                            <View className="w-11 h-11 rounded-xl justify-center items-center mr-4" style={{ backgroundColor: '#E9F1FF' }}>
                                <Wrench size={20} color="#0047AB" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-outfit-semibold text-xs tracking-widest text-gray-400 mb-0.5">{t('requestDetail.assistanceNeeded')}</Text>
                                <RequestIssueText
                                    requestId={id ? String(Array.isArray(id) ? id[0] : id) : undefined}
                                    fallback={String(notes || title || '')}
                                    className="font-outfit-bold text-base text-gray-900"
                                />
                            </View>
                        </View>

                        {/* Address — a video call is remote, it has none */}
                        {!isVideo && (
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
                        )}

                        {/* Client's area only — like the street line, the exact point unlocks after accept */}
                        {hasLocation && !isVideo && (
                            <View className="mx-5 mb-5">
                                <FixedLocationMap
                                    latitude={reqLat}
                                    longitude={reqLng}
                                    approximate
                                    seed={String(id)}
                                    height={160}
                                />
                                <Text className="font-outfit-medium text-[13px] mt-1.5" style={{ color: '#8C96AE' }}>
                                    {t('appointments.list.card.approximateArea')}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Distance / ETA Card */}
                    {!isVideo && (etaText || distKm !== null) && (
                        <View style={HERO_CARD}>
                            <View className="flex-row">
                                <View className="flex-1 flex-row items-center p-4">
                                    <View className="w-11 h-11 rounded-xl justify-center items-center mr-3" style={HERO_ICON}>
                                        <ArrowUpRight size={20} color={HERO_ICON_COLOR} />
                                    </View>
                                    <View>
                                        <Text className="font-outfit-semibold text-xs tracking-widest mb-0.5" style={HERO_LABEL}>{t('requestDetail.distance')}</Text>
                                        <Text className="font-outfit-bold text-lg" style={HERO_VALUE}>{distKm !== null ? `${(distKm * 0.621371).toFixed(1)} mi` : '—'}</Text>
                                    </View>
                                </View>
                                <View style={{ width: 1, backgroundColor: '#E4EAF5' }} className="my-4" />
                                <View className="flex-1 flex-row items-center p-4">
                                    <View className="w-11 h-11 rounded-xl justify-center items-center mr-3" style={HERO_ICON}>
                                        <Clock size={20} color={HERO_ICON_COLOR} />
                                    </View>
                                    <View>
                                        <Text className="font-outfit-semibold text-xs tracking-widest mb-0.5" style={HERO_LABEL}>{t('requestDetail.eta')}</Text>
                                        <Text className="font-outfit-bold text-lg" style={HERO_VALUE}>{etaText || '—'}</Text>
                                    </View>
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

                    {noLongerAvailable ? (
                        <View className="w-full py-4 rounded-xl items-center bg-gray-100 border border-gray-200">
                            <Text className="text-gray-500 font-outfit-bold text-base">{t('requestDetail.noLongerAvailable')}</Text>
                        </View>
                    ) : alreadyOffered ? (
                        <View className="w-full py-4 rounded-xl items-center bg-blue-50 border border-blue-100">
                            <Text className="text-blue-600 font-outfit-bold text-base">{t('requestDetail.waitingClientConfirmation')}</Text>
                        </View>
                    ) : (
                    <View style={{ gap: 12 }}>
                    <TouchableOpacity
                        onPress={handleAccept}
                        disabled={declining || (!isImmediate && (!selectedDate || !selectedTime))}
                        activeOpacity={0.8}
                        style={{ alignSelf: 'stretch' }}
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
                                <Text className="text-white font-outfit-bold text-lg">{t(isVideo ? 'requestDetail.offerVideoCall' : 'requestDetail.acceptRequest')}</Text>
                            </LinearGradient>
                        ) : (
                            <View className="w-full py-4 rounded-xl items-center bg-gray-300">
                                <Text className="text-white font-outfit-bold text-lg">{t(isVideo ? 'requestDetail.offerVideoCall' : 'requestDetail.acceptRequest')}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleDecline}
                        disabled={declining || submitting}
                        activeOpacity={0.8}
                        className="items-center justify-center"
                        style={{ alignSelf: 'stretch', height: 52, borderRadius: 12, backgroundColor: '#E6EAF2', opacity: declining ? 0.6 : 1 }}
                    >
                        <Text className="font-outfit-bold text-base" style={{ color: '#4A5470' }}>{t('requestDetail.decline')}</Text>
                    </TouchableOpacity>
                    </View>
                    )}

                    {/* Video call: what to know before offering, one short line each. */}
                    {isVideo && !noLongerAvailable && !alreadyOffered ? (
                        <View
                            className="bg-white rounded-2xl mt-5"
                            style={{ padding: 16, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }}
                            testID="video-call-good-to-know"
                        >
                            <Text className="font-outfit-bold" style={{ fontSize: 17, color: '#0B1530' }}>{t('requestDetail.goodToKnow.title')}</Text>
                            {([
                                { Icon: DollarSign, key: 'price' },
                                { Icon: Timer, key: 'time' },
                                { Icon: ShieldCheck, key: 'privacy' },
                            ] as const).map(({ Icon, key }) => (
                                <View key={key} className="flex-row items-center" style={{ gap: 12 }}>
                                    <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#E9F1FF' }}>
                                        <Icon size={18} color="#0047AB" />
                                    </View>
                                    <Text className="font-outfit-regular flex-1" style={{ fontSize: 15, lineHeight: 20, color: '#4B5563' }}>{t(`requestDetail.goodToKnow.${key}`)}</Text>
                                </View>
                            ))}
                        </View>
                    ) : null}
                </View>
            </ScrollView>

            <ConfirmationModal
                visible={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleConfirmAccept}
                icon={HelpCircle}
                iconColor="#1E56E3"
                confirmTone="success"
                title={t(isVideo ? 'requestDetail.confirmVideoTitle' : 'requestDetail.confirmOfferTitle')}
                message={t('requestDetail.confirmOfferPending')}
                highlight={isVideo
                    ? { label: t('requestDetail.offerHighlight.video'), value: String(title ?? ''), icon: 'videocam-outline' }
                    : isImmediate
                    ? { label: t('requestDetail.offerHighlight.immediate'), value: String(title ?? ''), icon: 'flash-outline' }
                    : { label: t('requestDetail.offerHighlight.scheduled'), value: selectedDate ?? '', sub: selectedTime ?? undefined, icon: 'calendar-outline' }
                }
                confirmText={submitting ? t('requestDetail.sendingOffer') : t(isVideo ? 'requestDetail.confirmVideo' : 'requestDetail.confirmOffer')}
                cancelText={t('requestDetail.cancel')}
            />
        </View>
    );
}
