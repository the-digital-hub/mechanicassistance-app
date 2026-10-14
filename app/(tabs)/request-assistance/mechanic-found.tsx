import {
    AO,
    OfferBreakdown,
    OfferHoldPill,
    PaymentValue,
    ProtectionBox,
    RequestSummaryRows,
    TechnicianCard,
} from '@/components/offer/OfferSections';
import { useAppointments } from '@/context/AppointmentsContext';
import { useSocket } from '@/context/SocketContext';
import { ApiError } from '@/lib/api/types';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import type { AssistanceOfferSummary, AssistanceRequest, VehicleIssueSnapshot } from '@/lib/dao/interfaces';
import { pricingDAO } from '@/lib/dao/PricingDAO';
import { videoCallBookedLabel } from '@/lib/video/videoCallTime';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Minutes in an ETA the mechanic typed ("5 min", "1h", "2hs", "20"), or null when it can't be read. */
function etaMinutes(eta?: string | null): number | null {
    if (!eta) return null;
    const hours = eta.match(/(\d+(?:\.\d+)?)\s*h/i);
    if (hours) return Math.round(parseFloat(hours[1]) * 60);
    const mins = eta.match(/(\d+)/);
    return mins ? parseInt(mins[1], 10) : null;
}

const formatMoney = (amount?: string | null) => (amount ? `$${Number(amount).toFixed(2)}` : null);

type ConfirmState = 'idle' | 'loading' | 'done';

export default function MechanicFoundScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { t, i18n } = useTranslation();
    const k = 'requestAssistance.mechanicFound';
    const { requestId } = useLocalSearchParams<{ requestId: string }>();
    const { refresh } = useAppointments();
    const { lastMessage } = useSocket();

    const [request, setRequest] = useState<AssistanceRequest | null>(null);
    const [offer, setOffer] = useState<AssistanceOfferSummary | null>(null);
    const [issues, setIssues] = useState<VehicleIssueSnapshot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [confirmState, setConfirmState] = useState<ConfirmState>('idle');
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

    // Phone clock minus server clock, so the countdown follows the server's hold.
    const clockSkew = useRef(0);
    const expiredHandled = useRef(false);

    useEffect(() => {
        if (!requestId) {
            setIsLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const [req, summary, reqIssues] = await Promise.all([
                    assistanceDAO.getById(requestId),
                    assistanceDAO.getOfferSummary(requestId).catch((error) => {
                        console.error('Failed to fetch offer summary:', error);
                        return null;
                    }),
                    pricingDAO.getRequestIssues(requestId).catch(() => [] as VehicleIssueSnapshot[]),
                ]);
                if (cancelled) return;
                setRequest(req);
                setOffer(summary);
                setIssues(reqIssues ?? []);
                if (summary) clockSkew.current = Date.now() - new Date(summary.serverNow).getTime();
                if (req?.status === 'accepted') setConfirmState('done');
            } catch (error) {
                console.error('Failed to fetch assistance request:', error);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [requestId]);

    // The offer lapsed (timer, socket or a late confirm): tell the owner and go
    // back to searching, where the next offer will land.
    // Only while this screen is the one on screen: `replace` acts on the focused
    // route, so firing from a copy left in the stack swapped whatever screen the
    // owner was on for the searching screen of an old request.
    const isFocused = useIsFocused();
    const handleExpired = useCallback(() => {
        if (expiredHandled.current || !requestId || !isFocused) return;
        expiredHandled.current = true;
        Alert.alert(t(`${k}.expiredTitle`), t(`${k}.expiredMessage`));
        router.replace({ pathname: '/request-assistance/searching', params: { requestId } });
    }, [requestId, router, t, isFocused]);

    // A hold only counts while the request is still offered: a canceled or
    // accepted request can carry a stale timestamp that would read as expired.
    const offerExpiresAt = request?.status === 'offered' ? (offer?.offerExpiresAt ?? null) : null;
    useEffect(() => {
        if (!offerExpiresAt || confirmState !== 'idle') {
            setSecondsLeft(null);
            return;
        }
        const expiresAt = new Date(offerExpiresAt).getTime();
        const tick = () => {
            const left = Math.max(0, Math.round((expiresAt - (Date.now() - clockSkew.current)) / 1000));
            setSecondsLeft(left);
            if (left === 0) handleExpired();
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [offerExpiresAt, confirmState, handleExpired]);

    // The server put the request back to pending (the hold ran out).
    useEffect(() => {
        if (lastMessage?.type !== 'assistance_update') return;
        const payload = lastMessage.payload ?? {};
        if ((payload.id ?? payload.requestId) !== requestId) return;
        if (payload.status === 'pending' && confirmState !== 'done') handleExpired();
    }, [lastMessage, requestId, confirmState, handleExpired]);

    const handleConfirm = async () => {
        if (!requestId || !request?.mechanicId || confirmState !== 'idle') return;
        setConfirmState('loading');
        try {
            await assistanceDAO.updateStatus(requestId, request.mechanicId, 'accepted');
            await refresh();
            setConfirmState('done');

            // The wizard is finished: empty its stack so neither back nor the tab
            // history lands on this screen again, then open the appointment with
            // the list under it.
            if (router.canDismiss()) router.dismissAll();
            // A video call asked for now starts right away, in the lobby; a booked
            // one opens its appointment, which has "Join video call" for later.
            if (request.type === 'videocall' && request.startNow) {
                router.push({ pathname: '/video-lobby/[id]' as any, params: { id: requestId } });
            } else {
                router.push({ pathname: '/appointments/[id]', params: { id: requestId } }, { withAnchor: true });
            }
        } catch (error) {
            const code = error instanceof ApiError ? (error.apiError as { code?: string } | null)?.code : undefined;
            if (code === 'OFFER_EXPIRED') {
                handleExpired();
                return;
            }
            console.error('Failed to confirm appointment:', error);
            setConfirmState('idle');
            Alert.alert(t(`${k}.errorTitle`), t(`${k}.errorMessage`));
        }
    };

    // Cancels the whole request, like the searching screen does. Asked first:
    // the link sits right under the offer and is easy to hit by mistake.
    const handleCancel = () => {
        if (!requestId) return;
        Alert.alert(t(`${k}.cancelTitle`), t(`${k}.cancelMessage`), [
            { text: t(`${k}.cancelKeep`), style: 'cancel' },
            {
                text: t(`${k}.cancelConfirm`),
                style: 'destructive',
                onPress: async () => {
                    try {
                        // Keep the offering mechanic on the request: '' would
                        // unassign them, and they would never hear it was canceled.
                        await assistanceDAO.updateStatus(requestId, request?.mechanicId ?? '', 'canceled');
                        await refresh();
                        router.replace('/(tabs)/dashboard');
                    } catch (error) {
                        console.error('Failed to cancel request:', error);
                        Alert.alert(t('requestAssistance.searching.cancelErrorAlert'));
                    }
                },
            },
        ]);
    };

    if (isLoading) {
        return (
            <View className="flex-1 justify-center items-center" style={{ backgroundColor: AO.page }}>
                <ActivityIndicator size="large" color={AO.blue} />
                <Text className="text-gray-500 font-outfit-medium mt-4">{t(`${k}.loading`)}</Text>
            </View>
        );
    }

    const type = request?.type as string | undefined;
    const typeLabel =
        request?.assistanceType === 'witness' ? t('requestAssistance.badge.accident') :
            type === 'immediate' ? t('requestAssistance.badge.immediate') :
                type === 'videocall' ? t('requestAssistance.badge.videoCall') :
                    t('requestAssistance.badge.scheduled');
    const includedKey =
        request?.assistanceType === 'witness' ? 'witness' :
            type === 'immediate' ? 'immediate' :
                type === 'videocall' ? 'video' :
                    type === 'scheduled' ? 'scheduled' : 'default';
    const included = t(`${k}.included.${includedKey}`, { returnObjects: true }) as string[];

    const eta = offer?.eta ?? request?.eta ?? null;
    const minutes = etaMinutes(eta);
    const arrival = minutes !== null && type === 'immediate'
        ? t(`${k}.aroundTime`, {
            time: new Date(Date.now() + minutes * 60_000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        })
        : undefined;
    const etaValue = minutes !== null && /^\s*\d+\s*$/.test(eta ?? '') ? `${minutes} min` : eta ?? '—';
    // A video call has no arrival: show when it happens — "Now" or the booked slot.
    const isVideoCall = type === 'videocall';
    const videoWhen = isVideoCall ? videoCallBookedLabel(request, i18n.language) ?? t('requestDetail.videoCallNow') : null;

    const breakdown = offer?.breakdown ?? null;
    const price = formatMoney(breakdown?.total ?? offer?.price ?? request?.price ?? request?.budget) ?? t(`${k}.tbd`);
    const lines = breakdown
        ? [
            { label: t(`${k}.lineService`, { type: typeLabel }), amount: formatMoney(breakdown.service)! },
            { label: t(`${k}.linePlatformFee`), amount: formatMoney(breakdown.fees)! },
            { label: t(`${k}.lineTaxes`), amount: formatMoney(breakdown.taxes)! },
        ]
        : [];

    const vehicle = [request?.vehicle?.make, request?.vehicle?.model].filter(Boolean).join(' ') || request?.car || '—';
    const issueText = issues.map((i) => i.name).filter(Boolean).join(', ') || request?.title || '—';

    return (
        <View className="flex-1" style={{ backgroundColor: AO.page }}>
            {/* Header */}
            <View
                className="flex-row items-center"
                style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(14,47,138,0.07)' }}
            >
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 }}
                >
                    <Ionicons name="chevron-back" size={18} color={AO.text} />
                </TouchableOpacity>
                <Text className="font-outfit-bold flex-1 text-center" style={{ fontSize: 17, color: AO.text, marginRight: 38 }}>
                    {t(`${k}.headerTitle`)}
                </Text>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, gap: 14 }}>
                <View>
                    {secondsLeft !== null && <OfferHoldPill secondsLeft={secondsLeft} />}
                    <Text className="font-outfit-bold" style={{ fontSize: 24, color: AO.text, letterSpacing: -0.6, marginTop: 10 }}>
                        {t(`${k}.title`)}
                    </Text>
                    <Text className="font-outfit-regular" style={{ fontSize: 13.5, color: AO.muted, marginTop: 4, lineHeight: 19 }}>
                        {t(isVideoCall ? `${k}.subtitleVideoCall` : `${k}.subtitle`)}
                    </Text>
                </View>

                {videoWhen !== null ? (
                    <TechnicianCard mechanic={offer?.mechanic ?? null} eta={videoWhen} etaLabel={t(`${k}.when`)} etaIcon="calendar-outline" price={price} />
                ) : (
                    <TechnicianCard mechanic={offer?.mechanic ?? null} eta={etaValue} etaCaption={arrival} price={price} />
                )}

                <OfferBreakdown included={included} lines={lines} total={breakdown ? formatMoney(breakdown.total) : null} />

                <View style={{ gap: 8 }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 14, color: AO.text, letterSpacing: -0.2, marginTop: 2 }}>
                        {t(`${k}.yourRequest`)}
                    </Text>
                    <RequestSummaryRows
                        rows={[
                            { icon: isVideoCall ? ('videocam-outline' as const) : ('flash-outline' as const), label: t(`${k}.rowService`), value: typeLabel },
                            { icon: 'car-outline', label: t(`${k}.rowVehicle`), value: vehicle },
                            { icon: 'construct-outline', label: t(`${k}.rowIssue`), value: issueText },
                            // A video call is remote: it has no location.
                            ...(isVideoCall ? [] : [{ icon: 'location-outline' as const, label: t(`${k}.rowLocation`), value: request?.address || '—' }]),
                            { icon: 'card-outline', label: t(`${k}.rowPayment`), value: <PaymentValue /> },
                        ]}
                    />
                </View>

                <ProtectionBox />

                {!!requestId && (
                    <Text className="text-center font-outfit-regular" style={{ fontSize: 11, color: AO.mutedLight, lineHeight: 16 }}>
                        {t(`${k}.requestNumber`)}
                        <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{requestId.slice(0, 8).toUpperCase()}</Text>
                    </Text>
                )}
            </ScrollView>

            {/* Sticky footer */}
            <View
                style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: AO.borderSoft, shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 8 }}
            >
                <TouchableOpacity onPress={handleConfirm} disabled={confirmState !== 'idle' || !request?.mechanicId} activeOpacity={0.85}>
                    <LinearGradient
                        colors={confirmState === 'done' ? [AO.green, AO.green] : [AO.blue, AO.blueDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ borderRadius: 14, paddingVertical: 15, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    >
                        {confirmState === 'done' && <Ionicons name="checkmark" size={16} color="#fff" />}
                        {confirmState === 'loading' && <ActivityIndicator size="small" color="#fff" />}
                        <Text className="font-outfit-bold" style={{ color: '#fff', fontSize: 15.5 }}>
                            {confirmState === 'done' ? t(`${k}.requestConfirmed`) : confirmState === 'loading' ? t(`${k}.confirming`) : t(`${k}.confirm`)}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCancel} disabled={confirmState !== 'idle'} style={{ paddingTop: 10, paddingBottom: 2, alignItems: 'center' }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 13.5, color: AO.red }}>{t('requestAssistance.searching.cancelRequest')}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
