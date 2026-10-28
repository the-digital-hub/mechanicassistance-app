import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { AO } from '@/components/offer/OfferSections';
import type { PaymentCard } from '@/lib/dao/interfaces';
import type { Wallet } from '@/lib/dao/WalletDAO';
import { cardLabel, isExpired } from '@/lib/payments/cardLabel';
import { formatMoney, shortfall, suggestedTopUp } from '@/lib/payments/paymentSource';

import { TopUpForm } from './TopUpSheet';

const K = 'wallet.insufficient';

type Step = 'choose' | 'topUp' | 'card';

/**
 * The wallet could not cover a charge (402 `insufficient_funds`). The owner
 * chooses: add the missing money to the wallet (prefilled with the shortfall,
 * editable) and pay from it, or pay this charge with a card. The parent retries
 * the charge from `onToppedUp` / `onPayWithCard`; nothing is mixed — one charge
 * is paid by one source.
 */
export function InsufficientFundsSheet({ visible, amount, wallet, cards, busy, onToppedUp, onPayWithCard, onClose }: {
    visible: boolean;
    /** What the charge costs. */
    amount: number;
    wallet: Wallet | null;
    cards: PaymentCard[];
    /** The parent is retrying the charge. */
    busy?: boolean;
    onToppedUp: (wallet: Wallet) => void;
    onPayWithCard: (cardId: string) => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const [step, setStep] = React.useState<Step>('choose');
    const usable = cards.filter((c) => !isExpired(c));
    const missing = shortfall(amount, wallet);

    React.useEffect(() => {
        if (visible) setStep('choose');
    }, [visible]);

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={busy ? undefined : onClose} />
            <View
                style={{ backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 34, maxHeight: '85%' }}
                testID="insufficient-funds-sheet"
            >
                {busy ? (
                    <View className="items-center" style={{ paddingVertical: 30, gap: 12 }}>
                        <ActivityIndicator color={AO.blue} />
                        <Text className="font-outfit-semibold" style={{ fontSize: 14, color: AO.muted }}>{t(`${K}.retrying`)}</Text>
                    </View>
                ) : step === 'topUp' ? (
                    <TopUpForm cards={cards} initialAmount={suggestedTopUp(amount, wallet)} onDone={onToppedUp} onCancel={() => setStep('choose')} />
                ) : step === 'card' ? (
                    <View>
                        <Text className="font-outfit-bold" style={{ fontSize: 17, color: AO.text, marginBottom: 12 }}>{t(`${K}.pickCard`)}</Text>
                        <ScrollView>
                            {usable.map((card) => (
                                <TouchableOpacity
                                    key={card.id}
                                    onPress={() => onPayWithCard(card.id)}
                                    className="flex-row items-center"
                                    style={{ gap: 12, padding: 14, marginBottom: 8, borderRadius: 14, borderWidth: 1.5, borderColor: AO.border }}
                                    testID={`insufficient-funds-card-${card.id}`}
                                >
                                    <Ionicons name="card-outline" size={20} color={AO.blue} />
                                    <Text className="font-outfit-semibold" style={{ flex: 1, fontSize: 14.5, color: AO.text }}>{cardLabel(card)}</Text>
                                    <Text className="font-outfit-bold" style={{ fontSize: 14, color: AO.blue }}>{formatMoney(amount)}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity onPress={() => setStep('choose')} className="items-center" style={{ paddingVertical: 12 }}>
                            <Text className="font-outfit-bold" style={{ color: AO.muted, fontSize: 14 }}>{t(`${K}.back`)}</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View>
                        <View className="flex-row items-center" style={{ gap: 10 }}>
                            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: AO.orangeSoft, alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="wallet-outline" size={20} color={AO.orange} />
                            </View>
                            <Text className="font-outfit-bold" style={{ flex: 1, fontSize: 17, color: AO.text }}>{t(`${K}.title`)}</Text>
                        </View>
                        <Text className="font-outfit-regular" style={{ fontSize: 13.5, color: AO.muted, marginTop: 10, lineHeight: 19 }} testID="insufficient-funds-body">
                            {t(`${K}.body`, {
                                amount: formatMoney(amount),
                                available: formatMoney(wallet?.availableBalance ?? 0),
                                missing: formatMoney(missing),
                            })}
                        </Text>

                        <TouchableOpacity
                            onPress={() => setStep('topUp')}
                            className="flex-row items-center justify-center"
                            style={{ gap: 8, marginTop: 18, paddingVertical: 14, borderRadius: 12, backgroundColor: AO.blue }}
                            testID="insufficient-funds-topup"
                            accessibilityRole="button"
                        >
                            <Ionicons name="add-circle-outline" size={18} color="#fff" />
                            <Text className="font-outfit-bold" style={{ fontSize: 14.5, color: '#fff' }}>{t(`${K}.addFunds`, { missing: formatMoney(missing) })}</Text>
                        </TouchableOpacity>
                        {usable.length > 0 && (
                            <TouchableOpacity
                                onPress={() => setStep('card')}
                                className="flex-row items-center justify-center"
                                style={{ gap: 8, marginTop: 10, paddingVertical: 14, borderRadius: 12, backgroundColor: AO.blueSoft }}
                                testID="insufficient-funds-card"
                                accessibilityRole="button"
                            >
                                <Ionicons name="card-outline" size={18} color={AO.blue} />
                                <Text className="font-outfit-bold" style={{ fontSize: 14.5, color: AO.blue }}>{t(`${K}.payWithCard`)}</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={onClose} className="items-center" style={{ paddingVertical: 12, marginTop: 4 }}>
                            <Text className="font-outfit-bold" style={{ color: AO.muted, fontSize: 14 }}>{t(`${K}.cancel`)}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
