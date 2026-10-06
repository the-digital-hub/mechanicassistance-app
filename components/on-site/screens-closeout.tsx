import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Animated, Text, TouchableOpacity, View } from 'react-native';
import { onSiteDAO, OnSiteVisit } from '@/lib/dao/OnSiteDAO';
import { ObdPanel } from './ObdPanel';
import { ActionBar, Body, Card, NoteInput, OS, PrimaryButton, cardShadow } from './ui';

// The last screen of the on-site flow, after "Finish Service" (design:
// "Assistance Closeout"). Confirms the charge was requested, shows the payout
// estimate, lets the mechanic ask the owner for a review and rate the owner,
// and tracks the close-out steps. The payout is informative: the platform does
// not process payments yet.

const REVIEW_COOLDOWN_MS = 12 * 60 * 60 * 1000;

function formatAmount(amount: string | null, fallback: string): string {
    if (!amount) return fallback;
    const n = Number(String(amount).replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : amount;
}

function useFormatters() {
    const { i18n } = useTranslation();
    const locale = i18n.language?.startsWith('en') ? 'en-US' : 'es-AR';
    return {
        date: (iso: string) => new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
        time: (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    };
}

// ─────────── Hero ───────────
function Hero({ redirected }: { redirected: boolean }) {
    const { t } = useTranslation();
    const k = 'appointments.closeout';
    const scale = React.useRef(new Animated.Value(0.6)).current;
    React.useEffect(() => {
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
    }, [scale]);
    const color = redirected ? OS.orange : OS.green;
    const soft = redirected ? OS.orangeSoft : OS.greenSoft;
    const dark = redirected ? OS.orangeText : OS.greenDark;
    return (
        <View className="mx-4 mt-4 items-center px-5 pt-6 pb-5" style={cardShadow}>
            <Animated.View
                className="items-center justify-center mb-3.5"
                style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: soft, transform: [{ scale }] }}
            >
                <Ionicons name="checkmark" size={28} color={color} />
            </Animated.View>
            <View className="flex-row items-center gap-1.5 mb-2.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: soft }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />
                <Text className="font-outfit-bold text-[10px] tracking-widest" style={{ color: dark }}>
                    {redirected ? t(`${k}.heroBadgeRedirected`) : t(`${k}.heroBadge`)}
                </Text>
            </View>
            <Text className="font-outfit-bold text-xl text-center leading-7" style={{ color: OS.text }}>
                {redirected ? t(`${k}.heroTitleRedirected`) : t(`${k}.heroTitle`)}
            </Text>
        </View>
    );
}

// ─────────── Payout ───────────
function Payout({ visit }: { visit: OnSiteVisit }) {
    const { t } = useTranslation();
    const k = 'appointments.closeout';
    const fmt = useFormatters();
    const steps = [
        { label: t(`${k}.stepRequested`), state: 'done' as const },
        { label: t(`${k}.stepReview`), state: visit.ownerReviewSubmitted ? ('done' as const) : ('active' as const) },
        { label: t(`${k}.stepFunds`), state: 'pending' as const },
    ];
    return (
        <Card style={{ padding: 16 }}>
            <View className="flex-row items-center justify-between">
                <View>
                    <Text className="font-outfit-bold text-[11px] tracking-widest" style={{ color: OS.muted }}>{t(`${k}.payoutLabel`)}</Text>
                    <Text className="font-outfit-bold mt-0.5" style={{ fontSize: 26, color: OS.blueDark }}>
                        {formatAmount(visit.serviceAmount, t(`${k}.unknownAmount`))}
                    </Text>
                </View>
                {visit.estimatedPayoutAt ? (
                    <View className="items-end px-3 py-2 rounded-xl" style={{ backgroundColor: OS.blueSofter }}>
                        <Text className="font-outfit-bold text-[10px]" style={{ color: OS.muted }}>{t(`${k}.arrivesBy`)}</Text>
                        <Text className="font-outfit-bold text-[13.5px] mt-0.5" style={{ color: OS.blueDark }}>{fmt.date(visit.estimatedPayoutAt)}</Text>
                    </View>
                ) : null}
            </View>

            <View className="flex-row items-center mt-4">
                {steps.map((s, i) => (
                    <React.Fragment key={s.label}>
                        <View className="items-center gap-1.5" style={{ maxWidth: 72 }}>
                            <View
                                className="items-center justify-center"
                                style={{
                                    width: 24, height: 24, borderRadius: 12,
                                    backgroundColor: s.state === 'done' ? OS.greenSoft : s.state === 'active' ? OS.blueSoft : OS.borderSoft,
                                }}
                            >
                                {s.state === 'done' ? (
                                    <Ionicons name="checkmark" size={13} color={OS.green} />
                                ) : s.state === 'active' ? (
                                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: OS.blue }} />
                                ) : (
                                    <Ionicons name="time-outline" size={12} color={OS.mutedLight} />
                                )}
                            </View>
                            <Text
                                className="font-outfit-bold text-[9.5px] text-center"
                                style={{ color: s.state === 'done' ? OS.greenDark : s.state === 'active' ? OS.blue : OS.mutedLight }}
                            >
                                {s.label}
                            </Text>
                        </View>
                        {i < steps.length - 1 ? (
                            <View className="flex-1 mx-1 mb-4" style={{ height: 2, backgroundColor: s.state === 'done' ? OS.green : OS.border }} />
                        ) : null}
                    </React.Fragment>
                ))}
            </View>
            <Text className="font-outfit-regular text-[11.5px] mt-2.5 leading-4" style={{ color: OS.mutedLight }}>{t(`${k}.payoutNote`)}</Text>
        </Card>
    );
}

// ─────────── Ask the owner for a review ───────────
function ReviewRequest({ visit, onVisit }: { visit: OnSiteVisit; onVisit: (v: OnSiteVisit) => void }) {
    const { t } = useTranslation();
    const k = 'appointments.closeout';
    const fmt = useFormatters();
    const [sending, setSending] = React.useState(false);
    const [retryAt, setRetryAt] = React.useState<string | null>(null);

    const requestedAt = visit.reviewRequestedAt ? new Date(visit.reviewRequestedAt).getTime() : null;
    const nextAllowed = retryAt
        ? new Date(retryAt).getTime()
        : requestedAt !== null
            ? requestedAt + REVIEW_COOLDOWN_MS
            : null;
    const canAsk = nextAllowed === null || Date.now() >= nextAllowed;

    const send = async () => {
        setSending(true);
        try {
            const result = await onSiteDAO.requestOwnerReview(visit.appointmentId);
            if (result.ok) onVisit(result.visit);
            else setRetryAt(result.retryAt);
        } catch {
            Alert.alert(t('appointments.onSite.common.error'));
        } finally {
            setSending(false);
        }
    };

    return (
        <Card>
            <View className="flex-row items-center gap-2.5 px-4 pt-4 pb-1">
                <View className="items-center justify-center" style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: OS.orangeSoft }}>
                    <Ionicons name="star-outline" size={19} color={OS.orange} />
                </View>
                <Text className="font-outfit-bold text-[14.5px]" style={{ color: OS.text }}>{t(`${k}.reviewTitle`)}</Text>
            </View>
            <Text className="font-outfit-regular text-[12.5px] px-4 pt-1.5 pb-4 leading-5" style={{ color: OS.muted }}>{t(`${k}.reviewBody`)}</Text>
            <View className="px-4 pb-4">
                {visit.ownerReviewSubmitted ? (
                    <View className="flex-row items-center gap-2.5 px-3.5 py-3 rounded-xl" style={{ backgroundColor: OS.greenSoft }}>
                        <Ionicons name="checkmark" size={16} color={OS.green} />
                        <Text className="flex-1 font-outfit-bold text-[12.5px]" style={{ color: OS.greenDark }}>{t(`${k}.reviewReceived`)}</Text>
                    </View>
                ) : requestedAt !== null && !canAsk ? (
                    <View className="px-3.5 py-3 rounded-xl" style={{ backgroundColor: OS.greenSoft }}>
                        <View className="flex-row items-center gap-2.5">
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: OS.green }} />
                            <Text className="flex-1 font-outfit-bold text-[12.5px]" style={{ color: OS.greenDark }}>{t(`${k}.reviewSent`)}</Text>
                        </View>
                        {nextAllowed ? (
                            <Text className="font-outfit-medium text-[11px] mt-1.5" style={{ color: OS.greenDark }}>
                                {t(`${k}.reviewAgainAt`, { time: `${fmt.date(new Date(nextAllowed).toISOString())} ${fmt.time(new Date(nextAllowed).toISOString())}` })}
                            </Text>
                        ) : null}
                    </View>
                ) : (
                    <TouchableOpacity
                        onPress={() => void send()}
                        disabled={sending}
                        activeOpacity={0.85}
                        className="flex-row items-center justify-center gap-2 py-3.5"
                        style={{ borderRadius: 13, backgroundColor: OS.blue, opacity: sending ? 0.7 : 1 }}
                        testID="closeout-request-review"
                    >
                        {sending ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="chatbubble-outline" size={15} color="#FFFFFF" />}
                        <Text className="text-white font-outfit-bold text-sm">
                            {requestedAt !== null ? t(`${k}.reviewResend`) : t(`${k}.reviewSend`)}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </Card>
    );
}

// ─────────── The mechanic rates the owner ───────────
function RateOwner({ visit, onVisit }: { visit: OnSiteVisit; onVisit: (v: OnSiteVisit) => void }) {
    const { t } = useTranslation();
    const k = 'appointments.closeout';
    const [rating, setRating] = React.useState(0);
    const [comment, setComment] = React.useState('');
    const [sending, setSending] = React.useState(false);

    const submit = async () => {
        setSending(true);
        try {
            await onSiteDAO.reviewClient(visit.appointmentId, rating, comment.trim() || undefined);
            const fresh = await onSiteDAO.get(visit.appointmentId);
            if (fresh) onVisit(fresh);
        } catch {
            Alert.alert(t('appointments.onSite.common.error'));
        } finally {
            setSending(false);
        }
    };

    return (
        <Card>
            <View className="flex-row items-center gap-2.5 px-4 pt-4 pb-1">
                <View className="items-center justify-center" style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: OS.blueSoft }}>
                    <Ionicons name="person-outline" size={19} color={OS.blue} />
                </View>
                <Text className="font-outfit-bold text-[14.5px]" style={{ color: OS.text }}>{t(`${k}.rateTitle`)}</Text>
            </View>
            <Text className="font-outfit-regular text-[12.5px] px-4 pt-1.5 pb-4 leading-5" style={{ color: OS.muted }}>{t(`${k}.rateBody`)}</Text>
            <View className="px-4 pb-4">
                {visit.clientRating ? (
                    <View className="flex-row items-center gap-2.5 px-3.5 py-3 rounded-xl" style={{ backgroundColor: OS.greenSoft }}>
                        <Ionicons name="checkmark" size={16} color={OS.green} />
                        <Text className="flex-1 font-outfit-bold text-[12.5px]" style={{ color: OS.greenDark }}>
                            {t(`${k}.rateDone`, { rating: visit.clientRating })}
                        </Text>
                    </View>
                ) : (
                    <>
                        <View className="flex-row justify-center gap-2 mb-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <TouchableOpacity key={n} onPress={() => setRating(n)} testID={`closeout-rate-${n}`} className="p-0.5">
                                    <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={30} color={n <= rating ? OS.orange : OS.border} />
                                </TouchableOpacity>
                            ))}
                        </View>
                        <NoteInput value={comment} onChangeText={setComment} placeholder={t(`${k}.ratePh`)} white />
                        <TouchableOpacity
                            onPress={() => void submit()}
                            disabled={!rating || sending}
                            className="items-center py-3.5 mt-3"
                            style={{ borderRadius: 13, backgroundColor: rating && !sending ? OS.blue : OS.blueIce }}
                        >
                            {sending ? <ActivityIndicator color="#FFFFFF" /> : (
                                <Text className="text-white font-outfit-bold text-sm">{t(`${k}.rateSubmit`)}</Text>
                            )}
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </Card>
    );
}

// ─────────── Close-out checklist ───────────
function Checklist({ visit }: { visit: OnSiteVisit }) {
    const { t } = useTranslation();
    const k = 'appointments.closeout';
    const kinds = new Set(visit.media.map((m) => m.kind));
    const items = [
        { label: t(`${k}.itemDiagnosis`), done: kinds.has('plate') && kinds.has('dashboard') },
        { label: t(`${k}.itemPayment`), done: !!visit.closedAt },
        visit.ownerReviewSubmitted
            ? { label: t(`${k}.itemReviewReceived`), done: true }
            : { label: t(`${k}.itemReviewRequested`), done: !!visit.reviewRequestedAt },
        { label: t(`${k}.itemFunds`), done: false },
    ];
    const doneCount = items.filter((i) => i.done).length;
    return (
        <Card>
            <View className="flex-row items-center justify-between px-4 py-3" style={{ borderBottomWidth: 1, borderBottomColor: OS.borderSoft }}>
                <Text className="font-outfit-bold text-[13px]" style={{ color: OS.text }}>{t(`${k}.checklistTitle`)}</Text>
                <Text className="font-outfit-bold text-[11.5px]" style={{ color: OS.mutedLight }}>{doneCount}/{items.length}</Text>
            </View>
            {items.map((it, i) => (
                <View
                    key={it.label}
                    className="flex-row items-center gap-3 px-4 py-3"
                    style={i < items.length - 1 ? { borderBottomWidth: 1, borderBottomColor: OS.borderSoft } : undefined}
                >
                    <View className="items-center justify-center" style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: it.done ? OS.greenSoft : OS.borderSoft }}>
                        {it.done ? <Ionicons name="checkmark" size={12} color={OS.green} /> : <Ionicons name="time-outline" size={11} color={OS.mutedLight} />}
                    </View>
                    <Text className="font-outfit-medium text-[13px]" style={{ color: it.done ? OS.text : OS.muted }}>{it.label}</Text>
                </View>
            ))}
        </Card>
    );
}

// ─────────── Screen ───────────
export function ScreenCloseout({ visit, onVisit, onBackToDashboard }: {
    visit: OnSiteVisit;
    onVisit: (v: OnSiteVisit) => void;
    onBackToDashboard: () => void;
}) {
    const { t } = useTranslation();
    const k = 'appointments.closeout';
    // The OBD report can still be uploaded after the close-out (the reminder push leads here).
    const [obdPending] = React.useState(
        () => visit.obdStatus === 'none' || visit.obdStatus === 'failed' || visit.obdStatus === 'processing',
    );

    return (
        <>
            <Body>
                <Hero redirected={visit.outcome === 'redirected'} />
                <Payout visit={visit} />
                <ReviewRequest visit={visit} onVisit={onVisit} />
                <RateOwner visit={visit} onVisit={onVisit} />
                {obdPending ? (
                    <View className="mt-4">
                        <Text className="font-outfit-bold text-[15px] mx-5" style={{ color: OS.text }}>{t(`${k}.obdTitle`)}</Text>
                        <ObdPanel appointmentId={visit.appointmentId} visit={visit} onVisit={onVisit} />
                    </View>
                ) : null}
                <Checklist visit={visit} />
                <Text className="font-outfit-regular text-[11.5px] text-center mx-5 mt-4 leading-4" style={{ color: OS.mutedLight }}>{t(`${k}.footer`)}</Text>
            </Body>
            <ActionBar>
                <PrimaryButton label={t(`${k}.back`)} onPress={onBackToDashboard} testID="closeout-back" />
            </ActionBar>
        </>
    );
}
