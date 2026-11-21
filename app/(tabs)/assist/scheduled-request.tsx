import { FLOATING_FOOTER } from '@/lib/ui/floatingFooter';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ban, Calendar, Car, Check, Clock, Hourglass, Lock, MessageSquare, Send, ShieldCheck, Wrench, type LucideIcon } from 'lucide-react-native';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { CARD_STYLE, Note, SC, StepHead, TextField, WizardHeader } from '@/components/scheduled/ui';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import type { MarketplaceRequest } from '@/lib/dao/interfaces';
import { parseAttachments } from '@/lib/media/attachments';
import { apiErrorCode } from '@/lib/payments/cardRequired';
import { declineRequest } from '@/lib/scheduled/declined';
import { dateFromKey, formatMinutes } from '@/lib/scheduled/draft';
import { money, parseSentQuote, splitQuoteDescription } from '@/lib/scheduled/offers';
import { refLabel } from '@/lib/refCode';
import {
    amountOf,
    arrivalTimes,
    buildQuoteOffer,
    distanceLabel,
    DURATIONS,
    offerSubmitProblem,
    parseRequestNotes,
    quoteProblem,
    quoteTotals,
    requestDays,
    vehicleLabel,
    WARRANTIES,
    type QuoteDraft,
} from '@/lib/scheduled/provider';

type ViewId = 'details' | 'quote' | 'review' | 'sent' | 'decline' | 'declined' | 'awarded' | 'notselected' | 'closed';

const DECLINE_REASONS = ['far', 'dates', 'services', 'other'] as const;
const BORDER = '#E4EAF5';

/** Provider side of a scheduled request, as in the design: details → quote → review → sent, plus the outcomes. */
export default function ScheduledRequestScreen() {
    const { t, i18n } = useTranslation();
    const router = useRouter();
    const { requestId } = useLocalSearchParams<{ requestId: string }>();

    const [request, setRequest] = useState<MarketplaceRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [view, setView] = useState<ViewId>('details');
    const [q, setQ] = useState<QuoteDraft | null>(null);
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [reason, setReason] = useState<(typeof DECLINE_REASONS)[number] | null>(null);
    const [sentTotal, setSentTotal] = useState<number | null>(null);

    const notes = useMemo(() => parseRequestNotes(request?.notes, request?.date), [request]);
    const days = useMemo(() => requestDays(notes.days, request?.date), [notes.days, request?.date]);
    const times = useMemo(() => arrivalTimes(notes.window), [notes.window]);

    /** A quote to start from: every requested service on, nothing priced, the first arrival that is still ahead. */
    const blankQuote = useCallback((r: MarketplaceRequest): QuoteDraft => {
        const n = parseRequestNotes(r.notes, r.date);
        const ds = requestDays(n.days, r.date);
        const ts = arrivalTimes(n.window);
        const names = (r.services ?? []).map((s) => s.name).filter(Boolean);
        const today = new Date();
        const dayKey = ds[0] ?? '';
        const firstAhead = ts.find((m) => {
            if (!dayKey) return false;
            const d = dateFromKey(dayKey);
            d.setHours(Math.floor(m / 60), m % 60, 0, 0);
            return d.getTime() > today.getTime();
        });
        return {
            lines: (names.length ? names : [r.title || t('scheduledProvider.title')]).map((name) => ({ name, on: true, price: '' })),
            partsIncluded: true,
            travelFee: '',
            day: dayKey,
            time: firstAhead ?? ts[0] ?? null,
            durationId: '2h',
            warrantyId: '90d',
            message: '',
        };
    }, [t]);

    const load = useCallback(async () => {
        if (!requestId) return;
        try {
            const r = await assistanceDAO.getMarketplaceRequest(requestId);
            setRequest(r);
            setFailed(false);
            setQ((prev) => prev ?? (r ? blankQuote(r) : null));
            const status = r?.myOffer?.status;
            setView((cur) => {
                if (cur !== 'details') return cur;
                if (!r) return 'closed';
                if (status === 'accepted') return 'awarded';
                if (status === 'not_selected') return 'notselected';
                if (status === 'expired' || status === 'withdrawn') return 'closed';
                if (status === 'submitted') return 'sent';
                return cur;
            });
        } catch (error) {
            console.error('Failed to load the scheduled request:', error);
            setFailed(true);
        } finally {
            setLoading(false);
        }
    }, [requestId, blankQuote]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const toRequests = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/assist'));

    const TITLES: Record<ViewId, string> = {
        details: t('scheduledProvider.titles.details'),
        quote: t('scheduledProvider.titles.quote'),
        review: t('scheduledProvider.titles.review'),
        sent: t('scheduledProvider.titles.sent'),
        decline: t('scheduledProvider.titles.decline'),
        declined: t('scheduledProvider.titles.declined'),
        awarded: t('scheduledProvider.titles.awarded'),
        notselected: t('scheduledProvider.titles.closed'),
        closed: t('scheduledProvider.titles.closed'),
    };
    const BACK: Partial<Record<ViewId, ViewId>> = { quote: 'details', review: 'quote', decline: 'details' };
    const onBack = () => {
        setNotice(null);
        const prev = BACK[view];
        if (prev) setView(prev);
        else toRequests();
    };
    const header = <WizardHeader title={TITLES[view]} onBack={onBack} />;

    const patch = (p: Partial<QuoteDraft>) => setQ((cur) => (cur ? { ...cur, ...p } : cur));
    const setLine = (i: number, p: Partial<QuoteDraft['lines'][number]>) =>
        setQ((cur) => (cur ? { ...cur, lines: cur.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) } : cur));

    const send = async () => {
        if (!requestId || !q || busy) return;
        setBusy(true);
        setNotice(null);
        try {
            await assistanceDAO.submitOffer(requestId, buildQuoteOffer(q));
            setSentTotal(quoteTotals(q).total);
            setView('sent');
            setConfirmed(false);
            void load();
        } catch (error) {
            const kind = offerSubmitProblem(apiErrorCode(error));
            if (kind === 'closed') {
                setView('closed');
                return;
            }
            setNotice(kind === 'generic' ? t('scheduledProvider.errors.generic') : t(`scheduledProvider.errors.${kind}`, { defaultValue: t(`scheduledProvider.problems.${kind}.body`) }));
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                {header}
                <View className="flex-1 items-center justify-center"><ActivityIndicator color={SC.blue} /></View>
            </View>
        );
    }

    if (!request || !q) {
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                {header}
                <Outcome icon={Hourglass} tone="amber" title={failed ? t('scheduledProvider.errors.loadTitle') : t('scheduledProvider.expired.title')} sub={failed ? t('scheduledProvider.errors.load') : t('scheduledProvider.expired.sub')} footer={<Primary label={t('scheduledProvider.back')} onPress={toRequests} />} />
            </View>
        );
    }

    const services = request.services ?? [];
    const photos = parseAttachments(request.photos);
    const closes = request.offersCloseAt ? new Date(request.offersCloseAt) : null;
    const hoursLeft = closes ? Math.max(0, Math.round((closes.getTime() - Date.now()) / 3600000)) : null;
    const closesLabel = closes && !isNaN(closes.getTime())
        ? closes.toLocaleString(i18n.language, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : '—';
    const vehicle = vehicleLabel(request);
    const dist = distanceLabel(request.distanceMiles);
    const whenLabel = notes.days || (request.date ? new Date(request.date).toLocaleDateString(i18n.language, { weekday: 'short', month: 'short', day: 'numeric' }) : '');
    const mine = request.myOffer;
    const totals = quoteTotals(q);
    const problem = quoteProblem(q);
    const dayLabel = (key: string) => dateFromKey(key).toLocaleDateString(i18n.language, { weekday: 'short', month: 'short', day: 'numeric' });
    const sentSplit = splitQuoteDescription(mine?.description);
    const sent = parseSentQuote(mine?.description);
    const sentMinutes = mine?.proposedStart && mine?.proposedEnd
        ? Math.round((Date.parse(mine.proposedEnd) - Date.parse(mine.proposedStart)) / 60000)
        : null;
    const sentDuration = sentMinutes && sentMinutes > 0 ? `${+(sentMinutes / 60).toFixed(1)} h` : '—';
    const sentPrice = mine?.price ? amountOf(String(mine.price)) : sentTotal;
    const slotOf = (iso?: string | null) => {
        const d = iso ? new Date(iso) : null;
        return d && !isNaN(d.getTime())
            ? `${d.toLocaleDateString(i18n.language, { weekday: 'short', month: 'short', day: 'numeric' })} · ${formatMinutes(d.getHours() * 60 + d.getMinutes())}`
            : '—';
    };

    /** Editing a sent quote starts from what was sent. */
    const editSent = () => {
        if (mine && request) {
            const base = blankQuote(request);
            const lines = base.lines.map((l) => {
                const item = sentSplit.items.find((i) => i.name === l.name);
                return item ? { ...l, on: item.quoted, price: item.quoted && item.total ? item.total.toFixed(2) : '' } : l;
            });
            const travel = sentSplit.items.find((i) => i.name === 'Travel fee');
            setQ({ ...base, lines, travelFee: travel?.total ? travel.total.toFixed(2) : '', warrantyId: WARRANTIES.find((w) => w.days === mine.warrantyDays)?.id ?? base.warrantyId });
        }
        setView('quote');
    };

    // ───────────── Outcomes ─────────────
    if (view === 'declined') {
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                {header}
                <Outcome icon={Check} title={t('scheduledProvider.declined.title')} sub={t('scheduledProvider.declined.sub')} footer={<Primary label={t('scheduledProvider.back')} onPress={toRequests} />} />
            </View>
        );
    }
    if (view === 'awarded') {
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                {header}
                <Outcome icon={Check} tone="green" title={t('scheduledProvider.awarded.title')} sub={t('scheduledProvider.awarded.sub')} footer={<Primary tone="green" label={t('scheduledProvider.awarded.cta')} onPress={() => router.replace('/(tabs)/appointments')} />}>
                    <KV rows={[[t('scheduledProvider.sentRows.arrival'), slotOf(mine?.proposedStart)], [t('scheduledProvider.sentRows.quote'), money(mine?.price)], [t('scheduledProvider.awarded.payment'), t('scheduledProvider.awarded.paymentValue')]]} />
                </Outcome>
            </View>
        );
    }
    if (view === 'notselected') {
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                {header}
                <Outcome icon={Ban} tone="amber" title={t('scheduledProvider.notSelected.title')} sub={t('scheduledProvider.notSelected.sub')} footer={<Primary label={t('scheduledProvider.back')} onPress={toRequests} />}>
                    <Note>{t('scheduledProvider.notSelected.tip')}</Note>
                </Outcome>
            </View>
        );
    }
    if (view === 'closed') {
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                {header}
                <Outcome icon={Hourglass} tone="amber" title={mine?.status === 'withdrawn' ? t('scheduledProvider.withdrawn.title') : t('scheduledProvider.expired.title')} sub={mine?.status === 'withdrawn' ? t('scheduledProvider.withdrawn.sub') : t('scheduledProvider.expired.sub')} footer={<Primary label={t('scheduledProvider.back')} onPress={toRequests} />}>
                    <KV rows={[[t('scheduledProvider.expired.closed'), closesLabel], [t('scheduledProvider.expired.request'), refLabel(request.refCode, request.id)]]} />
                </Outcome>
            </View>
        );
    }
    if (view === 'sent') {
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                {header}
                <Outcome
                    icon={Send}
                    title={t('scheduledProvider.sent.title')}
                    sub={t('scheduledProvider.sent.sub')}
                    footer={
                        <View style={{ gap: 10 }}>
                            <Primary label={t('scheduledProvider.back')} onPress={toRequests} />
                            <Ghost label={t('scheduledProvider.sent.edit')} onPress={editSent} outlined />
                        </View>
                    }
                >
                    <View style={{ ...CARD_STYLE, alignSelf: 'stretch', padding: 14 }}>
                        <View className="flex-row items-center justify-between">
                            <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1.2, color: SC.muted }}>{t('scheduledProvider.sent.yourQuote')}</Text>
                            <Pill bg={SC.amberSoft} fg={SC.amberText}>{t('scheduledProvider.sent.waiting')}</Pill>
                        </View>
                        <Text className="font-outfit-bold" style={{ fontSize: 28, letterSpacing: -0.8, color: SC.blueDark, marginTop: 6 }}>{money(sentPrice)}</Text>
                        {sentSplit.items.length > 0 ? (
                            <Text className="font-outfit-regular" style={{ fontSize: 13, color: SC.muted, marginTop: 2 }}>
                                {t('scheduledProvider.sent.servicesCount', { quoted: sentSplit.items.filter((i) => i.quoted && i.name !== 'Travel fee').length, total: sentSplit.items.filter((i) => i.name !== 'Travel fee').length })}
                            </Text>
                        ) : null}
                        {sentSplit.items.length > 0 ? (
                            <View style={{ marginTop: 12, paddingTop: 4, borderTopWidth: 1, borderTopColor: SC.borderSoft }}>
                                {sentSplit.items.map((item) => (
                                    <View key={item.name} className="flex-row items-center justify-between" style={{ paddingVertical: 8, gap: 12 }}>
                                        <IconBox icon={item.name === 'Travel fee' ? Car : Wrench} size={30} />
                                        <Text className="font-outfit-medium flex-1" style={{ fontSize: 14, color: SC.text }}>{item.name === 'Travel fee' ? t('scheduledProvider.sent.travel') : item.name}</Text>
                                        <Text className="font-outfit-bold" style={{ fontSize: 14, color: item.quoted ? SC.text : SC.muted }}>
                                            {item.quoted ? money(item.total ?? 0) : t('scheduledProvider.sent.notQuoted')}
                                        </Text>
                                    </View>
                                ))}
                                <View className="flex-row items-center justify-between" style={{ paddingTop: 10, marginTop: 2, borderTopWidth: 1, borderTopColor: SC.borderSoft }}>
                                    <Text className="font-outfit-bold" style={{ fontSize: 14, color: SC.text }}>{t('scheduledProvider.sent.total')}</Text>
                                    <Text className="font-outfit-bold" style={{ fontSize: 16, color: SC.blueDark }}>{money(sentPrice)}</Text>
                                </View>
                            </View>
                        ) : null}
                        {sent.message ? (
                            <View className="flex-row" style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: SC.blueSofter, gap: 10 }}>
                                <IconBox icon={MessageSquare} size={30} />
                                <View className="flex-1">
                                    <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1, color: SC.muted }}>{t('scheduledProvider.sent.yourMessage')}</Text>
                                    <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: SC.text, marginTop: 4 }}>{sent.message}</Text>
                                </View>
                            </View>
                        ) : null}
                    </View>
                    <View style={{ alignSelf: 'stretch', borderRadius: 18, backgroundColor: SC.blueSoft, padding: 14 }} className="flex-row items-center">
                        <View className="items-center justify-center" style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFFFFF', marginRight: 12 }}><Clock size={18} color={SC.blue} /></View>
                        <View className="flex-1">
                            <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 0.9, color: SC.blue }}>{t('scheduledProvider.sent.decidesBy')}</Text>
                            <Text className="font-outfit-bold" style={{ fontSize: 17, letterSpacing: -0.3, color: SC.blueDark, marginTop: 2 }}>{closesLabel}</Text>
                            <Text className="font-outfit-semibold" style={{ fontSize: 13, color: SC.muted, marginTop: 3 }}>{t('scheduledProvider.expired.request')} {refLabel(request.refCode, request.id)}</Text>
                        </View>
                    </View>
                    {/* Everything the customer is shown, as it was sent. */}
                    <View style={{ ...CARD_STYLE, alignSelf: 'stretch', overflow: 'hidden' }}>
                        {mine?.proposedStart ? <SummaryRow icon={Calendar} label={t('scheduledProvider.sentRows.arrival')} value={slotOf(mine.proposedStart)} /> : null}
                        {sentMinutes && sentMinutes > 0 ? <SummaryRow icon={Clock} label={t('scheduledProvider.sentRows.duration')} value={sentDuration} /> : null}
                        <SummaryRow
                            icon={ShieldCheck}
                            label={t('scheduledProvider.sentRows.warranty')}
                            value={mine?.warrantyDays ? t('scheduledProvider.days', { count: mine.warrantyDays }) : '—'}
                            sub={mine?.warrantyCoverage || undefined}
                            last={sent.partsIncluded === null && !sent.notIncluded}
                        />
                        {sent.partsIncluded !== null ? (
                            <SummaryRow
                                icon={Wrench}
                                label={t('scheduledProvider.sentRows.parts')}
                                value={sent.partsIncluded ? t('scheduledProvider.review.partsIn') : t('scheduledProvider.review.partsCustomer')}
                                last={!sent.notIncluded}
                            />
                        ) : null}
                        {sent.notIncluded ? <SummaryRow icon={Ban} label={t('scheduledProvider.sentRows.notIncluded')} value={sent.notIncluded} last /> : null}
                    </View>
                    <Note>{t('scheduledProvider.sent.note')}</Note>
                </Outcome>
            </View>
        );
    }
    if (view === 'decline') {
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                {header}
                <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 32, gap: 14 }}>
                    <StepHead eyebrow={t('scheduledProvider.decline.eyebrow')} title={t('scheduledProvider.decline.title')} sub={t('scheduledProvider.decline.sub')} />
                    <View style={{ ...CARD_STYLE, overflow: 'hidden' }} accessibilityRole="radiogroup">
                        {DECLINE_REASONS.map((r, i) => (
                            <TouchableOpacity key={r} onPress={() => setReason(r)} accessibilityRole="radio" accessibilityState={{ selected: reason === r }} className="flex-row items-center" style={{ padding: 16, gap: 12, borderBottomWidth: i < DECLINE_REASONS.length - 1 ? 1 : 0, borderBottomColor: SC.borderSoft, backgroundColor: reason === r ? SC.blueSofter : '#FFFFFF' }}>
                                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: reason === r ? 6 : 1.5, borderColor: reason === r ? SC.blue : BORDER, backgroundColor: '#FFFFFF' }} />
                                <Text className="font-outfit-bold" style={{ fontSize: 14, color: SC.text }}>{t(`scheduledProvider.decline.reasons.${r}`)}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
                <ActionBar>
                    <Primary label={t('scheduledProvider.decline.action')} disabled={!reason} onPress={async () => { await declineRequest(request.id); setView('declined'); }} />
                    <Ghost label={t('scheduledProvider.decline.cancel')} onPress={() => setView('details')} />
                </ActionBar>
            </View>
        );
    }

    // ───────────── 2 · Build the quote ─────────────
    if (view === 'quote' || view === 'review') {
        const inputStyle = { height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: BORDER, paddingLeft: 28, paddingRight: 12, fontSize: 16, color: SC.text, backgroundColor: '#FFFFFF' } as const;
        const money2 = (value: string, onChange: (v: string) => void, label: string) => (
            <View>
                <Text style={{ position: 'absolute', left: 12, top: 0, height: 46, lineHeight: 46, zIndex: 1, fontSize: 16, color: SC.muted }}>$</Text>
                <TextInput
                    accessibilityLabel={label}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={SC.mutedLight}
                    value={value}
                    onChangeText={(v) => onChange(cleanAmount(v))}
                    onBlur={() => onChange(value === '' || value === '.' ? '' : amountOf(value).toFixed(2))}
                    className="font-outfit-bold"
                    style={inputStyle}
                />
            </View>
        );
        const slotDay = q.day ? dayLabel(q.day) : '—';
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                {header}
                <Steps step={view === 'quote' ? 1 : 2} labels={[t('scheduledProvider.quote.stepPrice'), t('scheduledProvider.quote.stepReview')]} />
                <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    {view === 'quote' ? (
                        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: 18, gap: 14 }}>
                            <StepHead eyebrow={t('scheduledProvider.quote.eyebrow1')} title={t('scheduledProvider.quote.title')} sub={t('scheduledProvider.quote.sub')} />

                            <View style={{ ...CARD_STYLE, overflow: 'hidden' }}>
                                <SummaryRow icon={Calendar} label={t('scheduledProvider.quote.request')} value={t('scheduledProvider.scheduledAssistance')} sub={`ID: ${refLabel(request.refCode, request.id)}`} />
                                <SummaryRow icon={Wrench} label={t('scheduledProvider.quote.needed')} value={q.lines.map((l) => l.name).join(' · ')} />
                                <SummaryRow icon={Car} label={t('scheduledProvider.vehicle')} value={vehicle} sub={request.vehicle?.vin ? `VIN ${request.vehicle.vin}` : undefined} last />
                            </View>

                            <View style={{ paddingHorizontal: 4 }}>
                                <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1.2, color: SC.muted }}>{t('scheduledProvider.quote.servicesPrices')}</Text>
                                <Text className="font-outfit-regular" style={{ fontSize: 13, lineHeight: 19, color: SC.muted, marginTop: 4 }}>{t('scheduledProvider.quote.servicesHint')}</Text>
                            </View>
                            {q.lines.map((l, i) => (
                                <View key={`${l.name}-${i}`} style={{ ...CARD_STYLE, padding: 14 }}>
                                    <View className="flex-row items-center" style={{ gap: 12 }}>
                                        <View className="flex-1">
                                            <Text className="font-outfit-bold" style={{ fontSize: 15, color: l.on ? SC.text : SC.muted }}>{l.name}</Text>
                                            <Text className="font-outfit-regular" style={{ fontSize: 13, color: SC.muted, marginTop: 2 }}>{l.on ? t('scheduledProvider.quote.canDo') : t('scheduledProvider.quote.cantDo')}</Text>
                                        </View>
                                        <Switch on={l.on} label={t('scheduledProvider.quote.quoteService', { name: l.name })} onChange={(on) => setLine(i, { on })} />
                                    </View>
                                    {notes.serviceNotes[l.name] ? (
                                        <Text className="font-outfit-regular" style={{ fontSize: 13, lineHeight: 18, color: SC.muted, marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: SC.blueSofter }}>{t('scheduledProvider.customerNote', { note: notes.serviceNotes[l.name] })}</Text>
                                    ) : null}
                                    {l.on ? <View style={{ marginTop: 12 }}>{money2(l.price, (price) => setLine(i, { price }), t('scheduledProvider.quote.priceOf', { name: l.name }))}</View> : null}
                                </View>
                            ))}

                            {totals.notIncluded.length > 0 && totals.priced.length > 0 ? (
                                <Note tone="amber"><Text className="font-outfit-bold">{t('scheduledProvider.quote.partialTitle')} </Text>{t('scheduledProvider.quote.partialBody', { list: totals.notIncluded.join(', ') })}</Note>
                            ) : null}

                            <View style={{ ...CARD_STYLE, paddingHorizontal: 14 }}>
                                <View className="flex-row items-center" style={{ gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: SC.borderSoft }}>
                                    <View className="flex-1">
                                        <Text className="font-outfit-bold" style={{ fontSize: 14, color: SC.text }}>{t('scheduledProvider.quote.parts')}</Text>
                                        <Text className="font-outfit-regular" style={{ fontSize: 13, color: SC.muted, marginTop: 2 }}>{t('scheduledProvider.quote.partsHint')}</Text>
                                    </View>
                                    <Switch on={q.partsIncluded} label={t('scheduledProvider.quote.parts')} onChange={(partsIncluded) => patch({ partsIncluded })} />
                                </View>
                                <View style={{ paddingVertical: 12 }}>
                                    <Text className="font-outfit-bold" style={{ fontSize: 14, color: SC.text }}>{t('scheduledProvider.quote.travel')} <Text className="font-outfit-regular" style={{ color: SC.mutedLight }}>{t('scheduledProvider.optional')}</Text></Text>
                                    <View style={{ marginTop: 8 }}>{money2(q.travelFee, (travelFee) => patch({ travelFee }), t('scheduledProvider.quote.travel'))}</View>
                                </View>
                            </View>

                            <SectionLabel>{t('scheduledProvider.quote.arriveTitle')}</SectionLabel>
                            <View style={{ ...CARD_STYLE, padding: 14 }}>
                                <View style={{ marginBottom: 14, padding: 12, borderRadius: 14, backgroundColor: SC.blueSofter, gap: 8 }}>
                                    <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 0.8, color: SC.muted }}>{t('scheduledProvider.quote.customerAvailable')}</Text>
                                    <View className="flex-row items-center" style={{ gap: 10 }}>
                                        <IconBox icon={Calendar} size={30} />
                                        <Text className="font-outfit-bold flex-1" style={{ fontSize: 15, color: SC.text }}>{whenLabel || '—'}</Text>
                                    </View>
                                    {notes.window ? (
                                        <View className="flex-row items-center" style={{ gap: 10 }}>
                                            <IconBox icon={Clock} size={30} />
                                            <Text className="font-outfit-bold" style={{ fontSize: 15, color: SC.text }}>{notes.window}</Text>
                                        </View>
                                    ) : null}
                                </View>
                                <Text className="font-outfit-bold" style={{ fontSize: 15, color: SC.text }}>{t('scheduledProvider.quote.setArrival')}</Text>
                                <Text className="font-outfit-regular" style={{ fontSize: 13, lineHeight: 19, color: SC.muted, marginTop: 3, marginBottom: 14 }}>{t('scheduledProvider.quote.setArrivalHint')}</Text>
                                <Text className="font-outfit-bold" style={{ fontSize: 13, color: SC.muted, marginBottom: 8 }}>{t('scheduledProvider.quote.day')}</Text>
                                <Chips>{days.map((d) => <ChipBtn key={d} on={q.day === d} onPress={() => patch({ day: d })}>{dayLabel(d)}</ChipBtn>)}</Chips>
                                <Text className="font-outfit-bold" style={{ fontSize: 13, color: SC.muted, marginTop: 14, marginBottom: 8 }}>{t('scheduledProvider.quote.arrivalTime')}</Text>
                                <Chips>{times.map((m) => <ChipBtn key={m} on={q.time === m} onPress={() => patch({ time: m })}>{formatMinutes(m)}</ChipBtn>)}</Chips>
                                <Text className="font-outfit-bold" style={{ fontSize: 13, color: SC.muted, marginTop: 14, marginBottom: 8 }}>{t('scheduledProvider.quote.duration')}</Text>
                                <Chips>{DURATIONS.map((d) => <ChipBtn key={d.id} on={q.durationId === d.id} onPress={() => patch({ durationId: d.id })}>{d.label}</ChipBtn>)}</Chips>
                            </View>

                            <SectionLabel>{t('scheduledProvider.quote.warrantyTitle')}</SectionLabel>
                            <View style={{ ...CARD_STYLE, padding: 14 }}>
                                <Chips>{WARRANTIES.map((w) => <ChipBtn key={w.id} on={q.warrantyId === w.id} onPress={() => patch({ warrantyId: w.id })}>{t(`scheduledProvider.warranties.${w.id}`)}</ChipBtn>)}</Chips>
                            </View>

                            <SectionLabel>{t('scheduledProvider.quote.messageTitle')} <Text className="font-outfit-regular" style={{ letterSpacing: 0 }}>{t('scheduledProvider.optional')}</Text></SectionLabel>
                            <View style={{ ...CARD_STYLE, padding: 14 }}>
                                <TextField multiline value={q.message} onChangeText={(message) => patch({ message })} placeholder={t('scheduledProvider.quote.messagePlaceholder')} maxLength={300} />
                                <Text className="font-outfit-regular" style={{ fontSize: 13, color: SC.mutedLight, textAlign: 'right', marginTop: 4 }}>{q.message.length}/300</Text>
                            </View>
                            <Note>{t('scheduledProvider.quote.protect')}</Note>
                        </ScrollView>
                    ) : (
                        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 18, gap: 14 }}>
                            <StepHead eyebrow={t('scheduledProvider.review.eyebrow')} title={t('scheduledProvider.review.title')} sub={t('scheduledProvider.review.sub')} />
                            <View style={{ ...CARD_STYLE, overflow: 'hidden' }}>
                                <View className="flex-row items-center justify-between" style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: SC.borderSoft }}>
                                    <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1.2, color: SC.muted }}>{t('scheduledProvider.services')}</Text>
                                    <TouchableOpacity onPress={() => setView('quote')} accessibilityRole="button"><Text className="font-outfit-bold" style={{ fontSize: 13, color: SC.blue }}>{t('scheduledProvider.review.edit')}</Text></TouchableOpacity>
                                </View>
                                {q.lines.map((l) => (
                                    <ReviewLine key={l.name} label={l.name} value={l.on ? money(amountOf(l.price)) : t('scheduledProvider.review.notIncluded')} dim={!l.on} />
                                ))}
                                {totals.travel > 0 ? <ReviewLine label={t('scheduledProvider.quote.travel')} value={money(totals.travel)} /> : null}
                                <View className="flex-row items-baseline justify-between" style={{ paddingHorizontal: 16, paddingVertical: 13, backgroundColor: SC.blueSofter }}>
                                    <Text className="font-outfit-bold" style={{ fontSize: 14, color: SC.text }}>{t('scheduledProvider.sent.yourQuote')}</Text>
                                    <Text className="font-outfit-bold" style={{ fontSize: 22, letterSpacing: -0.5, color: SC.blueDark }}>{money(totals.total)}</Text>
                                </View>
                            </View>
                            <Text className="font-outfit-regular" style={{ fontSize: 13, lineHeight: 17, color: SC.muted, paddingHorizontal: 4, marginTop: -6 }}>{t('scheduledProvider.review.feesNote')}</Text>
                            {totals.notIncluded.length > 0 ? <Note tone="amber"><Text className="font-outfit-bold">{t('scheduledProvider.quote.partialTitle')} </Text>{t('scheduledProvider.review.partialBody', { list: totals.notIncluded.join(', ') })}</Note> : null}
                            <View style={{ ...CARD_STYLE, overflow: 'hidden' }}>
                                <SummaryRow icon={Calendar} label={t('scheduledProvider.review.arrival')} value={`${slotDay} · ${q.time !== null ? formatMinutes(q.time) : '—'}`} />
                                <SummaryRow icon={Clock} label={t('scheduledProvider.review.duration')} value={DURATIONS.find((d) => d.id === q.durationId)?.label ?? ''} />
                                <SummaryRow icon={ShieldCheck} label={t('scheduledProvider.review.warranty')} value={t(`scheduledProvider.warranties.${q.warrantyId}`)} />
                                <SummaryRow icon={Wrench} label={t('scheduledProvider.review.parts')} value={q.partsIncluded ? t('scheduledProvider.review.partsIn') : t('scheduledProvider.review.partsCustomer')} last />
                            </View>
                            {q.message.trim() ? (
                                <View style={{ ...CARD_STYLE, padding: 14 }}>
                                    <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1.2, color: SC.muted }}>{t('scheduledProvider.review.yourMessage')}</Text>
                                    <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 21, color: SC.text, marginTop: 6 }}>{q.message.trim()}</Text>
                                </View>
                            ) : null}
                            <TouchableOpacity onPress={() => setConfirmed(!confirmed)} accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} activeOpacity={0.8} className="flex-row items-start" style={{ ...CARD_STYLE, padding: 14, gap: 12 }}>
                                <View className="items-center justify-center" style={{ width: 20, height: 20, borderRadius: 6, marginTop: 1, borderWidth: 2, borderColor: confirmed ? SC.blue : BORDER, backgroundColor: confirmed ? SC.blue : '#FFFFFF' }}>
                                    {confirmed ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}
                                </View>
                                <Text className="font-outfit-semibold flex-1" style={{ fontSize: 13, lineHeight: 19, color: SC.text }}>{t('scheduledProvider.review.confirm')}</Text>
                            </TouchableOpacity>
                            {notice ? <Note tone="amber">{notice}</Note> : null}
                        </ScrollView>
                    )}
                </KeyboardAvoidingView>
                {view === 'quote' ? (
                    <View style={{ ...FLOATING_FOOTER }}>
                        <View className="flex-row items-baseline justify-between" style={{ marginBottom: 10 }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 13, color: SC.muted }}>{t('scheduledProvider.sent.yourQuote')}</Text>
                            <Text className="font-outfit-bold" style={{ fontSize: 24, letterSpacing: -0.6, color: SC.blueDark }}>{money(totals.total)}</Text>
                        </View>
                        {problem ? <Text className="font-outfit-regular" style={{ fontSize: 13, color: SC.amberText, marginBottom: 8 }}>{t(`scheduledProvider.quote.problems.${problem}`)}</Text> : null}
                        <View className="flex-row"><Primary label={t('scheduledProvider.quote.reviewCta')} disabled={!!problem} onPress={() => setView('review')} /></View>
                    </View>
                ) : (
                    <ActionBar>
                        <Primary label={busy ? t('scheduledProvider.review.sending') : t('scheduledProvider.review.send')} disabled={!confirmed || busy} onPress={send} />
                    </ActionBar>
                )}
            </View>
        );
    }

    // ───────────── 1 · Request details ─────────────
    return (
        <View className="flex-1" style={{ backgroundColor: SC.page }}>
            {header}
            <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 32, gap: 14 }}>
                <StepHead eyebrow={t('scheduledProvider.eyebrow')} title={t('scheduledProvider.details.title')} sub={t('scheduledProvider.details.sub')} />

                <View style={{ ...CARD_STYLE, padding: 14 }} className="flex-row items-center">
                    <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: SC.blueSoft, marginRight: 12 }}><Calendar size={22} color={SC.blue} /></View>
                    <View className="flex-1">
                        <View className="flex-row items-center flex-wrap" style={{ gap: 7 }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 15, color: SC.text }}>{t('scheduledProvider.scheduledAssistance')}</Text>
                            <Pill bg={SC.blueSoft} fg={SC.blue}>{notes.mode === 'workshop' ? t('scheduledProvider.atShop') : t('scheduledProvider.atClient')}</Pill>
                        </View>
                    </View>
                    {hoursLeft !== null ? <Pill bg="#F1F4FA" fg={SC.muted} icon={<Clock size={12} color={SC.muted} />}>{t('scheduledProvider.hoursLeft', { count: hoursLeft })}</Pill> : null}
                </View>

                <View style={{ ...CARD_STYLE, overflow: 'hidden' }}>
                    <SummaryRow icon={Car} label={t('scheduledProvider.vehicle')} value={vehicle || '—'} sub={request.vehicle?.vin ? `VIN ${request.vehicle.vin}` : undefined} />
                    <View className="flex-row" style={{ padding: 16, paddingBottom: 13, gap: 12, borderBottomWidth: 1, borderBottomColor: SC.borderSoft }}>
                        <IconBox icon={Wrench} size={36} />
                        <View className="flex-1">
                            <View className="flex-row items-center" style={{ gap: 7, marginBottom: 2 }}>
                                <Text className="font-outfit-semibold" style={{ fontSize: 13, color: SC.muted }}>{t('scheduledProvider.servicesRequested')}</Text>
                                <View className="items-center justify-center" style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: SC.blue }}><Text className="font-outfit-bold" style={{ fontSize: 13, color: '#FFFFFF' }}>{services.length}</Text></View>
                            </View>
                            <View style={{ gap: 12, marginTop: 8 }}>
                                {services.map((s) => (
                                    <View key={s.name} className="flex-row items-start" style={{ gap: 9 }}>
                                        <View className="items-center justify-center" style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: SC.blueSoft }}><Check size={12} color={SC.blue} strokeWidth={3} /></View>
                                        <View className="flex-1">
                                            <Text className="font-outfit-bold" style={{ fontSize: 14, color: SC.text }}>{s.quantity && s.quantity > 1 ? `${s.name} ×${s.quantity}` : s.name}</Text>
                                            {notes.serviceNotes[s.name] ? <Text className="font-outfit-regular" style={{ fontSize: 13, color: SC.muted, marginTop: 1 }}>{t('scheduledProvider.customerNote', { note: notes.serviceNotes[s.name] })}</Text> : null}
                                        </View>
                                    </View>
                                ))}
                                {notes.other ? <Text className="font-outfit-regular" style={{ fontSize: 13, color: SC.muted }}>{t('scheduledProvider.otherRequest', { note: notes.other })}</Text> : null}
                            </View>
                        </View>
                    </View>
                    <SummaryRow icon={Calendar} label={t('scheduledProvider.when')} value={whenLabel || '—'} sub={notes.window ? t('scheduledProvider.between', { window: notes.window }) : undefined} />
                    <SummaryRow icon={Lock} label={notes.mode === 'workshop' ? t('scheduledProvider.locationShop') : t('scheduledProvider.locationClient')} value={[request.zip, dist && t('scheduledProvider.away', { distance: dist })].filter(Boolean).join(' · ') || '—'} sub={t('scheduledProvider.areaHint')} last />
                </View>

                {notes.symptoms || photos.length > 0 ? (
                    <View style={{ ...CARD_STYLE, padding: 16 }}>
                        {notes.symptoms ? (
                            <>
                                <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1.2, color: SC.muted }}>{t('scheduledProvider.symptoms')}</Text>
                                <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 21, color: SC.text, marginTop: 6 }}>{notes.symptoms}</Text>
                            </>
                        ) : null}
                        {photos.length > 0 ? (
                            <>
                                <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1.2, color: SC.muted, marginTop: notes.symptoms ? 14 : 0 }}>{t('scheduledProvider.evidence')}</Text>
                                <View className="flex-row flex-wrap" style={{ gap: 8, marginTop: 8 }}>
                                    {photos.map((p, i) => (
                                        <View key={`${p.url}-${i}`} className="items-center justify-center" style={{ width: '31.5%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: SC.blueSoft }}>
                                            {p.type === 'photo' ? <Image source={{ uri: p.url }} style={{ width: '100%', height: '100%' }} /> : <Text className="font-outfit-bold" style={{ fontSize: 13, color: SC.blue }}>{t('scheduledProvider.video')}</Text>}
                                        </View>
                                    ))}
                                </View>
                            </>
                        ) : null}
                    </View>
                ) : null}

                {dist ? (
                    <View className="flex-row" style={{ borderRadius: 16, backgroundColor: SC.blueSoft, padding: 14, gap: 10 }}>
                        <IconBox icon={Clock} size={32} white />
                        <View>
                            <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 0.8, color: SC.blue }}>{t('scheduledProvider.distance')}</Text>
                            <Text className="font-outfit-bold" style={{ fontSize: 15, color: SC.blueDark, marginTop: 1 }}>{dist}</Text>
                        </View>
                    </View>
                ) : null}
                <Text className="font-outfit-regular text-center" style={{ fontSize: 13, lineHeight: 19, color: SC.mutedLight }}>{t('scheduledProvider.id', { id: refLabel(request.refCode, request.id) })}</Text>
            </ScrollView>
            <ActionBar>
                <Primary label={t('scheduledProvider.sendQuoteCta')} onPress={() => setView('quote')} />
                <Ghost label={t('scheduledProvider.decline.cta')} onPress={() => setView('decline')} />
            </ActionBar>
        </View>
    );
}

/** Digits and one dot with at most two decimals. */
function cleanAmount(v: string): string {
    const t = v.replace(/[^0-9.]/g, '');
    const i = t.indexOf('.');
    return i < 0 ? t : t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '').slice(0, 2);
}

// ───────────── Pieces, as in the design ─────────────

function Steps({ step, labels }: { step: number; labels: string[] }) {
    return (
        <View className="flex-row" style={{ paddingHorizontal: 16, paddingTop: 32, gap: 6 }} accessibilityLabel={labels.join(' / ')}>
            {labels.map((l, i) => {
                const on = i === step - 1;
                const done = i < step - 1;
                return (
                    <View key={l} className="flex-1 flex-row items-center justify-center" style={{ gap: 6, paddingVertical: 9, borderRadius: 100, backgroundColor: on ? SC.blueSoft : 'transparent' }}>
                        {done ? <Check size={12} color={SC.blue} strokeWidth={3} /> : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: on ? SC.blue : '#DCE3F0' }} />}
                        <Text className="font-outfit-bold" style={{ fontSize: 13, color: on ? SC.blue : done ? SC.blueDark : SC.mutedLight }}>{l}</Text>
                    </View>
                );
            })}
        </View>
    );
}

function IconBox({ icon: Icon, size, white }: { icon: LucideIcon; size: number; white?: boolean }) {
    return (
        <View className="items-center justify-center" style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: white ? '#FFFFFF' : SC.blueSoft }}>
            <Icon size={size * 0.5} color={SC.blue} />
        </View>
    );
}

function SummaryRow({ icon, label, value, sub, last }: { icon: LucideIcon; label: string; value: string; sub?: string; last?: boolean }) {
    return (
        <View className="flex-row" style={{ padding: 16, paddingVertical: 13, gap: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: SC.borderSoft }}>
            <IconBox icon={icon} size={36} />
            <View className="flex-1">
                <Text className="font-outfit-semibold" style={{ fontSize: 13, color: SC.muted, marginBottom: 2 }}>{label}</Text>
                <Text className="font-outfit-bold" style={{ fontSize: 15, lineHeight: 20, letterSpacing: -0.2, color: SC.text }}>{value}</Text>
                {sub ? <Text className="font-outfit-regular" style={{ fontSize: 13, lineHeight: 17, color: SC.mutedLight, marginTop: 3 }}>{sub}</Text> : null}
            </View>
        </View>
    );
}

function ReviewLine({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
    return (
        <View className="flex-row justify-between" style={{ paddingHorizontal: 16, paddingVertical: 11, gap: 12, borderBottomWidth: 1, borderBottomColor: SC.borderSoft }}>
            <Text className="font-outfit-bold flex-1" style={{ fontSize: 14, color: dim ? SC.muted : SC.text }}>{label}</Text>
            <Text className="font-outfit-bold" style={{ fontSize: 14, color: dim ? SC.muted : SC.text }}>{value}</Text>
        </View>
    );
}

function Pill({ children, bg, fg, icon }: { children: ReactNode; bg: string; fg: string; icon?: ReactNode }) {
    return (
        <View className="flex-row items-center" style={{ gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, backgroundColor: bg }}>
            {icon}
            <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 0.4, color: fg }}>{children}</Text>
        </View>
    );
}

function SectionLabel({ children }: { children: ReactNode }) {
    return <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1.2, color: SC.muted, paddingHorizontal: 4 }}>{children}</Text>;
}

function Chips({ children }: { children: ReactNode }) {
    return <View className="flex-row flex-wrap" style={{ gap: 8 }}>{children}</View>;
}

function ChipBtn({ on, onPress, children }: { on: boolean; onPress: () => void; children: ReactNode }) {
    return (
        <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} activeOpacity={0.8} style={{ paddingHorizontal: 13, paddingVertical: 9, borderRadius: 100, backgroundColor: on ? SC.blue : '#FFFFFF', borderWidth: on ? 0 : 1.5, borderColor: BORDER }}>
            <Text className="font-outfit-bold" style={{ fontSize: 13, color: on ? '#FFFFFF' : SC.text }}>{children}</Text>
        </TouchableOpacity>
    );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
        <TouchableOpacity onPress={() => onChange(!on)} accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: on }} activeOpacity={0.8} style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: on ? SC.blue : '#D5DBE8' }}>
            <View style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }} />
        </TouchableOpacity>
    );
}

function ActionBar({ children }: { children: ReactNode }) {
    return <View style={{ ...FLOATING_FOOTER, gap: 10 }}>{children}</View>;
}

function Primary({ label, onPress, disabled, tone }: { label: string; onPress: () => void; disabled?: boolean; tone?: 'green' }) {
    return (
        <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} style={{ alignItems: 'center', paddingVertical: 15, paddingHorizontal: 16, borderRadius: 14, backgroundColor: disabled ? '#DCE7FA' : tone === 'green' ? SC.green : SC.blue }}>
            <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#FFFFFF' }}>{label}</Text>
        </TouchableOpacity>
    );
}

function Ghost({ label, onPress, outlined }: { label: string; onPress: () => void; outlined?: boolean }) {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 15, paddingHorizontal: 18, borderRadius: 14, backgroundColor: '#E6EAF2' }}>
            <Text className="font-outfit-bold" style={{ fontSize: 15, color: '#4A5470' }}>{label}</Text>
        </TouchableOpacity>
    );
}

function KV({ rows }: { rows: [string, string][] }) {
    return (
        <View style={{ ...CARD_STYLE, alignSelf: 'stretch', overflow: 'hidden' }}>
            {rows.map(([k, v], i) => (
                <View key={k} className="flex-row" style={{ paddingHorizontal: 14, paddingVertical: 11, gap: 12, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: SC.borderSoft }}>
                    <View className="flex-1">
                        <Text className="font-outfit-regular" style={{ fontSize: 13, lineHeight: 17, color: SC.muted }}>{k}</Text>
                        <Text className="font-outfit-bold" style={{ fontSize: 15, lineHeight: 20, color: SC.text, marginTop: 1 }}>{v}</Text>
                    </View>
                </View>
            ))}
        </View>
    );
}

function Outcome({ icon: Icon, tone = 'blue', title, sub, children, footer }: { icon: LucideIcon; tone?: 'blue' | 'green' | 'amber'; title: string; sub: string; children?: ReactNode; footer?: ReactNode }) {
    const c = { blue: [SC.blueSoft, SC.blue], green: [SC.greenSoft, SC.greenText], amber: [SC.amberSoft, SC.amberText] }[tone];
    return (
        <View className="flex-1">
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 32, paddingBottom: 20, alignItems: 'center', gap: 16 }}>
                <View className="items-center justify-center" style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: c[0] }}><Icon size={34} color={c[1]} /></View>
                <View>
                    <Text className="font-outfit-bold text-center" style={{ fontSize: 24, letterSpacing: -0.6, lineHeight: 29, color: SC.text }}>{title}</Text>
                    <Text className="font-outfit-regular text-center" style={{ fontSize: 14, lineHeight: 20, color: SC.muted, marginTop: 8 }}>{sub}</Text>
                </View>
                {children}
            </ScrollView>
            {footer ? <View style={FLOATING_FOOTER}>{footer}</View> : null}
        </View>
    );
}
