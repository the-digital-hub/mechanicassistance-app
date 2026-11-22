import { useAcceptedSlot } from '@/lib/scheduled/slot';
import { isFarScheduled } from '@/lib/scheduled/timing';
import { RequestAgainButton } from '@/components/scheduled/RequestAgainButton';
import { FinalQuoteBanner } from '@/components/scheduled/FinalQuoteBanner';
import { CancellationDisputeBanner } from '@/components/appointments/CancellationDisputeBanner';
import { canCancelBeforeStart } from '@/components/appointments/CancelRequestLink';
import { CancellationModal } from '@/components/appointments/CancellationModal';
import { MechanicAssistanceInfoTab } from '@/components/appointments/MechanicAssistanceInfoTab';
import { HeadOutNextSteps, MechanicArrivalCard, PulseDot } from '@/components/appointments/MechanicArrivalCard';
import { CheckInCodeCard } from '@/components/appointments/CheckInCodeCard';
import { BackToDashboardButton, ServiceReportCard } from '@/components/appointments/ServiceReportCard';
import { ClientReviewCard } from '@/components/appointments/ClientReviewCard';
import { MechanicVideoStatusTab } from '@/components/appointments/MechanicVideoStatusTab';
import { useOwnerReviewPending } from '@/components/appointments/OwnerReviewInline';
import { OwnerReviewCard } from '@/components/appointments/OwnerReviewCard';
import { VideoCallTimerCard } from '@/components/appointments/VideoCallTimerCard';
import { TranscriptCard } from '@/components/video/TranscriptCard';
import { ExtensionRequestPanel } from '@/components/video/ExtensionRequestPanel';
import { ExtendCallSheet } from '@/components/video/ExtendCallSheet';
import { JoinCallSheet } from '@/components/video/JoinCallSheet';
import { CallTimeAddedToast } from '@/components/video/CallTimeAddedToast';
import {
    CustomerInRoomCard,
    SessionTimerNote,
    JoinVideoCallButton,
    WaitingForCustomerCard,
    MechanicVideoCallStatusCard,
    NoteSheet,
    QuietButton,
    OwnerVideoCallStatusCard,
    VideoCallWhenCard,
} from '@/components/appointments/VideoCallSections';
import {
    AcceptedHeader,
    CheckInBanner,
    ClientInfoPanel,
    MechanicClientCard,
    OwnerBudgetPanel,
    OwnerEtaCard,
    OwnerMechanicCard,
    OwnerTab,
    OwnerTabs,
    OwnerTechnicianPanel,
    OwnerVisitTimeline,
} from '@/components/appointments/owner/OwnerSections';
import { AO, IconName, RequestSummaryRows } from '@/components/offer/OfferSections';
import { PaymentCardValue } from '@/components/payments/PaymentCardValue';
import { isCancelledStatus, useAppointments } from '@/context/AppointmentsContext';
import { useUser } from '@/context/UserContext';
import { VehicleIdsRow } from '@/components/scheduled/ui';
import { vehicleDAO } from '@/lib/dao/VehicleDAO';
import { formatEtaTime, useAppointmentEta } from '@/hooks/useAppointmentEta';
import { useOnSiteProgress, visitStage } from '@/hooks/useOnSiteProgress';
import { useHeadOut } from '@/hooks/useHeadOut';
import { useCustomerInRoom } from '@/hooks/useCustomerInRoom';
import { useVideoCallState } from '@/hooks/useVideoCallState';
import { ApiError } from '@/lib/api/types';
import { appointmentDAO } from '@/lib/dao/AppointmentDAO';
import { onSiteDAO, type OnSiteVisit } from '@/lib/dao/OnSiteDAO';
import { MechanicOnSiteConfirmCard, OwnerOnSiteConfirmCard } from '@/components/appointments/OnSiteConfirmationCards';
import { videoCallDAO } from '@/lib/dao/VideoCallDAO';
import { onCancellationDisputePush } from '@/lib/notifications/push';
import { contractedSeconds, DEFAULT_CALL_MINUTES } from '@/lib/video/callLength';
import { formatLocalDateTime, videoCallBookedLabel } from '@/lib/video/videoCallTime';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import type { AssistanceClientSummary, AssistanceOfferSummary, CancellationDispute } from '@/lib/dao/interfaces';
import { userDAO } from '@/lib/dao/UserDAO';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useGlobalSearchParams, useRouter } from 'expo-router';
import { clearViewingAppointment, setViewingAppointment } from '@/lib/notifications/onSiteConfirmAlert';
import { goBackOr } from '@/lib/navigation/goBackOr';
import React from 'react';
import { AttachmentCard, AttachmentStrip } from '@/components/appointments/AttachmentStrip';
import { OnSiteDialog } from '@/components/on-site/ui';
import { useMessageDialog } from '@/components/ui/useMessageDialog';
import { RequestObdPanel, useRequestObd } from '@/components/video/RequestObdPanel';
import { RequestVinCheckModal } from '@/components/video/RequestVinCheckModal';
import { useVisitObdVinCheck } from '@/hooks/useRequestObdVinCheck';
import { parseAttachments } from '@/lib/media/attachments';
import { usePaymentCards } from '@/lib/payments/usePaymentCards';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Dimensions, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { chatAvailability } from '@/lib/chat/chatAvailability';
import { RequestIdRow } from '@/components/ui/RequestIdRow';
import { refLabel } from '@/lib/refCode';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';

const { width } = Dimensions.get('window');


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
    const { id: globalId, join: joinParam } = useGlobalSearchParams();
    // const { id } = useLocalSearchParams();
    const router = useRouter();
    // Leaving a closed assistance: empty the stack so the tab does not reopen it.
    const backToDashboard = () => {
        if (router.canDismiss()) router.dismissAll();
        router.navigate('/(tabs)/dashboard');
    };
    const { t, i18n } = useTranslation();
    const { getAppointmentById, refresh: refreshAppointments, isLoading: appointmentsLoading } = useAppointments();

    // The global params are those of whichever screen is focused, and they come empty for a moment while navigating
    // (coming back from the video lobby, say): the last real id is kept so the appointment is not "lost" meanwhile.
    const lastId = React.useRef<string | undefined>(undefined);
    const rawId = Array.isArray(globalId) ? globalId[0] : globalId;
    if (rawId) lastId.current = rawId;
    const id = rawId || lastId.current;

    const baseAppointment = getAppointmentById(id || '');
    // A scheduled service is booked for the time the provider offered, not the window the owner asked for.
    const acceptedSlotTime = useAcceptedSlot(baseAppointment?.id, (baseAppointment?.assistanceType ?? baseAppointment?.type) === 'scheduled' && baseAppointment?.source === 'appointment');
    const appointment = React.useMemo(() => (baseAppointment && acceptedSlotTime ? { ...baseAppointment, date: acceptedSlotTime.start } : baseAppointment), [baseAppointment, acceptedSlotTime]);

    const { user } = useUser();
    const isUserRole = user?.role === 'user';
    const { resolve: resolvePaymentCard } = usePaymentCards(isUserRole);
    // A video call is remote: no GPS, ETA, check-in or on-site close-out.
    const isVideoCall = (appointment?.assistanceType ?? appointment?.type) === 'videocall';
    // On-site: the mechanic's scanner read another vehicle's VIN (or the vehicle has none on file). The owner is told.
    const visitVinCheck = useVisitObdVinCheck(appointment?.id, isUserRole && !!appointment && !isVideoCall);

    // "Head out": the mechanic left for the vehicle. The position itself is
    // shared app-wide by MechanicLocationBroadcaster, not by this screen.
    const { headOut: departNow, headingOut, departedNow } = useHeadOut();
    const departedAt = appointment?.departedAt ?? departedNow;
    const departed = !!departedAt;
    const isCancelled = isCancelledStatus(appointment?.status);

    // Cancelled after the mechanic headed out and past the free window: the hold
    // was kept and a cancellation dispute opened. 404 (none) comes back as null.
    const [cancellationDispute, setCancellationDispute] = React.useState<CancellationDispute | null>(null);
    // Bumped by a foreground `cancellation_disputed` / `cancellation_dispute_resolved` push for this appointment.
    const [disputeTick, setDisputeTick] = React.useState(0);
    // `refresh` is a new function every render; read it through a ref so the subscription stays put.
    const refreshAppointmentsRef = React.useRef(refreshAppointments);
    refreshAppointmentsRef.current = refreshAppointments;
    React.useEffect(() => {
        if (!appointment?.id) return;
        const id = appointment.id;
        return onCancellationDisputePush((appointmentId) => {
            if (appointmentId !== id) return;
            setDisputeTick((n) => n + 1);
            // The push can be the first sign the appointment was cancelled.
            void refreshAppointmentsRef.current();
        });
    }, [appointment?.id]);
    React.useEffect(() => {
        if (!isCancelled || !appointment?.id) {
            setCancellationDispute(null);
            return;
        }
        let cancelled = false;
        appointmentDAO
            .getCancellationDispute(appointment.id)
            .then((d) => !cancelled && setCancellationDispute(d))
            .catch((error) => console.error('Error fetching cancellation dispute:', error));
        return () => {
            cancelled = true;
        };
    }, [isCancelled, appointment?.id, appointment?.updatedAt, disputeTick]);

    // Lifted here so the socket listener stays alive regardless of active tab.
    // An accepted job is only tracked once the mechanic heads out.
    const ownerTracks = isUserRole && !isVideoCall && (appointment?.status !== 'accepted' || departed);
    const { minutesAway, etaTime, loading: etaLoading, mechanicCoords, polyline } = useAppointmentEta(
        ownerTracks ? appointment?.id : undefined,
        ownerTracks ? appointment?.status : undefined,
    );

    const ownerVisit = useOnSiteProgress(
        appointment?.id,
        isUserRole && !isVideoCall && (appointment?.status === 'in_progress' || appointment?.status === 'started'),
        `${appointment?.status ?? ''}-${appointment?.updatedAt ?? ''}`,
    );

    const headOut = () => {
        if (appointment) departNow(appointment.id);
    };

    // On-site job already checked in: skip the arrival card and reopen the flow
    // where it was left. Decided once per appointment, on its first load, so a
    // check-in made from this screen (status flips while the flow is on top) or
    // coming back from the flow never pushes it again.
    const arrivalDecidedFor = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (!appointment || !user || arrivalDecidedFor.current === appointment.id) return;
        arrivalDecidedFor.current = appointment.id;
        if (user.role === 'mechanic' && !isVideoCall && appointment.status === 'in_progress') {
            router.push({ pathname: '/appointments/check-in/[id]' as any, params: { id: appointment.id } });
        }
    }, [appointment, user, isVideoCall, router]);

    // Video call close-out (finish → confirm / dispute). Reloaded on focus, on
    // appointment_update and whenever the appointments list refreshes this row.
    // Not asked while still pending or once canceled: there is no close-out to show.
    const videoStateRelevant =
        isVideoCall && !['pending', 'canceled', 'cancelled'].includes(appointment?.status ?? 'pending');
    const { state: videoState, setState: setVideoState, reload: reloadVideoState } = useVideoCallState(
        appointment?.id,
        videoStateRelevant,
        `${appointment?.status ?? ''}-${appointment?.updatedAt ?? ''}`,
    );
    const videoStatus = videoState?.status ?? appointment?.status;
    const videoCallLive = videoStatus === 'accepted' || videoStatus === 'in_progress';
    // The owner's OBD scanner report: it can change until the call is over.
    const obd = useRequestObd(isVideoCall ? appointment?.id : undefined);
    const obdEditable = ['pending', 'accepted', 'in_progress'].includes(videoStatus ?? '');
    const [obdSeen, setObdSeen] = React.useState(false);
    const obdDot = !obdSeen && (obd.report?.status === 'ready' || obd.report?.status === 'manual');
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
    // Started = the other person joined the call (both phones report it).
    const videoStartedAtMs = videoState?.startedAtLocalMs ?? null;
    // The time the call has (base + what the owner bought), as the server counts it.
    const videoLimitSeconds = contractedSeconds(videoState);
    // Owner, video call: the technician's rating is still to do once the call is closed and charged.
    const ownerReview = useOwnerReviewPending(
        appointment?.id,
        isUserRole && isVideoCall && videoStatus === 'completed' && videoState?.currentStatus !== 'not_resolved',
    );
    const [reviewSent, setReviewSent] = React.useState(false);
    // Technician: the customer already opened the room and is waiting in it.
    const customerInRoom = useCustomerInRoom(appointment?.id, !isUserRole && isVideoCall && videoCallLive && videoStartedAtMs === null);
    // What the transcript's PDF says about the call.
    const transcriptInfo = {
        ref: appointment?.refCode ?? null,
        vehicle: appointment?.car ?? null,
        callDate: formatLocalDateTime(videoState?.callStartedAt ?? appointment?.date, i18n.language) || null,
        durationMinutes: videoState?.contractedMinutes ?? videoState?.baseMinutes ?? appointment?.durationMinutes ?? null,
        selfName: [user?.name, user?.surname].filter(Boolean).join(' ') || null,
    };
    const videoAddedMinutes = Math.max(0, (videoState?.contractedMinutes ?? 0) - (videoState?.baseMinutes ?? 0));
    // Technician: what the extra time is worth to them. The server sends the technician's total (`budget`,
    // which already includes it) and what the call alone paid (`providerBreakdown.total`, the snapshot);
    // the difference is the extension, already net of the platform fee. Nothing is computed from a rate.
    const [callPayout, setCallPayout] = React.useState<number | null>(null);
    React.useEffect(() => {
        if (isUserRole || !isVideoCall || videoAddedMinutes <= 0 || !appointment?.id) return;
        let cancelled = false;
        assistanceDAO
            .getById(appointment.id)
            .then((r) => {
                const total = Number(r?.providerBreakdown?.total);
                if (!cancelled && Number.isFinite(total) && total > 0) setCallPayout(total);
            })
            .catch(() => undefined);
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isUserRole, isVideoCall, videoAddedMinutes, appointment?.id, appointment?.budget]);
    const budgetNumber = Number(String(appointment?.budget ?? '').replace(/[^0-9.]/g, ''));
    const extendedEarnings = callPayout !== null && Number.isFinite(budgetNumber) && budgetNumber > callPayout
        ? (budgetNumber - callPayout).toFixed(2)
        : null;
    // Owner only: the paid "Add time" sheet.
    const [showExtendSheet, setShowExtendSheet] = React.useState(false);
    const [videoBusy, setVideoBusy] = React.useState(false);
    const { notify, dialog: messageDialog } = useMessageDialog();
    const [finishAskOpen, setFinishAskOpen] = React.useState(false);
    const [videoErrorMsg, setVideoErrorMsg] = React.useState<{ title: string; body: string } | null>(null);
    const [showDisputeSheet, setShowDisputeSheet] = React.useState(false);
    const [showFinishSheet, setShowFinishSheet] = React.useState(false);
    const [offer, setOffer] = React.useState<AssistanceOfferSummary | null>(null);
    // Owner: what the extra time cost. Each block the owner bought carries its amount (the server sends it to the owner
    // only); the blocks that add time are the ones held, charged, released or still unpaid.
    const [ownerExtensionsAmount, setOwnerExtensionsAmount] = React.useState<number | null>(null);
    React.useEffect(() => {
        if (!isUserRole || !isVideoCall || videoAddedMinutes <= 0 || !appointment?.id) return;
        let cancelled = false;
        videoCallDAO
            .getExtensions(appointment.id)
            .then((r) => {
                const addsTime = ['held', 'captured', 'released', 'unpaid'];
                const sum = (r.extensions ?? []).filter((e) => addsTime.includes(e.status)).reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
                if (!cancelled) setOwnerExtensionsAmount(sum > 0 ? sum : null);
            })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, [isUserRole, isVideoCall, videoAddedMinutes, appointment?.id]);
    // The call's own price, from the offer: `budget` is not used here because it may already include the extra time.
    const ownerServiceTotal = (() => {
        const n = Number(String(offer?.breakdown?.total ?? offer?.price ?? '').replace(/[^0-9.]/g, ''));
        return Number.isFinite(n) && n > 0 ? n : null;
    })();
    // Owner: the card the request is charged to (null = made before the app sent one → default card).
    const [paymentMethodId, setPaymentMethodId] = React.useState<string | null>(null);
    // The vehicle's plate and VIN for the Details tab (the request has the VIN; the plate comes from the saved vehicle).
    const [vehicleIds, setVehicleIds] = React.useState<{ plate: string | null; vin: string | null }>({ plate: null, vin: null });

    const [ownerTab, setOwnerTab] = React.useState<OwnerTab>('status');
    // Mechanic: the owner's sub-navbar, with "mechanic" standing for the client.
    const [mechTab, setMechTab] = React.useState<OwnerTab>('status');
    const [checkInSeen, setCheckInSeen] = React.useState(false);
    const openOwnerTab = (tab: OwnerTab) => {
        if (tab === 'checkin') setCheckInSeen(true);
        if (tab === 'obd') setObdSeen(true);
        setOwnerTab(tab);
    };
    const [showCancelModal, setShowCancelModal] = React.useState(false);
    const [isCanceledFeedback, setIsCanceledFeedback] = React.useState(false);

    // Consistent state for ClientTab (Mechanic View)
    const [rating, setRating] = React.useState(appointment?.clientReview?.rating || 0);
    const [selectedTags, setSelectedTags] = React.useState<string[]>(appointment?.clientReview?.experienceTags ?? []);
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
            setSelectedTags(appointment.clientReview?.experienceTags ?? []);
            setReviewText(appointment.clientReview?.review || '');
            setIsReviewSubmitted(appointment.isReviewSubmitted || false);
        }
    }, [appointment]);

    // Mechanic: navigate to appointments list when client cancels — unless they
    // had already headed out: then the cancellation may compensate them, and this
    // screen is where they see it.
    React.useEffect(() => {
        if (!isUserRole && isCancelled && !departed) {
            router.replace('/(tabs)/appointments');
        }
    }, [isCancelled, departed, isUserRole, router]);

    // The mechanic's rating is only written when they send it (submitClientReview).
    // It used to be saved as a draft while they typed, which stored a 0-star
    // "review" on every job they merely opened and made the real one look done.

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
                if (cancelled) return;
                setPaymentMethodId(req?.paymentMethodId ?? null);
                setVehicleIds((prev) => ({ ...prev, vin: req?.vehicle?.vin ?? prev.vin }));
                if (req?.vehicleId && user?.id) {
                    vehicleDAO
                        .getByUser(user.id)
                        .then((list) => {
                            const v = list.find((x) => x.id === req.vehicleId);
                            if (!cancelled && v) setVehicleIds({ plate: v.plate || null, vin: v.vin || req.vehicle?.vin || null });
                        })
                        .catch(() => undefined);
                }
            })
            .catch((error) => console.error('Error fetching request payment method:', error));
        return () => {
            cancelled = true;
        };
    }, [isUserRole, appointment?.id, appointment?.mechanicId]);

    const videoError = (error: unknown, fallbackKey: string) => {
        // The server's message says why (e.g. 409: the call was never started).
        const message = error instanceof ApiError && error.apiMessage ? error.apiMessage : t(fallbackKey);
        // "This video call cannot be finished in its current state. It is "completed". Reload…": the screen was behind the server. Say it
        // short, in the person's words, and bring the screen up to date instead of asking them to reload it.
        const stale = message.match(/cannot be .*? in its current state\. It is "([a-z_]+)"/i);
        if (stale) {
            reloadVideoState();
            refreshAppointments();
            setVideoErrorMsg({
                title: t('appointments.videoCall.stale.title'),
                body: t(`appointments.videoCall.stale.${stale[1].toLowerCase()}`, { defaultValue: t('appointments.videoCall.stale.other') }),
            });
            return;
        }
        setVideoErrorMsg({ title: t('appointments.videoCall.errorTitle'), body: message });
    };

    // "Join video call" opens the sheet with the conditions of the call and "Connect" (it replaces the old lobby screen).
    const [joinSheetOpen, setJoinSheetOpen] = React.useState(false);
    const openVideoLobby = () => {
        if (appointment) setJoinSheetOpen(true);
    };
    // Landing here with `join` (the old lobby address, a push, "confirm" on the offer) opens the sheet once.
    const joinOpenedFor = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (!joinParam || !appointment?.id || joinOpenedFor.current === appointment.id) return;
        // The technician joins once the customer is in the room: landing here earlier waits, and the sheet opens when they enter.
        if (!isUserRole && isVideoCall && videoStartedAtMs === null && !customerInRoom) return;
        joinOpenedFor.current = appointment.id;
        setJoinSheetOpen(true);
    }, [joinParam, appointment?.id, isUserRole, isVideoCall, videoStartedAtMs, customerInRoom]);
    // Connected: the sheet closes first, then the call opens (presenting a screen while a modal is still leaving can fail).
    const enterVideoCall = (room: { roomUrl: string; token: string; expiry: number }) => {
        if (!appointment) return;
        setJoinSheetOpen(false);
        setTimeout(() => {
            router.push({ pathname: '/video-call/[id]' as never, params: { id: appointment.id, roomUrl: room.roomUrl, token: room.token, expiry: room.expiry } });
        }, 350);
    };

    // Owner: it was resolved — charged now; then offer the mechanic review.
    const confirmVideoCall = async () => {
        if (!appointment || videoBusy) return;
        setVideoBusy(true);
        try {
            setVideoState(await videoCallDAO.confirm(appointment.id));
            refreshAppointments();
            // The rating of the technician is asked right here (Status tab), not on another screen.
            setOwnerTab('status');
        } catch (error) {
            videoError(error, 'appointments.videoCall.owner.confirmFailed');
        } finally {
            setVideoBusy(false);
        }
    };

    // Owner: the help is done — end the call and confirm it (charged) in one
    // step, without waiting for the mechanic; then offer the mechanic review.
    const ownerFinishVideoCall = async () => {
        if (!appointment || videoBusy) return;
        setVideoBusy(true);
        try {
            setVideoState(await videoCallDAO.ownerFinish(appointment.id));
            refreshAppointments();
            setOwnerTab('status');
        } catch (error) {
            videoError(error, 'appointments.videoCall.owner.finishFailed');
        } finally {
            setVideoBusy(false);
        }
    };
    const askOwnerFinishVideoCall = () => setFinishAskOpen(true);

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

    // On-site close-out: a visit closed as resolved waits for the owner's
    // confirmation before it is charged; the owner may dispute it instead.
    const onSiteStatus = appointment?.status;
    const onSiteVisitRelevant = !!appointment && !isVideoCall
        && ['awaiting_confirmation', 'disputed', 'cancelled', 'canceled'].includes(onSiteStatus ?? '');
    const [onSiteVisit, setOnSiteVisit] = React.useState<OnSiteVisit | null>(null);
    const [onSiteBusy, setOnSiteBusy] = React.useState(false);
    React.useEffect(() => {
        if (!onSiteVisitRelevant || !appointment?.id) {
            setOnSiteVisit(null);
            return;
        }
        let cancelled = false;
        // A job cancelled before check-in has no visit: get() answers null for the 404.
        onSiteDAO
            .get(appointment.id)
            .then((v) => !cancelled && setOnSiteVisit(v))
            .catch((error) => console.error('Error fetching on-site visit:', error));
        return () => {
            cancelled = true;
        };
    }, [onSiteVisitRelevant, appointment?.id, appointment?.updatedAt, onSiteStatus]);

    // Coming back to this screen (from a push, another tab, the alert) shows the
    // fresh state: the job may have moved on (e.g. the mechanic closed it) meanwhile.
    // While focused, the on-site confirmation alert is not shown for this appointment.
    const appointmentIdForFocus = appointment?.id ?? id;
    const onSiteVisitRelevantRef = React.useRef(onSiteVisitRelevant);
    onSiteVisitRelevantRef.current = onSiteVisitRelevant;
    useFocusEffect(
        React.useCallback(() => {
            if (!appointmentIdForFocus) return;
            const focusedId = appointmentIdForFocus;
            setViewingAppointment(focusedId);
            let cancelled = false;
            void refreshAppointmentsRef.current();
            if (onSiteVisitRelevantRef.current) {
                onSiteDAO
                    .get(focusedId)
                    .then((v) => !cancelled && setOnSiteVisit(v))
                    .catch((error) => console.error('Error fetching on-site visit:', error));
            }
            return () => {
                cancelled = true;
                clearViewingAppointment(focusedId);
            };
        }, [appointmentIdForFocus]),
    );

    // 409: it is no longer awaiting confirmation (auto-confirmed, or already answered) — show the fresh state.
    const onSiteError = (error: unknown, fallbackKey: string) => {
        if (error instanceof ApiError && error.statusCode === 409) {
            refreshAppointments();
            setVideoErrorMsg({ title: t('appointments.videoCall.errorTitle'), body: t('appointments.onSiteConfirm.owner.alreadyAnswered') });
            return;
        }
        videoError(error, fallbackKey);
    };

    // Owner: the work was done — charged now.
    const confirmOnSite = async () => {
        if (!appointment || onSiteBusy) return;
        setOnSiteBusy(true);
        try {
            await onSiteDAO.confirm(appointment.id);
            refreshAppointments();
        } catch (error) {
            onSiteError(error, 'appointments.onSiteConfirm.owner.confirmFailed');
        } finally {
            setOnSiteBusy(false);
        }
    };

    // Owner: the work was not done — nothing is charged until support settles it.
    const disputeOnSite = async (reason: string) => {
        if (!appointment || onSiteBusy) return;
        setOnSiteBusy(true);
        try {
            await onSiteDAO.dispute(appointment.id, reason);
            setShowDisputeSheet(false);
            refreshAppointments();
        } catch (error) {
            setShowDisputeSheet(false);
            onSiteError(error, 'appointments.onSiteConfirm.dispute.failed');
        } finally {
            setOnSiteBusy(false);
        }
    };
    // The header follows the close-out while it is pending.
    const onSiteHeader: { title?: string; icon?: IconName; color?: string } =
        onSiteStatus === 'awaiting_confirmation'
            ? { title: t('appointments.videoCall.status.awaitingConfirmation'), icon: 'help', color: AO.orange }
            : onSiteStatus === 'disputed'
                ? { title: t('appointments.videoCall.status.disputed'), icon: 'hourglass-outline', color: AO.orange }
                // Already at the close of the job: "Assistance accepted" is no longer news, say where it is.
                : onSiteStatus === 'completed'
                    ? { title: t('appointments.videoCall.mechanic.completedTitle'), icon: 'checkmark', color: AO.green }
                    : onSiteStatus === 'started' || onSiteStatus === 'in_progress'
                        ? { title: t('appointments.list.card.status.inProgress'), icon: 'construct-outline', color: AO.blue }
                        : {};
    const onSiteClosePending = !isVideoCall && (onSiteStatus === 'awaiting_confirmation' || onSiteStatus === 'disputed');

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

    // Mechanic: the client's rating, jobs done, verification and join date.
    // Falls back to the public profile (name and photo only) if this fails.
    const [clientSummary, setClientSummary] = React.useState<AssistanceClientSummary | null>(null);
    React.useEffect(() => {
        if (isUserRole || !appointment?.id) return;
        let cancelled = false;
        assistanceDAO
            .getClientSummary(appointment.id)
            .then((summary) => !cancelled && setClientSummary(summary))
            .catch((error) => console.error('Error fetching client summary:', error));
        return () => {
            cancelled = true;
        };
    }, [isUserRole, appointment?.id]);

    // Hooks must all run before the early return below: calling one after it changes the
    // hook count between renders ("Rendered fewer hooks than expected") when the appointment loads.
    const reviewSending = React.useRef(false);

    // Not in the list (it may be mid-reload, or the list was replaced by a load that did not have it yet): ask for the list
    // again once per appointment before giving up.
    const reloadedFor = React.useRef<string | null>(null);
    const [reloading, setReloading] = React.useState(false);
    React.useEffect(() => {
        if (appointment || !id || reloadedFor.current === id) return;
        reloadedFor.current = id;
        setReloading(true);
        refreshAppointments().finally(() => setReloading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appointment, id]);

    if (!appointment) {
        if (appointmentsLoading || reloading) {
            return (
                <View className="flex-1 bg-white justify-center items-center p-6">
                    <ActivityIndicator size="large" color="#1E56E3" />
                </View>
            );
        }
        return (
            <View className="flex-1 bg-white justify-center items-center p-6" style={{ gap: 12 }}>
                <Text className="font-outfit-bold text-lg text-gray-900">{t('appointments.detail.notFound')}</Text>
                <TouchableOpacity
                    onPress={() => { setReloading(true); refreshAppointments().finally(() => setReloading(false)); }}
                    className="mt-2"
                    accessibilityRole="button"
                    testID="appointment-retry"
                >
                    <Text className="text-blue-600 font-outfit-bold">{t('appointments.detail.retry')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => goBackOr(router, '/(tabs)/appointments')} accessibilityRole="button">
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
    // Mechanic: who the client is, for the header card and the Client tab.
    const clientFallbackName = [client?.name, client?.surname].filter(Boolean).join(' ') || null;
    const panelClient = clientSummary?.client ?? (client ? { displayName: clientFallbackName, profileImage: client.profileImage ?? null } : null);

    // Over for the budget's rules: the technician finished it (awaiting the owner), or it was completed, disputed or cancelled.
    const assistanceOver = ['awaiting_confirmation', 'completed', 'disputed', 'cancelled', 'canceled'].includes(appointment.status);

    const renderOwnerPanel = () => {
        switch (ownerTab) {
            case 'status':
                if (isVideoCall) {
                    // No ETA on a remote call: the steps, and once it is closed the owner rates the technician
                    // right below, open. A "not resolved" one was not charged, so there is nothing to rate.
                    const ratable = videoStatus === 'completed' && videoState?.currentStatus !== 'not_resolved';
                    const ownerRated = reviewSent || (ratable && ownerReview.loaded && !ownerReview.pending);
                    return (
                        <View style={{ gap: 16 }}>
                            <TranscriptCard appointmentId={appointment.id} role="owner" info={transcriptInfo} />
                            {appointment.status === 'completed' && (
                                <ServiceReportCard appointment={appointment} ownerName={[user?.name, user?.surname].filter(Boolean).join(' ') || null} mechanicName={ownerMechanicName} />
                            )}
                            <MechanicVideoStatusTab
                                role="owner"
                                status={videoStatus}
                                callStarted={videoStartedAtMs !== null}
                                notResolved={videoState?.currentStatus === 'not_resolved'}
                                reviewSent={ownerRated}
                            />
                            {appointment.status === 'completed' && <BackToDashboardButton onPress={backToDashboard} />}
                        </View>
                    );
                }
                return (
                    <View style={{ gap: 16 }}>
                        {appointment.status === 'completed' && (
                            <ServiceReportCard appointment={appointment} ownerName={[user?.name, user?.surname].filter(Boolean).join(' ') || null} mechanicName={ownerMechanicName} />
                        )}
                        {/* Closed: no map any more, the final report takes its place. */}
                        {appointment.status === 'completed' ? null : (
                        <OwnerEtaCard
                            status={appointment.status}
                            departed={departed}
                            scheduledFor={isFarScheduled(appointment) ? appointment.date : null}
                            minutesAway={minutesAway}
                            etaTime={etaTime}
                            loading={etaLoading}
                            mechanicName={ownerMechanicName}
                            destination={ownerDestination}
                            mechanicCoords={mechanicCoords}
                            polyline={polyline}
                        />
                        )}
                        {/* The technician is on the way: show the code here too, right under the map
                            (above the timeline), so the owner is already holding the QR / PIN when they arrive (it is also in Check-in). */}
                        {appointment.status === 'accepted' && departed && (
                            <CheckInCodeCard appointmentId={appointment.id} status={appointment.status} />
                        )}
                        {/* Step by step, as on a video call. The server announces head-out, check-in and close; the steps between are asked for. */}
                        {['accepted', 'started', 'in_progress', 'awaiting_confirmation', 'disputed', 'completed'].includes(appointment.status) && (
                            <OwnerVisitTimeline
                                status={appointment.status}
                                departed={departed}
                                stage={visitStage(ownerVisit)}
                                minutesAway={minutesAway}
                                arrivedAt={ownerVisit?.checkedInAt ?? appointment.startedAt ?? null}
                            />
                        )}
                        {appointment.status === 'completed' && <BackToDashboardButton onPress={backToDashboard} />}
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
                // `date` is an ISO timestamp: the exact moment it was asked for. The ETA ("2 min") is not part of it.
                const posted = formatLocalDateTime(appointment.date, i18n.language) || '';
                const rows = [
                    { icon: isVideoCall ? 'videocam-outline' as const : 'flash-outline' as const, label: t('appointments.ownerAccepted.rows.service'), value: t(assistanceTypeKey(appointment)) },
                    isVideoCall && (appointment.durationMinutes ?? videoState?.baseMinutes)
                        ? { icon: 'timer-outline' as const, label: t('appointments.ownerAccepted.rows.duration'), value: t('requestAssistance.when.durationValue', { count: (appointment.durationMinutes ?? videoState?.baseMinutes) as number }) }
                        : null,
                    // The plate and the VIN sit with the vehicle as small badges, not as rows of their own.
                    appointment.car ? {
                        icon: 'car-outline' as const,
                        label: t('appointments.ownerAccepted.rows.vehicle'),
                        value: vehicleIds.plate || vehicleIds.vin ? (
                            <View>
                                <Text className="font-outfit-bold" style={{ fontSize: 15, lineHeight: 20, color: '#0B1530' }}>{appointment.car}</Text>
                                <VehicleIdsRow plate={vehicleIds.plate} vin={vehicleIds.vin} plateLabel={t('requestAssistance.selectVehicle.plate')} />
                            </View>
                        ) : appointment.car,
                    } : null,
                    !isVideoCall && appointment.vehicleCondition
                        ? { icon: 'speedometer-outline' as const, label: t('appointments.list.card.rows.condition'), value: t(`requestAssistance.vehicleInformation.condition.${appointment.vehicleCondition}`, { defaultValue: appointment.vehicleCondition }) }
                        : null,
                    issues ? { icon: 'construct-outline' as const, label: t('appointments.ownerAccepted.rows.issue'), value: issues } : null,
                    appointment.notes ? { icon: 'document-text-outline' as const, label: t('appointments.ownerAccepted.rows.notes'), value: appointment.notes } : null,
                    appointment.address ? { icon: 'location-outline' as const, label: t('appointments.ownerAccepted.rows.location'), value: appointment.address } : null,
                    posted ? { icon: 'calendar-outline' as const, label: t('appointments.ownerAccepted.rows.posted'), value: posted } : null,
                ].filter((r): r is NonNullable<typeof r> => r !== null);
                return (
                    <View style={{ gap: 12 }}>
                        <RequestSummaryRows rows={rows} />
                        <AttachmentCard photos={appointment.photos} title={t('appointments.ownerAccepted.mediaTitle', { count: parseAttachments(appointment.photos).length })} />
                    </View>
                );
            }
            case 'obd':
                return (
                    <View style={{ marginHorizontal: -16 }}>
                        <RequestObdPanel requestId={appointment.id} role="owner" editable={obdEditable} state={obd} />
                    </View>
                );
            case 'mechanic':
                return <OwnerTechnicianPanel mechanic={offer?.mechanic ?? null} />;
            case 'budget':
                return (
                    <OwnerBudgetPanel
                        total={(offer?.breakdown?.total ?? offer?.price ?? appointment.budget ?? '').replace(/^\$/, '') || null}
                        payment={<PaymentCardValue paymentMethodId={paymentMethodId} card={resolvePaymentCard(paymentMethodId)} />}
                        video={isVideoCall}
                        partsNote={assistanceOver ? null : undefined}
                        extendedMinutes={isVideoCall ? videoAddedMinutes : 0}
                        extendedAmount={isVideoCall && ownerExtensionsAmount !== null ? ownerExtensionsAmount.toFixed(2) : null}
                        grandTotal={isVideoCall && ownerExtensionsAmount !== null && ownerServiceTotal !== null ? (ownerServiceTotal + ownerExtensionsAmount).toFixed(2) : null}
                    />
                );
        }
    };

    // POST /appointments/:id/client-review for every kind of job. The screen only
    // says "rated" once the server has it, so a failed send never looks saved.
    // The rating went through the dashboard's sheet (it sends itself): this screen only has to know it is done.
    const markReviewSent = () => {
        setIsReviewSubmitted(true);
        refreshAppointments();
    };

    const submitClientReview = () => {
        if (reviewSending.current || isReviewSubmitted) return;
        if (rating < 1) {
            void notify(t('appointments.clientReview.title'), t('appointments.clientReview.pickStars'), 'blue');
            return;
        }
        // A video call can be rated once it is completed.
        if (isVideoCall && videoStatus !== 'completed') {
            void notify(t('appointments.clientReview.title'), t('appointments.videoCall.mechanic.reviewAfterCompleted'), 'blue');
            return;
        }
        reviewSending.current = true;
        onSiteDAO
            .reviewClient(appointment.id, rating, reviewText.trim() || undefined, selectedTags)
            .then(() => {
                setIsReviewSubmitted(true);
                refreshAppointments();
            })
            .catch((error) => {
                // 409 "already rated" means it is saved; any other 409 (e.g. service not closed) is not.
                if (error instanceof ApiError && error.statusCode === 409 && /already/i.test(error.apiMessage ?? '')) {
                    setIsReviewSubmitted(true);
                } else {
                    videoError(error, 'appointments.videoCall.mechanic.reviewFailed');
                }
            })
            .finally(() => {
                reviewSending.current = false;
            });
    };

    // Mechanic on a video call: the same tabs the owner has.
    const renderMechanicVideoPanel = () => {
        switch (mechTab) {
            case 'status':
                // Where the assistance is, step by step; the rating of the customer sits in the card above.
                return (
                    <View style={{ gap: 16 }}>
                        <TranscriptCard appointmentId={appointment.id} role="mechanic" info={transcriptInfo} />
                        <MechanicVideoStatusTab
                            status={videoStatus}
                            callStarted={videoStartedAtMs !== null}
                            notResolved={videoState?.currentStatus === 'not_resolved'}
                            reviewSent={isReviewSubmitted}
                        />
                    </View>
                );
            case 'info':
                // The call's length as it stands: the chosen one plus any time the owner added. The list row may
                // not carry it, so the call state (`GET …/video`) fills it in.
                return (
                    <MechanicAssistanceInfoTab
                        appointment={{ ...appointment, durationMinutes: videoState?.contractedMinutes ?? videoState?.baseMinutes ?? appointment.durationMinutes }}
                        videoSection="details"
                    />
                );
            case 'obd':
                return (
                    <View style={{ marginHorizontal: -16 }}>
                        <RequestObdPanel requestId={appointment.id} role="mechanic" editable={obdEditable} state={obd} />
                    </View>
                );
            case 'mechanic':
                return <ClientInfoPanel client={panelClient} />;
            case 'budget':
                // `budget` already comes back as what the mechanic earns, never the customer's price.
                // With extra time the call's own pay, the extension and the total are told apart. Until the call's own pay
                // is known the panel shows the one total and no extra-time row: a row of minutes beside a total that
                // already includes them reads as if they were added twice.
                return extendedEarnings !== null && callPayout !== null ? (
                    <OwnerBudgetPanel
                        total={callPayout.toFixed(2)}
                        video
                        extendedMinutes={videoAddedMinutes}
                        extendedAmount={extendedEarnings}
                        grandTotal={budgetNumber.toFixed(2)}
                    />
                ) : (
                    <OwnerBudgetPanel total={(appointment.budget ?? '').replace(/^\$/, '') || null} totalLabel={t('appointments.receipt.youEarn')} video extendedMinutes={callPayout !== null ? videoAddedMinutes : 0} extendedAmount={extendedEarnings} />
                );
            default:
                return null;
        }
    };

    // Mechanic on an on-site job: same sub-navbar, Status carries the trip and the map.
    const renderMechanicOnSitePanel = () => {
        switch (mechTab) {
            case 'status':
                return <MechanicAssistanceInfoTab appointment={appointment} section="trip" />;
            case 'info':
                return (
                    <View style={{ gap: 12 }}>
                        <MechanicAssistanceInfoTab appointment={appointment} section="vehicle" />
                        <AttachmentCard photos={appointment.photos} title={t('appointments.ownerAccepted.mediaTitle', { count: parseAttachments(appointment.photos).length })} />
                    </View>
                );
            case 'budget':
                // `budget` already comes back as what the mechanic earns, never the customer's price.
                return <OwnerBudgetPanel total={(appointment.budget ?? '').replace(/^\$/, '') || null} totalLabel={t('appointments.receipt.youEarn')} partsNote={assistanceOver ? null : t('appointments.ownerAccepted.partsOnlyWithCustomerApproval')} />;
            case 'mechanic':
                return (
                    <View style={{ gap: 12 }}>
                        <ClientInfoPanel client={panelClient} />
                        {/* Rating the client belongs to the end of the job: it only exists once the request is closed. */}
                        {appointment.status === 'completed' ? (
                            <ClientReviewCard
                                rating={rating}
                                setRating={setRating}
                                tags={selectedTags}
                                setTags={setSelectedTags}
                                reviewText={reviewText}
                                setReviewText={setReviewText}
                                isSubmitted={isReviewSubmitted}
                                onSubmit={submitClientReview}
                                appointment={appointment}
                                onSent={markReviewSent}
                            />
                        ) : null}
                    </View>
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
            {messageDialog}
            {appointment && isVideoCall ? (
                <JoinCallSheet visible={joinSheetOpen} appointmentId={appointment.id} onClose={() => setJoinSheetOpen(false)} onEnter={enterVideoCall} />
            ) : null}
            <OnSiteDialog
                visible={finishAskOpen}
                tone="blue"
                icon="videocam-outline"
                title={t('appointments.videoCall.owner.finishTitle')}
                body={t('appointments.videoCall.owner.finishBody')}
                primaryLabel={t('appointments.videoCall.owner.finishConfirm')}
                onPrimary={() => { setFinishAskOpen(false); void ownerFinishVideoCall(); }}
                secondaryLabel={t('appointments.videoCall.owner.finishCancel')}
                onSecondary={() => setFinishAskOpen(false)}
                onDismiss={() => setFinishAskOpen(false)}
                testID="finish-call-dialog"
            />
            <OnSiteDialog
                visible={videoErrorMsg !== null}
                icon="alert-circle-outline"
                title={videoErrorMsg?.title ?? ''}
                body={videoErrorMsg?.body ?? ''}
                primaryLabel={t('vehicles.ok')}
                onPrimary={() => setVideoErrorMsg(null)}
                testID="video-error-dialog"
            />
            {/* Either side: "the owner added N minutes" while a video call runs. */}
            {isVideoCall && <CallTimeAddedToast appointmentId={appointment.id} />}
            {isCanceledFeedback ? (
                <View><Text>Cancellation Feedback Placeholder</Text></View>
            ) : (
                <View className="flex-1">
                    <KeyboardAwareScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                        {isUserRole ? (
                            <View style={{ paddingHorizontal: 20, paddingTop: 32, paddingBottom: 32, gap: 16 }} testID="owner-accepted">
                                <AcceptedHeader
                                    {...(isCancelled
                                        ? { title: t('appointments.cancellationDispute.cancelledTitle'), icon: 'close' as IconName, color: AO.mutedLight }
                                        : isVideoCall ? videoCallHeader : onSiteHeader)}
                                />

                                {isCancelled && cancellationDispute && (
                                    <CancellationDisputeBanner dispute={cancellationDispute} role="owner" />
                                )}

                                {isCancelled && appointment.type === 'scheduled' && <RequestAgainButton requestId={appointment.id} />}

                                <FinalQuoteBanner requestId={appointment.id} enabled={appointment.type === 'scheduled' && !isCancelled} />

                                <OwnerMechanicCard
                                    mechanic={offer?.mechanic ?? null}
                                    chat={chatAvailability(appointment.status)}
                                    onMessage={() => router.push(`/chat/${appointment.id}`)}
                                />

                                {!isVideoCall && (
                                    <OwnerOnSiteConfirmCard
                                        status={appointment.status}
                                        visit={onSiteVisit}
                                        busy={onSiteBusy}
                                        onConfirm={confirmOnSite}
                                        onDispute={() => setShowDisputeSheet(true)}
                                    />
                                )}

                                {isVideoCall && (
                                    <>
                                        <VideoCallWhenCard date={appointment.date} startNow={appointment.startNow} startedAt={appointment.startedAt} completedAt={appointment.completedAt} live={videoCallLive} />
                                        {videoCallLive && <JoinVideoCallButton onPress={openVideoLobby} rejoin={videoStartedAtMs !== null} />}
                                        {/* Finish is the quiet one, right under Join. */}
                                        {videoCallLive && (
                                            <QuietButton
                                                label={t('appointments.videoCall.mechanic.finish')}
                                                loading={videoBusy}
                                                onPress={askOwnerFinishVideoCall}
                                                testID="owner-video-finish"
                                            />
                                        )}
                                        {videoCallLive && videoStartedAtMs !== null && (
                                            <>
                                                <VideoCallTimerCard
                                                    startedAtMs={videoStartedAtMs}
                                                    limitSeconds={videoLimitSeconds}
                                                    addedMinutes={videoAddedMinutes}
                                                    onExtend={() => setShowExtendSheet(true)}
                                                />
                                                <ExtendCallSheet
                                                    visible={showExtendSheet}
                                                    appointmentId={appointment.id}
                                                    onClose={() => setShowExtendSheet(false)}
                                                    onExtended={() => reloadVideoState()}
                                                />
                                            </>
                                        )}
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

                                {/* The rating of the technician sits here, over the tabs, in whichever tab you are: a card with one button that opens the form from below. */}
                                <OwnerReviewCard
                                    appointmentId={appointment.id}
                                    appointment={appointment}
                                    status={appointment.status}
                                    enabled={!isVideoCall || (videoStatus === 'completed' && videoState?.currentStatus !== 'not_resolved')}
                                    onSent={() => setReviewSent(true)}
                                    onDismissed={() => ownerReview.markDone()}
                                />

                                <OwnerTabs
                                    active={ownerTab}
                                    onChange={openOwnerTab}
                                    checkInDot={!isVideoCall && appointment.status === 'accepted' && !checkInSeen}
                                    hideCheckIn={isVideoCall}
                                    showObd={isVideoCall}
                                    obdDot={obdDot}
                                />

                                {!isVideoCall && ownerTab === 'status' && appointment.status === 'accepted' && (
                                    <CheckInBanner onPress={() => openOwnerTab('checkin')} />
                                )}

                                <View testID="tab-content-container">{renderOwnerPanel()}</View>

                                <RequestIdRow
                                    id={appointment.id}
                                    refCode={appointment.refCode}
                                    onCancel={canCancelBeforeStart(appointment.status) ? () => setShowCancelModal(true) : undefined}
                                />
                            </View>
                        ) : (
                            <>
                            {/* Badge + title + assistance type */}
                            <View className="px-5 pb-1" style={{ paddingTop: 32 }}>
                                {isVideoCall ? (
                                    <View className="flex-row items-center gap-1.5 mb-3 px-2.5 py-1 rounded-full" style={{ backgroundColor: MECH.blueSoft, alignSelf: 'flex-start' }}>
                                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: MECH.blue }} />
                                        <Text className="font-outfit-bold text-[12px] tracking-widest" style={{ color: MECH.blue }}>
                                            {t('appointments.videoCall.badge')}
                                        </Text>
                                    </View>
                                ) : null}
                                {isVideoCall ? (
                                    <View className="flex-row items-center" style={{ gap: 12 }} testID="video-call-accepted-header">
                                        <View
                                            className="items-center justify-center"
                                            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: MECH.green, shadowColor: MECH.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 4 }}
                                        >
                                            <Ionicons name="checkmark" size={20} color="#fff" />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="font-outfit-bold text-[22px] leading-6" style={{ color: MECH.text, letterSpacing: -0.6 }}>
                                                {t('appointments.videoCall.mechanic.title')}
                                            </Text>
                                            <Text className="font-outfit-semibold" style={{ fontSize: 13, lineHeight: 18, color: MECH.muted, marginTop: 1 }} selectable testID="detail-ref-code">{refLabel(appointment.refCode, appointment.id)}</Text>
                                        </View>
                                    </View>
                                ) : (
                                <>
                                {isCancelled ? (
                                    <Text className="font-outfit-bold text-[22px] mb-3" style={{ color: MECH.text }}>
                                        {t('appointments.cancellationDispute.cancelledTitle')}
                                    </Text>
                                ) : null}
                                <View className="flex-row items-center" style={{ gap: 12 }}>
                                    <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(229,62,62,0.08)' }}>
                                        <Ionicons name="flash-outline" size={22} color={MECH.red} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="font-outfit-bold" style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.6, color: MECH.text }}>
                                            {t(assistanceTypeKey(appointment))}
                                        </Text>
                                        <Text className="font-outfit-semibold" style={{ fontSize: 13, lineHeight: 18, color: MECH.muted, marginTop: 1 }} selectable testID="detail-ref-code">{refLabel(appointment.refCode, appointment.id)}</Text>
                                    </View>
                                </View>
                                </>
                                )}
                            </View>

                            {/* The client, with chat and call — the counterpart of the owner's technician card */}
                            <View className="mx-4 mt-3">
                                <MechanicClientCard
                                    client={panelClient}
                                    chat={chatAvailability(appointment.status)}
                                    onMessage={() => router.push(`/chat/${appointment.id}`)}
                                />
                            </View>

                            {/* Cancelled after heading out: what the mechanic gets for the trip */}
                            {isCancelled && cancellationDispute && (
                                <View className="mx-4 mt-3.5">
                                    <CancellationDisputeBanner dispute={cancellationDispute} role="mechanic" />
                                </View>
                            )}

                            {/* While the customer has not confirmed, the rating of the customer is already here to give: it closes by itself once sent. */}
                            {!isVideoCall && onSiteClosePending && onSiteVisit && onSiteVisit.clientRating == null && !isReviewSubmitted ? (
                                <View className="mx-4 mt-3.5">
                                    <ClientReviewCard
                                        rating={rating}
                                        setRating={setRating}
                                        tags={selectedTags}
                                        setTags={setSelectedTags}
                                        reviewText={reviewText}
                                        setReviewText={setReviewText}
                                        isSubmitted={isReviewSubmitted}
                                        onSubmit={submitClientReview}
                                appointment={appointment}
                                onSent={markReviewSent}
                                    />
                                </View>
                            ) : null}

                            {/* On-site closed as resolved: waiting for the owner, disputed, or released by support */}
                            {!isVideoCall && (onSiteClosePending || isCancelled) && onSiteVisit ? (
                                <View className="mx-4 mt-3.5">
                                    <MechanicOnSiteConfirmCard status={appointment.status} visit={onSiteVisit} />
                                </View>
                            ) : null}

                            {/* Status card — a finished video call shows its close-out card instead */}
                            {!isVideoCall && !isCancelled && !onSiteClosePending && appointment.status === 'accepted' && (
                            // Always the calm light blue (before heading out and once on the way): what has to pull the eye is the next action
                            // ("Head out", then "Start check-in"), not this status.
                            <LinearGradient
                                colors={['#F1F6FF', '#E6EEFF']}
                                locations={[0, 1]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 0.9, y: 1 }}
                                style={{ marginHorizontal: 16, marginTop: 14, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#DCE7FA' }}
                                testID="status-badge"
                                nativeID="status-badge"
                            >
                                <View className="flex-row items-center self-start" style={{ gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, backgroundColor: 'rgba(30,86,227,0.10)' }}>
                                    <PulseDot color="#10B981" size={7} />
                                    <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1.2, color: '#1E56E3' }} testID="status-value">
                                        {awaitingHeadOut ? t('appointments.detail.readyBadge') : t('appointments.detail.onTheWayBadge')}
                                    </Text>
                                </View>
                                <Text className="font-outfit-bold" style={{ fontSize: 26, lineHeight: 31, letterSpacing: -0.7, color: '#0B2A8E', marginTop: 12 }}>
                                    {awaitingHeadOut ? t('appointments.detail.acceptedTitle') : t('appointments.detail.onTheWayTitle')}
                                </Text>
                                <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: '#6B7490', marginTop: 6 }} testID="status-description">
                                    {awaitingHeadOut
                                        ? t('appointments.detail.headOutPrompt')
                                        : `${t('appointments.detail.leftAtShort', { time: departedAt ? formatEtaTime(departedAt) : '--' })} · ${t('appointments.detail.clientNotified')}`}
                                </Text>
                            </LinearGradient>
                            )}

                            {/* Closed job: the same card, in green, saying it is completed */}
                            {!isVideoCall && appointment.status === 'completed' ? (
                                <View
                                    style={{ marginHorizontal: 16, marginTop: 14, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#CDEFD9', backgroundColor: '#EAF8EF' }}
                                    testID="status-completed"
                                >
                                    <View className="flex-row items-center self-start" style={{ gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, backgroundColor: 'rgba(16,185,129,0.14)' }}>
                                        <Ionicons name="checkmark-circle" size={14} color="#0F8A5F" />
                                        <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1.2, color: '#0F8A5F' }}>{t('appointments.detail.completedBadge')}</Text>
                                    </View>
                                    <Text className="font-outfit-bold" style={{ fontSize: 26, lineHeight: 31, letterSpacing: -0.7, color: '#0B5A3E', marginTop: 12 }}>{t('appointments.detail.completedTitle')}</Text>
                                    {(appointment.completedAt ?? onSiteVisit?.closedAt) ? (
                                        <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: '#4B6B5C', marginTop: 6 }}>
                                            {t('appointments.detail.completedAt', { time: formatEtaTime((appointment.completedAt ?? onSiteVisit?.closedAt) as string) })}
                                        </Text>
                                    ) : null}
                                </View>
                            ) : null}

                            {/* Closed: the final report, then the review */}
                            {!isVideoCall && appointment.status === 'completed' ? (
                                <View className="mx-4 mt-3.5">
                                    <ServiceReportCard appointment={appointment} role="mechanic" />
                                </View>
                            ) : null}

                            {/* Completed and the customer not rated yet: the review is right under the card */}
                            {!isVideoCall && appointment.status === 'completed' && !isReviewSubmitted && (onSiteVisit ? onSiteVisit.clientRating == null : true) ? (
                                <View className="mx-4 mt-3.5">
                                    <ClientReviewCard
                                        rating={rating}
                                        setRating={setRating}
                                        tags={selectedTags}
                                        setTags={setSelectedTags}
                                        reviewText={reviewText}
                                        setReviewText={setReviewText}
                                        isSubmitted={isReviewSubmitted}
                                        onSubmit={submitClientReview}
                                appointment={appointment}
                                onSent={markReviewSent}
                                    />
                                </View>
                            ) : null}

                            {!isVideoCall && appointment.status === 'completed' ? (
                                <View className="mx-4 mt-3.5">
                                    <BackToDashboardButton onPress={backToDashboard} />
                                </View>
                            ) : null}

                            {/* Head out — starts the owner's live map and ETA */}
                            {!isVideoCall && appointment.status === 'accepted' ? (
                                <View className="mx-4 mt-5">
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
                                                    <Text className="text-white font-outfit-bold" style={{ fontSize: 17, lineHeight: 23 }}>
                                                        {t('appointments.detail.headOut')}
                                                    </Text>
                                                </LinearGradient>
                                            </TouchableOpacity>
                                            <HeadOutNextSteps />
                                        </>
                                    ) : null}
                                </View>
                            ) : null}

                            {/* Video call: join / finish, then the owner's answer */}
                            {isVideoCall ? (
                                <View className="mx-4 mt-3.5" style={{ gap: 10 }}>
                                    {/* When, in both roles: the owner has it in the same place, over the status. */}
                                    <VideoCallWhenCard date={appointment.date} startNow={appointment.startNow} startedAt={appointment.startedAt} completedAt={appointment.completedAt} live={false} />
                                    {videoCallLive ? (
                                        <>
                                            {/* Extra time the owner asked for: answered here too, not only inside the call. */}
                                            <ExtensionRequestPanel appointmentId={appointment.id} isOwner={false} inline />
                                            {videoStartedAtMs !== null && (
                                                <VideoCallTimerCard
                                                    startedAtMs={videoStartedAtMs}
                                                    limitSeconds={videoLimitSeconds}
                                                    addedMinutes={videoAddedMinutes}
                                                />
                                            )}
                                            {videoStartedAtMs === null ? (
                                                <>
                                                    {/* Joining waits for the customer: until they open the room the button is grey and the card says so;
                                                        once they are in, it turns green and "Join" opens the conditions to accept before connecting. */}
                                                    {customerInRoom ? <CustomerInRoomCard /> : <WaitingForCustomerCard />}
                                                    <JoinVideoCallButton onPress={openVideoLobby} disabled={!customerInRoom} />
                                                </>
                                            ) : (
                                                <JoinVideoCallButton onPress={openVideoLobby} rejoin />
                                            )}
                                            {/* Finish is the quiet one, right under Join: only one button here asks for attention. */}
                                            <QuietButton
                                                label={t('appointments.videoCall.mechanic.finish')}
                                                loading={videoBusy}
                                                onPress={() => setShowFinishSheet(true)}
                                                testID="mechanic-video-finish"
                                            />
                                            {videoStartedAtMs === null && (
                                                <SessionTimerNote minutes={videoState?.baseMinutes ?? DEFAULT_CALL_MINUTES} />
                                            )}
                                        </>
                                    ) : videoState ? (
                                        <>
                                            <MechanicVideoCallStatusCard state={videoState} />
                                            {/* Closed: the rating of the customer is right here, open, ready to send. */}
                                            {videoStatus === 'completed' ? (
                                                <View className="mt-3.5">
                                                    <ClientReviewCard
                                                        rating={rating}
                                                        setRating={setRating}
                                                        tags={selectedTags}
                                                        setTags={setSelectedTags}
                                                        reviewText={reviewText}
                                                        setReviewText={setReviewText}
                                                        isSubmitted={isReviewSubmitted}
                                                        onSubmit={submitClientReview}
                                appointment={appointment}
                                onSent={markReviewSent}
                                                    />
                                                </View>
                                            ) : null}
                                        </>
                                    ) : null}
                                </View>
                            ) : null}

                            {/* On-site check-in — the critical next step once the mechanic arrives */}
                            {!isVideoCall && appointment.status !== 'completed' && !isCancelled && !awaitingHeadOut && !onSiteClosePending ? (
                                <View className="mt-3.5">
                                    <MechanicArrivalCard
                                        inProgress={appointment.status === 'in_progress'}
                                        onStartCheckIn={() => router.push({
                                            pathname: '/appointments/check-in/[id]' as any,
                                            params: { id: appointment.id },
                                        })}
                                    />
                                </View>
                            ) : null}

                            {/* Quick-nav sub-navbar (the owner's), set per kind of job */}
                            {isVideoCall ? (
                                <>
                                    <View className="mx-4 mt-3.5">
                                        <OwnerTabs
                                            active={mechTab}
                                            onChange={(tab) => {
                                                if (tab === 'obd') setObdSeen(true);
                                                setMechTab(tab);
                                            }}
                                            checkInDot={false}
                                            hideCheckIn
                                            showObd
                                            obdDot={obdDot}
                                            labels={{ mechanic: t('appointments.videoCall.mechanic.tabs.client') }}
                                        />
                                    </View>
                                    <View className="px-4 pt-3.5 pb-10" testID="tab-content-container" nativeID="tab-content-container">
                                        {renderMechanicVideoPanel()}
                                    </View>
                                </>
                            ) : (
                                <>
                                    <View className="mx-4 mt-3.5" testID="tab-navigation-container" nativeID="tab-navigation-container">
                                        <OwnerTabs
                                            active={mechTab}
                                            onChange={setMechTab}
                                            checkInDot={false}
                                            hideCheckIn
                                            labels={{ mechanic: t('appointments.videoCall.mechanic.tabs.client') }}
                                        />
                                    </View>

                                    <View className="px-4 pt-3.5 pb-10" testID="tab-content-container" nativeID="tab-content-container">
                                        {renderMechanicOnSitePanel()}
                                    </View>
                                </>
                            )}
                            {appointment && (
                                <View className="px-5 pb-10" style={{ marginTop: -8 }}>
                                    <RequestIdRow
                                        id={appointment.id}
                                        refCode={appointment.refCode}
                                        cancelAppointmentId={canCancelBeforeStart(appointment.status) ? appointment.id : undefined}
                                        scheduled={appointment.type === 'scheduled'}
                                    />
                                </View>
                            )}
                            </>
                        )}
                    </KeyboardAwareScrollView>
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

            {/* Owner reports it as not resolved: the video call, or an on-site visit whose work was not done */}
            <NoteSheet
                visible={showDisputeSheet}
                title={t(isVideoCall ? 'appointments.videoCall.dispute.title' : 'appointments.onSiteConfirm.dispute.title')}
                body={t(isVideoCall ? 'appointments.videoCall.dispute.body' : 'appointments.onSiteConfirm.dispute.body')}
                placeholder={t('appointments.videoCall.dispute.placeholder')}
                confirmLabel={t('appointments.videoCall.dispute.submit')}
                minLength={10}
                maxLength={1000}
                danger
                submitting={isVideoCall ? videoBusy : onSiteBusy}
                onClose={() => setShowDisputeSheet(false)}
                onSubmit={isVideoCall ? disputeVideoCall : disputeOnSite}
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
                departedAt={departedAt}
                freeCancelUntil={appointment?.freeCancelUntil}
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

            {visitVinCheck.check && appointment ? (
                <RequestVinCheckModal
                    requestId={appointment.id}
                    variant={visitVinCheck.check.variant}
                    obdVin={visitVinCheck.check.vin}
                    vehicleVin={visitVinCheck.check.vehicleVin}
                    onContinue={visitVinCheck.dismiss}
                    textKey="appointments.onSite.obd.ownerVinCheck"
                />
            ) : null}
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
                <Text className="text-gray-500 font-outfit-medium text-[13px] mb-1">Issue Type</Text>
                <Text className="text-blue-900 font-outfit-bold text-xl">{appointment.title}</Text>
            </View>

            {/* Photos */}
            {parseAttachments(appointment.photos).length > 0 && (
                <View>
                    <Text className="text-gray-500 font-outfit-medium text-[13px] mb-2">Photos</Text>
                    <AttachmentStrip photos={appointment.photos} size={128} />
                </View>
            )}

            {/* Car Details */}
            <View className="flex-row items-start gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                <View className="bg-blue-100 p-2 rounded-lg">
                    <Ionicons name="car-sport" size={24} color="#0047AB" />
                </View>
                <View>
                    <Text className="text-gray-500 text-[13px] font-outfit-medium">Vehicle</Text>
                    <Text className="text-blue-900 font-outfit-bold text-base">{appointment.car}</Text>
                </View>
            </View>

            {/* Description */}
            <View>
                <Text className="text-gray-500 font-outfit-medium text-[13px] mb-1">Description</Text>
                <Text className="text-gray-700 font-outfit-regular leading-5">
                    {appointment.notes || 'No description provided.'}
                </Text>
            </View>

            {/* Location (Simplified) */}
            <View>
                <Text className="text-gray-500 font-outfit-medium text-[13px] mb-1">Location</Text>
                <View className="flex-row items-center gap-2">
                    <Ionicons name="location" size={16} color="#0047AB" />
                    <Text className="text-blue-900 font-outfit-medium">{appointment.address}</Text>
                </View>
            </View>

            {/* Scan Button Action */}
            <View className="mt-4">
                <TouchableOpacity
                    onPress={onScanComplete}
                    className="bg-blue-600 w-full py-4 rounded-[14px] flex-row items-center justify-center gap-2 shadow-sm"
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
