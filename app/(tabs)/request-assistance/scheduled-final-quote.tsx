import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { CreditCard, ShieldCheck } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { QuoteDetails } from '@/components/scheduled/QuoteDetails';
import { CARD_STYLE, Footer, Note, SC, StepHead, WizardHeader } from '@/components/scheduled/ui';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import type { FinalQuoteView } from '@/lib/dao/interfaces';
import { apiErrorCode, RETURN_TO_BACK } from '@/lib/payments/cardRequired';
import { money, quoteErrorAction, quoteIsOpen } from '@/lib/scheduled/offers';

export default function ScheduledFinalQuoteScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { requestId } = useLocalSearchParams<{ requestId: string }>();

    const [view, setView] = useState<FinalQuoteView | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [cardModal, setCardModal] = useState(false);
    const [decided, setDecided] = useState<'approved' | 'rejected' | null>(null);

    const load = useCallback(async () => {
        if (!requestId) return;
        try {
            setView(await assistanceDAO.getFinalQuote(requestId));
        } catch (error) {
            console.error('Failed to load final quote:', error);
            setNotice(t('finalQuote.errors.load'));
        } finally {
            setLoading(false);
        }
    }, [requestId, t]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'));

    const fail = async (error: unknown) => {
        const action = quoteErrorAction(apiErrorCode(error));
        if (action === 'card') setCardModal(true);
        else if (action === 'reload') { await load(); setNotice(t('scheduledOffers.errors.priceChanged')); }
        else if (action === 'gone') { await load(); setNotice(t('finalQuote.errors.gone')); }
        else if (action === 'funds') setNotice(t('scheduledOffers.errors.funds'));
        else setNotice(t('scheduledOffers.errors.generic'));
    };

    const approve = async () => {
        if (!requestId || !view?.customerTotal || busy) return;
        setBusy(true);
        setNotice(null);
        try {
            await assistanceDAO.approveFinalQuote(requestId, view.quote.id, view.customerTotal.amount);
            setDecided('approved');
        } catch (error) {
            await fail(error);
        } finally {
            setBusy(false);
        }
    };

    const reject = () => {
        if (!requestId || !view) return;
        Alert.alert(t('finalQuote.reject.title'), t('finalQuote.reject.message'), [
            { text: t('finalQuote.reject.keep'), style: 'cancel' },
            {
                text: t('finalQuote.reject.confirm'),
                style: 'destructive',
                onPress: async () => {
                    setBusy(true);
                    try {
                        await assistanceDAO.rejectFinalQuote(requestId, view.quote.id);
                        setDecided('rejected');
                    } catch (error) {
                        await fail(error);
                    } finally {
                        setBusy(false);
                    }
                },
            },
        ]);
    };

    const header = <WizardHeader title={t('finalQuote.title')} onBack={back} />;

    if (loading) {
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                {header}
                <View className="flex-1 items-center justify-center"><ActivityIndicator color={SC.blue} /></View>
            </View>
        );
    }

    if (decided) {
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                {header}
                <View style={{ padding: 24, gap: 16 }}>
                    <StepHead
                        eyebrow={t(`finalQuote.${decided}.eyebrow`)}
                        title={t(`finalQuote.${decided}.title`)}
                        sub={t(`finalQuote.${decided}.sub`)}
                    />
                </View>
                <View style={{ flex: 1 }} />
                <Footer label={t('finalQuote.back')} onPress={back} />
            </View>
        );
    }

    if (!view) {
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                {header}
                <View className="flex-1 items-center justify-center px-8" style={{ gap: 12 }}>
                    <Text className="font-outfit-regular text-center" style={{ color: SC.muted }}>{notice ?? t('finalQuote.none')}</Text>
                </View>
            </View>
        );
    }

    const { quote, customerTotal } = view;
    const open = quoteIsOpen(quote.status, quote.expiresAt) && !!customerTotal;

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
                <StepHead eyebrow={t('finalQuote.eyebrow')} title={money(customerTotal?.amount)} sub={t('finalQuote.sub')} />
                {notice ? <Note tone="amber">{notice}</Note> : null}
                <QuoteDetails description={quote.description} />
                {quote.parts?.length ? (
                    <View style={{ ...CARD_STYLE, padding: 14, gap: 6 }}>
                        <Text className="font-outfit-bold" style={{ fontSize: 11, letterSpacing: 1.2, color: SC.muted }}>{t('scheduledOffers.detail.parts')}</Text>
                        {quote.parts.map((p, i) => (
                            <Line key={i} label={`${p.name}${p.quantity && p.quantity > 1 ? ` ×${p.quantity}` : ''}`} value={p.price ? money(p.price) : ''} />
                        ))}
                    </View>
                ) : null}
                {quote.warrantyDays ? (
                    <View style={{ ...CARD_STYLE, padding: 14 }} className="flex-row items-center">
                        <ShieldCheck size={20} color={SC.green} />
                        <Text className="font-outfit-semibold flex-1" style={{ marginLeft: 10, color: SC.text }}>
                            {t('scheduledOffers.detail.warranty', { days: quote.warrantyDays })}
                            {quote.warrantyCoverage ? ` · ${quote.warrantyCoverage}` : ''}
                        </Text>
                    </View>
                ) : null}
                {customerTotal ? (
                    <View style={{ ...CARD_STYLE, padding: 16, gap: 10 }}>
                        <Line label={t('scheduledOffers.service')} value={money(customerTotal.baseAmount)} />
                        <Line label={t('scheduledOffers.fees')} value={money(customerTotal.fees)} />
                        {parseFloat(customerTotal.taxes) > 0 ? <Line label={t('scheduledOffers.taxes')} value={money(customerTotal.taxes)} /> : null}
                        <View style={{ height: 1, backgroundColor: SC.borderSoft }} />
                        <Line label={t('scheduledOffers.total')} value={money(customerTotal.amount)} bold />
                        {view.alreadyHeld ? <Line label={t('finalQuote.alreadyHeld')} value={`− ${money(view.alreadyHeld)}`} /> : null}
                        {view.additionalToHold ? <Line label={t('finalQuote.additional')} value={money(view.additionalToHold)} bold /> : null}
                    </View>
                ) : null}
                {open ? <Note tone="blue">{t('finalQuote.note')}</Note> : <Note tone="amber">{t('finalQuote.closed')}</Note>}
                {open ? (
                    <TouchableOpacity onPress={reject} disabled={busy} style={{ alignItems: 'center', paddingVertical: 8 }}>
                        <Text className="font-outfit-bold" style={{ color: SC.red }}>{t('finalQuote.reject.action')}</Text>
                    </TouchableOpacity>
                ) : null}
            </ScrollView>
            {open ? <Footer label={t('finalQuote.approve', { amount: money(view.additionalToHold ?? customerTotal?.amount) })} onPress={approve} loading={busy} /> : null}
        </View>
    );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
    return (
        <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
            <Text className={bold ? 'font-outfit-bold flex-1' : 'font-outfit-regular flex-1'} style={{ color: bold ? SC.text : SC.muted, fontSize: bold ? 16 : 14 }}>{label}</Text>
            <Text className={bold ? 'font-outfit-bold' : 'font-outfit-medium'} style={{ color: SC.text, fontSize: bold ? 16 : 14 }}>{value}</Text>
        </View>
    );
}
