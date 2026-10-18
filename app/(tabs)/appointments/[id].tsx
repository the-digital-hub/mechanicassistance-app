import { CancellationModal } from '@/components/appointments/CancellationModal';
import { MechanicAssistanceInfoTab } from '@/components/appointments/MechanicAssistanceInfoTab';
import { MechanicArrivalCard, PulseDot } from '@/components/appointments/MechanicArrivalCard';
import { MechanicClientInfoTab } from '@/components/appointments/MechanicClientInfoTab';
import { CheckInCodeCard } from '@/components/appointments/CheckInCodeCard';
import { OwnerReviewCard } from '@/components/appointments/OwnerReviewCard';
import {
    GradientButton,
    JoinVideoCallButton,
    MechanicVideoCallStatusCard,
    NoteSheet,
    OwnerVideoCallStatusCard,
    VideoCallWhenCard,
} from '@/components/appointments/VideoCallSections';
import {
    AcceptedHeader,
    CheckInBanner,
    OwnerBudgetPanel,
    OwnerEtaCard,
    OwnerMechanicCard,
    OwnerTab,
    OwnerTabs,
    OwnerTechnicianPanel,
} from '@/components/appointments/owner/OwnerSections';
import { AO, IconName, RequestSummaryRows } from '@/components/offer/OfferSections';
import { PaymentCardValue } from '@/components/payments/PaymentCardValue';
import { useAppointments } from '@/context/AppointmentsContext';
import { useUser } from '@/context/UserContext';
import { formatEtaTime, useAppointmentEta } from '@/hooks/useAppointmentEta';
import { useMechanicLocationBroadcast } from '@/hooks/useMechanicLocationBroadcast';
import { useVideoCallState } from '@/hooks/useVideoCallState';
import { ApiError } from '@/lib/api/types';
import { onSiteDAO } from '@/lib/dao/OnSiteDAO';
import { videoCallDAO } from '@/lib/dao/VideoCallDAO';
import { videoCallBookedLabel } from '@/lib/video/videoCallTime';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import type { AssistanceOfferSummary } from '@/lib/dao/interfaces';
import { userDAO } from '@/lib/dao/UserDAO';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { goBackOr } from '@/lib/navigation/goBackOr';
import React from 'react';
import { AttachmentStrip } from '@/components/appointments/AttachmentStrip';
import { parseAttachments } from '@/lib/media/attachments';
import { usePaymentCards } from '@/lib/payments/usePaymentCards';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Dimensions, ScrollView, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

type TabType = 'info' | 'client';

// Mechanic "Request accepted" palette.
const MECH = {
    blue: '#1E56E3',
    blueSoft: '#EAF1FF',
    text: '#0B1530',
    muted: '#6B7490',
    mutedLight: '#8C96AE',
    border: '#E4EAF5',
    page: '#F6F8FC',
    red: '#E53E3E',
    green: '#10B981',
    greenSoft: '#E6F7EF',
};

function assistanceTypeKey(appointment: { assistanceType?: string; type?: string }): string {
    const kind = appointment.assistanceType ?? appointment.type;
    if (appointment.assistanceType === 'witness') return 'appointments.detail.types.accident';
    if (kind === 'immediate') return 'appointments.detail.types.immediate';
    if (kind === 'videocall') return 'appointments.detail.types.videocall';
    return 'appointments.detail.types.scheduled';
}

export default function AppointmentDetailScreen() {
    // Switch back to Global params as Local causes context error in full tree
    const { id } = useGlobalSearchParams();
    // const { id } = useLocalSearchParams();
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const { getAppointmentById, updateAppointment, refresh: refreshAppointments } = useAppointments();

    const appointment = getAppointmentById(Array.isArray(id) ? id[0] : id || '');

    const { user } = useUser();
    const isUserRole = user?.role === 'user';
    const { resolve: resolvePaymentCard } = usePaymentCards(isUserRole);
    // A video call is remote: no GPS, ETA, check-in or on-site close-out.
    const isVideoCall = (appointment?.assistanceType ?? appointment?.type) === 'videocall';

    // "Head out": the mechanic left for the vehicle. Until then the job is
    // accepted but nobody follows them — no position shared, no live ETA.
    // `departedNow` covers the gap until the refreshed appointment arrives.
    const [departedNow, setDepartedNow] = React.useState<string | null>(null);
    const departedAt = appointment?.departedAt ?? departedNow;
    const departed = !!departedAt;
    const [headingOut, setHeadingOut] = React.useState(false);

    useMechanicLocationBroadcast({
        appointmentId: appointment?.id ?? '',
        status: appointment?.status ?? 'pending',
        role: user?.role,
        isVideoCall,
        departed,
    });

    // Lifted here so the socket listener stays alive regardless of active tab.
    // An accepted job is only tracked once the mechanic heads out.
    const ownerTracks = isUserRole && !isVideoCall && (appointment?.status !== 'accepted' || departed);
    const { minutesAway, etaTime, loading: etaLoading, mechanicCoords, polyline } = useAppointmentEta(
        ownerTracks ? appointment?.id : undefined,
        ownerTracks ? appointment?.status : undefined,
    );

    const headOut = async () => {
        if (!appointment || headingOut) return;
        setHeadingOut(true);
        try {
            // Ask now, while the mechanic is looking: the broadcast starts as soon as departedAt is set.
            const { status: perm } = await Location.requestForegroundPermissionsAsync();
            if (perm !== 'granted') {
                Alert.alert(t('appointments.detail.locationNeededTitle'), t('appointments.detail.locationNeeded'));
            }
            const res = await onSiteDAO.depart(appointment.id);
            setDepartedNow(res.departedAt);
            refreshAppointments();
        } catch (error) {
            const message = error instanceof ApiError && error.apiMessage ? error.apiMessage : t('appointments.detail.headOutFailed');
            Alert.alert(t('appointments.videoCall.errorTitle'), message);
        } finally {
            setHeadingOut(false);
        }
    };

    // Video call close-out (finish → confirm / dispute). Reloaded on focus, on
    // appointment_update and whenever the appointments list refreshes this row.
    // Not asked while still pending or once canceled: there is no close-out to show.
    const videoStateRelevant =
        isVideoCall && !['pending', 'canceled', 'cancelled'].includes(appointment?.status ?? 'pending');
    const { state: videoState, setState: setVideoState } = useVideoCallState(
        appointment?.id,
        videoStateRelevant,
        `${appointment?.status ?? ''}-${appointment?.updatedAt ?? ''}`,
    );
    const videoStatus = videoState?.status ?? appointment?.status;
    const videoCallLive = videoStatus === 'accepted' || videoStatus === 'in_progress';
    // Owner header for a video call: follows the close-out state, not just "accepted".
    const videoCallHeader: { title: string; icon: IconName; color: string } =
        videoStatus === 'awaiting_confirmation'
            ? { title: t('appointments.videoCall.header.confirm'), icon: 'help', color: AO.orange }
            : videoStatus === 'disputed'
                ? { title: t('appointments.videoCall.status.disputed'), icon: 'hourglass-outline', color: AO.orange }
                : videoStatus === 'completed'
                    ? (videoState?.currentStatus ?? appointment?.currentStatus) === 'not_resolved'
                        ? { title: t('appointments.videoCall.status.notCharged'), icon: 'close', color: AO.mutedLight }
                        : { title: t('appointments.videoCall.mechanic.completedTitle'), icon: 'checkmark', color: AO.green }
                    : { title: t(appointment?.startNow ? 'appointments.videoCall.header.ready' : 'appointments.videoCall.header.booked'), icon: 'videocam', color: AO.blue };
    const [videoBusy, setVideoBusy] = React.useState(false);
    const [showDisputeSheet, setShowDisputeSheet] = React.useState(false);
    const [showFinishSheet, setShowFinishSheet] = React.useState(false);
    const [offer, setOffer] = React.useState<AssistanceOfferSummary | null>(null);
    // Owner: the card the request is charged to (null = made before the app sent one → default card).
    const [paymentMethodId, setPaymentMethodId] = React.useState<string | null>(null);

    const [activeTab, setActiveTab] = React.useState<TabType>('info');
    const [ownerTab, setOwnerTab] = React.useState<OwnerTab>('status');
    const [checkInSeen, setCheckInSeen] = React.useState(false);
    const openOwnerTab = (tab: OwnerTab) => {
        if (tab === 'checkin') setCheckInSeen(true);
        setOwnerTab(tab);
    };
    const [showCancelModal, setShowCancelModal] = React.useState(false);
    const [isCanceledFeedback, setIsCanceledFeedback] = React.useState(false);

    // Consistent state for ClientTab (Mechanic View)
    const [rating, setRating] = React.useState(appointment?.clientReview?.rating || 0);
    const [selectedOption, setSelectedOption] = React.useState<string>(appointment?.clientReview?.experienceTags?.[0] || '');
    const [reviewText, setReviewText] = React.useState(appointment?.clientReview?.review || '');
    const [isReviewSubmitted, setIsReviewSubmitted] = React.useState(appointment?.isReviewSubmitted || false);

    // Hydrate mechanic review state once appointment data arrives — AppointmentsContext
    // loads asynchronously, so a cold navigation into this screen can mount before it
    // does, leaving the useState initializers above stuck at their empty defaults.
    const hasHydratedReview = React.useRef(false);
    React.useEffect(() => {
        if (appointment && !hasHydratedReview.current) {
            hasHydratedReview.current = true;
            setRating(appointment.clientReview?.rating || 0);
            setSelectedOption(appointment.clientReview?.experienceTags?.[0] || '');
            setReviewText(appointment.clientReview?.review || '');
            setIsReviewSubmitted(appointment.isReviewSubmitted || false);
        }
    }, [appointment]);

    // Debounced update implementation for preservation
    const timerRef = React.useRef<any>(null);
    const debouncedUpdate = React.useCallback(
        (updates: Partial<any>) => {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                if (appointment) {
                    updateAppointment(appointment.id, updates);
                }
            }, 1000);
        },
        [appointment?.id]
    );

    // Cleanup timer on unmount
    React.useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    // Mechanic: navigate to appointments list when client cancels
    React.useEffect(() => {
        if (!isUserRole && appointment?.status === 'canceled') {
            router.replace('/(tabs)/appointments');
        }
    }, [appointment?.status, isUserRole]);

    // Sync client review state to context for persistence
    React.useEffect(() => {
        if (appointment && !isReviewSubmitted && !isUserRole) {
            debouncedUpdate({
                clientReview: {
                    rating,
                    review: reviewText,
                    experienceTags: selectedOption ? [selectedOption] : []
                }
            });
        }
    }, [rating, selectedOption, reviewText]);

    // Owner: who the mechanic is and what the job costs — the same summary the offer screen used.
    // The appointment id is the request id.
    React.useEffect(() => {
        if (!isUserRole || !appointment?.id || !appointment?.mechanicId) return;
        let cancelled = false;
        assistanceDAO
            .getOfferSummary(appointment.id)
            .then((summary) => !cancelled && setOffer(summary))
            .catch((error) => console.error('Error fetching offer summary:', error));
        assistanceDAO
            .getById(appointment.id)
            .then((req) => {
                if (!cancelled) setPaymentMethodId(req?.paymentMethodId ?? null);
            })
            .catch((error) => console.error('Error fetching request payment method:', error));
        return () => {
            cancelled = true;
        };
    }, [isUserRole, appointment?.id, appointment?.mechanicId]);

    const videoError = (error: unknown, fallbackKey: string) => {
        // The server's message says why (e.g. 409: the call was never started).
        const message = error instanceof ApiError && error.apiMessage ? error.apiMessage : t(fallbackKey);
        Alert.alert(t('appointments.videoCall.errorTitle'), message);
    };

    const openVideoLobby = () => {
        if (appointment) router.push({ pathname: '/video-lobby/[id]' as never, params: { id: appointment.id } });
    };

    // Owner: it was resolved — charged now; then offer the mechanic review.
    const confirmVideoCall = async () => {
        if (!appointment || videoBusy) return;
        setVideoBusy(true);
        try {
            setVideoState(await videoCallDAO.confirm(appointment.id));
            refreshAppointments();
            router.push({ pathname: '/appointments/review/[id]' as never, params: { id: appointment.id } });
        } catch (error) {
            videoError(error, 'appointments.videoCall.owner.confirmFailed');
        } finally {
            setVideoBusy(false);
        }
    };

    // Owner: it was not resolved — nothing is charged until support decides.
    const disputeVideoCall = async (reason: string) => {
        if (!appointment || videoBusy) return;
        setVideoBusy(true);
        try {
            setVideoState(await videoCallDAO.dispute(appointment.id, reason));
            setShowDisputeSheet(false);
            refreshAppointments();
        } catch (error) {
            videoError(error, 'appointments.videoCall.dispute.failed');
        } finally {
            setVideoBusy(false);
        }
    };

    // Mechanic: the help is done; the owner is asked to confirm.
    const finishVideoCall = async (note: string) => {
        if (!appointment || videoBusy) return;
        setVideoBusy(true);
        try {
            setVideoState(await videoCallDAO.finish(appointment.id, note || undefined));
            setShowFinishSheet(false);
            refreshAppointments();
        } catch (error) {
            setShowFinishSheet(false);
            videoError(error, 'appointments.videoCall.mechanic.finishFailed');
        } finally {
            setVideoBusy(false);
        }
    };

    // Fetch client details if user is mechanic
    const [client, setClient] = React.useState<any>(null);
    React.useEffect(() => {
        const fetchClient = async () => {
            if (!isUserRole && appointment?.userId) {
                try {
                    const clientData = await userDAO.getPublicProfile(appointment.userId);
                    setClient(clientData);
                } catch (error) {
                    console.error('Error fetching client:', error);
                }
            }
        };
        fetchClient();
    }, [isUserRole, appointment?.userId]);

    const tabs: { key: TabType; label: string }[] = React.useMemo(() => [
        { key: 'info', label: t('appointments.detail.tabs.assistanceInfo') },
        { key: 'client', label: t('appointments.detail.tabs.clientInfo') },
    ], [t]);

    if (!appointment) {
        return (
            <View className="flex-1 bg-white justify-center items-center p-6">
                <Text className="font-outfit-bold text-lg text-gray-900">{t('appointments.detail.notFound')}</Text>
                <Text className="text-gray-500 mt-2">ID: {JSON.stringify(id)}</Text>
                <TouchableOpacity onPress={() => goBackOr(router, '/(tabs)/appointments')} className="mt-4">
                    <Text className="text-blue-600 font-outfit-medium">{t('appointments.detail.goBack')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const ownerDestination =
        appointment.locationLat != null && appointment.locationLng != null
            ? { latitude: appointment.locationLat, longitude: appointment.locationLng }
            : null;
    const ownerMechanicName = offer?.mechanic.displayName ?? t('requestAssistance.mechanicFound.technicianFallback');
    const awaitingHeadOut = !isVideoCall && appointment.status === 'accepted' && !departed;

    const renderOwnerPanel = () => {
        switch (ownerTab) {
            case 'status':
                if (isVideoCall) {
                    // No ETA on a remote call; a "not resolved" one was not charged, so nothing to rate.
                    return videoState?.currentStatus === 'not_resolved' ? null : (
                        <OwnerReviewCard appointmentId={appointment.id} status={videoStatus} />
                    );
                }
                return (
                    <View style={{ gap: 16 }}>
                        <OwnerReviewCard appointmentId={appointment.id} status={appointment.status} />
                        <OwnerEtaCard
                            status={appointment.status}
                            departed={departed}
                            minutesAway={minutesAway}
                            etaTime={etaTime}
                            loading={etaLoading}
                            mechanicName={ownerMechanicName}
                            destination={ownerDestination}
                            mechanicCoords={mechanicCoords}
                            polyline={polyline}
                        />
                    </View>
                );
            case 'checkin':
                return appointment.status === 'accepted' ? (
                    <CheckInCodeCard appointmentId={appointment.id} status={appointment.status} />
                ) : (
                    <RequestSummaryRows rows={[{ icon: 'checkmark-circle-outline', label: t('appointments.ownerAccepted.tabs.checkin'), value: t('appointments.ownerAccepted.checkInDone'), tone: 'green' }]} />
                );
            case 'info': {
                const issues = appointment.vehicleIssues?.map((i) => i.name).join(', ');
                const posted = [appointment.date, appointment.time].filter(Boolean).join(' · ');
                const rows = [
                    { icon: isVideoCall ? 'videocam-outline' as const : 'flash-outline' as const, label: t('appointments.ownerAccepted.rows.service'), value: t(assistanceTypeKey(appointment)) },
                    appointment.car ? { icon: 'car-outline' as const, label: t('appointments.ownerAccepted.rows.vehicle'), value: appointment.car } : null,
                    issues ? { icon: 'construct-outline' as const, label: t('appointments.ownerAccepted.rows.issue'), value: issues } : null,
                    appointment.notes ? { icon: 'document-text-outline' as const, label: t('appointments.ownerAccepted.rows.notes'), value: appointment.notes } : null,
                    appointment.address ? { icon: 'location-outline' as const, label: t('appointments.ownerAccepted.rows.location'), value: appointment.address } : null,
                    posted ? { icon: 'calendar-outline' as const, label: t('appointments.ownerAccepted.rows.posted'), value: posted } : null,
                ].filter((r): r is NonNullable<typeof r> => r !== null);
                return (
                    <View style={{ gap: 12 }}>
                        <RequestSummaryRows rows={rows} />
                        {parseAttachments(appointment.photos).length > 0 && <AttachmentStrip photos={appointment.photos} />}
                    </View>
                );
            }
            case 'mechanic':
                return <OwnerTechnicianPanel mechanic={offer?.mechanic ?? null} />;
            case 'budget':
                return (
                    <OwnerBudgetPanel
                        total={(offer?.breakdown?.total ?? offer?.price ?? appointment.budget ?? '').replace(/^\$/, '') || null}
                        payment={<PaymentCardValue paymentMethodId={paymentMethodId} card={resolvePaymentCard(paymentMethodId)} />}
                    />
                );
        }
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'info':
                return <MechanicAssistanceInfoTab appointment={appointment} />;
            case 'client':
                return (
                    <MechanicClientInfoTab
                        client={client}
                        appointmentType={appointment.type}
                        assistanceType={appointment.assistanceType}
                        rating={rating}
                        setRating={setRating}
                        selectedOption={selectedOption}
                        setSelectedOption={setSelectedOption}
                        reviewText={reviewText}
                        setReviewText={setReviewText}
                        isSubmitted={isReviewSubmitted}
                        onSubmit={() => {
                            if (isVideoCall) {
                                // POST /appointments/:id/client-review — allowed once the video call is completed.
                                if (videoStatus !== 'completed') {
                                    Alert.alert(t('appointments.videoCall.mechanic.reviewAfterCompleted'));
                                    return;
                                }
                                onSiteDAO
                                    .reviewClient(appointment.id, rating, reviewText.trim() || undefined)
                                    .then(() => setIsReviewSubmitted(true))
                                    .catch((error) => {
                                        if (error instanceof ApiError && error.statusCode === 409) setIsReviewSubmitted(true);
                                        else videoError(error, 'appointments.videoCall.mechanic.reviewFailed');
                                    });
                                return;
                            }
                            setIsReviewSubmitted(true);
                            updateAppointment(appointment.id, {
                                isReviewSubmitted: true,
                                clientReview: {
                                    rating,
                                    review: reviewText,
                                    experienceTags: selectedOption ? [selectedOption] : []
                                }
                            });
                        }}
                        onMessage={() => router.push(`/chat/${appointment.id}`)}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <View
            className="flex-1"
            style={{ backgroundColor: MECH.page }}
            testID="appointment-detail-root"
            nativeID="appointment-detail-root"
        >
            {isCanceledFeedback ? (
                <View><Text>Cancellation Feedback Placeholder</Text></View>
            ) : (
                <View className="flex-1">
                    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                        {isUserRole ? (
                            <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32, gap: 16 }} testID="owner-accepted">
                                <AcceptedHeader id={appointment.id} {...(isVideoCall ? videoCallHeader : {})} />

                                <OwnerMechanicCard
                                    mechanic={offer?.mechanic ?? null}
                                    onMessage={() => router.push(`/chat/${appointment.id}`)}
                                    onCall={isVideoCall ? undefined : () => router.push({ pathname: '/video-lobby/[id]' as any, params: { id: appointment.id } })}
                                />

                                {isVideoCall && (
                                    <>
                                        <VideoCallWhenCard date={appointment.date} startNow={appointment.startNow} />
                                        {videoCallLive && <JoinVideoCallButton onPress={openVideoLobby} />}
                                        {videoState && (
                                            <OwnerVideoCallStatusCard
                                                state={videoState}
                                                mechanicName={ownerMechanicName}
                                                busy={videoBusy}
                                                onConfirm={confirmVideoCall}
                                                onNotResolved={() => setShowDisputeSheet(true)}
                                            />
                                        )}
                                    </>
                                )}

                                <OwnerTabs
                                    active={ownerTab}
                                    onChange={openOwnerTab}
                                    checkInDot={!isVideoCall && appointment.status === 'accepted' && !checkInSeen}
                                    hideCheckIn={isVideoCall}
                                />

                                {!isVideoCall && ownerTab === 'status' && appointment.status === 'accepted' && (
                                    <CheckInBanner onPress={() => openOwnerTab('checkin')} />
                                )}

                                <View testID="tab-content-container">{renderOwnerPanel()}</View>

                                {(appointment.status === 'accepted' || appointment.status === 'pending') && (
                                    <TouchableOpacity onPress={() => setShowCancelModal(true)} style={{ alignItems: 'center', paddingVertical: 6 }} testID="owner-cancel">
                                        <Text className="font-outfit-bold" style={{ fontSize: 14, color: AO.red }}>{t('appointments.ownerAccepted.cancel')}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : (
                            <>
                            {/* Badge + title + assistance type */}
                            <View className="px-5 pt-5 pb-1">
                                <View className="flex-row items-center gap-1.5 mb-3 px-2.5 py-1 rounded-full" style={{ backgroundColor: MECH.blueSoft, alignSelf: 'flex-start' }}>
                                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: MECH.blue }} />
                                    <Text className="font-outfit-bold text-[10.5px] tracking-widest" style={{ color: MECH.blue }}>
                                        {isVideoCall
                                            ? t('appointments.videoCall.badge')
                                            : awaitingHeadOut
                                                ? t('appointments.detail.readyBadge')
                                                : t('appointments.detail.onTheWayBadge')}
                                    </Text>
                                </View>
                                <Text className="font-outfit-bold text-[22px]" style={{ color: MECH.text }}>
                                    {isVideoCall
                                        ? t('appointments.videoCall.mechanic.title')
                                        : awaitingHeadOut
                                            ? t('appointments.detail.acceptedTitle')
                                            : t('appointments.detail.onTheWayTitle')}
                                </Text>
                                <View className="flex-row items-center flex-wrap gap-2 mt-2">
                                    <View className="flex-row items-center gap-2">
                                        <View className="items-center justify-center" style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: isVideoCall ? MECH.blueSoft : 'rgba(229,62,62,0.08)' }}>
                                            <Ionicons name={isVideoCall ? 'videocam-outline' : 'flash-outline'} size={14} color={isVideoCall ? MECH.blue : MECH.red} />
                                        </View>
                                        <Text className="font-outfit-bold text-[13.5px]" style={{ color: MECH.text }}>
                                            {t(assistanceTypeKey(appointment))}
                                        </Text>
                                    </View>
                                    <Text style={{ color: MECH.border }}>·</Text>
                                    <Text className="font-outfit-medium text-xs" style={{ color: MECH.mutedLight }}>
                                        {t('appointments.detail.idLabel', { id: appointment.id.slice(0, 8) })}
                                    </Text>
                                </View>
                            </View>

                            {/* Status card — a finished video call shows its close-out card instead */}
                            {(!isVideoCall || videoCallLive) && (
                            <View className="mx-4 mt-3.5 px-5 py-4 items-center" style={{ borderRadius: 20, backgroundColor: MECH.greenSoft }} testID="status-badge" nativeID="status-badge">
                                <View className="flex-row items-center gap-2">
                                    <PulseDot color={MECH.green} />
                                    <Text className="font-outfit-bold text-[22px]" style={{ color: '#0F8A55' }} testID="status-value">
                                        {t('appointments.detail.accepted')}
                                    </Text>
                                </View>
                                <Text className="font-outfit-medium text-[13px] mt-1" style={{ color: '#19A368' }} testID="status-description">
                                    {isVideoCall
                                        ? videoCallBookedLabel(appointment, i18n.language)
                                            ? t('appointments.videoCall.scheduledAt', { date: videoCallBookedLabel(appointment, i18n.language) })
                                            : t('appointments.videoCall.remoteHint')
                                        : awaitingHeadOut
                                            ? t('appointments.detail.headOutPrompt')
                                            : t('appointments.detail.onTrip')}
                                </Text>
                            </View>
                            )}

                            {/* Head out — starts the owner's live map and ETA */}
                            {!isVideoCall && appointment.status === 'accepted' ? (
                                <View className="mx-4 mt-3">
                                    {awaitingHeadOut ? (
                                        <>
                                            <TouchableOpacity onPress={headOut} disabled={headingOut} activeOpacity={0.85} testID="head-out" accessibilityRole="button">
                                                <LinearGradient
                                                    colors={[MECH.blue, '#0B2A8E']}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 0 }}
                                                    style={{
                                                        borderRadius: 14,
                                                        paddingVertical: 15,
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: 10,
                                                        shadowColor: MECH.blue,
                                                        shadowOffset: { width: 0, height: 8 },
                                                        shadowOpacity: 0.35,
                                                        shadowRadius: 12,
                                                        elevation: 5,
                                                    }}
                                                >
                                                    {headingOut ? (
                                                        <ActivityIndicator color="#fff" />
                                                    ) : (
                                                        <Ionicons name="navigate-outline" size={18} color="#fff" />
                                                    )}
                                                    <Text className="text-white font-outfit-bold text-[15.5px]">
                                                        {t('appointments.detail.headOut')}
                                                    </Text>
                                                </LinearGradient>
                                            </TouchableOpacity>
                                            <Text className="text-center mt-2 font-outfit-regular text-[11.5px] leading-4" style={{ color: MECH.muted }}>
                                                {t('appointments.detail.headOutHint')}
                                            </Text>
                                        </>
                                    ) : (
                                        <View
                                            className="flex-row items-center bg-white"
                                            style={{ gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: '#EEF2FA' }}
                                            testID="departed-row"
                                        >
                                            <Ionicons name="navigate-outline" size={18} color={MECH.blue} />
                                            <View className="flex-1">
                                                <Text className="font-outfit-bold text-[13px]" style={{ color: MECH.text }}>
                                                    {t('appointments.detail.leftAt', { time: departedAt ? formatEtaTime(departedAt) : '--' })}
                                                </Text>
                                                <Text className="font-outfit-regular text-[11.5px] mt-0.5" style={{ color: MECH.muted }}>
                                                    {t('appointments.detail.clientNotified')}
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            ) : null}

                            {/* Video call: join / finish, then the owner's answer */}
                            {isVideoCall ? (
                                <View className="mx-4 mt-3.5" style={{ gap: 10 }}>
                                    {videoCallLive ? (
                                        <>
                                            <JoinVideoCallButton onPress={openVideoLobby} />
                                            <GradientButton
                                                label={t('appointments.videoCall.mechanic.finish')}
                                                icon="checkmark-done"
                                                colors={['#10B981', '#047857']}
                                                loading={videoBusy}
                                                onPress={() => setShowFinishSheet(true)}
                                                testID="mechanic-video-finish"
                                            />
                                        </>
                                    ) : videoState ? (
                                        <MechanicVideoCallStatusCard
                                            state={videoState}
                                            onRateClient={videoStatus === 'completed' && !isReviewSubmitted ? () => setActiveTab('client') : undefined}
                                        />
                                    ) : null}
                                </View>
                            ) : null}

                            {/* On-site check-in — the critical next step once the mechanic arrives */}
                            {!isVideoCall && appointment.status !== 'completed' ? (
                                <View className="mt-3.5">
                                    <MechanicArrivalCard
                                        inProgress={appointment.status === 'in_progress'}
                                        disabled={awaitingHeadOut}
                                        onStartCheckIn={() => router.push({
                                            pathname: '/appointments/check-in/[id]' as any,
                                            params: { id: appointment.id },
                                        })}
                                    />
                                </View>
                            ) : null}

                            {/* Quick-nav tabs */}
                            <View className="mx-4 mt-3.5 flex-row gap-2.5" testID="tab-navigation-container" nativeID="tab-navigation-container">
                                {tabs.map((tab) => {
                                    const isActive = activeTab === tab.key;
                                    return (
                                        <TouchableOpacity
                                            key={tab.key}
                                            testID={`tab-button-${tab.key}`}
                                            className="flex-1 items-center py-3.5"
                                            style={{
                                                borderRadius: 14,
                                                borderWidth: 1.5,
                                                borderColor: isActive ? MECH.blue : MECH.border,
                                                backgroundColor: isActive ? MECH.blueSoft : '#FFFFFF',
                                            }}
                                            onPress={() => setActiveTab(tab.key)}
                                        >
                                            <Text className="font-outfit-bold text-[13px]" style={{ color: isActive ? MECH.blue : MECH.text }}>
                                                {tab.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <View className="px-4 pt-3.5 pb-10" testID="tab-content-container" nativeID="tab-content-container">
                                {renderTabContent()}
                            </View>
                            </>
                        )}
                    </ScrollView>
                </View>
            )}

            {/* Success Overlay */}
            {/* 
            <SuccessModal
                visible={showSuccess}
                onClose={() => {
                    setShowSuccess(false);
                    router.navigate('/(tabs)/appointments');
                }}
            />
            */}

            {/* Video call: owner reports it as not resolved */}
            <NoteSheet
                visible={showDisputeSheet}
                title={t('appointments.videoCall.dispute.title')}
                body={t('appointments.videoCall.dispute.body')}
                placeholder={t('appointments.videoCall.dispute.placeholder')}
                confirmLabel={t('appointments.videoCall.dispute.submit')}
                minLength={10}
                maxLength={1000}
                danger
                submitting={videoBusy}
                onClose={() => setShowDisputeSheet(false)}
                onSubmit={disputeVideoCall}
            />

            {/* Video call: mechanic finishes it, with an optional note */}
            <NoteSheet
                visible={showFinishSheet}
                title={t('appointments.videoCall.mechanic.finishTitle')}
                body={t('appointments.videoCall.mechanic.finishBody')}
                placeholder={t('appointments.videoCall.mechanic.notePlaceholder')}
                confirmLabel={t('appointments.videoCall.mechanic.finishConfirm')}
                maxLength={1000}
                submitting={videoBusy}
                onClose={() => setShowFinishSheet(false)}
                onSubmit={finishVideoCall}
            />

            {/* Cancellation Overlay */}
            <CancellationModal
                visible={showCancelModal}
                onClose={() => setShowCancelModal(false)}
                onConfirm={() => {
                    setShowCancelModal(false);
                    // Navigate to cancellation reason screen with ID
                    router.push({
                        pathname: '/appointments/cancel-reason',
                        params: { id }
                    });
                }}
            />
        </View>
    );
}

// --- Sub-components (Mechanic View) ---

// KEEPING THESE HELPER FUNCTIONS DEFINED BUT UNUSED FOR NOW TO AVOID IMPORT ERRORS IF I UNCOMMENT

function InfoTab({ appointment, onScanComplete }: { appointment: any, onScanComplete: () => void }) {
    return (
        <View className="gap-5" testID="info-tab-content">
            {/* Title & Type */}
            <View>
                <Text className="text-gray-500 font-outfit-medium text-xs mb-1">Issue Type</Text>
                <Text className="text-blue-900 font-outfit-bold text-xl">{appointment.title}</Text>
            </View>

            {/* Photos */}
            {parseAttachments(appointment.photos).length > 0 && (
                <View>
                    <Text className="text-gray-500 font-outfit-medium text-xs mb-2">Photos</Text>
                    <AttachmentStrip photos={appointment.photos} size={128} />
                </View>
            )}

            {/* Car Details */}
            <View className="flex-row items-start gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                <View className="bg-blue-100 p-2 rounded-lg">
                    <Ionicons name="car-sport" size={24} color="#0047AB" />
                </View>
                <View>
                    <Text className="text-gray-500 text-xs font-outfit-medium">Vehicle</Text>
                    <Text className="text-blue-900 font-outfit-bold text-base">{appointment.car}</Text>
                </View>
            </View>

            {/* Description */}
            <View>
                <Text className="text-gray-500 font-outfit-medium text-xs mb-1">Description</Text>
                <Text className="text-gray-700 font-outfit-regular leading-5">
                    {appointment.notes || 'No description provided.'}
                </Text>
            </View>

            {/* Location (Simplified) */}
            <View>
                <Text className="text-gray-500 font-outfit-medium text-xs mb-1">Location</Text>
                <View className="flex-row items-center gap-2">
                    <Ionicons name="location" size={16} color="#0047AB" />
                    <Text className="text-blue-900 font-outfit-medium">{appointment.address}</Text>
                </View>
            </View>

            {/* Scan Button Action */}
            <View className="mt-4">
                <TouchableOpacity
                    onPress={onScanComplete}
                    className="bg-blue-600 w-full py-4 rounded-xl flex-row items-center justify-center gap-2 shadow-sm"
                >
                    <Ionicons name="qr-code-outline" size={24} color="white" />
                    <Text className="text-white font-outfit-bold text-lg">Scan to Start</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

function ClientTab({
    appointment,
    rating,
    setRating,
    selectedOptions,
    setSelectedOptions,
    reviewText,
    setReviewText,
    isSubmitted,
    setIsSubmitted
}: any) {
    return (
        <View><Text>Client Tab Placeholder</Text></View>
    );
}

function StatusTab({
    // props
}: any) {
    return <View><Text>Status Tab Placeholder</Text></View>
}

function BudgetTab({ appointment, onAskPayment }: { appointment: any, onAskPayment: () => void }) {
    return <View><Text>Budget Tab Placeholder</Text></View>
}

// ... other modals ...
