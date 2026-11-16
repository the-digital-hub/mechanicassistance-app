import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, Car, Clock, MapPin, Wrench } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { DayCalendar, TimeWheel } from '@/components/scheduled/DateTime';
import { CARD_STYLE, Chip, FieldLabel, Footer, Note, SC, StepHead, TextField, WizardHeader } from '@/components/scheduled/ui';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import type { MarketplaceRequest } from '@/lib/dao/interfaces';
import { parseAttachments } from '@/lib/media/attachments';
import { apiErrorCode } from '@/lib/payments/cardRequired';
import { dateFromKey, formatMinutes, toDateKey } from '@/lib/scheduled/draft';
import { money } from '@/lib/scheduled/offers';
import { buildOffer, distanceLabel, offerSubmitProblem, validateOffer, vehicleLabel, type OfferForm } from '@/lib/scheduled/provider';

const SLOT_MIN = 6 * 60;
const SLOT_MAX = 21 * 60;

const isoAt = (dayKey: string, minutes: number) => {
    const d = dateFromKey(dayKey);
    d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return d.toISOString();
};

/** Provider side of a scheduled request: what the owner asked for, and the quote form. */
export default function ScheduledRequestScreen() {
    const { t, i18n } = useTranslation();
    const router = useRouter();
    const { requestId } = useLocalSearchParams<{ requestId: string }>();

    const [request, setRequest] = useState<MarketplaceRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const [quoteType, setQuoteType] = useState<OfferForm['quoteType']>('final');
    const [price, setPrice] = useState('');
    const [diagnosticFee, setDiagnosticFee] = useState('');
    const [description, setDescription] = useState('');
    const [warrantyDays, setWarrantyDays] = useState('');
    const [warrantyCoverage, setWarrantyCoverage] = useState('');
    const [proposeSlot, setProposeSlot] = useState(false);
    const [slotDay, setSlotDay] = useState('');
    const [slotFrom, setSlotFrom] = useState(9 * 60);
    const [slotTo, setSlotTo] = useState(11 * 60);
    const [prefilled, setPrefilled] = useState(false);

    const load = useCallback(async () => {
        if (!requestId) return;
        try {
            const r = await assistanceDAO.getMarketplaceRequest(requestId);
            setRequest(r);
            setFailed(false);
            // Editing a quote replaces it: start from what was sent.
            const mine = r?.myOffer;
            if (mine && !prefilled) {
                setPrefilled(true);
                if (mine.quoteType) setQuoteType(mine.quoteType);
                if (mine.price) setPrice(String(mine.price));
                if (mine.diagnosticFee) setDiagnosticFee(String(mine.diagnosticFee));
                if (mine.description) setDescription(mine.description);
                if (mine.warrantyDays) setWarrantyDays(String(mine.warrantyDays));
                if (mine.warrantyCoverage) setWarrantyCoverage(mine.warrantyCoverage);
            }
        } catch (error) {
            console.error('Failed to load the scheduled request:', error);
            setFailed(true);
        } finally {
            setLoading(false);
        }
    }, [requestId, prefilled]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/assist'));

    const form: OfferForm = {
        quoteType,
        price,
        diagnosticFee,
        description,
        warrantyDays,
        warrantyCoverage,
        ...(proposeSlot && slotDay ? { proposedStart: isoAt(slotDay, slotFrom), proposedEnd: isoAt(slotDay, slotTo) } : {}),
    };
    const problem = validateOffer(form);

    const send = async () => {
        if (!requestId || busy) return;
        if (problem) {
            setNotice(t(`scheduledProvider.errors.${problem}`));
            return;
        }
        setBusy(true);
        setNotice(null);
        try {
            await assistanceDAO.submitOffer(requestId, buildOffer(form));
            setSent(true);
        } catch (error) {
            const kind = offerSubmitProblem(apiErrorCode(error));
            if (kind === 'closed') await load();
            setNotice(kind === 'generic' ? t('scheduledProvider.errors.generic') : t(`scheduledProvider.errors.${kind}`, { defaultValue: t(`scheduledProvider.problems.${kind}.body`) }));
        } finally {
            setBusy(false);
        }
    };

    const header = <WizardHeader title={t('scheduledProvider.title')} onBack={back} />;

    if (loading) {
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                {header}
                <View className="flex-1 items-center justify-center"><ActivityIndicator color={SC.blue} /></View>
            </View>
        );
    }

    if (sent) {
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                {header}
                <View style={{ padding: 24 }}>
                    <StepHead eyebrow={t('scheduledProvider.sent.eyebrow')} title={t('scheduledProvider.sent.title')} sub={t('scheduledProvider.sent.sub')} />
                </View>
                <View style={{ flex: 1 }} />
                <Footer label={t('scheduledProvider.back')} onPress={back} />
            </View>
        );
    }

    if (!request) {
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                {header}
                <View className="flex-1 items-center justify-center px-8">
                    <Text className="font-outfit-regular text-center" style={{ color: SC.muted }}>
                        {failed ? t('scheduledProvider.errors.load') : t('scheduledProvider.gone')}
                    </Text>
                </View>
            </View>
        );
    }

    const services = request.services ?? [];
    const photos = parseAttachments(request.photos).filter((p) => p.type === 'photo');
    const when = request.date ? new Date(request.date) : null;
    const whenLabel = when && !isNaN(when.getTime())
        ? when.toLocaleString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : null;
    const closes = request.offersCloseAt ? new Date(request.offersCloseAt) : null;
    const closesLabel = closes && !isNaN(closes.getTime())
        ? closes.toLocaleString(i18n.language, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : null;
    const mine = request.myOffer;
    const today = new Date();
    const dist = distanceLabel(request.distanceMiles);
    const vehicle = vehicleLabel(request);
    const vehicleMeta = [request.vehicle?.mileage ? `${request.vehicle.mileage.toLocaleString(i18n.language)} mi` : null, request.vehicle?.condition].filter(Boolean).join(' · ');

    return (
        <View className="flex-1" style={{ backgroundColor: SC.page }}>
            {header}
            <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 18 }}>
                    <StepHead
                        eyebrow={t('scheduledProvider.eyebrow')}
                        title={request.title || services.map((s) => s.name).slice(0, 2).join(', ') || t('scheduledProvider.title')}
                        sub={closesLabel ? t('scheduledProvider.closes', { date: closesLabel }) : undefined}
                    />

                    {mine ? (
                        <Note tone="green" title={t('scheduledProvider.mine.title')}>
                            {[mine.price ? money(mine.price) : mine.diagnosticFee ? `${t('scheduledProvider.diagnostic')} ${money(mine.diagnosticFee)}` : null, mine.status ? t(`scheduledProvider.mine.status.${mine.status}`, { defaultValue: String(mine.status) }) : null].filter(Boolean).join(' · ') + ' — ' + t('scheduledProvider.mine.editHint')}
                        </Note>
                    ) : null}

                    <View style={{ ...CARD_STYLE, padding: 16, gap: 14 }}>
                        {whenLabel ? <Row icon={Calendar} label={t('scheduledProvider.when')} value={whenLabel} /> : null}
                        {vehicle ? <Row icon={Car} label={t('scheduledProvider.vehicle')} value={vehicleMeta ? `${vehicle}\n${vehicleMeta}` : vehicle} /> : null}
                        {services.length > 0 ? (
                            <Row icon={Wrench} label={t('scheduledProvider.services')} value={services.map((s) => (s.quantity && s.quantity > 1 ? `${s.name} ×${s.quantity}` : s.name)).join('\n')} />
                        ) : null}
                        {request.zip || dist ? <Row icon={MapPin} label={t('scheduledProvider.area')} value={[request.zip, dist && t('scheduledProvider.away', { distance: dist })].filter(Boolean).join(' · ')} hint={t('scheduledProvider.areaHint')} /> : null}
                        {request.notes ? <Row icon={Clock} label={t('scheduledProvider.notes')} value={request.notes} /> : null}
                    </View>

                    {photos.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                            {photos.map((p, i) => (
                                <Image key={`${p.url}-${i}`} source={{ uri: p.url }} style={{ width: 96, height: 96, borderRadius: 12, backgroundColor: SC.blueSoft }} />
                            ))}
                        </ScrollView>
                    ) : null}

                    <View>
                        <FieldLabel>{t('scheduledProvider.form.type')}</FieldLabel>
                        <View className="flex-row" style={{ gap: 8 }}>
                            <Chip on={quoteType === 'final'} onPress={() => setQuoteType('final')}>{t('scheduledProvider.form.final')}</Chip>
                            <Chip on={quoteType === 'diagnostic_then_quote'} onPress={() => setQuoteType('diagnostic_then_quote')}>{t('scheduledProvider.form.diagnostic')}</Chip>
                        </View>
                        <Text className="font-outfit-regular" style={{ fontSize: 12, color: SC.muted, marginTop: 6 }}>
                            {quoteType === 'final' ? t('scheduledProvider.form.finalHint') : t('scheduledProvider.form.diagnosticHint')}
                        </Text>
                    </View>

                    <View>
                        <FieldLabel>{quoteType === 'final' ? t('scheduledProvider.form.price') : t('scheduledProvider.form.diagnosticFee')}</FieldLabel>
                        <TextField
                            value={quoteType === 'final' ? price : diagnosticFee}
                            onChangeText={quoteType === 'final' ? setPrice : setDiagnosticFee}
                            keyboardType="decimal-pad"
                            placeholder="150.00"
                            maxLength={10}
                        />
                        <Text className="font-outfit-regular" style={{ fontSize: 12, color: SC.muted, marginTop: 6 }}>{t('scheduledProvider.form.priceHint')}</Text>
                    </View>

                    <View>
                        <FieldLabel>{t('scheduledProvider.form.description')}</FieldLabel>
                        <TextField multiline value={description} onChangeText={setDescription} placeholder={t('scheduledProvider.form.descriptionPlaceholder')} maxLength={1000} />
                    </View>

                    <View style={{ gap: 10 }}>
                        <FieldLabel>{t('scheduledProvider.form.slotTitle')}</FieldLabel>
                        <View className="flex-row" style={{ gap: 8 }}>
                            <Chip on={!proposeSlot} onPress={() => setProposeSlot(false)}>{t('scheduledProvider.form.slotAsked')}</Chip>
                            <Chip on={proposeSlot} onPress={() => { setProposeSlot(true); if (!slotDay) setSlotDay(toDateKey(request.date && when && when.getTime() > Date.now() ? when : new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1))); }}>{t('scheduledProvider.form.slotPropose')}</Chip>
                        </View>
                        {proposeSlot && slotDay ? (
                            <>
                                <DayCalendar
                                    value={slotDay}
                                    min={new Date(today.getFullYear(), today.getMonth(), today.getDate())}
                                    max={new Date(today.getFullYear(), today.getMonth() + 3, today.getDate())}
                                    locale={i18n.language}
                                    onChange={setSlotDay}
                                />
                                <View className="flex-row" style={{ gap: 12 }}>
                                    <TimeWheel label={t('scheduledProvider.form.from')} minutes={slotFrom} min={SLOT_MIN} max={SLOT_MAX - 30} onChange={(m) => { setSlotFrom(m); if (slotTo <= m) setSlotTo(Math.min(SLOT_MAX, m + 60)); }} />
                                    <TimeWheel label={t('scheduledProvider.form.to')} minutes={slotTo} min={Math.min(SLOT_MAX, slotFrom + 30)} max={SLOT_MAX} onChange={setSlotTo} />
                                </View>
                                <Text className="font-outfit-semibold" style={{ fontSize: 13.5, color: SC.text }}>
                                    {`${dateFromKey(slotDay).toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' })} · ${formatMinutes(slotFrom)} – ${formatMinutes(slotTo)}`}
                                </Text>
                                <Text className="font-outfit-regular" style={{ fontSize: 12, color: SC.muted }}>{t('scheduledProvider.form.slotHint')}</Text>
                            </>
                        ) : null}
                    </View>

                    <View className="flex-row" style={{ gap: 10 }}>
                        <View style={{ flex: 1 }}>
                            <FieldLabel>{t('scheduledProvider.form.warrantyDays')}</FieldLabel>
                            <TextField value={warrantyDays} onChangeText={(v) => setWarrantyDays(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="30" maxLength={4} />
                        </View>
                        <View style={{ flex: 2 }}>
                            <FieldLabel>{t('scheduledProvider.form.warrantyCoverage')}</FieldLabel>
                            <TextField value={warrantyCoverage} onChangeText={setWarrantyCoverage} placeholder={t('scheduledProvider.form.warrantyCoveragePlaceholder')} maxLength={200} />
                        </View>
                    </View>

                    {notice ? <Note tone="amber">{notice}</Note> : null}
                </ScrollView>
            </KeyboardAvoidingView>
            <Footer label={mine ? t('scheduledProvider.form.update') : t('scheduledProvider.form.send')} disabled={!!problem} loading={busy} onPress={send} />
        </View>
    );
}

function Row({ icon: Icon, label, value, hint }: { icon: typeof Car; label: string; value: string; hint?: string }) {
    return (
        <View className="flex-row" style={{ gap: 12 }}>
            <View className="items-center justify-center" style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: SC.blueSoft }}>
                <Icon size={19} color={SC.blue} />
            </View>
            <View className="flex-1">
                <Text className="font-outfit-bold" style={{ fontSize: 11, letterSpacing: 1.2, color: SC.muted }}>{label}</Text>
                <Text className="font-outfit-semibold" style={{ fontSize: 15, lineHeight: 21, color: SC.text, marginTop: 2 }}>{value}</Text>
                {hint ? <Text className="font-outfit-regular" style={{ fontSize: 12, color: SC.muted, marginTop: 2 }}>{hint}</Text> : null}
            </View>
        </View>
    );
}
