import { LinearGradient } from 'expo-linear-gradient';
import { BadgeCheck, CalendarClock, Check, Crown, Info, Repeat, Sparkles, Ticket, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useUser } from '@/context/UserContext';
import { applyPromoCode, cancelPlan, loadMembership, removePromoCode, type Membership } from '@/lib/membership/plan';
import { appAlert } from '@/lib/ui/appAlert';
import { BUTTON_RADIUS } from '@/lib/ui/floatingFooter';
import { formatLocalDateTime } from '@/lib/video/videoCallTime';
import { TYPE } from '@/lib/ui/type';

const C = { blue: '#1E56E3', soft: '#EAF1FF', text: '#0B1530', muted: '#6B7490', border: '#E4EAF5', line: '#EEF2FA', green: '#12B76A', greenSoft: '#E7F8EF', greenText: '#0F8A5F' };

const card = { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: C.line, shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 2 } as const;

/** A small blue tile with the line's icon, as in the rest of the app's rows. */
function IconTile({ icon: Icon }: { icon: typeof Crown }) {
    return (
        <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.soft }}>
            <Icon size={20} color={C.blue} />
        </View>
    );
}

/**
 * The profile's Membership plan (technician and vehicle owner). The membership card on top, what the plan includes, the billing facts
 * (shown as coming soon until plans launch) and a promo code field. Simulated: see lib/membership/plan.ts.
 */
export default function MembershipScreen() {
    const { t, i18n } = useTranslation();
    const { user } = useUser();
    const role: 'mechanic' | 'user' = user?.role === 'mechanic' ? 'mechanic' : 'user';
    const [plan, setPlan] = useState<Membership | null>(null);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        loadMembership(role, user?.id).then((m) => { if (!cancelled) setPlan(m); });
        return () => { cancelled = true; };
    }, [role, user?.id]);

    const name = [user?.name, user?.surname].filter(Boolean).join(' ');
    const waived = plan?.status === 'startup_waived';
    const price = `$${(plan?.amount ?? 0).toFixed(2)}`;
    const includes = ['account', 'wallet', 'support', role === 'mechanic' ? 'jobs' : 'requests'] as const;

    // Simulated until plans launch: it answers that nothing can change yet (see lib/membership/plan.ts).
    const takeCouponOff = async () => {
        await removePromoCode(user?.id);
        setPlan(await loadMembership(role, user?.id));
    };

    const askCancel = () => {
        appAlert(t('membership.actions.cancelTitle'), t('membership.actions.cancelBody'), [
            { text: t('membership.actions.keep') },
            {
                text: t('membership.actions.cancelConfirm'),
                style: 'destructive',
                onPress: async () => {
                    const result = await cancelPlan();
                    if (!result.ok) appAlert(t('membership.actions.cancelSoonTitle'), t('membership.actions.cancelSoon'), [{ text: t('membership.actions.gotIt') }], { tone: 'info' });
                },
            },
        ], { tone: 'warning' });
    };

    const apply = async () => {
        const value = code.trim();
        if (!value || busy) return;
        setBusy(true);
        const result = await applyPromoCode(value, role, user?.id);
        setBusy(false);
        if (result.ok) {
            setCode('');
            setPlan(await loadMembership(role, user?.id));
            appAlert(t('membership.promo.applied', { percent: result.coupon?.percentOff }), undefined, undefined, { tone: 'success' });
        } else {
            appAlert(t(`membership.promo.${result.reason ?? 'invalid'}`));
        }
    };

    return (
        <ScrollView style={{ backgroundColor: '#F6F8FC' }} contentContainerStyle={{ padding: 24, paddingBottom: 48, gap: 18 }} keyboardShouldPersistTaps="handled" testID="membership-screen">
            <View>
                <View className="flex-row items-center self-start" style={{ gap: 6, marginTop: 8, marginBottom: 14, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#E9F1FF' }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#0047AB' }} />
                    <Text className="font-outfit-semibold" style={{ ...TYPE.eyebrow, color: C.blue }}>{t('membership.badge').toUpperCase()}</Text>
                </View>
                <Text className="font-outfit-bold" style={{ fontSize: 28, lineHeight: 34, letterSpacing: -0.6, color: C.text }}>{t('membership.title')}</Text>
                <Text className="font-outfit-regular" style={{ ...TYPE.body, color: C.muted, marginTop: 8 }}>{t('membership.subtitle')}</Text>
            </View>

            {!plan ? (
                <View className="items-center" style={{ paddingVertical: 40 }}><ActivityIndicator color={C.blue} /></View>
            ) : (
                <>
                    {/* The membership card: the plan, whose it is and what it costs now. */}
                    <LinearGradient colors={['#2B66F8', '#081E72']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 22, overflow: 'hidden' }} testID="membership-card">
                        <View style={{ position: 'absolute', right: -50, top: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.07)' }} />
                        <View style={{ position: 'absolute', right: 30, bottom: -70, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.05)' }} />
                        <View className="flex-row items-center justify-between">
                            <Image source={require('@/assets/images/brand_ring_white.png')} style={{ width: 44, height: 44 }} resizeMode="contain" />
                            {plan.coupon ? (
                                <View className="flex-row items-center" style={{ gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(18,183,106,0.95)' }} testID="membership-coupon-badge">
                                    <Ticket size={15} color="#FFFFFF" />
                                    <Text className="font-outfit-bold text-white" style={{ fontSize: 12, letterSpacing: 0.8 }}>{`${t('membership.coupon.badge')} · ${t('membership.coupon.off', { percent: plan.coupon.percentOff })}`.toUpperCase()}</Text>
                                </View>
                            ) : waived ? (
                                <View className="flex-row items-center" style={{ gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(18,183,106,0.95)' }}>
                                    <BadgeCheck size={15} color="#FFFFFF" />
                                    <Text className="font-outfit-bold text-white" style={{ fontSize: 12, letterSpacing: 0.8 }}>{t('membership.status.startup_waived').toUpperCase()}</Text>
                                </View>
                            ) : null}
                        </View>
                        <Text className="font-outfit-semibold" style={{ ...TYPE.eyebrow, color: '#BFD3FF', marginTop: 26 }}>{t('membership.cardEyebrow').toUpperCase()}</Text>
                        <Text className="font-outfit-bold text-white" style={{ fontSize: 24, lineHeight: 30, letterSpacing: -0.4, marginTop: 4 }}>{plan.planName}</Text>
                        {name ? <Text className="font-outfit-regular" style={{ ...TYPE.body, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{name}</Text> : null}
                        <View className="flex-row items-end" style={{ marginTop: 22, gap: 6 }}>
                            <Text className="font-outfit-bold text-white" style={{ fontSize: 40, lineHeight: 44, letterSpacing: -1 }} testID="membership-price">{price}</Text>
                            <Text className="font-outfit-medium" style={{ ...TYPE.body, color: 'rgba(255,255,255,0.8)', paddingBottom: 6 }}>{t(`membership.per.${plan.period}`)}</Text>
                            {plan.coupon ? (
                                <Text className="font-outfit-medium" style={{ ...TYPE.body, color: 'rgba(255,255,255,0.6)', paddingBottom: 6, marginLeft: 6, textDecorationLine: 'line-through' }} testID="membership-list-price">{`$${plan.listAmount.toFixed(2)}`}</Text>
                            ) : null}
                        </View>
                        <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{plan.coupon ? t('membership.coupon.note', { percent: plan.coupon.percentOff, code: plan.coupon.code }) : t(waived ? 'membership.feeNoteWaived' : plan.period === 'year' ? 'membership.feeNoteYearly' : 'membership.feeNote')}</Text>
                    </LinearGradient>

                    {/* What the plan includes. */}
                    <View style={{ ...card, padding: 18 }}>
                        <View className="flex-row items-center" style={{ gap: 10, marginBottom: 6 }}>
                            <IconTile icon={Sparkles} />
                            <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, color: C.text }}>{t('membership.includesTitle')}</Text>
                        </View>
                        {includes.map((key) => (
                            <View key={key} className="flex-row items-center" style={{ gap: 12, paddingVertical: 11, borderTopWidth: 1, borderTopColor: C.line }}>
                                <View className="items-center justify-center" style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.greenSoft }}>
                                    <Check size={14} color={C.greenText} strokeWidth={3} />
                                </View>
                                <Text className="flex-1 font-outfit-semibold" style={{ ...TYPE.body, color: C.text }}>{t(`membership.includes.${key}`)}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Promo code. */}
                    <View style={{ ...card, padding: 18, borderStyle: 'dashed', borderColor: '#BFD3FA' }}>
                        <View className="flex-row items-center" style={{ gap: 10, marginBottom: 12 }}>
                            <IconTile icon={Ticket} />
                            <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, color: C.text }}>{t('membership.promo.title')}</Text>
                        </View>
                        {plan.coupon ? (
                            // Applied: the code and what it takes off, with a way to remove it (the input is not needed any more).
                            <View className="flex-row items-center" style={{ gap: 12, padding: 14, borderRadius: 16, backgroundColor: '#ECFDF3', borderWidth: 1, borderColor: '#BBF0D3' }} testID="promo-applied">
                                <Check size={20} color="#15803D" />
                                <View className="flex-1" style={{ minWidth: 0 }}>
                                    <Text className="font-outfit-bold" style={{ ...TYPE.body, color: C.text }}>{plan.coupon.code}</Text>
                                    <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: '#4B5563' }}>{t('membership.coupon.off', { percent: plan.coupon.percentOff })}</Text>
                                </View>
                                <TouchableOpacity onPress={takeCouponOff} hitSlop={10} accessibilityRole="button" testID="promo-remove">
                                    <Text className="font-outfit-bold" style={{ ...TYPE.helper, color: '#DC2626' }}>{t('membership.coupon.remove')}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <>
                                <TextInput
                                    value={code}
                                    onChangeText={setCode}
                                    placeholder={t('membership.promo.placeholder')}
                                    placeholderTextColor="#9AA3B8"
                                    autoCapitalize="characters"
                                    autoCorrect={false}
                                    returnKeyType="done"
                                    onSubmitEditing={apply}
                                    className="font-outfit-semibold"
                                    style={{ minHeight: 52, borderRadius: BUTTON_RADIUS, paddingHorizontal: 14, backgroundColor: '#F6F8FC', borderWidth: 1.5, borderColor: C.border, fontSize: 16, color: C.text }}
                                    testID="promo-input"
                                />
                                <TouchableOpacity
                                    onPress={apply}
                                    disabled={!code.trim() || busy}
                                    activeOpacity={0.85}
                                    accessibilityRole="button"
                                    className="items-center justify-center"
                                    style={{ minHeight: 56, borderRadius: BUTTON_RADIUS, backgroundColor: C.soft, marginTop: 10, opacity: code.trim() ? 1 : 0.55 }}
                                    testID="promo-apply"
                                >
                                    {busy ? <ActivityIndicator color={C.blue} /> : <Text className="font-outfit-bold" style={{ ...TYPE.button, color: C.blue }}>{t('membership.promo.apply')}</Text>}
                                </TouchableOpacity>
                                <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: C.muted, marginTop: 10 }}>{t('membership.promo.hint')}</Text>
                            </>
                        )}
                    </View>

                    {/* The billing facts: laid out already, filled in once plans launch. */}
                    <View style={{ ...card, padding: 18 }}>
                        <View className="flex-row items-center justify-between" style={{ marginBottom: 6 }}>
                            <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, color: C.text }}>{t('membership.billingTitle')}</Text>
                            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: C.soft }}>
                                <Text className="font-outfit-bold" style={{ ...TYPE.eyebrow, color: C.blue }}>{t('membership.comingSoon').toUpperCase()}</Text>
                            </View>
                        </View>
                        {[
                            { key: 'period', icon: Repeat, value: plan.periodsOffered.length === 1 ? t(`membership.billing.periodOnly.${plan.periodsOffered[0]}`) : t('membership.billing.periodValue') },
                            { key: 'next', icon: CalendarClock, value: plan.nextPaymentAt ? formatLocalDateTime(plan.nextPaymentAt, i18n.language) : '—' },
                            { key: 'promo', icon: Ticket, value: t(plan.promoAvailable ? 'membership.billing.promoValue' : 'membership.billing.promoNone') },
                        ].map((row) => (
                            <View key={row.key} className="flex-row items-center" style={{ gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line }}>
                                <IconTile icon={row.icon} />
                                <View className="flex-1" style={{ minWidth: 0 }}>
                                    <Text className="font-outfit-semibold" style={{ ...TYPE.caption, color: C.muted }}>{t(`membership.billing.${row.key}`)}</Text>
                                    <Text className="font-outfit-bold" style={{ ...TYPE.body, color: C.text }}>{row.value}</Text>
                                    <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: C.muted }}>{t(`membership.billing.${row.key}Hint`)}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* Quiet on purpose: a small red link, not a button (same as cancelling a quote). */}
                    {plan.status !== 'cancelled' ? (
                        <TouchableOpacity onPress={askCancel} accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 16, right: 16 }} className="self-center flex-row items-center" style={{ gap: 6, paddingVertical: 6 }} testID="membership-cancel">
                            <X size={14} color="#DC2626" />
                            <Text className="font-outfit-semibold" style={{ ...TYPE.helper, color: '#DC2626' }}>{t('membership.actions.cancel')}</Text>
                        </TouchableOpacity>
                    ) : null}

                    <View className="flex-row" style={{ gap: 10, paddingHorizontal: 4 }}>
                        <Info size={18} color={C.muted} style={{ marginTop: 1 }} />
                        <Text className="flex-1 font-outfit-regular" style={{ ...TYPE.helper, color: C.muted }}>{t('membership.notice')}</Text>
                    </View>
                </>
            )}
        </ScrollView>
    );
}
