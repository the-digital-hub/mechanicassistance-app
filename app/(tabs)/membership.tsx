import { useTabBarInset } from '@/components/ui/RoundedTabBar';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeCheck, CalendarClock, Car, Check, ChevronRight, Clock, CreditCard, Crown, Info, Repeat, Sparkles, Ticket, Wallet, X } from 'lucide-react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useUser } from '@/context/UserContext';
import { MembershipPaySheet } from '@/components/membership/MembershipPaySheet';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';
import { useKeyboardOpen } from '@/hooks/useKeyboardOpen';
import { setTabBarFooter } from '@/lib/ui/tabBarVisibility';
import type { PaymentCard } from '@/lib/dao/interfaces';
import { earningsDAO } from '@/lib/dao/EarningsDAO';
import { paymentMethodDAO } from '@/lib/dao/PaymentMethodDAO';
import { applyPromoCode, cancelPlan, loadMembership, OWNER_VEHICLE_PRICES, OWNER_VEHICLE_PRICE_FROM_FOURTH, payMembership, removePromoCode, resetMembershipPayment, setMembershipAutoRenew, type FleetLine, type Membership, type PaymentMethodUsed, type PlanVehicle } from '@/lib/membership/plan';
import { vehicleDAO } from '@/lib/dao/VehicleDAO';
import { cardLabel, isExpired } from '@/lib/payments/cardLabel';
import { RETURN_TO_BACK } from '@/lib/payments/cardRequired';
import { appAlert } from '@/lib/ui/appAlert';
import { BUTTON_RADIUS, CONFIRM_GRADIENT, CONFIRM_CTA, FLOATING_FOOTER } from '@/lib/ui/floatingFooter';
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
 * (with the payment of the year for a technician) and a promo code field. Simulated: see lib/membership/plan.ts.
 */
export default function MembershipScreen() {
    const tabInset = useTabBarInset();
    const { t, i18n } = useTranslation();
    const { user } = useUser();
    const role: 'mechanic' | 'user' = user?.role === 'mechanic' ? 'mechanic' : 'user';
    const [plan, setPlan] = useState<Membership | null>(null);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [paying, setPaying] = useState(false);
    const router = useRouter();
    // What the technician can pay with: the cards kept in the wallet and the earnings ready to pay out (null: not known yet).
    const [cards, setCards] = useState<PaymentCard[]>([]);
    const [earningsReady, setEarningsReady] = useState<number | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    // Went to add a card from the sheet: when coming back, the sheet opens again with the new card there.
    const [resumeSheet, setResumeSheet] = useState(false);

    useFocusEffect(
        useCallback(() => {
            let active = true;
            paymentMethodDAO.list().then((list) => { if (active) setCards(list); }).catch(() => undefined);
            // Only a technician has earnings to pay with.
            if (role === 'mechanic') earningsDAO.list().then((res) => { if (active) setEarningsReady(Number(res.summary.readyNet) || 0); }).catch(() => undefined);
            return () => { active = false; };
        }, [role]),
    );

    useEffect(() => {
        if (resumeSheet && cards.length > 0) { setSheetOpen(true); setResumeSheet(false); }
    }, [resumeSheet, cards]);

    // The owner's plan is per vehicle: the vehicles are read each time the screen is reached (adding one elsewhere changes the plan).
    const vehiclesRef = useRef<PlanVehicle[] | undefined>(undefined);
    const reloadPlan = useCallback(
        () => loadMembership(role, user?.id, null, role === 'user' ? vehiclesRef.current : undefined),
        [role, user?.id],
    );
    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            (async () => {
                if (role === 'user' && user?.id) {
                    vehiclesRef.current = await vehicleDAO.getByUser(user.id).catch(() => []);
                }
                const m = await reloadPlan();
                if (!cancelled) setPlan(m);
            })();
            return () => { cancelled = true; };
        }, [role, user?.id, reloadPlan]),
    );

    const name = [user?.name, user?.surname].filter(Boolean).join(' ');
    const waived = plan?.status === 'startup_waived';
    const pendingPayment = !!plan && !waived && plan.amount > 0 && !plan.payment;
    const paidNow = !!plan?.payment;
    // Whoever has something to pay does it from a footer that is always in sight.
    const canPay = !!plan && !plan.payment && !waived && plan.amount > 0;
    const keyboardOpen = useKeyboardOpen();
    // The pay bar sits over the tab bar's row: while it is there the tab bar keeps its own row (no fade over the button).
    // Only while this screen is the one on view: tab screens stay mounted when you leave them, and a footer flag left on made every other
    // tab lose the fade (the content ended in a hard line over a solid bar row).
    useFocusEffect(
        useCallback(() => {
            setTabBarFooter(canPay);
            return () => setTabBarFooter(false);
        }, [canPay]),
    );
    const scroller = useRef<ScrollView>(null);
    const promoInput = useRef<TextInput>(null);
    const promoY = useRef(0);
    // "Have a promo code?" in the card: takes the screen down to the promo field and opens the keyboard there.
    const goPromo = () => {
        scroller.current?.scrollTo({ y: Math.max(0, promoY.current - 16), animated: true });
        setTimeout(() => promoInput.current?.focus(), 350);
    };
    const price = `$${(plan?.amount ?? 0).toFixed(2)}`;
    // The technician's plan opens every request to them; the owner's is about asking for help.
    const includes = (role === 'mechanic' ? ['apply', 'account', 'wallet', 'support', 'perks'] : ['account', 'wallet', 'support', 'requests', 'perks']) as readonly string[];

    // Simulated until plans launch: it answers that nothing can change yet (see lib/membership/plan.ts).
    const takeCouponOff = async () => {
        await removePromoCode(user?.id, role);
        setPlan(await reloadPlan());
    };

    const dateOnly = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' });
    const money = (n: number) => `$${n.toFixed(2)}`;

    // Pays the year of the plan (simulated until billing has the endpoint): the sheet asks how, then the receipt.
    const askPay = () => {
        if (!plan || paying) return;
        setSheetOpen(true);
    };

    const addCard = () => {
        setSheetOpen(false);
        setResumeSheet(true);
        router.push({ pathname: '/payment-cards', params: { returnTo: RETURN_TO_BACK } });
    };

    const pay = async (method: PaymentMethodUsed, autoRenew: boolean) => {
        setPaying(true);
        const result = await payMembership(role, user?.id, { method, autoRenew, vehicles: vehiclesRef.current });
        setPaying(false);
        if (!result.ok) {
            appAlert(t('membership.pay.failedTitle'), t('membership.pay.failed'), undefined, { tone: 'danger' });
            return;
        }
        setSheetOpen(false);
        const next = await reloadPlan();
        setPlan(next);
        appAlert(t('membership.pay.successTitle'), t('membership.pay.success', { plan: next.planName, date: next.nextPaymentAt ? dateOnly(next.nextPaymentAt) : '' }), undefined, { tone: 'success' });
    };

    const toggleAutoRenew = async (value: boolean) => {
        await setMembershipAutoRenew(user?.id, value, role);
        setPlan(await reloadPlan());
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
            setPlan(await reloadPlan());
            appAlert(t('membership.promo.applied', { percent: result.coupon?.percentOff }), undefined, undefined, { tone: 'success' });
        } else {
            appAlert(t(`membership.promo.${result.reason ?? 'invalid'}`));
        }
    };

    const defaultCard = cards.filter((c) => !isExpired(c)).find((c) => c.isDefault) ?? cards.find((c) => !isExpired(c));
    const methodRow: { key: string; icon: typeof CreditCard; value: string; hint: string; onPress?: () => void } = plan?.payment
        ? { key: 'method', icon: CreditCard, value: plan.payment.method.label || t('membership.billing.methodCard'), hint: t(plan.payment.method.type === 'earnings' ? 'membership.billing.methodEarningsHint' : 'membership.billing.methodCardHint') }
        : defaultCard
            ? { key: 'method', icon: CreditCard, value: cardLabel(defaultCard), hint: t('membership.billing.methodDefaultHint'), onPress: askPay }
            : { key: 'method', icon: CreditCard, value: t('membership.billing.methodUnset'), hint: t('membership.billing.methodUnsetHint'), onPress: askPay };

    return (
        <View style={{ flex: 1, backgroundColor: '#F6F8FC' }}>
        <KeyboardAwareScrollView ref={scroller} style={{ flex: 1, backgroundColor: '#F6F8FC' }} contentContainerStyle={{ padding: 24, paddingBottom: 48 + tabInset, gap: 18 }} keyboardShouldPersistTaps="handled" testID="membership-screen">
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
                            <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                {pendingPayment ? (
                                    <TouchableOpacity onPress={askPay} disabled={!canPay} activeOpacity={0.85} accessibilityRole={canPay ? 'button' : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(245,158,11,0.97)' }} testID="membership-pending-badge">
                                        <Clock size={15} color="#FFFFFF" />
                                        <Text className="font-outfit-bold text-white" style={{ fontSize: 12, letterSpacing: 0.8 }}>{t('membership.pay.pendingBadge').toUpperCase()}</Text>
                                    </TouchableOpacity>
                                ) : paidNow ? (
                                    <View className="flex-row items-center" style={{ gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(18,183,106,0.95)' }} testID="membership-paid-badge">
                                        <BadgeCheck size={15} color="#FFFFFF" />
                                        <Text className="font-outfit-bold text-white" style={{ fontSize: 12, letterSpacing: 0.8 }}>{t('membership.pay.paidPill').toUpperCase()}</Text>
                                    </View>
                                ) : null}
                            {plan.coupon ? (
                                // Two lines so it never runs into the sides of the card: the coupon, and what it takes off as an amount (the percentage is in the note under the price).
                                <View className="flex-row items-center" style={{ gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(18,183,106,0.95)' }} testID="membership-coupon-badge">
                                    <Ticket size={20} color="#FFFFFF" />
                                    <View>
                                        <Text className="font-outfit-bold text-white" style={{ fontSize: 12, lineHeight: 15, letterSpacing: 0.8 }}>{t('membership.coupon.badge').toUpperCase()}</Text>
                                        <Text className="font-outfit-bold text-white" style={{ fontSize: 20, lineHeight: 24, letterSpacing: -0.3 }} testID="membership-coupon-discount">{`\u2212${money(plan.listAmount - plan.amount)}`}</Text>
                                    </View>
                                </View>
                            ) : waived ? (
                                <View className="flex-row items-center" style={{ gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(18,183,106,0.95)' }}>
                                    <BadgeCheck size={15} color="#FFFFFF" />
                                    <Text className="font-outfit-bold text-white" style={{ fontSize: 12, letterSpacing: 0.8 }}>{t('membership.status.startup_waived').toUpperCase()}</Text>
                                </View>
                            ) : null}
                            </View>
                        </View>
                        <Text className="font-outfit-semibold" style={{ ...TYPE.eyebrow, color: '#BFD3FF', marginTop: 26 }}>{t('membership.cardEyebrow').toUpperCase()}</Text>
                        <Text className="font-outfit-bold text-white" style={{ fontSize: 24, lineHeight: 30, letterSpacing: -0.4, marginTop: 4 }}>{plan.planName}</Text>
                        {name ? <Text className="font-outfit-regular" style={{ ...TYPE.body, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{name}</Text> : null}
                        <View className="flex-row items-end" style={{ marginTop: 22, gap: 6 }}>
                            <Text className="font-outfit-bold text-white" style={{ fontSize: 40, lineHeight: 44, letterSpacing: -1 }} testID="membership-price">{price}</Text>
                            <Text className="font-outfit-medium" style={{ ...TYPE.body, color: 'rgba(255,255,255,0.8)', paddingBottom: 6 }}>{t(`membership.per.${plan.period}`)}</Text>
                            {plan.coupon ? (
                                <Text className="font-outfit-medium" style={{ fontSize: 22, lineHeight: 28, color: 'rgba(255,255,255,0.78)', paddingBottom: 5, marginLeft: 8, textDecorationLine: 'line-through', textDecorationColor: '#FFFFFF', textDecorationStyle: 'solid' }} testID="membership-list-price">{`$${plan.listAmount.toFixed(2)}`}</Text>
                            ) : null}
                        </View>
                        <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{plan.coupon ? t('membership.coupon.note', { percent: plan.coupon.percentOff, code: plan.coupon.code }) : t(waived ? 'membership.feeNoteWaived' : plan.period === 'year' ? 'membership.feeNoteYearly' : 'membership.feeNote')}</Text>
                        {pendingPayment && !plan.coupon ? (
                            <TouchableOpacity onPress={goPromo} activeOpacity={0.8} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} className="flex-row items-center self-start" style={{ gap: 6, marginTop: 16, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)' }} testID="membership-have-code">
                                <Ticket size={15} color="#FFFFFF" />
                                <Text className="font-outfit-bold text-white" style={TYPE.helper}>{t('membership.promo.haveCode')}</Text>
                            </TouchableOpacity>
                        ) : null}
                    </LinearGradient>

                    {/* The owner's plan is per vehicle: each one with its price and its own year, and how the total comes about. */}
                    {plan.fleet ? (
                        <View style={{ ...card, padding: 18 }} testID="membership-fleet">
                            <View className="flex-row items-center" style={{ gap: 10, marginBottom: 4 }}>
                                <IconTile icon={Car} />
                                <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, color: C.text }}>{t('membership.fleet.title')}</Text>
                            </View>
                            <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: C.muted, marginBottom: 6 }}>
                                {t('membership.fleet.hint', { first: money(OWNER_VEHICLE_PRICES[0]), second: money(OWNER_VEHICLE_PRICES[1]), fourth: money(OWNER_VEHICLE_PRICE_FROM_FOURTH) })}
                            </Text>
                            {plan.fleet.lines.length === 0 ? (
                                <TouchableOpacity onPress={() => router.push({ pathname: '/(tabs)/vehicles', params: { add: '1' } })} activeOpacity={0.8} accessibilityRole="button" className="flex-row items-center" style={{ gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.line }} testID="membership-fleet-empty">
                                    <Text className="flex-1 font-outfit-semibold" style={{ ...TYPE.body, color: C.text }}>{t('membership.fleet.empty')}</Text>
                                    <ChevronRight size={18} color={C.muted} />
                                </TouchableOpacity>
                            ) : (
                                plan.fleet.lines.map((line: FleetLine) => {
                                    const covered = !line.payment && line.price <= 0;
                                    return (
                                        <View key={line.vehicleId} className="flex-row items-center" style={{ gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line }} testID={`fleet-line-${line.vehicleId}`}>
                                            <View className="flex-1" style={{ minWidth: 0 }}>
                                                <Text className="font-outfit-bold" style={{ ...TYPE.body, color: C.text }} numberOfLines={1}>{line.label}</Text>
                                                <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: C.muted }} numberOfLines={1}>
                                                    {line.payment ? t('membership.fleet.until', { date: dateOnly(line.renewsAt as string) }) : `VIN ••••${line.vinTail}`}
                                                </Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                                <Text className="font-outfit-bold" style={{ ...TYPE.body, color: C.text }}>{money(line.payment ? line.payment.amount : covered ? line.listPrice : line.price)}</Text>
                                                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: line.payment || covered ? C.greenSoft : '#FEF3C7' }}>
                                                    <Text className="font-outfit-bold" style={{ ...TYPE.eyebrow, color: line.payment || covered ? C.greenText : '#B45309' }}>
                                                        {t(line.payment ? 'membership.pay.paidPill' : covered ? 'membership.fleet.covered' : 'membership.pay.duePill').toUpperCase()}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                            {plan.fleet.lines.length > 0 ? (
                                <View style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12, gap: 6 }}>
                                    <View className="flex-row justify-between">
                                        <Text className="font-outfit-regular" style={{ ...TYPE.body, color: C.muted }}>{t('membership.fleet.base', { count: plan.fleet.lines.length, price: money(OWNER_VEHICLE_PRICES[0]) })}</Text>
                                        <Text className="font-outfit-semibold" style={{ ...TYPE.body, color: C.text }}>{money(plan.fleet.lines.length * OWNER_VEHICLE_PRICES[0])}</Text>
                                    </View>
                                    {plan.fleet.fleetDiscount > 0 ? (
                                        <View className="flex-row justify-between" testID="fleet-discount">
                                            <Text className="font-outfit-regular" style={{ ...TYPE.body, color: C.greenText }}>{t('membership.fleet.discount')}</Text>
                                            <Text className="font-outfit-semibold" style={{ ...TYPE.body, color: C.greenText }}>{`\u2212${money(plan.fleet.fleetDiscount)}`}</Text>
                                        </View>
                                    ) : null}
                                    {plan.coupon && plan.listAmount > plan.amount ? (
                                        <View className="flex-row justify-between">
                                            <View style={{ flex: 1, minWidth: 0 }}>
                                                <Text className="font-outfit-semibold" style={{ ...TYPE.body, color: C.greenText }}>{t('membership.fleet.couponApplied', { code: plan.coupon.code })}</Text>
                                                <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: C.greenText }}>{t('membership.coupon.off', { percent: plan.coupon.percentOff })}</Text>
                                            </View>
                                            <Text className="font-outfit-semibold" style={{ ...TYPE.body, color: C.greenText }}>{`\u2212${money(plan.listAmount - plan.amount)}`}</Text>
                                        </View>
                                    ) : null}
                                    <View className="flex-row justify-between" style={{ marginTop: 4 }}>
                                        <Text className="font-outfit-bold" style={{ ...TYPE.body, color: C.text }}>{t(plan.fleet.pendingCount > 0 ? 'membership.fleet.totalDue' : 'membership.fleet.total')}</Text>
                                        <Text className="font-outfit-bold" style={{ ...TYPE.body, color: C.text }} testID="fleet-total">{money(plan.amount)}</Text>
                                    </View>
                                </View>
                            ) : null}
                        </View>
                    ) : null}

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

                    {/* Promo code (not once the year is paid: the amount is settled). */}
                    {plan.payment ? null : (
                    <View onLayout={(e) => { promoY.current = e.nativeEvent.layout.y; }} style={{ ...card, padding: 18, borderStyle: 'dashed', borderColor: '#BFD3FA' }}>
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
                                    ref={promoInput}
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
                    )}

                    {/* Billing: what is due (or paid), when the plan renews and, for a technician with something to pay, the button. */}
                    <View style={{ ...card, padding: 18 }}>
                        <View className="flex-row items-center justify-between" style={{ marginBottom: 6 }}>
                            <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, color: C.text }}>{t('membership.billingTitle')}</Text>
                            {plan.amount > 0 || plan.payment ? (
                                // Simulated payment: a long press on the pill takes it back, to try the flow again (goes when billing is real).
                                <TouchableOpacity
                                    activeOpacity={1}
                                    onLongPress={async () => { if (plan.payment) { await resetMembershipPayment(user?.id, role); setPlan(await reloadPlan()); } }}
                                    style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: plan.payment ? C.greenSoft : '#FEF3C7' }}
                                    testID="billing-pill"
                                >
                                    <Text className="font-outfit-bold" style={{ ...TYPE.eyebrow, color: plan.payment ? C.greenText : '#B45309' }}>{t(plan.payment ? 'membership.pay.paidPill' : 'membership.pay.duePill').toUpperCase()}</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                        {[
                            {
                                key: 'amount',
                                icon: Wallet,
                                value: money(plan.amount),
                                hint: plan.payment ? t('membership.billing.amountPaidHint', { date: dateOnly(plan.payment.paidAt) }) : t(plan.amount > 0 ? 'membership.billing.amountHint' : plan.coupon ? 'membership.billing.amountCovered' : 'membership.billing.amountFree', { plan: plan.planName }),
                            },
                            { key: 'period', icon: Repeat, value: plan.periodsOffered.length === 1 ? t(`membership.billing.periodOnly.${plan.periodsOffered[0]}`) : t('membership.billing.periodValue'), hint: t(plan.periodsOffered.length === 1 ? 'membership.billing.periodOnlyHint' : 'membership.billing.periodHint') },
                            {
                                key: 'next',
                                icon: CalendarClock,
                                value: plan.nextPaymentAt ? dateOnly(plan.nextPaymentAt) : plan.amount > 0 ? t('membership.billing.nextDue') : '—',
                                hint: t(plan.nextPaymentAt ? 'membership.billing.nextHint' : plan.amount > 0 ? 'membership.billing.nextDueHint' : 'membership.billing.nextHint'),
                            },
                            {
                                key: 'promo',
                                icon: Ticket,
                                value: plan.coupon ? `${plan.coupon.code} · ${t('membership.coupon.off', { percent: plan.coupon.percentOff })}` : t(plan.promoAvailable ? 'membership.billing.promoValue' : 'membership.billing.promoNone'),
                                hint: t(plan.coupon ? 'membership.billing.promoAppliedHint' : 'membership.billing.promoHint'),
                            },
                            // Last row: how it was paid, or how it will be (the default card of the wallet, or "choose when you pay").
                            ...(plan.amount > 0 || plan.payment ? [methodRow] : []),
                        ].map((row) => (
                            <TouchableOpacity key={row.key} disabled={!('onPress' in row && row.onPress)} onPress={'onPress' in row ? row.onPress : undefined} activeOpacity={0.8} className="flex-row items-center" style={{ gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line }} testID={`billing-row-${row.key}`}>
                                <IconTile icon={row.icon} />
                                <View className="flex-1" style={{ minWidth: 0 }}>
                                    <Text className="font-outfit-semibold" style={{ ...TYPE.caption, color: C.muted }}>{t(`membership.billing.${row.key}`)}</Text>
                                    <Text className="font-outfit-bold" style={{ ...TYPE.body, color: C.text }}>{row.value}</Text>
                                    <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: C.muted }}>{row.hint}</Text>
                                </View>
                                {'onPress' in row && row.onPress ? <ChevronRight size={18} color={C.muted} /> : null}
                            </TouchableOpacity>
                        ))}
                        {plan.payment?.method.type === 'card' ? (
                            <View className="flex-row items-center" style={{ gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line }} testID="membership-auto-renew">
                                <IconTile icon={Repeat} />
                                <View className="flex-1" style={{ minWidth: 0 }}>
                                    <Text className="font-outfit-semibold" style={{ ...TYPE.caption, color: C.muted }}>{t('membership.billing.autoRenew')}</Text>
                                    <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: C.muted }}>{t(plan.payment.autoRenew ? 'membership.billing.autoRenewOn' : 'membership.billing.autoRenewOff', { date: plan.nextPaymentAt ? dateOnly(plan.nextPaymentAt) : '' })}</Text>
                                </View>
                                <Switch value={plan.payment.autoRenew} onValueChange={toggleAutoRenew} trackColor={{ true: '#12B76A', false: '#D5DCEB' }} />
                            </View>
                        ) : null}
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
            <MembershipPaySheet
                planName={plan?.planName ?? ''}
                visible={sheetOpen && !!plan}
                amount={plan?.amount ?? 0}
                cards={cards}
                earningsReady={earningsReady}
                paying={paying}
                onClose={() => setSheetOpen(false)}
                onAddCard={addCard}
                onPay={pay}
            />
        </KeyboardAwareScrollView>
        {/* The pay bar steps aside while the promo code is being typed: the keyboard (and the field) get the room. */}
        {canPay && plan && !keyboardOpen ? (
            <View style={{ ...FLOATING_FOOTER }} testID="membership-pay-footer">
                <TouchableOpacity onPress={askPay} disabled={paying} activeOpacity={0.85} accessibilityRole="button" style={{ ...CONFIRM_CTA, opacity: paying ? 0.7 : 1 }} testID="membership-pay">
                    <LinearGradient colors={[...CONFIRM_GRADIENT]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ minHeight: 56, borderRadius: BUTTON_RADIUS, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 }}>
                        {paying ? <ActivityIndicator color="#FFFFFF" /> : (
                            <>
                                <CreditCard size={20} color="#FFFFFF" />
                                <Text className="font-outfit-bold text-white" style={TYPE.button}>{t('membership.pay.button', { amount: money(plan.amount) })}</Text>
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        ) : null}
        </View>
    );
}
