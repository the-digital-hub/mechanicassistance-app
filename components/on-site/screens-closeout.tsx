import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, Text, TouchableOpacity, View } from 'react-native';
import { onSiteConfirmationStage, onSiteDAO, OnSiteConfirmationStage, OnSiteVisit } from '@/lib/dao/OnSiteDAO';
import { FinalReportCard } from './FinalReportActions';
import { ObdPanel } from './ObdPanel';
import { Body, Card, NoteInput, OS, PrimaryButton, cardShadow } from './ui';
import { appAlert } from '@/lib/ui/appAlert';
import { TYPE } from '@/lib/ui/type';

// The last screen of the on-site flow, after "Finish Service" (design:
// "Assistance Closeout"). Confirms the charge was requested, says where the payout
// goes (the wallet; paying it out to a bank account is the mechanic's own choice),
// lets the mechanic rate the owner, and offers the final report. The payout comes
// from Billing once the job is charged (`payoutStatus`); otherwise it is an estimate.
// The owner's review closes the assistance out (`closeoutCompletedAt`).
// A visit closed as resolved is only charged once the owner confirms it (or the
// confirmation deadline passes); until then, and while a dispute is open, the
// screen says so instead of "charge requested".

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
const PENDING_STAGES: ReadonlySet<OnSiteConfirmationStage> = new Set(['awaiting', 'disputed', 'released']);

function Hero({ redirected, stage }: { redirected: boolean; stage: OnSiteConfirmationStage | null }) {
    const { t } = useTranslation();
    const k = 'appointments.closeout';
    // Waiting for the owner / in review / released: not a "charge requested" hero.
    const pending = !redirected && stage !== null && PENDING_STAGES.has(stage);
    const scale = React.useRef(new Animated.Value(0.6)).current;
    React.useEffect(() => {
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
    }, [scale]);
    const color = redirected || pending ? OS.orange : OS.green;
    const soft = redirected || pending ? OS.orangeSoft : OS.greenSoft;
    const dark = redirected || pending ? OS.orangeText : OS.greenDark;
    const stageKey = stage === 'awaiting' ? 'Awaiting' : stage === 'disputed' ? 'Disputed' : 'Released';
    return (
        <View className="mx-4 mt-4 items-center px-5 pt-6 pb-5" style={cardShadow}>
            <Animated.View
                className="items-center justify-center mb-3.5"
                style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: soft, transform: [{ scale }] }}
            >
                <Ionicons name={pending ? (stage === 'awaiting' ? 'hourglass-outline' : 'alert') : 'checkmark'} size={28} color={color} />
            </Animated.View>
            <View className="flex-row items-center gap-1.5 mb-2.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: soft }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />
                <Text className="font-outfit-bold text-[12px] tracking-widest" style={{ color: dark }}>
                    {redirected ? t(`${k}.heroBadgeRedirected`) : pending ? t(`${k}.heroBadge${stageKey}`) : t(`${k}.heroBadge`)}
                </Text>
            </View>
            <Text className="font-outfit-bold text-xl text-center leading-7" style={{ color: OS.text }}>
                {redirected ? t(`${k}.heroTitleRedirected`) : pending ? t(`${k}.heroTitle${stageKey}`) : t(`${k}.heroTitle`)}
            </Text>
        </View>
    );
}

// ─────────── Payout ───────────
function Payout({ visit }: { visit: OnSiteVisit }) {
    const { t } = useTranslation();
    const k = 'appointments.closeout';
    const fmt = useFormatters();
    const settled = visit.payoutStatus === 'settled';
    const stage = onSiteConfirmationStage(visit);
    // Paid money lands in the mechanic's wallet; paying it out to a bank account is their own choice, later.
    const status = settled
        ? {
            icon: 'wallet' as const, bg: OS.greenSoft, fg: OS.greenDark,
            title: visit.fundsTransferredAt ? t(`${k}.walletSentOn`, { date: fmt.date(visit.fundsTransferredAt) }) : t(`${k}.walletSent`),
        }
        : stage === 'disputed'
            ? { icon: 'alert-circle-outline' as const, bg: OS.orangeSoft, fg: OS.orangeText, title: t(`${k}.walletDisputed`) }
            : stage === 'released'
                ? { icon: 'close-circle-outline' as const, bg: OS.orangeSoft, fg: OS.orangeText, title: t(`${k}.walletReleased`) }
                : { icon: 'time-outline' as const, bg: OS.blueSofter, fg: OS.blueDark, title: t(`${k}.walletPending`) };
    return (
        <Card style={{ padding: 16 }}>
            <Text className="font-outfit-bold text-[12px] tracking-widest" style={{ color: OS.muted }}>{t(`${k}.payoutLabel`)}</Text>
            <Text className="font-outfit-bold mt-0.5" style={{ fontSize: 30, lineHeight: 36, color: OS.blueDark }}>
                {formatAmount(visit.payoutAmount ?? visit.serviceAmount, t(`${k}.unknownAmount`))}
            </Text>
            <View className="flex-row items-start mt-3" style={{ gap: 12, padding: 12, borderRadius: 14, backgroundColor: status.bg }} testID="payout-status">
                <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: '#FFFFFF' }}>
                    <Ionicons name={status.icon} size={19} color={status.fg} />
                </View>
                <View className="flex-1">
                    <Text className="font-outfit-bold" style={{ fontSize: 16, lineHeight: 22, color: status.fg }}>{status.title}</Text>
                    <Text className="font-outfit-regular mt-0.5" style={{ fontSize: 14, lineHeight: 20, color: OS.muted }}>{t(`${k}.walletNote`)}</Text>
                </View>
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
            appAlert(t('appointments.onSite.common.error'));
        } finally {
            setSending(false);
        }
    };

    return (
        <Card>
            <View className="flex-row items-center gap-2.5 px-4 pt-4 pb-1">
                <View className="items-center justify-center" style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: OS.blueSoft }}>
                    <Ionicons name="person-outline" size={20} color={OS.blue} />
                </View>
                <Text className="flex-1 font-outfit-bold" style={{ ...TYPE.cardTitle, color: OS.text }}>{t(`${k}.rateTitle`)}</Text>
            </View>
            <Text className="font-outfit-regular px-4 pt-1.5 pb-4" style={{ fontSize: 14, lineHeight: 20, color: OS.muted }}>{t(`${k}.rateBody`)}</Text>
            <View className="px-4 pb-4">
                {visit.clientRating ? (
                    <View className="flex-row items-center gap-2.5 px-3.5 py-3 rounded-xl" style={{ backgroundColor: OS.greenSoft }}>
                        <Ionicons name="checkmark-circle" size={20} color={OS.green} />
                        <Text className="flex-1 font-outfit-bold" style={{ fontSize: 14, lineHeight: 20, color: OS.greenDark }}>
                            {t(`${k}.rateDone`, { rating: visit.clientRating })}
                        </Text>
                    </View>
                ) : (
                    <>
                        <View className="flex-row justify-center gap-2" style={{ marginBottom: 14 }}>
                            {[1, 2, 3, 4, 5].map((n) => (
                                <TouchableOpacity key={n} onPress={() => setRating(n)} testID={`closeout-rate-${n}`} className="p-0.5">
                                    <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={30} color={n <= rating ? OS.orange : '#C5CEE3'} />
                                </TouchableOpacity>
                            ))}
                        </View>
                        <NoteInput value={comment} onChangeText={setComment} placeholder={t(`${k}.ratePh`)} white />
                        <TouchableOpacity
                            onPress={() => void submit()}
                            disabled={!rating || sending}
                            className="items-center justify-center mt-3"
                            style={{ minHeight: 52, borderRadius: 14, backgroundColor: rating && !sending ? OS.blue : OS.blueIce }}
                        >
                            {sending ? <ActivityIndicator color="#FFFFFF" /> : (
                                <Text className="text-white font-outfit-bold" style={{ fontSize: 16, lineHeight: 22 }}>{t(`${k}.rateSubmit`)}</Text>
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
    const items = [
        { label: t(`${k}.itemDiagnosis`), done: visit.obdStatus === 'ready' || visit.obdStatus === 'manual' },
        // Resolved visits are charged on the owner's confirmation, not on close.
        ...(() => {
            const stage = onSiteConfirmationStage(visit);
            if (stage === null) return [{ label: t(`${k}.itemPayment`), done: !!visit.closedAt }];
            return [{ label: t(`${k}.itemOwnerConfirmation`), done: stage === 'confirmed' || stage === 'captured' }];
        })(),
        ...(visit.ownerReviewSubmitted ? [{ label: t(`${k}.itemReviewReceived`), done: true }] : []),
    ];
    const doneCount = items.filter((i) => i.done).length;
    return (
        <Card>
            <View className="flex-row items-center justify-between px-4 py-3.5" style={{ borderBottomWidth: 1, borderBottomColor: OS.borderSoft }}>
                <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, lineHeight: 22, color: OS.text }}>{t(`${k}.checklistTitle`)}</Text>
                <Text className="font-outfit-bold" style={{ fontSize: 14, color: OS.muted }}>{doneCount}/{items.length}</Text>
            </View>
            {items.map((it, i) => (
                <View
                    key={it.label}
                    className="flex-row items-center gap-3 px-4 py-3.5"
                    style={i < items.length - 1 ? { borderBottomWidth: 1, borderBottomColor: OS.borderSoft } : undefined}
                >
                    <View className="items-center justify-center" style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: it.done ? OS.greenSoft : OS.borderSoft }}>
                        {it.done ? <Ionicons name="checkmark" size={14} color={OS.green} /> : <Ionicons name="time-outline" size={14} color={OS.mutedLight} />}
                    </View>
                    <Text className="flex-1 font-outfit-medium" style={{ fontSize: 16, lineHeight: 22, color: it.done ? OS.text : OS.muted }}>{it.label}</Text>
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
                <Hero redirected={visit.outcome === 'redirected'} stage={onSiteConfirmationStage(visit)} />
                <Payout visit={visit} />
                <Checklist visit={visit} />
                <RateOwner visit={visit} onVisit={onVisit} />
                <FinalReportCard appointmentId={visit.appointmentId} />
                {obdPending ? (
                    <View className="mt-5">
                        <Text className="font-outfit-bold mx-5" style={{ ...TYPE.cardTitle, color: OS.text }}>{t(`${k}.obdTitle`)}</Text>
                        <ObdPanel appointmentId={visit.appointmentId} visit={visit} onVisit={onVisit} />
                    </View>
                ) : null}
                <Text className="font-outfit-regular text-center mx-5 mt-5" style={{ fontSize: 14, lineHeight: 20, color: visit.closeoutCompletedAt ? OS.greenDark : OS.muted }}>
                    {visit.closeoutCompletedAt ? t(`${k}.footerClosed`) : t(`${k}.footer`)}
                </Text>
                {/* Part of the page, not a fixed bar: nothing here is required to leave. */}
                <View className="flex-row mx-4 mt-4 mb-6">
                    <PrimaryButton label={t(`${k}.back`)} onPress={onBackToDashboard} testID="closeout-back" />
                </View>
            </Body>
        </>
    );
}
