import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, CreditCard, Crown, Plus } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { useUser } from '@/context/UserContext';
import type { PaymentCard } from '@/lib/dao/interfaces';
import { paymentMethodDAO } from '@/lib/dao/PaymentMethodDAO';
import { loadMembership, type Membership } from '@/lib/membership/plan';
import { cardLabel, isExpired } from '@/lib/payments/cardLabel';
import { RETURN_TO_BACK } from '@/lib/payments/cardRequired';
import { BUTTON_RADIUS } from '@/lib/ui/floatingFooter';
import { TYPE } from '@/lib/ui/type';

const INK = { text: '#0B1530', muted: '#6B7490', blue: '#1E56E3', soft: '#EAF1FF', line: '#EEF2FA', amber: '#B45309', amberSoft: '#FEF3C7', green: '#0F8A5F' };
const CARD = { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: INK.line, shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 } as const;

/** The technician's plan and the cards of their wallet, reloaded each time the screen is reached (paying or adding a card happens elsewhere). */
function useMembershipWallet() {
    const { user } = useUser();
    const [plan, setPlan] = useState<Membership | null>(null);
    const [cards, setCards] = useState<PaymentCard[] | null>(null);
    useFocusEffect(
        useCallback(() => {
            if (!user?.id) return undefined;
            let active = true;
            loadMembership('mechanic', user.id).then((m) => { if (active) setPlan(m); });
            paymentMethodDAO.list().then((l) => { if (active) setCards(l); }).catch(() => { if (active) setCards([]); });
            return () => { active = false; };
        }, [user?.id]),
    );
    return { plan, cards };
}

const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * In "Your earnings": where the membership stands (due, or paid and when it renews) and the way into the cards of the wallet. The plan itself is
 * managed in Membership plan; this is the money side of it, next to what the technician earns.
 */
export function MembershipEarningsCard() {
    const { t, i18n } = useTranslation();
    const router = useRouter();
    const { plan, cards } = useMembershipWallet();
    if (!plan) return null;
    const paid = !!plan.payment;
    const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' });
    return (
        <View style={{ ...CARD, padding: 16, marginBottom: 16 }} testID="membership-earnings-card">
            <TouchableOpacity onPress={() => router.push('/(tabs)/membership' as never)} activeOpacity={0.85} accessibilityRole="button" className="flex-row items-center" style={{ gap: 12 }} testID="membership-earnings-open">
                <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: INK.soft }}><Crown size={20} color={INK.blue} /></View>
                <View className="flex-1" style={{ minWidth: 0 }}>
                    <Text className="font-outfit-bold" style={{ ...TYPE.body, color: INK.text }}>{t('payments.membership.title')}</Text>
                    <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: paid ? INK.green : INK.amber }}>
                        {paid && plan.nextPaymentAt ? t('payments.membership.paid', { date: date(plan.nextPaymentAt) }) : t('payments.membership.due', { amount: money(plan.amount) })}
                    </Text>
                </View>
                {paid ? <ChevronRight size={18} color={INK.muted} /> : null}
            </TouchableOpacity>
            {/* Not paid: the way to pay goes under the words (aligned with them), not in a second column squeezing them. */}
            {paid ? null : (
                <TouchableOpacity
                    onPress={() => router.push('/(tabs)/membership' as never)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    className="items-center justify-center self-start"
                    style={{ marginTop: 10, marginLeft: 52, minHeight: 40, paddingHorizontal: 18, borderRadius: BUTTON_RADIUS, backgroundColor: '#12B76A' }}
                    testID="membership-earnings-pay"
                >
                    <Text className="font-outfit-bold text-white" style={{ fontSize: 14, lineHeight: 20 }}>{t('payments.membership.payNow')}</Text>
                </TouchableOpacity>
            )}

            <View style={{ height: 1, backgroundColor: INK.line, marginVertical: 14 }} />

            <Text className="font-outfit-bold" style={{ ...TYPE.body, color: INK.text }}>{t('payments.membership.methods')}</Text>
            {cards === null ? null : cards.length === 0 ? (
                <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: INK.muted, marginTop: 4 }}>{t('payments.membership.methodsNone')}</Text>
            ) : (
                cards.map((c) => (
                    <View key={c.id} className="flex-row items-center" style={{ gap: 12, paddingTop: 12 }} testID={`earnings-card-${c.id}`}>
                        <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: INK.soft }}><CreditCard size={20} color={INK.blue} /></View>
                        <View className="flex-1" style={{ minWidth: 0 }}>
                            <Text className="font-outfit-semibold" style={{ ...TYPE.body, color: INK.text }} numberOfLines={1}>{cardLabel(c)}</Text>
                            {isExpired(c) || c.isDefault ? <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: isExpired(c) ? '#B42318' : INK.muted }}>{t(isExpired(c) ? 'payments.membership.expired' : 'payments.membership.defaultCard')}</Text> : null}
                        </View>
                    </View>
                ))
            )}
            <TouchableOpacity onPress={() => router.push({ pathname: '/payment-cards', params: { returnTo: RETURN_TO_BACK } })} activeOpacity={0.85} accessibilityRole="button" className="flex-row items-center justify-center" style={{ gap: 8, minHeight: 48, marginTop: 14, borderRadius: BUTTON_RADIUS, backgroundColor: '#E6EAF2' }} testID="earnings-payment-methods">
                <Plus size={18} color="#4A5470" />
                <Text className="font-outfit-bold" style={{ ...TYPE.button, color: '#4A5470' }}>{t(cards && cards.length > 0 ? 'payments.membership.manageCards' : 'payments.membership.addCard')}</Text>
            </TouchableOpacity>
        </View>
    );
}

/** The membership payment as a line of the activity (a payment going out, so the earnings, what was paid and what is withdrawn add up). */
export function MembershipActivityRow() {
    const { t, i18n } = useTranslation();
    const { plan } = useMembershipWallet();
    if (!plan?.payment) return null;
    const { payment } = plan;
    return (
        <View className="bg-white rounded-2xl px-4 py-4 mb-3 border" style={{ borderColor: '#E1EAFB' }} testID="membership-activity-row">
            <View className="flex-row items-start" style={{ gap: 10 }}>
                <View className="flex-1" style={{ minWidth: 0 }}>
                    <Text className="font-outfit-semibold text-gray-900" style={TYPE.body} numberOfLines={1}>{t('payments.membership.activityTitle')}</Text>
                    <Text className="font-outfit-medium mt-1" style={{ ...TYPE.helper, color: '#0047AB' }}>
                        {new Date(payment.paidAt).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </Text>
                    <Text className="font-outfit-regular mt-0.5" style={{ ...TYPE.helper, color: INK.muted }} numberOfLines={2}>
                        {t('payments.membership.paidWith', { method: payment.method.label || t('membership.billing.methodCard') })}{payment.couponCode ? ` · ${payment.couponCode}` : ''}
                    </Text>
                </View>
                <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, color: '#B42318' }}>{`−${money(payment.amount)}`}</Text>
            </View>
        </View>
    );
}
