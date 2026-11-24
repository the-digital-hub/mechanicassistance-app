import { HeaderBell } from '@/components/HeaderBell';
import { FONT } from '@/lib/ui/fonts';
import { RequestSteps, stepEyebrow } from '@/components/ui/RequestSteps';
import { ROUNDED_HEADER } from '@/lib/ui/header';
import { FLOATING_CTA, FLOATING_FOOTER, CONFIRM_CTA, CONFIRM_GRADIENT } from '@/lib/ui/floatingFooter';
import { TYPE } from '@/lib/ui/type';
import { DEFAULT_CALL_MINUTES } from '@/lib/video/callLength';
import { useMessageDialog } from '@/components/ui/useMessageDialog';
import { CardPickerModal } from '@/components/payments/CardPickerModal';
import { useRequestDraft } from '@/context/RequestDraftContext';
import { useUser } from '@/context/UserContext';
import { ApiError } from '@/lib/api/types';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { pricingDAO } from '@/lib/dao/PricingDAO';
import { requestObdDAO } from '@/lib/dao/RequestObdDAO';
import { WALLET_METHOD } from '@/lib/payments/cardLabel';
import { usePaymentChoice } from '@/lib/payments/usePaymentChoice';
import {
    deviceTimeZone,
    videoCallDAO,
    type VideoCallNow,
    type VideoCallSlot,
    type VideoCallSlotDay,
} from '@/lib/dao/VideoCallDAO';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    CalendarDays,
    Check,
    ChevronLeft,
    Clock,
    CreditCard,
    Info,
    DollarSign,
    MoonStar,
    Sun,
    Sunrise,
    Sunset,
    Timer,
    Video,
    Zap,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { ChangeBadge } from '@/components/ui/ChangeBadge';

/**
 * Last step of the video-call wizard (vehicle → issue → OBD scanner → here): the owner picks
 * "Now" or a booked slot, and the button creates the request. A video call is
 * remote, so the wizard never asks for photos or a location.
 */

const C = {
    page: '#F6F8FC',
    ink: '#0B1530',
    muted: '#6B7490',
    faint: '#8C96AE',
    blue: '#1E56E3',
    blueSoft: 'rgba(30,86,227,0.08)',
    line: '#EEF2FA',
    border: '#E1E7F3',
    taken: '#B7BECD',
    takenBg: '#F1F3F8',
    green: '#16A34A',
    greenSoft: '#E8F7EE',
    note: '#3B4A78',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const parseIds = (raw: unknown): string[] =>
    typeof raw === 'string' ? raw.split(',').filter((id) => UUID_RE.test(id)) : [];

type Mode = 'now' | 'schedule';

// The day is split here, by the slot's local hour, instead of trusting the server's own
// `period`: the grid covers all 24 hours (a video call can be asked for at any time) and a
// new server value must never hide slots.
type DayPart = 'night' | 'morning' | 'afternoon' | 'evening';

const PERIODS: { key: DayPart; Icon: typeof Sun }[] = [
    { key: 'night', Icon: MoonStar },
    { key: 'morning', Icon: Sunrise },
    { key: 'afternoon', Icon: Sun },
    { key: 'evening', Icon: Sunset },
];

/** Which part of the day a slot falls in, from its local "HH:mm". */
/**
 * A video call can be asked for at any hour, 24/7: a time with no technician on duty is still
 * bookable (worst case nobody takes it and the request is cancelled without charge). Only times
 * already gone or taken are left out.
 */
function bookable(slot: VideoCallSlot): boolean {
    return slot.available || slot.reason === 'no_mechanics';
}

function partOf(slot: VideoCallSlot): DayPart {
    const hour = Number(slot.time?.slice(0, 2));
    if (!Number.isFinite(hour)) return slot.period === 'morning' || slot.period === 'afternoon' ? slot.period : 'evening';
    if (hour < 6) return 'night';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
}

/** Open first the part of the day people most likely want: morning, then afternoon, evening, night. */
const DEFAULT_PART_ORDER: DayPart[] = ['morning', 'afternoon', 'evening', 'night'];

export default function VideoCallWhenScreen() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const { user } = useUser();
    const { notify, dialog } = useMessageDialog();
    const { vehicleDetails, obdFile, setObdFile } = useRequestDraft();
    const params = useLocalSearchParams();
    const { vehicleId, vehicleName, description, issues, symptomIds, details, condition } = params;

    const timezone = useMemo(() => deviceTimeZone(), []);
    const [now, setNow] = useState<VideoCallNow | null>(null);
    // The backend asks for a call length only once it sends the menu (`durations`); until then the
    // old flat-fee flow applies, and sending a length would be rejected (400).
    const durationSupported = !!now?.durations?.length;
    const [days, setDays] = useState<VideoCallSlotDay[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [price, setPrice] = useState<number | null>(null);
    const [priceLoading, setPriceLoading] = useState(true);
    const [mode, setMode] = useState<Mode>('now');
    // "Now" or "Schedule" is the user's explicit choice: until then neither is marked and the button asks for it.
    const [modeChosen, setModeChosen] = useState(false);
    // Only with the call-length menu: the old flat-fee flow has no such step and keeps "Now" as it was.
    const modeReady = modeChosen || !durationSupported;
    // The call length is chosen first and has no default: nothing can be requested without it.
    const [duration, setDuration] = useState<number | null>(null);
    const [period, setPeriod] = useState<DayPart | null>(null);
    const [dayIndex, setDayIndex] = useState(0);
    const [slot, setSlot] = useState<VideoCallSlot | null>(null);
    const [submitting, setSubmitting] = useState(false);
    // How this request is paid: the wallet when its balance covers the price,
    // else the default card — until the user picks another.
    // While pricing cannot quote this length, show the menu's base price instead of "TBD".
    const menuPrice = duration !== null ? now?.durations?.find((d) => d.minutes === duration)?.price ?? null : null;
    const shownPrice = price ?? menuPrice;
    const { cards, wallet, selectedId: paymentMethodId, selectedLabel: paymentLabel, pick: pickPayment } = usePaymentChoice(shownPrice);
    const [cardPickerOpen, setCardPickerOpen] = useState(false);

    const load = useCallback(async () => {
        setLoadFailed(false);
        try {
            const [nowRes, slotsRes] = await Promise.all([
                videoCallDAO.getNow(),
                videoCallDAO.getSlots(timezone),
            ]);
            setNow(nowRes);
            setDays(slotsRes.days);
            // Nobody on duty: "Now" would wait forever, so start on Schedule.
            if (nowRes.mechanicsOnline === 0) setMode('schedule');
        } catch (err) {
            console.warn('[when] availability failed', err);
            setLoadFailed(true);
        } finally {
            setLoading(false);
        }
    }, [timezone]);

    useEffect(() => {
        load();
    }, [load]);

    // The video-call price is a base × the time band of the moment it happens:
    // re-quoted for "Now" or the picked slot. Failures show "TBD" and never
    // block the request.
    const serviceAt = mode === 'schedule' ? slot?.start : undefined;
    useEffect(() => {
        // Nothing to quote until the length is chosen (when the backend asks for one).
        if (durationSupported && duration === null) {
            setPrice(null);
            setPriceLoading(false);
            return;
        }
        let mounted = true;
        setPriceLoading(true);
        pricingDAO
            .calculatePrice({
                assistance_type: 'videocall',
                timezone,
                ...(durationSupported && duration !== null ? { duration_minutes: duration } : {}),
                ...(serviceAt ? { service_at: serviceAt } : {}),
            })
            .then((r) => {
                if (mounted) setPrice(r?.pricing_breakdown?.final_price ?? null);
            })
            .catch((err) => {
                console.warn('[when] price failed; showing TBD', err);
                if (mounted) setPrice(null);
            })
            .finally(() => {
                if (mounted) setPriceLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, [timezone, serviceAt, duration, durationSupported]);

    // The price of every length in the menu, quoted for the same moment, so each option shows what it costs
    // before it is picked. While a quote is pending (or fails) the option shows the menu's base price.
    const [optionPrices, setOptionPrices] = useState<Record<number, number>>({});
    useEffect(() => {
        const menu = now?.durations ?? [];
        if (!durationSupported || menu.length === 0) return;
        let mounted = true;
        Promise.all(
            menu.map((d) =>
                pricingDAO
                    .calculatePrice({
                        assistance_type: 'videocall',
                        timezone,
                        duration_minutes: d.minutes,
                        ...(serviceAt ? { service_at: serviceAt } : {}),
                    })
                    .then((r) => [d.minutes, r?.pricing_breakdown?.final_price ?? null] as const)
                    .catch(() => [d.minutes, null] as const),
            ),
        ).then((rows) => {
            if (!mounted) return;
            const next: Record<number, number> = {};
            rows.forEach(([minutes, value]) => { if (typeof value === 'number') next[minutes] = value; });
            setOptionPrices(next);
        });
        return () => {
            mounted = false;
        };
    }, [now?.durations, timezone, serviceAt, durationSupported]);

    // ─── Formatting (in the phone's own zone and language) ───

    const fmt = useCallback(
        (iso: string, opts: Intl.DateTimeFormatOptions) => {
            try {
                return new Intl.DateTimeFormat(i18n.language, { timeZone: timezone, ...opts }).format(new Date(iso));
            } catch {
                return new Date(iso).toLocaleString();
            }
        },
        [i18n.language, timezone],
    );

    // A named abbreviation when the engine has one ("EDT"); otherwise the real
    // offset ("GMT-3"). Hermes answers a bare "GMT" for most zones, which read
    // as UTC. `timezone` is the device's own zone, so its offset is the device's.
    const zoneLabel = useMemo(() => {
        const minutes = -new Date().getTimezoneOffset();
        const sign = minutes < 0 ? '-' : '+';
        const abs = Math.abs(minutes);
        const offset =
            minutes === 0
                ? 'GMT'
                : `GMT${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${String(abs % 60).padStart(2, '0')}` : ''}`;
        try {
            const name = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'short' })
                .formatToParts(new Date())
                .find((p) => p.type === 'timeZoneName')?.value;
            return name && /^[A-Z]{2,5}$/.test(name) && !/^(GMT|UTC)$/.test(name) ? name : offset;
        } catch {
            return offset;
        }
    }, [timezone]);

    const day = days[dayIndex];
    const relativeDay = (index: number) =>
        index === 0 ? t('requestAssistance.when.today') : index === 1 ? t('requestAssistance.when.tomorrow') : null;
    const dayAnchor = (d: VideoCallSlotDay) => d.slots[0]?.start ?? `${d.date}T12:00:00.000Z`;
    const slotLabel = (s: VideoCallSlot) => fmt(s.start, { hour: 'numeric', minute: '2-digit' });

    const selectDay = (index: number) => {
        setDayIndex(index);
        setSlot(null);
        setPeriod(null);
    };

    // ─── Submit ───

    const canSubmit = !submitting && !loading && modeReady && (!durationSupported || duration !== null) && (mode === 'now' ? (now?.mechanicsOnline ?? 0) > 0 : !!slot);

    // Two phases on one screen: pick the length and the time, then review the summary and request. The summary and the
    // payment notes only show in the second one, so the first stays light.
    const [reviewing, setReviewing] = useState(false);
    const showReview = reviewing && canSubmit;
    const scrollRef = useRef<ScrollView>(null);
    const goReview = () => {
        setReviewing(true);
        scrollRef.current?.scrollTo({ y: 0, animated: false });
    };
    const leaveReview = () => {
        setReviewing(false);
        scrollRef.current?.scrollTo({ y: 0, animated: false });
    };

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        try {
            const response = await assistanceDAO.create({
                userId: user?.id,
                title: typeof description === 'string' ? description : 'Video call assistance',
                notes: typeof details === 'string' ? details : '',
                type: 'videocall',
                assistanceType: 'videocall',
                ...(durationSupported && duration !== null ? { durationMinutes: duration } : {}),
                vehicleId: vehicleId as string,
                car: (vehicleName as string) || '',
                status: 'pending',
                ...(mode === 'now' ? { startNow: true } : { date: slot!.start, timezone }),
                ...(typeof condition === 'string' && condition ? { vehicleCondition: condition } : {}),
                ...(vehicleDetails.mileage !== undefined ? { mileage: vehicleDetails.mileage } : {}),
                driverIsOwner: vehicleDetails.driverIsOwner,
                ...(vehicleDetails.driverFirstName ? { driverFirstName: vehicleDetails.driverFirstName } : {}),
                ...(vehicleDetails.driverLastName ? { driverLastName: vehicleDetails.driverLastName } : {}),
                ...(vehicleDetails.driverPhone ? { driverPhone: vehicleDetails.driverPhone } : {}),
                ...(paymentMethodId ? { paymentMethodId } : {}),
            });

            // Records the price and the issues on the request, for the same
            // instant and zone the owner was quoted. The request already
            // exists, so a failure here must not undo it — but say so.
            const priceBody = {
                assistance_type: 'videocall',
                timezone,
                ...(mode === 'schedule' && slot ? { service_at: slot.start } : {}),
                vehicle_issue_ids: parseIds(issues),
                vehicle_issue_symptom_ids: parseIds(symptomIds),
            };
            try {
                try {
                    await pricingDAO.persistRequestPrice(response.id, {
                        ...priceBody,
                        ...(durationSupported && duration !== null ? { duration_minutes: duration } : {}),
                    });
                } catch (err) {
                    // A pricing service that does not know the length yet rejects the field; the request
                    // already carries its length, so price it without repeating it.
                    if (!(err instanceof ApiError && err.statusCode === 400 && /should not exist/i.test(err.apiMessage ?? err.message))) throw err;
                    await pricingDAO.persistRequestPrice(response.id, priceBody);
                }
            } catch (err) {
                // A video call has a fixed price and nobody quotes it: there is nothing to tell the
                // owner here, so the failure is only logged (the price is read again from the request).
                console.warn(`[when] persisting price failed for ${response.id}`, err);
            }

            // The OBD scanner report picked on the previous step. The request
            // already exists, so a failed upload must not undo it: the owner can
            // send it again from the assistance's OBD tab.
            if (obdFile) {
                try {
                    await requestObdDAO.attach(response.id, obdFile);
                    setObdFile(null);
                } catch (err) {
                    console.warn(`[when] attaching the OBD report failed for ${response.id}`, err);
                    await notify(
                        t('requestAssistance.obdScanner.uploadFailedTitle'),
                        t('requestAssistance.obdScanner.uploadFailedMessage'),
                        'blue',
                    );
                }
            }

            router.replace({
                pathname: '/request-assistance/searching',
                params: { requestId: response.id, type: 'videocall' },
            });
        } catch (error) {
            const code =
                error instanceof ApiError ? (error.apiError as { code?: string } | null)?.code : undefined;
            if (code === 'slot_unavailable') {
                void notify(t('requestAssistance.when.slotGoneTitle'), t('requestAssistance.when.slotGoneMessage'));
                setSlot(null);
                load();
            } else {
                console.error(error);
                void notify(t('requestAssistance.confirmation.errorTitle'), t('requestAssistance.confirmation.errorMessage'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    // ─── Pieces ───

    const OptionCard = ({
        value,
        Icon,
        title,
        subtitle,
        badge,
        disabled,
    }: {
        value: Mode;
        Icon: typeof Zap;
        title: string;
        subtitle: string;
        badge?: React.ReactNode;
        disabled?: boolean;
    }) => {
        const selected = modeReady && mode === value;
        return (
            <TouchableOpacity
                activeOpacity={0.85}
                disabled={disabled}
                onPress={() => { setMode(value); setModeChosen(true); }}
                testID={`when-option-${value}`}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 14,
                    borderRadius: 16,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1.5,
                    borderColor: selected ? C.blue : 'transparent',
                    opacity: disabled ? 0.55 : 1,
                    shadowColor: '#0E2F8A',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 6,
                    elevation: 2,
                }}
            >
                <View
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: selected ? '#C5D6F6' : C.blueSoft,
                    }}
                >
                    <Icon size={20} color={selected ? '#1743B0' : C.blue} />
                </View>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text className="font-outfit-bold" style={{ ...TYPE.body, color: C.ink }}>
                            {title}
                        </Text>
                        {badge}
                    </View>
                    <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: C.muted, marginTop: 2 }}>
                        {subtitle}
                    </Text>
                </View>
                <View
                    style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: selected ? C.blue : 'transparent',
                        borderWidth: selected ? 0 : 1.5,
                        borderColor: C.border,
                    }}
                >
                    {selected && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                </View>
            </TouchableOpacity>
        );
    };

    const SummaryRow = ({ Icon, label, value, last, action }: { Icon: typeof Zap; label: string; value: string; last?: boolean; action?: React.ReactNode }) => (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 12,
                borderBottomWidth: last ? 0 : 1,
                borderBottomColor: C.line,
            }}
        >
            <View style={{ width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: C.blueSoft }}>
                <Icon size={16} color={C.blue} />
            </View>
            <View style={{ flex: 1 }}>
                <Text className="font-outfit-medium" style={{ ...TYPE.helper, color: C.muted }}>
                    {label}
                </Text>
                <Text className="font-outfit-bold" style={{ ...TYPE.body, color: C.ink, marginTop: 1 }}>
                    {value}
                </Text>
            </View>
            {action}
        </View>
    );

    const InfoNote = ({ children }: { children: React.ReactNode }) => (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, backgroundColor: C.blueSoft }}>
            <Info size={18} color={C.blue} style={{ marginTop: 1 }} />
            <View style={{ flex: 1, gap: 6 }}>{children}</View>
        </View>
    );

    const SectionLabel = ({ children }: { children: string }) => (
        <Text className="font-outfit-bold" style={{ ...TYPE.eyebrow, color: C.muted }}>
            {children.toUpperCase()}
        </Text>
    );

    const online = now?.mechanicsOnline ?? 0;
    const wait = now?.estimatedWaitMinutes ?? null;
    const callMinutes = durationSupported ? duration ?? 0 : now?.baseMinutes ?? DEFAULT_CALL_MINUTES;
    // Only the parts of the day with something to book; the first one is open by default.
    const periodsWithSlots = day
        ? PERIODS.filter(({ key }) => day.slots.some((s) => partOf(s) === key && bookable(s)))
        : [];
    const activePeriod =
        period && periodsWithSlots.some((p) => p.key === period)
            ? period
            : DEFAULT_PART_ORDER.find((k) => periodsWithSlots.some((p) => p.key === k)) ?? null;
    const periodSlots = day && activePeriod ? day.slots.filter((s) => partOf(s) === activePeriod && bookable(s)) : [];
    const periodRange = (key: DayPart) => {
        const list = day?.slots.filter((s) => partOf(s) === key && bookable(s)) ?? [];
        return list.length ? `${slotLabel(list[0])} – ${slotLabel(list[list.length - 1])}` : '';
    };
    const priceLabel = durationSupported && duration === null
        ? t('requestAssistance.when.priceUnset')
        : priceLoading
        ? '…'
        : shownPrice != null
            ? `$${shownPrice.toFixed(2)}`
            : t('requestAssistance.when.priceTbd');

    const ctaLabel =
        durationSupported && duration === null
            ? t('requestAssistance.when.ctaPickDuration')
            : !modeReady
            ? t('requestAssistance.when.ctaPickWhen')
            : mode === 'schedule' && !slot
            ? t('requestAssistance.when.ctaPickTime')
            : !showReview
            ? t('requestAssistance.when.ctaContinue')
            : mode === 'now'
            ? t('requestAssistance.when.ctaNow')
            : t('requestAssistance.when.ctaSchedule', { time: slot ? slotLabel(slot) : '' });

    const selectedDayRel = day ? relativeDay(dayIndex) : null;
    const selectedDayLabel = day
        ? `${selectedDayRel ? `${selectedDayRel}, ` : ''}${fmt(dayAnchor(day), selectedDayRel ? { month: 'short', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' })}`
        : '';

    return (
        <View className="flex-1" style={{ backgroundColor: C.page }}>
            {dialog}
            <CardPickerModal
                visible={cardPickerOpen}
                cards={cards}
                selectedId={paymentMethodId}
                onSelect={(card) => {
                    pickPayment(card.id);
                    setCardPickerOpen(false);
                }}
                onSelectWallet={() => {
                    pickPayment(WALLET_METHOD);
                    setCardPickerOpen(false);
                }}
                wallet={wallet}
                amount={shownPrice}
                onClose={() => setCardPickerOpen(false)}
            />
            {/* Header — same as the other wizard steps */}
            <View
                className="px-6 pt-20 pb-2 flex-row items-center justify-between"
                style={[ROUNDED_HEADER, { paddingTop: 63 }]}
            >
                <TouchableOpacity onPress={() => (showReview ? leaveReview() : router.back())} testID="when-back">
                    <View className="rounded-full justify-center items-center" style={{ width: 30, height: 30, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
                        <ChevronLeft size={16} color="#0047AB" />
                    </View>
                </TouchableOpacity>
                <Text style={{ fontFamily: FONT.bold, fontSize: 17, color: C.ink, flex: 1, textAlign: 'center' }}>
                    {t('requestAssistance.when.headerTitle')}
                </Text>
                <HeaderBell />
            </View>
            <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24, gap: 14 }}>
                    <RequestSteps type={params.type} step="when" gap={14} flush />
                <View>
                    <View className="flex-row items-center justify-between" style={{ marginBottom: 12 }}>
                        <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                            <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                            <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                                {stepEyebrow(t, params.type, 'when')}
                            </Text>
                        </View>
                    </View>
                    <Text className="font-outfit-bold" style={{ fontSize: 26, color: C.ink }}>
                        {showReview ? t('requestAssistance.when.reviewTitle') : t('requestAssistance.when.title')}
                    </Text>
                    <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: C.muted, marginTop: 6 }}>
                        {showReview ? t('requestAssistance.when.reviewSubtitle') : t('requestAssistance.when.subtitle')}
                    </Text>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={C.blue} style={{ marginTop: 32 }} />
                ) : loadFailed ? (
                    <View style={{ alignItems: 'center', gap: 10, marginTop: 24 }}>
                        <Text className="font-outfit-medium" style={{ color: C.muted, textAlign: 'center' }}>
                            {t('requestAssistance.when.loadFailed')}
                        </Text>
                        <TouchableOpacity
                            onPress={() => {
                                setLoading(true);
                                load();
                            }}
                            testID="when-retry"
                        >
                            <Text className="font-outfit-bold" style={{ color: C.blue }}>
                                {t('requestAssistance.when.retry')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {!showReview && (
                        <>
                        {durationSupported && (
                        <View testID="when-duration-section" style={{ gap: 14 }}>
                            {/* No blue card, no arrows: a clear question, and every length laid out in the open, two to a row. */}
                            <View>
                                <Text className="font-outfit-bold" style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.4, color: C.ink }}>
                                    {t('requestAssistance.when.durationTitle')}
                                </Text>
                                <Text className="font-outfit-regular" style={{ ...TYPE.body, color: C.muted, marginTop: 4 }}>
                                    {t('requestAssistance.when.durationHint')}
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                                {(() => {
                                    // Columns follow how many lengths there are: up to three share one row, four make a square, and a
                                    // longer menu goes three to a row when it divides evenly, else two. Never a lone tile stretched wide.
                                    const list = now?.durations ?? [];
                                    const cols = list.length <= 3 ? Math.max(1, list.length) : list.length === 4 ? 2 : list.length % 3 === 0 ? 3 : 2;
                                    const tileWidth = cols === 1 ? '100%' : cols === 2 ? '48%' : '31%';
                                    const tight = cols === 3;
                                    return list.map((d) => {
                                    const selected = duration === d.minutes;
                                    return (
                                        <TouchableOpacity
                                            key={d.minutes}
                                            // A second tap on the chosen length lets go of it.
                                            onPress={() => setDuration(selected ? null : d.minutes)}
                                            activeOpacity={0.85}
                                            accessibilityRole="radio"
                                            accessibilityState={{ selected }}
                                            style={{
                                                // Two to a row; an odd last one keeps its width instead of stretching across.
                                                width: tileWidth,
                                                flexGrow: 0,
                                                minHeight: tight ? 118 : 108,
                                                paddingVertical: 16,
                                                paddingHorizontal: tight ? 8 : 16,
                                                borderRadius: 14,
                                                borderWidth: 2,
                                                borderColor: selected ? C.blue : '#E3EBFA',
                                                backgroundColor: selected ? '#EDF3FF' : '#FAFCFF',
                                                justifyContent: 'center',
                                                shadowColor: '#0E2F8A',
                                                shadowOffset: { width: 0, height: 4 },
                                                shadowOpacity: selected ? 0.12 : 0.05,
                                                shadowRadius: 10,
                                                elevation: selected ? 4 : 2,
                                            }}
                                            testID={`when-duration-${d.minutes}`}
                                        >
                                            <View style={{ position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? C.blue : '#FFFFFF', borderWidth: selected ? 0 : 2, borderColor: '#D5E1F8' }}>
                                                {selected ? <Check size={14} color="#FFFFFF" strokeWidth={3.4} /> : null}
                                            </View>
                                            <Text className="font-outfit-bold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ fontSize: tight ? 28 : 30, lineHeight: 36, letterSpacing: -0.6, color: selected ? C.blue : C.ink, marginTop: tight ? 10 : 0 }}>
                                                {d.minutes}
                                                <Text className="font-outfit-semibold" style={{ fontSize: 17, letterSpacing: 0, color: selected ? C.blue : C.muted }}>{' min'}</Text>
                                            </Text>
                                            <Text className="font-outfit-bold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ ...TYPE.group, color: C.blue, marginTop: 6 }} testID={`when-duration-price-${d.minutes}`}>
                                                {`$${(optionPrices[d.minutes] ?? d.price).toFixed(2)}`}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                    });
                                })()}
                            </View>
                        </View>
                        )}

                        {durationSupported && (
                            <Text className="font-outfit-bold" style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.4, color: C.ink, marginTop: 14 }}>
                                {t('requestAssistance.when.whenTitle')}
                            </Text>
                        )}
                        <OptionCard
                            value="now"
                            Icon={Zap}
                            title={t('requestAssistance.when.nowTitle')}
                            subtitle={
                                online === 0
                                    ? t('requestAssistance.when.nowNobody')
                                    : wait != null
                                        ? t('requestAssistance.when.nowSubtitleSoft')
                                        : t('requestAssistance.when.nowSubtitleNoWait')
                            }
                            disabled={online === 0}
                            badge={
                                online > 0 ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: C.greenSoft }}>
                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }} />
                                        <Text className="font-outfit-semibold" style={{ ...TYPE.caption, color: C.green }}>
                                            {t('requestAssistance.when.onlineBadge')}
                                        </Text>
                                    </View>
                                ) : undefined
                            }
                        />
                        <OptionCard
                            value="schedule"
                            Icon={CalendarDays}
                            title={t('requestAssistance.when.scheduleTitle')}
                            subtitle={t('requestAssistance.when.scheduleSubtitle')}
                        />

                        {modeReady && mode === 'schedule' && day && (
                            <View
                                style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, gap: 14, shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}
                                testID="when-schedule-panel"
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <SectionLabel>{t('requestAssistance.when.day')}</SectionLabel>
                                    <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF' }}>
                                        <Text className="font-outfit-bold" style={{ ...TYPE.caption, color: '#1E56E3' }}>
                                            {selectedDayLabel}
                                        </Text>
                                    </View>
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                    {days.map((d, index) => {
                                        const selected = index === dayIndex;
                                        const isToday = index === 0;
                                        const anchor = dayAnchor(d);
                                        const circle = { width: 46, height: 46, borderRadius: 23, alignItems: 'center' as const, justifyContent: 'center' as const };
                                        const number = (
                                            <Text className="font-outfit-bold" style={{ fontSize: 18, lineHeight: 22, color: selected ? '#FFFFFF' : C.ink }}>
                                                {fmt(anchor, { day: 'numeric' })}
                                            </Text>
                                        );
                                        return (
                                            <TouchableOpacity
                                                key={d.date}
                                                onPress={() => selectDay(index)}
                                                activeOpacity={0.85}
                                                style={{ width: 54, alignItems: 'center', gap: 6 }}
                                                accessibilityState={{ selected }}
                                                testID={`when-day-${d.date}`}
                                            >
                                                <Text className="font-outfit-semibold" numberOfLines={1} style={{ ...TYPE.caption, color: selected ? C.blue : C.faint }}>
                                                    {fmt(anchor, { weekday: 'short' })}
                                                </Text>
                                                {selected ? (
                                                    <LinearGradient colors={['#2B66F8', '#081E72']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={circle}>
                                                        {number}
                                                    </LinearGradient>
                                                ) : (
                                                    <View style={{ ...circle, backgroundColor: '#F4F6FB', borderWidth: isToday ? 1.5 : 0, borderColor: C.blue }}>{number}</View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>

                                {periodsWithSlots.length > 0 ? (
                                    <>
                                        <SectionLabel>{t('requestAssistance.when.rangeLabel')}</SectionLabel>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                            {periodsWithSlots.map(({ key, Icon }) => {
                                                const selected = activePeriod === key;
                                                return (
                                                    <TouchableOpacity
                                                        key={key}
                                                        onPress={() => {
                                                            setPeriod(key);
                                                            setSlot(null);
                                                        }}
                                                        activeOpacity={0.85}
                                                        accessibilityState={{ selected }}
                                                        testID={`when-period-${key}`}
                                                        style={{
                                                            ...(periodsWithSlots.length > 3 ? { width: '48.5%' } : { flex: 1 }),
                                                            alignItems: 'center',
                                                            gap: 3,
                                                            paddingVertical: 12,
                                                            paddingHorizontal: 4,
                                                            borderRadius: 14,
                                                            backgroundColor: selected ? C.blueSoft : '#FFFFFF',
                                                            borderWidth: 1.5,
                                                            borderColor: selected ? C.blue : C.border,
                                                        }}
                                                    >
                                                        <Icon size={18} color={selected ? C.blue : C.muted} />
                                                        <Text className="font-outfit-bold" style={{ ...TYPE.body, color: selected ? C.blue : C.ink }}>
                                                            {t(`requestAssistance.when.periods.${key}`)}
                                                        </Text>
                                                        <Text className="font-outfit-regular" numberOfLines={1} adjustsFontSizeToFit style={{ ...TYPE.caption, color: C.muted }}>
                                                            {periodRange(key)}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>

                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                                            {periodSlots.map((s) => {
                                                const selected = slot?.start === s.start;
                                                return (
                                                    <TouchableOpacity
                                                        key={s.start}
                                                        onPress={() => setSlot(s)}
                                                        activeOpacity={0.85}
                                                        testID={`when-slot-${s.time}`}
                                                        style={{
                                                            minWidth: 92,
                                                            height: 44,
                                                            paddingHorizontal: 12,
                                                            borderRadius: 12,
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            backgroundColor: selected ? C.blue : '#FFFFFF',
                                                            borderWidth: 1,
                                                            borderColor: selected ? C.blue : C.border,
                                                        }}
                                                    >
                                                        <Text className="font-outfit-bold" style={{ ...TYPE.body, color: selected ? '#FFFFFF' : C.ink }}>
                                                            {slotLabel(s)}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>
                                    </>
                                ) : (
                                    <Text className="font-outfit-medium" style={{ ...TYPE.helper, color: C.muted }}>
                                        {t('requestAssistance.when.noSlots')}
                                    </Text>
                                )}

                                <Text className="font-outfit-regular" style={{ ...TYPE.caption, color: C.faint }}>
                                    {t('requestAssistance.when.footnote', { zone: zoneLabel })}
                                </Text>
                            </View>
                        )}

                        </>
                        )}

                        {showReview && (
                        <>
                        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 14, shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
                            <SummaryRow Icon={DollarSign} label={t('requestAssistance.when.price')} value={priceLabel} />
                            <SummaryRow Icon={Video} label={t('requestAssistance.when.service')} value={t('requestAssistance.header.videoCall')} />
                            <SummaryRow Icon={Timer} label={t('requestAssistance.when.duration')} value={durationSupported && duration === null ? t('requestAssistance.when.durationUnset') : t('requestAssistance.when.durationValue', { count: callMinutes })} />
                            {mode === 'now' ? (
                                <>
                                    <SummaryRow Icon={Zap} label={t('requestAssistance.when.whenLabel')} value={t('requestAssistance.when.nowSummary')} />
                                    {wait != null && (
                                        <SummaryRow Icon={Clock} label={t('requestAssistance.when.wait')} value={t('requestAssistance.when.waitValue', { count: wait })} />
                                    )}
                                </>
                            ) : (
                                <>
                                    <SummaryRow Icon={CalendarDays} label={t('requestAssistance.when.day')} value={selectedDayLabel} />
                                    <SummaryRow Icon={Clock} label={t('requestAssistance.when.time')} value={slot ? slotLabel(slot) : t('requestAssistance.when.pickTime')} />
                                </>
                            )}
                            <SummaryRow
                                last
                                Icon={CreditCard}
                                label={t('requestAssistance.mechanicFound.rowPayment')}
                                value={paymentLabel}
                                action={<ChangeBadge onPress={() => setCardPickerOpen(true)} />}
                            />
                        </View>
                        <InfoNote>
                            {(!durationSupported || duration !== null) && (
                                <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: C.note }} testID="when-duration-note">
                                    {t('requestAssistance.when.durationNote', { count: callMinutes })}
                                </Text>
                            )}
                            <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: C.note }}>
                                {t('requestAssistance.when.priceNote')}
                            </Text>
                        </InfoNote>
                        <InfoNote>
                            <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: C.note }} testID="when-consent-note">
                                {t('requestAssistance.when.consentNote')}
                            </Text>
                        </InfoNote>
                        </>
                        )}
                    </>
                )}
            </ScrollView>

            {/* Sticky action */}
            <View style={FLOATING_FOOTER}>
                {submitting ? (
                    <ActivityIndicator size="large" color={C.blue} />
                ) : (
                    <TouchableOpacity onPress={showReview ? handleSubmit : goReview} disabled={!canSubmit} activeOpacity={0.85} testID="when-submit" style={canSubmit ? (showReview ? CONFIRM_CTA : FLOATING_CTA) : undefined}>
                        {canSubmit ? (
                            <LinearGradient
                                colors={showReview ? [...CONFIRM_GRADIENT] : ['#2B66F8', '#081E72']}
                                start={{ x: 0, y: 1 }}
                                end={{ x: 1, y: 0 }}
                                style={{ borderRadius: 16, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            >
                                {showReview && mode === 'now' && <Video size={18} color="#FFFFFF" />}
                                <Text className="text-white font-outfit-bold" style={TYPE.button}>
                                    {ctaLabel}
                                </Text>
                            </LinearGradient>
                        ) : (
                            <View style={{ borderRadius: 16, paddingVertical: 17, alignItems: 'center', backgroundColor: '#B9C0CF' }}>
                                <Text className="text-white font-outfit-bold" style={TYPE.button}>
                                    {ctaLabel}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}
