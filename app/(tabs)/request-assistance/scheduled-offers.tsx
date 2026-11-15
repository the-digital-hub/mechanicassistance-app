import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Clock, CreditCard, ShieldCheck, Star } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { CARD_STYLE, Footer, Note, SC, StepHead, WizardHeader } from '@/components/scheduled/ui';
import { RequestAgainButton } from '@/components/scheduled/RequestAgainButton';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { useSocket } from '@/context/SocketContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import type { AssistanceRequest, MarketplaceOffer } from '@/lib/dao/interfaces';
import { apiErrorCode, RETURN_TO_BACK } from '@/lib/payments/cardRequired';
import { usePaymentChoice } from '@/lib/payments/usePaymentChoice';
import {
    bestOfferId,
    canSelect,
    holdsNow,
    money,
    offerErrorAction,
    openOffersByTotal,
    requestPhase,
    totalOf,
    windowLeft,
} from '@/lib/scheduled/offers';

type View_ = 'list' | 'detail' | 'pay' | 'done';

const POLL_MS = 30000;
const EXTEND_HOURS = 24;

function formatSlot(start?: string | null, end?: string | null, locale?: string): string | null {
    if (!start) return null;
    const s = new Date(start);
    if (Number.isNaN(s.getTime())) return null;
    const day = s.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
    const time = (d: Date) => d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
    const e = end ? new Date(end) : null;
    return e && !Number.isNaN(e.getTime()) ? `${day} · ${time(s)} – ${time(e)}` : `${day} · ${time(s)}`;
}

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
        if (view === 'detail') setView('list');
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
            Alert.alert(t('scheduledOffers.errors.generic'));
        } finally {
            setBusy(false);
        }
    };

    const cancelRequest = () => {
        if (!requestId) return;
        Alert.alert(t('scheduledOffers.cancel.title'), t('scheduledOffers.cancel.message'), [
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
                        Alert.alert(t('scheduledOffers.errors.generic'));
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
                    {chosen.description ? <Info label={t('scheduledOffers.detail.description')} value={chosen.description} /> : null}
                    {chosen.parts?.length ? (
                        <View style={{ ...CARD_STYLE, padding: 14, gap: 6 }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 11, letterSpacing: 1.2, color: SC.muted }}>{t('scheduledOffers.detail.parts')}</Text>
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
                                            <Text className="font-outfit-bold" style={{ fontSize: 11, color: SC.greenText }}>{t('scheduledOffers.bestPrice')}</Text>
                                        </View>
                                    ) : null}
                                </View>
                                {slot ? <Text className="font-outfit-regular" style={{ color: SC.muted }}>{slot}</Text> : null}
                                <Text className="font-outfit-regular" style={{ fontSize: 12.5, color: SC.muted }}>
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
            <Text className="font-outfit-bold" style={{ fontSize: 11, letterSpacing: 1.2, color: SC.muted }}>{label}</Text>
            <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: SC.text }}>{value}</Text>
        </View>
    );
}
