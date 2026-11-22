import { CountdownBlocks } from '@/components/ui/ConfirmCountdown';
import { RatingFields } from '@/components/reviews/RatingFields';
import { CLIENT_REVIEW_TAGS } from '@/lib/reviews/tags';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, Platform, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardSheetScroll } from '@/components/ui/KeyboardSheetScroll';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
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

function Hero({ redirected, stage, deadline, requestCode }: { redirected: boolean; stage: OnSiteConfirmationStage | null; /** While waiting for the owner: when the service confirms by itself. */ deadline?: string | null; /** The assistance this result is about (`AS-4H8TX2`). */ requestCode?: string | null }) {
    const { t, i18n } = useTranslation();
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
            {requestCode ? (
                <Text className="font-outfit-semibold text-center" style={{ fontSize: 13, lineHeight: 18, color: OS.muted, marginTop: 6 }} selectable testID="closeout-request-code">
                    {t(`${k}.assistanceCode`, { code: requestCode })}
                </Text>
            ) : null}
            {/* Waiting for the owner: the time left lives in this same card, not in a block of its own. */}
            {!redirected && stage === 'awaiting' && deadline && Date.parse(deadline) > Date.now() ? (
                <View className="items-center" style={{ marginTop: 14, gap: 8 }} testID="confirm-window">
                    <CountdownBlocks deadline={deadline} tone="amber" />
                    <Text className="font-outfit-regular text-center" style={{ fontSize: 13, lineHeight: 18, color: OS.muted }}>
                        {t('appointments.onSiteConfirm.autoConfirmShort', {
                            date: new Date(deadline).toLocaleDateString(i18n.language, { weekday: 'short', month: 'short', day: 'numeric' }),
                            time: new Date(deadline).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' }),
                        })}
                    </Text>
                </View>
            ) : null}
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
            <View className="flex-row items-center mt-3" style={{ gap: 12, padding: 12, borderRadius: 14, backgroundColor: status.bg }} testID="payout-status">
                <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: '#FFFFFF' }}>
                    <Ionicons name={status.icon} size={19} color={status.fg} />
                </View>
                <View className="flex-1">
                    <Text className="font-outfit-bold" style={{ fontSize: 16, lineHeight: 22, color: status.fg }}>{status.title}</Text>
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
    const { height: windowHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const keyboard = useKeyboardHeight();
    // The sheet fits in what is left above the keyboard: its body scrolls and the send button stays in view under it.
    const sheetMax = windowHeight - (Platform.OS === 'ios' ? keyboard : 0) - insets.top - 12;

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
            <View style={{ height: 12 }} />
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
                <View style={{ ...SHEET, maxHeight: sheetMax, paddingTop: 16 }} testID="closeout-rate-sheet">
                    <View className="flex-row items-center justify-between px-5 pb-2">
                        <Text className="font-outfit-bold" style={{ fontSize: 22, letterSpacing: -0.4, color: OS.text }}>{t(`${k}.rateTitle`)}</Text>
                        <TouchableOpacity onPress={() => setSheet(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" className="items-center justify-center" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#EEF1F6' }}>
                            <Ionicons name="close" size={16} color="#4B5563" />
                        </TouchableOpacity>
                    </View>
                    <KeyboardSheetScroll style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}>
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
                    </KeyboardSheetScroll>
                    <View style={{ paddingHorizontal: 20, paddingBottom: 34, paddingTop: 4 }}>
                        <TouchableOpacity
                            onPress={() => void submit()}
                            disabled={!rating || sending}
                            className="items-center justify-center"
                            style={{ minHeight: 52, borderRadius: 14, backgroundColor: rating && !sending ? OS.blue : OS.blueIce }}
                            testID="closeout-rate-submit"
                        >
                            {sending ? <ActivityIndicator color="#FFFFFF" /> : (
                                <Text className="text-white font-outfit-bold" style={{ fontSize: 16, lineHeight: 22 }}>{t(`${k}.rateSubmit`)}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </SlideModal>
        </Card>
    );
}

// ─────────── Screen ───────────
export function ScreenCloseout({ visit, onVisit, onBackToDashboard, requestCode }: {
    visit: OnSiteVisit;
    /** The assistance's short code, shown with the result so it is clear what it refers to. */
    requestCode?: string | null;
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
                {/* Result on top (with the time left while the owner has not confirmed), then rating the owner, then the payout. */}
                <Hero redirected={visit.outcome === 'redirected'} stage={stage} deadline={visit.confirmDeadline} requestCode={requestCode} />
                <RateOwner visit={visit} onVisit={onVisit} />
                <Payout visit={visit} />
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
                {visit.closeoutCompletedAt ? (
                    <Text className="font-outfit-regular text-center mx-5 mt-5" style={{ fontSize: 14, lineHeight: 20, color: OS.greenDark }}>{t(`${k}.footerClosed`)}</Text>
                ) : null}
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
