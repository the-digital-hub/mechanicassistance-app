import { useAppointments } from '@/context/AppointmentsContext';
import { useSocket } from '@/context/SocketContext';
import { useUser } from '@/context/UserContext';
import { apiClient } from '@/lib/api/apiClient';
import { ApiError } from '@/lib/api/types';
import { userDAO } from '@/lib/dao/UserDAO';
import { useMessageDialog } from '@/components/ui/useMessageDialog';
import { useVideoCallState } from '@/hooks/useVideoCallState';
import { VideoCallTimerCard } from '@/components/appointments/VideoCallTimerCard';
import { hasPreCallConsent, recordConsent } from '@/lib/video/consent';
import { DEFAULT_CALL_MINUTES, contractedSeconds } from '@/lib/video/callLength';
import { HeaderBackButton } from '@/components/ui/HeaderBackButton';
import { GradientButton } from '@/components/appointments/VideoCallSections';
import { AO } from '@/components/offer/OfferSections';
import { FLOATING_FOOTER } from '@/lib/ui/floatingFooter';
import { TYPE } from '@/lib/ui/type';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goBackOr } from '@/lib/navigation/goBackOr';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';

export default function VideoLobbyScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useUser();
    const { getAppointmentById, refresh } = useAppointments();
    const { lastMessage } = useSocket();
    const { t } = useTranslation();
    const { notify, dialog } = useMessageDialog();

    const appointmentId = Array.isArray(id) ? id[0] : id || '';
    const { state: callState } = useVideoCallState(appointmentId || undefined, !!appointmentId);
    const appointment = getAppointmentById(appointmentId);
    const isUserRole = user?.role === 'user';
    const participantName = user ? `${user.name} ${user.surname}`.trim() : 'Participant';
    const participantRole: 'user' | 'mechanic' = isUserRole ? 'user' : 'mechanic';

    const [isCreatingRoom, setIsCreatingRoom] = useState(false);
    const [roomUrl, setRoomUrl] = useState<string | null>(null);
    const [roomExpiry, setRoomExpiry] = useState<number | null>(null);
    const [otherPartyName, setOtherPartyName] = useState<string>('');
    const [isCheckingRoom, setIsCheckingRoom] = useState(true);

    // Pulsing animation
    const pulseScale = useSharedValue(1);
    const pulseOpacity = useSharedValue(0.6);

    useEffect(() => {
        pulseScale.value = withRepeat(
            withTiming(1.6, { duration: 1500, easing: Easing.out(Easing.ease) }),
            -1,
            true
        );
        pulseOpacity.value = withRepeat(
            withTiming(0, { duration: 1500, easing: Easing.out(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
        opacity: pulseOpacity.value,
    }));

    // Fetch the other party's name
    useEffect(() => {
        const fetchOtherParty = async () => {
            try {
                if (isUserRole && appointment?.mechanicId) {
                    const mech = await userDAO.getPublicProfile(appointment.mechanicId);
                    if (mech) setOtherPartyName(`${mech.name || ''} ${mech.surname || ''}`.trim());
                } else if (!isUserRole && appointment?.userId) {
                    const client = await userDAO.getPublicProfile(appointment.userId);
                    if (client) setOtherPartyName(`${client.name || ''} ${client.surname || ''}`.trim());
                }
            } catch (e) {
                console.error('Failed to fetch other party:', e);
            }
        };
        fetchOtherParty();
    }, [appointment?.mechanicId, appointment?.userId, isUserRole]);

    // Check if a room already exists (runs once on mount + polls every 3s for mechanic)
    useEffect(() => {
        const checkExistingRoom = async () => {
            try {
                const data = await apiClient.get<{ roomUrl: string; roomName: string; expiry: number; isExpired: boolean }>(
                    `/api/video-room/${appointmentId}`
                );
                if (data && data.roomUrl && !data.isExpired) {
                    setRoomUrl(data.roomUrl);
                    setRoomExpiry(data.expiry);
                    return true; // Room found
                }
            } catch (e) {
                // 404 = no room yet, that's fine. 401/403 will not change by
                // polling: say so instead of waiting forever.
                if (e instanceof ApiError && (e.statusCode === 401 || e.statusCode === 403)) {
                    void notify(t('videoCall.lobby.errorTitle'), t('videoCall.lobby.notOnAppointment'));
                    return true; // Stop polling
                }
            } finally {
                setIsCheckingRoom(false);
            }
            return false;
        };

        if (!appointmentId) return;

        let interval: ReturnType<typeof setInterval> | undefined;

        // Initial check, then poll every 3 seconds if mechanic is waiting for room
        checkExistingRoom().then((done) => {
            if (done || isUserRole) return;
            interval = setInterval(async () => {
                if (await checkExistingRoom()) clearInterval(interval);
            }, 3000);
        });
        return () => clearInterval(interval);
    }, [appointmentId, isUserRole]);

    // Also listen for real-time video_room_ready notifications (WebSocket).
    // The event carries no room URL (the room is private and the event also
    // travels through push/SQS), so fetch the room from the API instead.
    useEffect(() => {
        if (lastMessage?.type !== 'video_room_ready' || lastMessage?.payload?.appointmentId !== appointmentId) return;
        apiClient
            .get<{ roomUrl: string | null; expiry: number; isExpired: boolean }>(`/api/video-room/${appointmentId}`)
            .then((data) => {
                if (data?.roomUrl && !data.isExpired) {
                    setRoomUrl(data.roomUrl);
                    setRoomExpiry(data.expiry);
                }
            })
            .catch(() => {
                // The 3s poll above picks the room up anyway.
            });
    }, [lastMessage, appointmentId]);

    const handleStartCall = useCallback(async () => {
        setIsCreatingRoom(true);
        try {
            const data = await apiClient.post<{ roomUrl: string; roomName: string; expiry: number; token: string }>(
                '/api/video-room',
                { appointmentId, participantName, role: participantRole }
            );
            setRoomUrl(data.roomUrl);
            setRoomExpiry(data.expiry);

            router.push({
                pathname: '/video-call/[id]' as any,
                params: { id: appointmentId, roomUrl: data.roomUrl, token: data.token, expiry: data.expiry }
            });
        } catch (error) {
            console.error('Failed to create video room:', error);
            void notify(t('videoCall.lobby.errorTitle'), t('videoCall.lobby.startFailed'));
        } finally {
            setIsCreatingRoom(false);
        }
    }, [appointmentId, router, participantName, participantRole, notify, t]);

    const handleJoinCall = useCallback(async () => {
        if (!roomUrl) return;
        try {
            const data = await apiClient.get<{ roomUrl: string; token: string | null; expiry: number }>(
                `/api/video-room/${appointmentId}?participantName=${encodeURIComponent(participantName)}&role=${participantRole}`
            );
            if (!data.token) {
                void notify(t('videoCall.lobby.errorTitle'), t('videoCall.lobby.roomExpired'));
                return;
            }
            router.push({
                pathname: '/video-call/[id]' as any,
                params: { id: appointmentId, roomUrl: data.roomUrl, token: data.token, expiry: data.expiry }
            });
        } catch (error) {
            console.error('Failed to join video call:', error);
            void notify(t('videoCall.lobby.errorTitle'), t('videoCall.lobby.joinFailed'));
        }
    }, [roomUrl, appointmentId, router, participantName, participantRole, notify, t]);

    const minutes = callState?.contractedMinutes ?? callState?.baseMinutes ?? appointment?.durationMinutes ?? DEFAULT_CALL_MINUTES;
    // The call already started: whoever left and came back is rejoining, not starting.
    const rejoin = callState?.startedAtLocalMs != null && (callState.status === 'accepted' || callState.status === 'in_progress');
    // Both people accept the conditions of the call (captions and transcript only if both agree during
    // the call) before entering it; the answer is kept with its time and the version of the text.
    const consentRole: 'owner' | 'mechanic' = isUserRole ? 'owner' : 'mechanic';
    const [accepted, setAccepted] = useState(false);
    const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
    useEffect(() => {
        if (!appointmentId) return;
        hasPreCallConsent(appointmentId, consentRole).then((c) => {
            if (c) {
                setAccepted(true);
                setAcceptedAt(c.at);
            }
        });
    }, [appointmentId, consentRole]);
    const canAct = (isUserRole || !!roomUrl) && accepted;
    const proceed = isUserRole ? handleStartCall : handleJoinCall;
    const onAct = async () => {
        if (!accepted) return;
        if (!acceptedAt) {
            const record = await recordConsent(appointmentId, { kind: 'precall', role: consentRole, accepted: true });
            setAcceptedAt(record.at);
        }
        proceed();
    };
    const tips = [1, 2, 3].map((n) => t(`videoCall.lobby.tips.${isUserRole ? 'owner' : 'mechanic'}${n}`));

    if (!appointment) {
        return (
            <View style={styles.container}>
                <View style={styles.centerContent}>
                    <Text style={styles.errorTitle}>{t('videoCall.lobby.notFound')}</Text>
                    <TouchableOpacity onPress={() => goBackOr(router, '/(tabs)/appointments')} style={styles.backLink}>
                        <Text style={styles.backLinkText}>{t('videoCall.lobby.goBack')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (isCheckingRoom) {
        return (
            <View style={styles.container}>
                {dialog}
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={AO.blue} />
                    <Text style={styles.loadingText}>{t('videoCall.lobby.checking')}</Text>
                </View>
            </View>
        );
    }

    type InfoRow = { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; text: string };
    const infoRows = [
        appointment.car ? ({ icon: 'car-sport-outline', label: t('videoCall.lobby.labels.vehicle'), text: appointment.car } as InfoRow) : null,
        otherPartyName ? ({ icon: 'person-outline', label: t(isUserRole ? 'videoCall.lobby.labels.technician' : 'videoCall.lobby.labels.customer'), text: otherPartyName } as InfoRow) : null,
        { icon: 'timer-outline', label: t('videoCall.lobby.labels.duration'), text: t('requestAssistance.when.durationValue', { count: minutes }) } as InfoRow,
    ].filter((r): r is InfoRow => r !== null);

    return (
        <View style={styles.container}>
            {dialog}
            <View style={styles.header}>
                <HeaderBackButton marginLeft={0} onPress={() => goBackOr(router, { pathname: '/appointments/[id]', params: { id: appointmentId } })} />
                <Text style={styles.headerTitle}>{t('videoCall.lobby.header')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.circleContainer}>
                    <Animated.View style={[styles.pulseRing, styles.pulseRingOuter, pulseStyle]} />
                    <Animated.View style={[styles.pulseRing, styles.pulseRingMiddle, pulseStyle]} />
                    <TouchableOpacity
                        onPress={onAct}
                        disabled={isCreatingRoom || !canAct}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={t(rejoin ? 'videoCall.lobby.rejoin' : isUserRole ? 'videoCall.lobby.start' : 'videoCall.lobby.join')}
                        style={[styles.mainCircle, (isCreatingRoom || !canAct) && { opacity: 0.55 }]}
                    >
                        <LinearGradient colors={['#2F6BFF', '#1E56E3', '#0B2A8E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mainCircleFill}>
                            {isCreatingRoom ? <ActivityIndicator size="large" color="white" /> : <Ionicons name="videocam" size={46} color="white" />}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                <Text style={styles.actionLabel}>{t(rejoin ? 'videoCall.lobby.rejoinTitle' : isUserRole ? 'videoCall.lobby.startTitle' : 'videoCall.lobby.joinTitle')}</Text>
                <Text style={styles.actionSubLabel}>
                    {rejoin ? t('videoCall.lobby.rejoinHint') : isUserRole ? t('videoCall.lobby.startHint') : roomUrl ? t('videoCall.lobby.joinHint') : t('videoCall.lobby.waitingHint')}
                </Text>

                {roomUrl && roomExpiry ? (
                    <View style={styles.roomStatus}>
                        <View style={styles.roomStatusDot} />
                        <Text style={styles.roomStatusText}>{t('videoCall.lobby.roomActive')}</Text>
                    </View>
                ) : !isUserRole ? (
                    <View style={styles.waitingContainer}>
                        <ActivityIndicator size="small" color={AO.muted} />
                        <Text style={styles.waitingText}>{t('videoCall.lobby.waiting')}</Text>
                    </View>
                ) : null}

                {rejoin && callState?.startedAtLocalMs != null ? (
                    <View style={{ alignSelf: 'stretch', marginTop: 20 }}>
                        <VideoCallTimerCard
                            startedAtMs={callState.startedAtLocalMs}
                            limitSeconds={contractedSeconds(callState)}
                            addedMinutes={Math.max(0, (callState.contractedMinutes ?? 0) - (callState.baseMinutes ?? 0))}
                        />
                    </View>
                ) : null}

                <View style={styles.card}>
                    {infoRows.map((r, i) => (
                        <View key={r.icon} style={[styles.infoRow, i < infoRows.length - 1 && styles.infoRowBorder]}>
                            <View style={styles.iconTile}><Ionicons name={r.icon} size={18} color={AO.blue} /></View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.infoLabel}>{r.label}</Text>
                                <Text style={styles.infoText} numberOfLines={1}>{r.text}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                <View style={[styles.card, styles.consent]} testID="lobby-consent">
                    <View style={styles.consentHead}>
                        <View style={styles.iconTile}><Ionicons name="shield-checkmark-outline" size={18} color={AO.blue} /></View>
                        <Text style={styles.consentTitle}>{t('videoCall.lobby.consent.title')}</Text>
                    </View>
                    {[1, 2, 3].map((n) => (
                        <View key={n} style={styles.tipRow}>
                            <Ionicons name="ellipse" size={6} color={AO.muted} style={{ marginTop: 8 }} />
                            <Text style={styles.tipText}>{t(`videoCall.lobby.consent.point${n}`)}</Text>
                        </View>
                    ))}
                    <TouchableOpacity
                        onPress={() => !acceptedAt && setAccepted((v) => !v)}
                        activeOpacity={0.8}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: accepted }}
                        style={styles.consentCheck}
                        testID="lobby-consent-check"
                    >
                        <Ionicons name={accepted ? 'checkbox' : 'square-outline'} size={24} color={accepted ? AO.blue : AO.mutedLight} />
                        <Text style={styles.consentCheckText}>{t('videoCall.lobby.consent.accept')}</Text>
                    </TouchableOpacity>
                    {acceptedAt ? (
                        <Text style={styles.consentSaved}>{t('videoCall.lobby.consent.acceptedOn', { date: new Date(acceptedAt).toLocaleString() })}</Text>
                    ) : null}
                </View>

                <View style={styles.card}>
                    <Text style={styles.tipsTitle}>{t('videoCall.lobby.tipsTitle')}</Text>
                    {tips.map((tip) => (
                        <View key={tip} style={styles.tipRow}>
                            <Ionicons name="checkmark-circle" size={18} color={AO.blue} />
                            <Text style={styles.tipText}>{tip}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.note}>
                    <View style={styles.noteIcon}><Ionicons name="time-outline" size={18} color={AO.blue} /></View>
                    <Text style={styles.noteText}>{t('videoCall.lobby.footer', { minutes })}</Text>
                </View>
            </ScrollView>

            <View style={[FLOATING_FOOTER, { paddingBottom: 28 }]}>
                <GradientButton
                    label={t(rejoin ? 'videoCall.lobby.rejoin' : isUserRole ? 'videoCall.lobby.start' : 'videoCall.lobby.join')}
                    icon="videocam"
                    onPress={onAct}
                    disabled={!canAct}
                    loading={isCreatingRoom}
                    testID="lobby-primary"
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: AO.page },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: AO.page },
    headerTitle: { fontFamily: 'Outfit_700Bold', fontSize: TYPE.group.fontSize, color: AO.text },
    centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    scroll: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
    circleContainer: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    pulseRing: { position: 'absolute', borderRadius: 999, backgroundColor: '#2B66F8' },
    pulseRingOuter: { width: 200, height: 200 },
    pulseRingMiddle: { width: 160, height: 160 },
    mainCircle: { width: 120, height: 120, borderRadius: 60, shadowColor: '#2B66F8', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8, zIndex: 10 },
    mainCircleFill: { flex: 1, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
    actionLabel: { fontFamily: 'Outfit_700Bold', fontSize: 24, color: AO.text, marginBottom: 6, textAlign: 'center' },
    actionSubLabel: { fontFamily: 'Outfit_400Regular', fontSize: TYPE.helper.fontSize, lineHeight: 20, color: AO.muted, textAlign: 'center', paddingHorizontal: 12 },
    roomStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 16, backgroundColor: AO.blueSoft, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
    roomStatusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: AO.blue, marginRight: 8 },
    roomStatusText: { fontFamily: 'Outfit_600SemiBold', fontSize: TYPE.caption.fontSize, color: AO.blue },
    waitingContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 8 },
    waitingText: { fontFamily: 'Outfit_400Regular', fontSize: TYPE.caption.fontSize, color: AO.muted },
    consent: { borderColor: AO.blueSoft, backgroundColor: AO.blueSofter, paddingBottom: 12 },
    consentHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 6 },
    consentTitle: { flex: 1, fontFamily: 'Outfit_700Bold', fontSize: TYPE.body.fontSize, color: AO.text },
    consentCheck: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, paddingBottom: 4 },
    consentCheckText: { flex: 1, fontFamily: 'Outfit_600SemiBold', fontSize: TYPE.helper.fontSize, lineHeight: 20, color: AO.text },
    consentSaved: { fontFamily: 'Outfit_400Regular', fontSize: TYPE.caption.fontSize, color: AO.muted, paddingTop: 2, paddingLeft: 36 },
    card: { alignSelf: 'stretch', backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: AO.borderSoft, paddingHorizontal: 14, paddingVertical: 6, marginTop: 20 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
    infoRowBorder: { borderBottomWidth: 1, borderBottomColor: AO.borderSoft },
    iconTile: { width: 34, height: 34, borderRadius: 10, backgroundColor: AO.blueSoft, alignItems: 'center', justifyContent: 'center' },
    infoLabel: { fontFamily: 'Outfit_600SemiBold', fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: AO.mutedLight },
    infoText: { fontFamily: 'Outfit_600SemiBold', fontSize: TYPE.body.fontSize, color: AO.text },
    tipsTitle: { fontFamily: 'Outfit_700Bold', fontSize: TYPE.body.fontSize, color: AO.text, paddingTop: 8, paddingBottom: 4 },
    tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 7 },
    tipText: { flex: 1, fontFamily: 'Outfit_400Regular', fontSize: TYPE.helper.fontSize, lineHeight: 20, color: AO.muted },
    note: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, padding: 14, borderRadius: 16, backgroundColor: AO.blueSofter, borderWidth: 1, borderColor: AO.blueSoft },
    noteIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: AO.blueSoft, alignItems: 'center', justifyContent: 'center' },
    noteText: { flex: 1, fontFamily: 'Outfit_400Regular', fontSize: TYPE.helper.fontSize, lineHeight: 20, color: AO.muted },
    errorTitle: { fontFamily: 'Outfit_700Bold', fontSize: TYPE.group.fontSize, color: AO.text },
    backLink: { marginTop: 16 },
    backLinkText: { fontFamily: 'Outfit_500Medium', fontSize: TYPE.helper.fontSize, color: AO.blue },
    loadingText: { fontFamily: 'Outfit_500Medium', fontSize: TYPE.helper.fontSize, color: AO.muted, marginTop: 12 },
});
