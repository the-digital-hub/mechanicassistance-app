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
    type SlotPeriod,
} from '@/lib/dao/VideoCallDAO';
import { DEFAULT_CALL_MINUTES } from '@/lib/video/callLength';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    CalendarDays,
    Check,
    ChevronLeft,
    Clock,
    CreditCard,
    DollarSign,
    Moon,
    Sun,
    Sunrise,
    Timer,
    Video,
    Zap,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

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
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const parseIds = (raw: unknown): string[] =>
    typeof raw === 'string' ? raw.split(',').filter((id) => UUID_RE.test(id)) : [];

type Mode = 'now' | 'schedule';

const PERIODS: { key: SlotPeriod; Icon: typeof Sun }[] = [
    { key: 'morning', Icon: Sunrise },
    { key: 'afternoon', Icon: Sun },
    { key: 'evening', Icon: Moon },
];

export default function VideoCallWhenScreen() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const { user } = useUser();
    const { vehicleDetails, obdFile, setObdFile } = useRequestDraft();
    const params = useLocalSearchParams();
    const { vehicleId, vehicleName, description, issues, symptomIds, details, condition } = params;

    const timezone = useMemo(() => deviceTimeZone(), []);
    const [now, setNow] = useState<VideoCallNow | null>(null);
    const [days, setDays] = useState<VideoCallSlotDay[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [price, setPrice] = useState<number | null>(null);
    const [priceLoading, setPriceLoading] = useState(true);
    const [mode, setMode] = useState<Mode>('now');
    const [dayIndex, setDayIndex] = useState(0);
    const [slot, setSlot] = useState<VideoCallSlot | null>(null);
    const [submitting, setSubmitting] = useState(false);
    // How this request is paid: the wallet when its balance covers the price,
    // else the default card — until the user picks another.
    const { cards, wallet, selectedId: paymentMethodId, selectedLabel: paymentLabel, pick: pickPayment } = usePaymentChoice(price);
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
        let mounted = true;
        setPriceLoading(true);
        pricingDAO
            .calculatePrice({
                assistance_type: 'videocall',
                timezone,
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
    }, [timezone, serviceAt]);

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
    };

    // ─── Submit ───

    const canSubmit = !submitting && !loading && (mode === 'now' ? (now?.mechanicsOnline ?? 0) > 0 : !!slot);

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
                vehicleId: vehicleId as string,
                car: (vehicleName as string) || '',
                status: 'pending',
                ...(mode === 'now' ? { startNow: true } : { date: slot!.start }),
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
            try {
                await pricingDAO.persistRequestPrice(response.id, {
                    assistance_type: 'videocall',
                    timezone,
                    ...(mode === 'schedule' && slot ? { service_at: slot.start } : {}),
                    vehicle_issue_ids: parseIds(issues),
                    vehicle_issue_symptom_ids: parseIds(symptomIds),
                });
            } catch (err) {
                console.warn(`[when] persisting price failed for ${response.id}`, err);
                Alert.alert(
                    t('requestAssistance.confirmation.pricingUnavailableTitle'),
                    t('requestAssistance.confirmation.pricingUnavailableMessage'),
                );
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
                    Alert.alert(
                        t('requestAssistance.obdScanner.uploadFailedTitle'),
                        t('requestAssistance.obdScanner.uploadFailedMessage'),
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
                Alert.alert(t('requestAssistance.when.slotGoneTitle'), t('requestAssistance.when.slotGoneMessage'));
                setSlot(null);
                load();
            } else {
                console.error(error);
                Alert.alert(t('requestAssistance.confirmation.errorTitle'), t('requestAssistance.confirmation.errorMessage'));
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
        const selected = mode === value;
        return (
            <TouchableOpacity
                activeOpacity={0.85}
                disabled={disabled}
                onPress={() => setMode(value)}
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
                        backgroundColor: selected ? C.blue : C.blueSoft,
                    }}
                >
                    <Icon size={20} color={selected ? '#FFFFFF' : C.blue} />
                </View>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text className="font-outfit-bold" style={{ fontSize: 15, color: C.ink }}>
                            {title}
                        </Text>
                        {badge}
                    </View>
                    <Text className="font-outfit-regular" style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>
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
            <Text className="font-outfit-medium" style={{ fontSize: 12, color: C.muted }}>
                {label}
            </Text>
            <Text className="font-outfit-bold" style={{ flex: 1, textAlign: 'right', fontSize: 13, color: C.ink }}>
                {value}
            </Text>
            {action}
        </View>
    );

    const SectionLabel = ({ children }: { children: string }) => (
        <Text className="font-outfit-bold" style={{ fontSize: 11, letterSpacing: 1.2, color: C.muted }}>
            {children.toUpperCase()}
        </Text>
    );

    const online = now?.mechanicsOnline ?? 0;
    const wait = now?.estimatedWaitMinutes ?? null;
    const callMinutes = now?.baseMinutes ?? DEFAULT_CALL_MINUTES;
    const priceLabel = priceLoading
        ? '…'
        : price != null
            ? `$${price.toFixed(2)}`
            : t('requestAssistance.when.priceTbd');

    const ctaLabel =
        mode === 'now'
            ? t('requestAssistance.when.ctaNow')
            : slot
                ? t('requestAssistance.when.ctaSchedule', { time: slotLabel(slot) })
                : t('requestAssistance.when.ctaPickTime');

    const selectedDayRel = day ? relativeDay(dayIndex) : null;
    const selectedDayLabel = day
        ? `${selectedDayRel ? `${selectedDayRel}, ` : ''}${fmt(dayAnchor(day), selectedDayRel ? { month: 'short', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' })}`
        : '';

    return (
        <View className="flex-1" style={{ backgroundColor: C.page }}>
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
                amount={price}
                onClose={() => setCardPickerOpen(false)}
            />
            {/* Header — same as the other wizard steps */}
            <View
                className="px-6 pt-20 pb-2 flex-row items-center justify-between"
                style={{ backgroundColor: '#F4F5FA', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 3, borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB' }}
            >
                <TouchableOpacity onPress={() => router.back()} testID="when-back">
                    <View className="w-10 h-10 rounded-full justify-center items-center" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
                        <ChevronLeft size={20} color="#0047AB" />
                    </View>
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 17, color: C.ink, flex: 1, textAlign: 'center' }}>
                    {t('requestAssistance.when.headerTitle')}
                </Text>
                <View className="w-10" />
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 14 }}>
                <View>
                    <View className="flex-row items-center gap-1.5 mb-3 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                            {t('requestAssistance.when.badge')}
                        </Text>
                    </View>
                    <Text className="font-outfit-bold" style={{ fontSize: 26, color: C.ink }}>
                        {t('requestAssistance.when.title')}
                    </Text>
                    <Text className="font-outfit-regular" style={{ fontSize: 14, color: C.muted, marginTop: 6, lineHeight: 20 }}>
                        {t('requestAssistance.when.subtitle')}
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
                        <OptionCard
                            value="now"
                            Icon={Zap}
                            title={t('requestAssistance.when.nowTitle')}
                            subtitle={
                                online === 0
                                    ? t('requestAssistance.when.nowNobody')
                                    : wait != null
                                        ? t('requestAssistance.when.nowSubtitle', { count: wait })
                                        : t('requestAssistance.when.nowSubtitleNoWait')
                            }
                            disabled={online === 0}
                            badge={
                                online > 0 ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: C.greenSoft }}>
                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }} />
                                        <Text className="font-outfit-semibold" style={{ fontSize: 11, color: C.green }}>
                                            {t('requestAssistance.when.online', { count: online })}
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

                        {mode === 'schedule' && day && (
                            <View
                                style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, gap: 14, shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}
                                testID="when-schedule-panel"
                            >
                                <SectionLabel>{t('requestAssistance.when.day')}</SectionLabel>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                                    {days.map((d, index) => {
                                        const selected = index === dayIndex;
                                        const rel = relativeDay(index);
                                        const anchor = dayAnchor(d);
                                        const body = (
                                            <>
                                                <Text className="font-outfit-bold" style={{ fontSize: 10.5, letterSpacing: 1, color: selected ? 'rgba(255,255,255,0.8)' : C.faint }}>
                                                    {fmt(anchor, { weekday: 'short' }).toUpperCase()}
                                                </Text>
                                                <Text className="font-outfit-bold" style={{ fontSize: 20, color: selected ? '#FFFFFF' : C.ink }}>
                                                    {fmt(anchor, { day: 'numeric' })}
                                                </Text>
                                                {rel ? (
                                                    <Text className="font-outfit-bold" style={{ fontSize: 9.5, color: selected ? 'rgba(255,255,255,0.85)' : C.faint }}>
                                                        {rel}
                                                    </Text>
                                                ) : null}
                                            </>
                                        );
                                        const box = { width: 58, height: 70, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 1 };
                                        return (
                                            <TouchableOpacity key={d.date} onPress={() => selectDay(index)} activeOpacity={0.85} testID={`when-day-${d.date}`}>
                                                {selected ? (
                                                    <LinearGradient colors={['#2B66F8', '#081E72']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={box}>
                                                        {body}
                                                    </LinearGradient>
                                                ) : (
                                                    <View style={{ ...box, backgroundColor: '#F4F6FB', borderWidth: 1, borderColor: C.border }}>{body}</View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>

                                {PERIODS.map(({ key, Icon }) => {
                                    const list = day.slots.filter((s) => s.period === key);
                                    // A part of the day with nothing left to book is noise.
                                    if (!list.some((s) => s.available)) return null;
                                    return (
                                        <View key={key} style={{ gap: 8 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Icon size={14} color={C.muted} />
                                                <SectionLabel>{t(`requestAssistance.when.periods.${key}`)}</SectionLabel>
                                            </View>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                                {list.map((s) => {
                                                    const selected = slot?.start === s.start;
                                                    return (
                                                        <TouchableOpacity
                                                            key={s.start}
                                                            disabled={!s.available}
                                                            onPress={() => setSlot(s)}
                                                            activeOpacity={0.85}
                                                            testID={`when-slot-${s.time}`}
                                                            style={{
                                                                width: '31.5%',
                                                                height: 40,
                                                                borderRadius: 10,
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                backgroundColor: selected ? C.blue : s.available ? '#FFFFFF' : C.takenBg,
                                                                borderWidth: 1,
                                                                borderColor: selected ? C.blue : s.available ? C.border : C.takenBg,
                                                            }}
                                                        >
                                                            <Text
                                                                className="font-outfit-bold"
                                                                style={{
                                                                    fontSize: 13.5,
                                                                    color: selected ? '#FFFFFF' : s.available ? C.ink : C.taken,
                                                                    textDecorationLine: s.available ? 'none' : 'line-through',
                                                                }}
                                                            >
                                                                {slotLabel(s)}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        </View>
                                    );
                                })}

                                {!day.slots.some((s) => s.available) && (
                                    <Text className="font-outfit-medium" style={{ fontSize: 13, color: C.muted }}>
                                        {t('requestAssistance.when.noSlots')}
                                    </Text>
                                )}

                                <Text className="font-outfit-regular" style={{ fontSize: 11.5, color: C.faint, lineHeight: 16 }}>
                                    {t('requestAssistance.when.footnote', { zone: zoneLabel })}
                                </Text>
                            </View>
                        )}

                        <View style={{ marginTop: 6 }}>
                            <SectionLabel>{t('requestAssistance.when.summary')}</SectionLabel>
                        </View>
                        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 14, shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
                            <SummaryRow Icon={Video} label={t('requestAssistance.when.service')} value={t('requestAssistance.header.videoCall')} />
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
                            <SummaryRow Icon={Timer} label={t('requestAssistance.when.duration')} value={t('requestAssistance.when.durationValue', { count: callMinutes })} />
                            <SummaryRow Icon={DollarSign} label={t('requestAssistance.when.price')} value={priceLabel} />
                            <SummaryRow
                                last
                                Icon={CreditCard}
                                label={t('requestAssistance.mechanicFound.rowPayment')}
                                value={paymentLabel}
                                action={
                                    <TouchableOpacity onPress={() => setCardPickerOpen(true)} hitSlop={8}>
                                        <Text className="font-outfit-bold" style={{ fontSize: 12.5, color: C.blue }}>
                                            {t('requestAssistance.mechanicFound.change')}
                                        </Text>
                                    </TouchableOpacity>
                                }
                            />
                        </View>
                        <Text className="font-outfit-regular" style={{ fontSize: 11.5, color: C.faint, lineHeight: 16, marginTop: 8 }} testID="when-duration-note">
                            {t('requestAssistance.when.durationNote', { count: callMinutes })}
                        </Text>
                    </>
                )}
            </ScrollView>

            {/* Sticky action */}
            <View style={{ backgroundColor: C.page, borderTopWidth: 1, borderTopColor: C.line, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18 }}>
                {submitting ? (
                    <ActivityIndicator size="large" color={C.blue} />
                ) : (
                    <TouchableOpacity onPress={handleSubmit} disabled={!canSubmit} activeOpacity={0.85} testID="when-submit">
                        {canSubmit ? (
                            <LinearGradient
                                colors={['#2B66F8', '#081E72']}
                                start={{ x: 0, y: 1 }}
                                end={{ x: 1, y: 0 }}
                                style={{ borderRadius: 12, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            >
                                {mode === 'now' && <Video size={18} color="#FFFFFF" />}
                                <Text className="text-white font-outfit-bold" style={{ fontSize: 16 }}>
                                    {ctaLabel}
                                </Text>
                            </LinearGradient>
                        ) : (
                            <View style={{ borderRadius: 12, paddingVertical: 16, alignItems: 'center', backgroundColor: '#B9C0CF' }}>
                                <Text className="text-white font-outfit-bold" style={{ fontSize: 16 }}>
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
