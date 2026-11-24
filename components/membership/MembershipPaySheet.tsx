import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle2, CreditCard, Plus, Wallet } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';

import { SheetDim } from '@/components/ui/SheetDim';
import { SheetHandle } from '@/components/ui/SheetHandle';
import type { PaymentCard } from '@/lib/dao/interfaces';
import type { PaymentMethodUsed } from '@/lib/membership/plan';
import { cardLabel, isExpired } from '@/lib/payments/cardLabel';
import { BUTTON_RADIUS, CONFIRM_GRADIENT } from '@/lib/ui/floatingFooter';
import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';
import { SHEET } from '@/lib/ui/sheet';
import { TYPE } from '@/lib/ui/type';

const INK = { text: '#0B1530', muted: '#6B7490', blue: '#1E56E3', soft: '#EAF1FF', border: '#E4EAF5' };

const EARNINGS = 'earnings';

/** What can be picked, as the sheet orders it: the card kept in the wallet first, then the earnings (when they cover it), then "add a card". */
export function defaultMethod(cards: readonly PaymentCard[], earningsReady: number | null, amount: number): string | null {
    const usable = cards.filter((c) => !isExpired(c));
    const preferred = usable.find((c) => c.isDefault) ?? usable[0];
    if (preferred) return preferred.id;
    if (earningsReady !== null && earningsReady >= amount) return EARNINGS;
    return null;
}

/**
 * "How do you want to pay?": the technician's plan for the year. The earnings balance (only when it covers the whole amount), the cards kept in
 * their wallet, and a way to add a card, which is kept there for the renewal and for what comes next. A card can renew by itself.
 */
export function MembershipPaySheet({
    visible,
    amount,
    planName,
    cards,
    earningsReady,
    paying,
    onClose,
    onAddCard,
    onPay,
}: {
    visible: boolean;
    amount: number;
    /** The plan being paid, as the person knows it. */
    planName: string;
    cards: PaymentCard[];
    /** What the earnings have ready to pay out; null while unknown. */
    earningsReady: number | null;
    paying: boolean;
    onClose: () => void;
    onAddCard: () => void;
    onPay: (method: PaymentMethodUsed, autoRenew: boolean) => void;
}) {
    const { t } = useTranslation();
    const money = (n: number) => `$${n.toFixed(2)}`;
    const [selected, setSelected] = useState<string | null>(null);
    const [autoRenew, setAutoRenew] = useState(true);
    const earningsCover = earningsReady !== null && earningsReady >= amount;

    useEffect(() => {
        if (visible) setSelected(defaultMethod(cards, earningsReady, amount));
    }, [visible, cards, earningsReady, amount]);

    const card = cards.find((c) => c.id === selected) ?? null;
    const method: PaymentMethodUsed | null = selected === EARNINGS
        ? { type: 'earnings', label: t('membership.paySheet.earningsLabel') }
        : card ? { type: 'card', label: cardLabel(card), cardId: card.id } : null;

    const option = (key: string, icon: React.ReactNode, title: string, sub: string, disabled = false) => (
        <TouchableOpacity
            key={key}
            disabled={disabled}
            onPress={() => setSelected(key)}
            activeOpacity={0.85}
            accessibilityRole="radio"
            accessibilityState={{ selected: selected === key, disabled }}
            className="flex-row items-center"
            style={{ gap: 12, padding: 14, marginBottom: 8, borderRadius: 14, borderWidth: 1.5, borderColor: selected === key ? INK.blue : INK.border, backgroundColor: selected === key ? '#F4F8FF' : '#FFFFFF', opacity: disabled ? 0.55 : 1 }}
            testID={`pay-option-${key}`}
        >
            <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: INK.soft }}>{icon}</View>
            <View className="flex-1" style={{ minWidth: 0 }}>
                <Text className="font-outfit-bold" style={{ ...TYPE.body, color: INK.text }}>{title}</Text>
                <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: INK.muted }}>{sub}</Text>
            </View>
            {selected === key ? <CheckCircle2 size={22} color={INK.blue} /> : null}
        </TouchableOpacity>
    );

    return (
        <Modal supportedOrientations={MODAL_ORIENTATIONS} transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <SheetDim color="rgba(11,21,48,0.45)" />
            <Pressable style={{ flex: 1 }} onPress={onClose} />
            <View style={{ ...SHEET, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34, maxHeight: '85%' }} testID="membership-pay-sheet">
                <SheetHandle />
                <Text className="font-outfit-bold" style={{ fontSize: 20, lineHeight: 26, color: INK.text }}>{t('membership.paySheet.title')}</Text>
                <Text className="font-outfit-regular" style={{ ...TYPE.body, color: INK.muted, marginTop: 4, marginBottom: 14 }}>{t('membership.paySheet.subtitle', { amount: money(amount), plan: planName })}</Text>

                <ScrollView showsVerticalScrollIndicator={false}>
                    {cards.map((c) => option(c.id, <CreditCard size={20} color={INK.blue} />, cardLabel(c), isExpired(c) ? t('membership.paySheet.expired') : c.isDefault ? t('membership.paySheet.defaultCard') : t('membership.paySheet.savedCard'), isExpired(c)))}
                    {earningsReady !== null
                        ? option(
                            EARNINGS,
                            <Wallet size={20} color={INK.blue} />,
                            t('membership.paySheet.earningsLabel'),
                            earningsCover ? t('membership.paySheet.earningsAvailable', { amount: money(earningsReady) }) : t('membership.paySheet.earningsShort', { amount: money(earningsReady) }),
                            !earningsCover,
                        )
                        : null}
                    <TouchableOpacity onPress={onAddCard} activeOpacity={0.85} accessibilityRole="button" className="flex-row items-center" style={{ gap: 12, padding: 14, marginBottom: 8, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#BFD3FA' }} testID="pay-add-card">
                        <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: INK.soft }}><Plus size={20} color={INK.blue} /></View>
                        <View className="flex-1" style={{ minWidth: 0 }}>
                            <Text className="font-outfit-bold" style={{ ...TYPE.body, color: INK.blue }}>{t('membership.paySheet.addCard')}</Text>
                            <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: INK.muted }}>{t('membership.paySheet.addCardHint')}</Text>
                        </View>
                    </TouchableOpacity>
                </ScrollView>

                {card ? (
                    <View className="flex-row items-center" style={{ gap: 12, paddingVertical: 10 }}>
                        <View className="flex-1" style={{ minWidth: 0 }}>
                            <Text className="font-outfit-semibold" style={{ ...TYPE.body, color: INK.text }}>{t('membership.paySheet.autoRenew')}</Text>
                            <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: INK.muted }}>{t('membership.paySheet.autoRenewHint')}</Text>
                        </View>
                        <Switch value={autoRenew} onValueChange={setAutoRenew} trackColor={{ true: '#12B76A', false: '#D5DCEB' }} testID="pay-auto-renew" />
                    </View>
                ) : null}

                <TouchableOpacity
                    onPress={() => method && onPay(method, autoRenew)}
                    disabled={!method || paying}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    style={{ marginTop: 6, opacity: !method || paying ? 0.55 : 1 }}
                    testID="pay-confirm"
                >
                    <LinearGradient colors={[...CONFIRM_GRADIENT]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ minHeight: 56, borderRadius: BUTTON_RADIUS, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
                        {paying ? <ActivityIndicator color="#FFFFFF" /> : <Text className="font-outfit-bold text-white" style={TYPE.button}>{t('membership.pay.button', { amount: money(amount) })}</Text>}
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </Modal>
    );
}
