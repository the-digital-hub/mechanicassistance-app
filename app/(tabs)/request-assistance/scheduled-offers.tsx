import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, Check, Clock, CreditCard, Minus, ShieldCheck, Star, Store } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { CARD_STYLE, Footer, Note, SC, StepHead, WizardHeader } from '@/components/scheduled/ui';
import { formatSlot } from '@/lib/scheduled/slot';
import { QuoteDetails } from '@/components/scheduled/QuoteDetails';
import { RequestAgainButton } from '@/components/scheduled/RequestAgainButton';
import { WaitingHub, type HubRow } from '@/components/scheduled/WaitingHub';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { useSocket } from '@/context/SocketContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { pricingDAO } from '@/lib/dao/PricingDAO';
import type { AssistanceRequest, MarketplaceOffer } from '@/lib/dao/interfaces';
import { apiErrorCode, RETURN_TO_BACK } from '@/lib/payments/cardRequired';
import { usePaymentChoice } from '@/lib/payments/usePaymentChoice';
import { parseRequestNotes } from '@/lib/scheduled/provider';
import {
    bestOfferId,
    canSelect,
    holdsNow,
    money,
    offerErrorAction,
    openOffersByTotal,
    requestPhase,
    splitQuoteDescription,
    totalOf,
    windowLeft,
} from '@/lib/scheduled/offers';
import { appAlert } from '@/lib/ui/appAlert';

type View_ = 'list' | 'compare' | 'detail' | 'pay' | 'done';
type SortId = 'coverage' | 'price' | 'date' | 'distance';

const POLL_MS = 30000;
const EXTEND_HOURS = 24;

export default function ScheduledOffersScreen() {
    const { t, i18n } = useTranslation();
    const router = useRouter();
    const { requestId } = useLocalSearchParams<{ requestId: string }>();

    const [request, setRequest] = useState<AssistanceRequest | null>(null);
    const [offers, setOffers] = useState<MarketplaceOffer[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [view, setView] = useState<View_>('list');
    const [openId, setOpenId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [now, setNow] = useState(() => new Date());
    const [cardModal, setCardModal] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [sort, setSort] = useState<SortId>('coverage');
    // Catalog names (English, as providers quote them) for the codes the request carries.
    const [serviceNames, setServiceNames] = useState<Record<string, string>>({});

    const load = useCallback(async () => {
        if (!requestId) return;
        try {
            const [req, list] = await Promise.all([assistanceDAO.getById(requestId), assistanceDAO.getOffers(requestId)]);
            setRequest(req);
            setOffers(list);
            setFailed(false);
        } catch (error) {
            console.error('Failed to load offers:', error);
            setFailed(true);
        } finally {
            setLoading(false);
            setNow(new Date());
        }
    }, [requestId]);

    useEffect(() => {
        let alive = true;
        pricingDAO
            .getServiceCategories()
            .then((cats) => {
                if (!alive || !Array.isArray(cats)) return;
                const map: Record<string, string> = {};
                for (const c of cats) for (const sv of c.services) map[sv.code] = sv.name;
                setServiceNames(map);
            })
            .catch(() => undefined);
        return () => {
            alive = false;
        };
    }, []);

    useFocusEffect(
        useCallback(() => {
            load();
            const id = setInterval(load, POLL_MS);
            return () => clearInterval(id);
        }, [load]),
    );

    // Keep the countdown alive between polls.
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(id);
    }, []);

    const sorted = useMemo(() => openOffersByTotal(offers), [offers]);
    const best = useMemo(() => bestOfferId(offers, now), [offers, now]);
    const chosen = useMemo(() => offers.find((o) => o.id === openId) ?? null, [offers, openId]);
    const chosenTotal = chosen ? totalOf(chosen) : null;
    const payment = usePaymentChoice(chosenTotal);
    const left = windowLeft(request?.offersCloseAt, now);
    const phase = requestPhase(request, offers, now);
    const { lastMessage } = useSocket();

    // Live: a provider answered, the window closed, or the chosen provider cancelled and the request reopened.
    useEffect(() => {
        if (lastMessage?.type !== 'assistance_update' || !requestId) return;
        const payload = lastMessage.payload;
        if (payload?.id !== requestId && payload?.requestId !== requestId) return;
        load();
        if (payload?.reason === 'request_reopened') {
            setView('list');
            setNotice(t('scheduledOffers.reopened'));
        }
    }, [lastMessage, requestId, load, t]);

    // A provider was chosen (here or elsewhere): the request continues as an appointment.
    useEffect(() => {
        if (phase === 'selected' && view !== 'done' && requestId) {
            router.replace(`/(tabs)/appointments/${requestId}` as any);
        }
    }, [phase, view, requestId, router]);
    const serviceDate = request?.date;

    const back = () => {
        if (view === 'compare') setView('list');
        else if (view === 'detail') setView('compare');
        else if (view === 'pay') setView('detail');
        else if (view === 'done') router.replace('/(tabs)/dashboard');
        else if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/dashboard');
    };

    const extend = async () => {
        if (!requestId || busy) return;
        setBusy(true);
        try {
            await assistanceDAO.extendOffers(requestId, EXTEND_HOURS);
            await load();
        } catch (error) {
            console.error('Failed to extend offers:', error);
            appAlert(t('scheduledOffers.errors.generic'));
        } finally {
            setBusy(false);
        }
    };

    const cancelRequest = () => {
        if (!requestId) return;
        appAlert(t('scheduledOffers.cancel.title'), t('scheduledOffers.cancel.message'), [
            { text: t('scheduledOffers.cancel.keep'), style: 'cancel' },
            {
                text: t('scheduledOffers.cancel.confirm'),
                style: 'destructive',
                onPress: async () => {
                    try {
                        await assistanceDAO.updateStatus(requestId, '', 'cancelled');
                        router.replace('/(tabs)/dashboard');
                    } catch (error) {
                        console.error('Failed to cancel scheduled request:', error);
                        appAlert(t('scheduledOffers.errors.generic'));
                    }
                },
            },
        ]);
    };

    const confirmPay = async () => {
        if (!requestId || !chosen || chosenTotal === null || !chosen.customerTotal || busy) return;
        setBusy(true);
        setNotice(null);
        try {
            if (payment.selectedId && payment.selectedId !== request?.paymentMethodId) {
                await assistanceDAO.setPaymentMethod(requestId, payment.selectedId);
            }
            await assistanceDAO.selectOffer(requestId, chosen.id, chosen.customerTotal.amount);
            setView('done');
        } catch (error) {
            const code = apiErrorCode(error);
            const action = offerErrorAction(code);
            if (action === 'card') setCardModal(true);
            else if (action === 'reload') {
                await load();
                setView('detail');
                setNotice(t('scheduledOffers.errors.priceChanged'));
            } else if (action === 'list') {
                await load();
                setView('list');
                setNotice(t('scheduledOffers.errors.offerGone'));
            } else if (action === 'funds') setNotice(t('scheduledOffers.errors.funds'));
            else if (action === 'disabled') setNotice(t('scheduledOffers.errors.disabled'));
            else if (action === 'location') setNotice(t('scheduledOffers.errors.location'));
            else setNotice(t('scheduledOffers.errors.generic'));
        } finally {
            setBusy(false);
        }
    };

    // ------------------------------------------------------------------ views

    const header = <WizardHeader title={t('scheduledOffers.title')} onBack={back} />;

    if (loading) {
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                {header}
                <View className="flex-1 items-center justify-center"><ActivityIndicator color={SC.blue} /></View>
            </View>
        );
    }

    if (failed && !request) {
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                {header}
                <View className="flex-1 items-center justify-center px-8" style={{ gap: 12 }}>
                    <Text className="font-outfit-regular text-center" style={{ color: SC.muted }}>{t('scheduledOffers.errors.load')}</Text>
                    <TouchableOpacity onPress={load}><Text className="font-outfit-bold" style={{ color: SC.blue }}>{t('scheduledOffers.retry')}</Text></TouchableOpacity>
                </View>
            </View>
        );
    }

    if (view === 'done' && chosen) {
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                {header}
                <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
                    <StepHead eyebrow={t('scheduledOffers.done.eyebrow')} title={t('scheduledOffers.done.title')} sub={t('scheduledOffers.done.sub')} />
                    <View style={{ ...CARD_STYLE, padding: 16, gap: 6 }}>
                        <Text className="font-outfit-bold" style={{ fontSize: 15, color: SC.text }}>{request?.title}</Text>
                        {formatSlot(chosen.proposedStart ?? serviceDate, chosen.proposedEnd, i18n.language) ? (
                            <Text className="font-outfit-regular" style={{ color: SC.muted }}>{formatSlot(chosen.proposedStart ?? serviceDate, chosen.proposedEnd, i18n.language)}</Text>
                        ) : null}
                        <Text className="font-outfit-bold" style={{ fontSize: 20, color: SC.text }}>{money(chosenTotal)}</Text>
                    </View>
                    <Note tone="green">{holdsNow(serviceDate, now) ? t('scheduledOffers.done.holdNow') : t('scheduledOffers.done.holdLater')}</Note>
                </ScrollView>
                <Footer label={t('scheduledOffers.done.home')} onPress={() => router.replace('/(tabs)/dashboard')} />
            </View>
        );
    }

    if (view === 'pay' && chosen && chosenTotal !== null && chosen.customerTotal) {
        const ct = chosen.customerTotal;
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                {header}
                <ConfirmationModal
                    visible={cardModal}
                    title={t('requestAssistance.cardRequired.title')}
                    message={t('requestAssistance.cardRequired.message')}
                    icon={CreditCard}
                    iconColor="#0047AB"
                    confirmText={t('requestAssistance.cardRequired.confirm')}
                    cancelText={t('requestAssistance.cardRequired.cancel')}
                    onConfirm={() => {
                        setCardModal(false);
                        router.push({ pathname: '/payment-cards', params: { returnTo: RETURN_TO_BACK } });
                    }}
                    onClose={() => setCardModal(false)}
                />
                <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
                    <StepHead eyebrow={t('scheduledOffers.pay.eyebrow')} title={t('scheduledOffers.pay.title')} />
                    <View style={{ ...CARD_STYLE, padding: 16, gap: 10 }}>
                        <Row label={ct.basis === 'diagnostic_fee' ? t('scheduledOffers.diagnosticFee') : t('scheduledOffers.service')} value={money(ct.baseAmount)} />
                        <Row label={t('scheduledOffers.fees')} value={money(ct.fees)} />
                        {parseFloat(ct.taxes) > 0 ? <Row label={t('scheduledOffers.taxes')} value={money(ct.taxes)} /> : null}
                        <View style={{ height: 1, backgroundColor: SC.borderSoft }} />
                        <Row label={t('scheduledOffers.total')} value={money(ct.amount)} bold />
                    </View>
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/payment-cards', params: { returnTo: RETURN_TO_BACK } })}
                        style={{ ...CARD_STYLE, padding: 14 }}
                        className="flex-row items-center"
                        activeOpacity={0.8}
                    >
                        <CreditCard size={20} color={SC.blue} />
                        <Text className="font-outfit-semibold flex-1" style={{ marginLeft: 10, color: SC.text }}>{payment.selectedLabel}</Text>
                        <Text className="font-outfit-bold" style={{ color: SC.blue }}>{t('scheduledOffers.pay.change')}</Text>
                    </TouchableOpacity>
                    <Note tone="blue">{holdsNow(serviceDate, now) ? t('scheduledOffers.pay.holdNow') : t('scheduledOffers.pay.holdLater')}</Note>
                    {ct.basis === 'diagnostic_fee' ? <Note tone="amber">{t('scheduledOffers.pay.diagnosticNote')}</Note> : null}
                    {notice ? <Note tone="amber">{notice}</Note> : null}
                </ScrollView>
                <Footer label={t('scheduledOffers.pay.confirm', { total: money(ct.amount) })} onPress={confirmPay} loading={busy} disabled={!payment.selectedId} />
            </View>
        );
    }

    if (view === 'detail' && chosen) {
        const ok = canSelect(chosen, now);
        const slot = formatSlot(chosen.proposedStart, chosen.proposedEnd, i18n.language);
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                {header}
                <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
                    <StepHead eyebrow={t('scheduledOffers.detail.eyebrow')} title={money(chosenTotal)} sub={chosen.quoteType === 'diagnostic_then_quote' ? t('scheduledOffers.detail.diagnosticSub') : t('scheduledOffers.detail.finalSub')} />
                    {notice ? <Note tone="amber">{notice}</Note> : null}
                    {slot ? <Info label={t('scheduledOffers.detail.slot')} value={slot} /> : null}
                    <QuoteDetails description={chosen.description} />
                    {chosen.parts?.length ? (
                        <View style={{ ...CARD_STYLE, padding: 14, gap: 6 }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1.2, color: SC.muted }}>{t('scheduledOffers.detail.parts')}</Text>
                            {chosen.parts.map((p, i) => (
                                <Row key={i} label={`${p.name}${p.quantity && p.quantity > 1 ? ` ×${p.quantity}` : ''}`} value={p.price ? money(p.price) : ''} />
                            ))}
                        </View>
                    ) : null}
                    {chosen.warrantyDays ? (
                        <View style={{ ...CARD_STYLE, padding: 14 }} className="flex-row items-center">
                            <ShieldCheck size={20} color={SC.green} />
                            <Text className="font-outfit-semibold flex-1" style={{ marginLeft: 10, color: SC.text }}>
                                {t('scheduledOffers.detail.warranty', { days: chosen.warrantyDays })}
                                {chosen.warrantyCoverage ? ` · ${chosen.warrantyCoverage}` : ''}
                            </Text>
                        </View>
                    ) : null}
                    {chosen.customerTotal ? (
                        <View style={{ ...CARD_STYLE, padding: 16, gap: 10 }}>
                            <Row label={t('scheduledOffers.service')} value={money(chosen.customerTotal.baseAmount)} />
                            <Row label={t('scheduledOffers.fees')} value={money(chosen.customerTotal.fees)} />
                            {parseFloat(chosen.customerTotal.taxes) > 0 ? <Row label={t('scheduledOffers.taxes')} value={money(chosen.customerTotal.taxes)} /> : null}
                            <View style={{ height: 1, backgroundColor: SC.borderSoft }} />
                            <Row label={t('scheduledOffers.total')} value={money(chosen.customerTotal.amount)} bold />
                        </View>
                    ) : null}
                    {!ok ? <Note tone="amber">{t('scheduledOffers.detail.unavailable')}</Note> : null}
                </ScrollView>
                <Footer label={t('scheduledOffers.detail.select')} onPress={() => { setNotice(null); setView('pay'); }} disabled={!ok} />
            </View>
        );
    }

    // What the owner asked, from the request and the notes the app wrote into it.
    const notes = parseRequestNotes(request?.notes, request?.date);
    const requested = (request?.services ?? []).map((x) => serviceNames[x.code] ?? x.code.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()));
    const agoLabel = (iso?: string | null) => {
        const at = iso ? Date.parse(iso) : NaN;
        if (!Number.isFinite(at)) return '';
        const mins = Math.max(0, Math.floor((now.getTime() - at) / 60000));
        if (mins < 1) return t('dashboard.timeAgo.justNow');
        if (mins < 60) return t('dashboard.timeAgo.minutes', { count: mins });
        if (mins < 1440) return t('dashboard.timeAgo.hours', { count: Math.floor(mins / 60) });
        return t('dashboard.timeAgo.days', { count: Math.floor(mins / 1440) });
    };
    const newestOffer = [...offers].sort((x, y) => Date.parse(y.createdAt ?? '') - Date.parse(x.createdAt ?? ''))[0];
    const radius = notes.mode === 'workshop' ? parseInt(request?.notes?.match(/within (\d+) mile/)?.[1] ?? '', 10) : NaN;
    const whenValue = [notes.days, notes.window].filter(Boolean).join(' · ') ||
        (request?.date ? new Date(request.date).toLocaleDateString(i18n.language, { weekday: 'short', month: 'short', day: 'numeric' }) : '—');
    const hubRows: HubRow[] = [
        { key: 'vehicle', kind: 'vehicle', label: t('scheduledOffers.hub.vehicle'), value: request?.car || '—' },
        {
            key: 'mode',
            kind: notes.mode === 'workshop' ? 'shop' : 'home',
            label: t('scheduledOffers.hub.modality'),
            value: notes.mode === 'workshop'
                ? Number.isFinite(radius) ? t('scheduledOffers.hub.modeShopWithin', { count: radius }) : t('scheduledOffers.hub.modeShop')
                : t('scheduledOffers.hub.modeOnsite'),
        },
        { key: 'when', kind: 'when', label: t('scheduledOffers.hub.when'), value: whenValue },
    ];

    if (view === 'compare' && phase !== 'cancelled') {
        const quotedNames = (o: MarketplaceOffer) => new Set(splitQuoteDescription(o.description).items.filter((i) => i.quoted).map((i) => i.name));
        const coverage = (o: MarketplaceOffer) => {
            const items = splitQuoteDescription(o.description).items.filter((i) => i.name !== 'Travel fee');
            if (items.length === 0 || requested.length === 0) return null;
            const names = quotedNames(o);
            return requested.filter((n) => names.has(n)).length;
        };
        const startOf = (o: MarketplaceOffer) => Date.parse(o.proposedStart ?? '') || Number.MAX_SAFE_INTEGER;
        const list = [...sorted].sort((x, y) => {
            if (sort === 'price') return (totalOf(x) ?? Infinity) - (totalOf(y) ?? Infinity);
            if (sort === 'date') return startOf(x) - startOf(y);
            if (sort === 'distance') return (x.distanceMiles ?? Infinity) - (y.distanceMiles ?? Infinity) || (totalOf(x) ?? Infinity) - (totalOf(y) ?? Infinity);
            return (coverage(y) ?? requested.length) - (coverage(x) ?? requested.length) || (totalOf(x) ?? Infinity) - (totalOf(y) ?? Infinity);
        });
        const tag = { coverage: t('scheduledOffers.compare.mostCoverage'), price: t('scheduledOffers.compare.lowestPrice'), date: '', distance: t('scheduledOffers.compare.nearest') }[sort];
        const chip = (id: SortId, label: string) => (
            <TouchableOpacity key={id} onPress={() => setSort(id)} accessibilityRole="button" accessibilityState={{ selected: sort === id }} style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 100, backgroundColor: sort === id ? SC.blue : '#FFFFFF', borderWidth: sort === id ? 0 : 1, borderColor: SC.border }}>
                <Text className="font-outfit-bold" style={{ fontSize: 13, color: sort === id ? '#FFFFFF' : SC.text }}>{label}</Text>
            </TouchableOpacity>
        );
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                <WizardHeader title={t('scheduledOffers.title')} onBack={back} />
                <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }}>
                    <StepHead eyebrow={t('scheduledOffers.compare.eyebrow', { count: list.length })} title={t('scheduledOffers.compare.title')} sub={t('scheduledOffers.compare.sub')} />
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                        {chip('coverage', t('scheduledOffers.compare.mostCoverage'))}
                        {chip('price', t('scheduledOffers.compare.lowestPrice'))}
                        {chip('date', t('scheduledOffers.compare.earliest'))}
                        {chip('distance', t('scheduledOffers.compare.nearest'))}
                    </View>
                    {notice ? <Note tone="amber">{notice}</Note> : null}
                    {list.map((o, i) => {
                        const ok = canSelect(o, now);
                        const items = splitQuoteDescription(o.description).items.filter((x) => x.name !== 'Travel fee');
                        const cov = coverage(o);
                        const full = cov !== null && cov === requested.length;
                        const slot = formatSlot(o.proposedStart, o.proposedEnd, i18n.language);
                        const names = quotedNames(o);
                        return (
                            <View key={o.id} style={{ ...CARD_STYLE, padding: 14, gap: 12, opacity: ok ? 1 : 0.6 }}>
                                <View className="flex-row items-center" style={{ gap: 12 }}>
                                    <View className="items-center justify-center" style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: SC.blueSoft }}><Store size={20} color={SC.blue} /></View>
                                    <View className="flex-1">
                                        <Text className="font-outfit-bold" style={{ fontSize: 15, color: SC.text }}>{t('scheduledOffers.compare.offerN', { n: i + 1 })}</Text>
                                        <Text className="font-outfit-regular" style={{ fontSize: 13, color: SC.muted, marginTop: 2 }}>{o.quoteType === 'diagnostic_then_quote' ? t('scheduledOffers.diagnosticThenQuote') : t('scheduledOffers.finalPrice')}{typeof o.distanceMiles === 'number' ? ` · ${o.distanceMiles < 10 ? o.distanceMiles.toFixed(1) : Math.round(o.distanceMiles)} mi` : ''}{agoLabel(o.createdAt) ? ` · ${agoLabel(o.createdAt)}` : ''}</Text>
                                    </View>
                                </View>
                                {cov !== null ? (
                                    <View>
                                        <View className="flex-row items-center justify-between" style={{ marginBottom: 6 }}>
                                            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100, backgroundColor: full ? SC.greenSoft : SC.amberSoft }}>
                                                <Text className="font-outfit-bold" style={{ fontSize: 13, color: full ? SC.greenText : SC.amberText }}>{full ? t('scheduledOffers.compare.coversAll') : t('scheduledOffers.compare.partial', { n: cov, total: requested.length })}</Text>
                                            </View>
                                            {i === 0 && tag ? <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 0.8, color: SC.blue }}>{tag}</Text> : null}
                                        </View>
                                        <View className="flex-row" style={{ gap: 3 }}>
                                            {requested.map((n, k) => <View key={`${n}-${k}`} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: names.has(n) ? SC.blue : '#DCE3F0' }} />)}
                                        </View>
                                    </View>
                                ) : i === 0 && tag ? <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 0.8, color: SC.blue }}>{tag}</Text> : null}
                                {items.length > 0 ? (
                                    <View style={{ gap: 5 }}>
                                        {items.map((it) => (
                                            <View key={it.name} className="flex-row items-center" style={{ gap: 8 }}>
                                                <View className="items-center justify-center" style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: it.quoted ? SC.blue : '#E8ECF4' }}>
                                                    {it.quoted ? <Check size={10} color="#FFFFFF" strokeWidth={3} /> : <Minus size={10} color="#5A6482" strokeWidth={3} />}
                                                </View>
                                                <Text className="font-outfit-semibold flex-1" style={{ fontSize: 13, color: it.quoted ? SC.text : SC.muted }}>{it.name}</Text>
                                                <Text className="font-outfit-bold" style={{ fontSize: 13, color: it.quoted ? SC.text : SC.muted }}>{it.quoted && it.total !== null ? money(it.total) : t('scheduledOffers.compare.notQuoted')}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : null}
                                <View className="flex-row items-baseline justify-between" style={{ marginTop: 2, paddingTop: 10, borderTopWidth: 1, borderTopColor: SC.border, borderStyle: 'dashed' }}>
                                    <Text className="font-outfit-bold" style={{ fontSize: 13, color: SC.muted }}>{t('scheduledOffers.compare.yourTotal')}</Text>
                                    <Text className="font-outfit-bold" style={{ fontSize: 20, letterSpacing: -0.5, color: SC.blue }}>{money(totalOf(o))}</Text>
                                </View>
                                <View className="flex-row" style={{ gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: SC.borderSoft }}>
                                    <View className="flex-1 flex-row items-center" style={{ gap: 7 }}>
                                        <Calendar size={16} color={SC.blue} />
                                        <View className="flex-1">
                                            <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1, color: SC.muted }}>{t('scheduledOffers.compare.available')}</Text>
                                            <Text className="font-outfit-bold" style={{ fontSize: 13, lineHeight: 18, color: SC.text, marginTop: 1 }}>{slot || '—'}</Text>
                                        </View>
                                    </View>
                                    <View className="flex-1 flex-row items-center" style={{ gap: 7 }}>
                                        <ShieldCheck size={16} color={SC.blue} />
                                        <View className="flex-1">
                                            <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1, color: SC.muted }}>{t('scheduledOffers.compare.warranty')}</Text>
                                            <Text className="font-outfit-bold" style={{ fontSize: 13, lineHeight: 18, color: SC.text, marginTop: 1 }}>{o.warrantyDays ? t('scheduledOffers.detail.warranty', { days: o.warrantyDays }) : '—'}</Text>
                                        </View>
                                    </View>
                                </View>
                                <View className="flex-row items-center" style={{ gap: 10 }}>
                                    <TouchableOpacity onPress={() => { setOpenId(o.id); setNotice(null); setView('detail'); }} accessibilityRole="button" style={{ paddingHorizontal: 4 }}>
                                        <Text className="font-outfit-bold" style={{ fontSize: 13, color: SC.blue }}>{t('scheduledOffers.compare.details')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => { setOpenId(o.id); setNotice(null); setView('pay'); }} disabled={!ok} activeOpacity={0.85} accessibilityRole="button" style={{ flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 14, backgroundColor: ok ? SC.blue : '#DCE7FA' }}>
                                        <Text className="font-outfit-bold" style={{ fontSize: 15, color: '#FFFFFF' }}>{t('scheduledOffers.compare.select')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}
                    <Text className="font-outfit-regular" style={{ fontSize: 13, lineHeight: 17, color: SC.muted }}>{t('scheduledOffers.compare.totalNote')}</Text>
                </ScrollView>
            </View>
        );
    }

    if (view === 'list' && (phase === 'collecting' || phase === 'closedWithOffers')) {
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                <WizardHeader title={t('scheduled.title')} onBack={back} />
                {notice ? <View style={{ paddingHorizontal: 20, paddingTop: 12 }}><Note tone="amber">{notice}</Note></View> : null}
                <WaitingHub
                    closeAt={request?.offersCloseAt}
                    createdAt={request?.createdAt}
                    closed={left.closed}
                    offerCount={sorted.length}
                    latestAgo={agoLabel(newestOffer?.createdAt)}
                    refCode={request?.refCode ? `#${request.refCode}` : `#${String(requestId).slice(0, 8)}`}
                    rows={hubRows}
                    services={requested}
                    onCompare={() => { setNotice(null); setView('compare'); }}
                    onExtend={extend}
                    extendLabel={t('scheduledOffers.hub.extend', { hours: EXTEND_HOURS })}
                    onCancel={cancelRequest}
                    onHome={() => router.replace('/(tabs)/dashboard')}
                    busy={busy}
                />
            </View>
        );
    }

    // List / waiting hub
    return (
        <View className="flex-1" style={{ backgroundColor: SC.page }}>
            {header}
            <ScrollView contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 40 }}>
                <StepHead
                    eyebrow={t('scheduledOffers.eyebrow')}
                    title={
                        phase === 'cancelled'
                            ? t('scheduledOffers.cancelledTitle')
                            : sorted.length
                                ? t('scheduledOffers.listTitle', { count: sorted.length })
                                : phase === 'closedEmpty'
                                    ? t('scheduledOffers.noOffersTitle')
                                    : t('scheduledOffers.waitingTitle')
                    }
                    sub={request?.title}
                />
                {phase === 'cancelled' ? null : (
                <View style={{ ...CARD_STYLE, padding: 14 }} className="flex-row items-center">
                    <Clock size={20} color={SC.blue} />
                    <Text className="font-outfit-semibold flex-1" style={{ marginLeft: 10, color: SC.text }}>
                        {left.closed ? t('scheduledOffers.windowClosed') : t('scheduledOffers.windowLeft', { hours: left.hours, minutes: left.minutes })}
                    </Text>
                    <TouchableOpacity onPress={extend} disabled={busy}>
                        <Text className="font-outfit-bold" style={{ color: SC.blue }}>{t('scheduledOffers.extend', { hours: EXTEND_HOURS })}</Text>
                    </TouchableOpacity>
                </View>
                )}
                {notice ? <Note tone="amber">{notice}</Note> : null}
                {phase === 'cancelled' ? (
                    <>
                        <Note tone="amber">{t('scheduledOffers.cancelledSub')}</Note>
                        <RequestAgainButton requestId={requestId as string} />
                    </>
                ) : phase === 'closedEmpty' ? (
                    <>
                        <Note tone="amber">{t('scheduledOffers.noOffersSub')}</Note>
                        <TouchableOpacity onPress={extend} disabled={busy} activeOpacity={0.85} accessibilityRole="button" style={{ paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: SC.blue, opacity: busy ? 0.6 : 1 }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#FFFFFF' }}>{t('scheduledOffers.extendLong', { hours: EXTEND_HOURS })}</Text>
                        </TouchableOpacity>
                        <RequestAgainButton requestId={requestId as string} />
                    </>
                ) : sorted.length === 0 ? (
                    <Note tone="blue">{t('scheduledOffers.waitingSub')}</Note>
                ) : (
                    sorted.map((o) => {
                        const ok = canSelect(o, now);
                        const slot = formatSlot(o.proposedStart, o.proposedEnd, i18n.language);
                        return (
                            <TouchableOpacity
                                key={o.id}
                                activeOpacity={0.85}
                                onPress={() => { setOpenId(o.id); setNotice(null); setView('detail'); }}
                                style={{ ...CARD_STYLE, padding: 16, gap: 6, opacity: ok ? 1 : 0.6, borderColor: o.id === best ? SC.green : SC.borderSoft, borderWidth: o.id === best ? 1.5 : 1 }}
                            >
                                <View className="flex-row items-center justify-between">
                                    <Text className="font-outfit-bold" style={{ fontSize: 22, color: SC.text }}>{money(totalOf(o))}</Text>
                                    {o.id === best ? (
                                        <View className="flex-row items-center rounded-full" style={{ gap: 4, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: SC.greenSoft }}>
                                            <Star size={12} color={SC.greenText} />
                                            <Text className="font-outfit-bold" style={{ fontSize: 13, color: SC.greenText }}>{t('scheduledOffers.bestPrice')}</Text>
                                        </View>
                                    ) : null}
                                </View>
                                {slot ? <Text className="font-outfit-regular" style={{ color: SC.muted }}>{slot}</Text> : null}
                                <Text className="font-outfit-regular" style={{ fontSize: 13, color: SC.muted }}>
                                    {o.quoteType === 'diagnostic_then_quote' ? t('scheduledOffers.diagnosticThenQuote') : t('scheduledOffers.finalPrice')}
                                    {o.warrantyDays ? ` · ${t('scheduledOffers.detail.warranty', { days: o.warrantyDays })}` : ''}
                                </Text>
                            </TouchableOpacity>
                        );
                    })
                )}
                {phase === 'cancelled' ? null : (
                <TouchableOpacity onPress={cancelRequest} style={{ alignItems: 'center', paddingVertical: 12 }}>
                    <Text className="font-outfit-bold" style={{ color: SC.red }}>{t('scheduledOffers.cancel.action')}</Text>
                </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
    return (
        <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
            <Text className={bold ? 'font-outfit-bold flex-1' : 'font-outfit-regular flex-1'} style={{ color: bold ? SC.text : SC.muted, fontSize: bold ? 16 : 14 }}>{label}</Text>
            <Text className={bold ? 'font-outfit-bold' : 'font-outfit-medium'} style={{ color: SC.text, fontSize: bold ? 16 : 14 }}>{value}</Text>
        </View>
    );
}


function Info({ label, value }: { label: string; value: string }) {
    return (
        <View style={{ ...CARD_STYLE, padding: 14, gap: 4 }}>
            <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1.2, color: SC.muted }}>{label}</Text>
            <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: SC.text }}>{value}</Text>
        </View>
    );
}
