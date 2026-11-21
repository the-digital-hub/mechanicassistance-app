import { RatingFields } from '@/components/reviews/RatingFields';
import { CLIENT_REVIEW_TAGS } from '@/lib/reviews/tags';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { onSiteConfirmationStage, onSiteDAO, OnSiteConfirmationStage, OnSiteVisit } from '@/lib/dao/OnSiteDAO';
import { FinalReportCard } from './FinalReportActions';
import { ObdPanel } from './ObdPanel';
import { SlideModal } from '@/components/ui/SlideModal';
import { SHEET } from '@/lib/ui/sheet';
import { Body, Card, NoteInput, OnSiteDialog, OS, PrimaryButton, cardShadow } from './ui';
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
    const [tags, setTags] = React.useState<string[]>([]);
    const [sending, setSending] = React.useState(false);
    const [sheet, setSheet] = React.useState(false);

    const submit = async () => {
        setSending(true);
        try {
            await onSiteDAO.reviewClient(visit.appointmentId, rating, comment.trim() || undefined, tags);
            const fresh = await onSiteDAO.get(visit.appointmentId);
            if (fresh) onVisit(fresh);
            setSheet(false);
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
                    <TouchableOpacity
                        onPress={() => setSheet(true)}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        className="items-center justify-center"
                        style={{ minHeight: 52, borderRadius: 14, backgroundColor: OS.blue }}
                        testID="closeout-rate-open"
                    >
                        <Text className="text-white font-outfit-bold" style={{ fontSize: 16, lineHeight: 22 }}>{t(`${k}.rateButton`)}</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* The rating opens from below, over the close-out. */}
            <SlideModal visible={sheet} onClose={() => setSheet(false)} avoidKeyboard>
                <View style={{ ...SHEET, maxHeight: '90%', paddingTop: 16 }} testID="closeout-rate-sheet">
                    <View className="flex-row items-center justify-between px-5 pb-2">
                        <Text className="font-outfit-bold" style={{ fontSize: 22, letterSpacing: -0.4, color: OS.text }}>{t(`${k}.rateTitle`)}</Text>
                        <TouchableOpacity onPress={() => setSheet(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" className="items-center justify-center" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#EEF1F6' }}>
                            <Ionicons name="close" size={16} color="#4B5563" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
                        <RatingFields
                            rating={rating}
                            onRating={setRating}
                            tags={tags}
                            onTags={setTags}
                            options={CLIENT_REVIEW_TAGS.map((tag) => ({ value: tag, label: t(`reviews.clientTags.${tag}`) }))}
                            tagsTitle={t('appointments.clientReview.experience')}
                            comment={comment}
                            onComment={setComment}
                            commentPlaceholder={t(`${k}.ratePh`)}
                            starSize={30}
                            testIDPrefix="closeout-rate"
                        />
                        <TouchableOpacity
                            onPress={() => void submit()}
                            disabled={!rating || sending}
                            className="items-center justify-center mt-4"
                            style={{ minHeight: 52, borderRadius: 14, backgroundColor: rating && !sending ? OS.blue : OS.blueIce }}
                            testID="closeout-rate-submit"
                        >
                            {sending ? <ActivityIndicator color="#FFFFFF" /> : (
                                <Text className="text-white font-outfit-bold" style={{ fontSize: 16, lineHeight: 22 }}>{t(`${k}.rateSubmit`)}</Text>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </SlideModal>
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

// ─────────── How long the customer has to confirm ───────────
/** The customer's time to confirm, live, so the technician knows when the service confirms by itself. */
function ConfirmWindow({ deadline }: { deadline: string }) {
    const { t } = useTranslation();
    const k = 'appointments.closeout';
    const fmt = useFormatters();
    const [now, setNow] = React.useState(() => Date.now());
    React.useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(id);
    }, []);
    const end = Date.parse(deadline);
    if (!Number.isFinite(end)) return null;
    const minutesLeft = Math.max(0, Math.ceil((end - now) / 60000));
    const days = Math.floor(minutesLeft / 1440);
    const hours = Math.floor((minutesLeft % 1440) / 60);
    const minutes = minutesLeft % 60;
    const left = minutesLeft <= 0
        ? null
        : days > 0
            ? t(`${k}.confirmWindowDays`, { days, hours })
            : hours > 0
                ? t(`${k}.confirmWindowHours`, { hours, minutes })
                : t(`${k}.confirmWindowMinutes`, { minutes });
    return (
        <View className="mx-4 mt-3.5 flex-row items-start" style={[cardShadow, { gap: 12, padding: 16, backgroundColor: OS.orangeSoft }]} testID="confirm-window">
            <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF' }}>
                <Ionicons name="hourglass-outline" size={24} color={OS.orange} />
            </View>
            <View className="flex-1">
                <Text className="font-outfit-semibold uppercase" style={{ fontSize: 13, lineHeight: 17, letterSpacing: 0.6, color: OS.orangeText }}>{t(`${k}.confirmWindowTitle`)}</Text>
                <Text className="font-outfit-bold" style={{ fontSize: 26, lineHeight: 32, letterSpacing: -0.5, color: OS.text, marginTop: 2 }}>
                    {left ? t(`${k}.confirmWindowLeft`, { time: left }) : t(`${k}.confirmWindowDue`)}
                </Text>
                {left ? (
                    <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: OS.orangeText, marginTop: 4 }}>
                        {t(`${k}.confirmWindowNote`, { date: fmt.date(deadline), time: fmt.time(deadline) })}
                    </Text>
                ) : null}
            </View>
        </View>
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
    // Not a form in the page: an alert asks for it once, the upload opens from below, and "later" goes to the dashboard.
    const [obdAlert, setObdAlert] = React.useState(obdPending);
    const [obdSheet, setObdSheet] = React.useState(false);
    const stage = onSiteConfirmationStage(visit);
    const stillNoReport = visit.obdStatus === 'none' || visit.obdStatus === 'failed';

    return (
        <>
            <Body>
                <Hero redirected={visit.outcome === 'redirected'} stage={stage} />
                {/* The rating of the customer is part of closing the job: right under the result, not buried below the payout and the checklist. */}
                <RateOwner visit={visit} onVisit={onVisit} />
                {stage === 'awaiting' && visit.confirmDeadline ? <ConfirmWindow deadline={visit.confirmDeadline} /> : null}
                <Payout visit={visit} />
                <Checklist visit={visit} />
                <FinalReportCard appointmentId={visit.appointmentId} />
                {stillNoReport && !obdAlert ? (
                    <TouchableOpacity
                        onPress={() => setObdSheet(true)}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        className="mx-4 mt-3.5 flex-row items-center"
                        style={{ gap: 12, padding: 14, borderRadius: 18, backgroundColor: OS.blueSofter, borderWidth: 1, borderColor: OS.blueSoft }}
                        testID="obd-pending-row"
                    >
                        <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFFFFF' }}>
                            <Ionicons name="document-text-outline" size={22} color={OS.blue} />
                        </View>
                        <Text className="flex-1 font-outfit-bold" style={{ fontSize: 16, lineHeight: 22, color: OS.text }}>{t(`${k}.obdPendingRow`)}</Text>
                        <Text className="font-outfit-bold" style={{ fontSize: 15, color: OS.blue }}>{t(`${k}.obdPendingAction`)}</Text>
                    </TouchableOpacity>
                ) : null}
                <Text className="font-outfit-regular text-center mx-5 mt-5" style={{ fontSize: 14, lineHeight: 20, color: visit.closeoutCompletedAt ? OS.greenDark : OS.muted }}>
                    {visit.closeoutCompletedAt ? t(`${k}.footerClosed`) : t(`${k}.footer`)}
                </Text>
                {/* Part of the page, not a fixed bar: nothing here is required to leave. */}
                <View className="flex-row mx-4 mt-4 mb-6">
                    <PrimaryButton label={t(`${k}.back`)} onPress={onBackToDashboard} testID="closeout-back" />
                </View>
            </Body>

            <OnSiteDialog
                visible={obdAlert}
                tone="blue"
                icon="document-text-outline"
                title={t(`${k}.obdAlertTitle`)}
                body={t(`${k}.obdAlertBody`)}
                primaryLabel={t(`${k}.obdAlertNow`)}
                onPrimary={() => { setObdAlert(false); setObdSheet(true); }}
                secondaryLabel={t(`${k}.obdAlertLater`)}
                onSecondary={() => { setObdAlert(false); onBackToDashboard(); }}
                onDismiss={() => setObdAlert(false)}
                testID="obd-alert"
            />

            <SlideModal visible={obdSheet} onClose={() => setObdSheet(false)} avoidKeyboard>
                <View style={{ ...SHEET, maxHeight: '88%', paddingTop: 16 }} testID="obd-sheet">
                    <View className="flex-row items-center justify-between px-5 pb-2">
                        <Text className="font-outfit-bold" style={{ fontSize: 22, letterSpacing: -0.4, color: OS.text }}>{t(`${k}.obdTitle`)}</Text>
                        <TouchableOpacity onPress={() => setObdSheet(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" className="items-center justify-center" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#EEF1F6' }}>
                            <Ionicons name="close" size={16} color="#4B5563" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 34 }}>
                        <ObdPanel appointmentId={visit.appointmentId} visit={visit} onVisit={onVisit} />
                    </ScrollView>
                </View>
            </SlideModal>
        </>
    );
}
