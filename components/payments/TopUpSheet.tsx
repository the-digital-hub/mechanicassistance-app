import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AO } from '@/components/offer/OfferSections';
import { ApiError } from '@/lib/api/types';
import type { PaymentCard } from '@/lib/dao/interfaces';
import { MAX_TOP_UP, MIN_TOP_UP, type Wallet, walletDAO } from '@/lib/dao/WalletDAO';
import { cardLabel, isExpired } from '@/lib/payments/cardLabel';
import { RETURN_TO_BACK, apiErrorCode } from '@/lib/payments/cardRequired';
import { parseTopUp } from '@/lib/payments/paymentSource';

const K = 'wallet.topUp';

/** Why a top-up failed, as a translation key. */
export function topUpErrorKey(error: unknown): string {
    const code = apiErrorCode(error);
    if (code === 'topups_paused' || (error instanceof ApiError && error.statusCode === 503)) return `${K}.paused`;
    if (error instanceof ApiError && error.statusCode === 402) return `${K}.declined`;
    return `${K}.failed`;
}

/**
 * Adds money to the wallet from a saved card: amount (prefilled, editable) and
 * card. Billing charges the card right away; `onDone` gets the new wallet.
 */
export function TopUpForm({ cards, initialAmount, onDone, onCancel }: {
    cards: PaymentCard[];
    initialAmount?: string;
    onDone: (wallet: Wallet) => void;
    onCancel: () => void;
}) {
    const { t } = useTranslation();
    const router = useRouter();
    const usable = cards.filter((c) => !isExpired(c));
    const [amount, setAmount] = React.useState(initialAmount ?? '');
    const [cardId, setCardId] = React.useState<string | null>((usable.find((c) => c.isDefault) ?? usable[0])?.id ?? null);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const parsed = parseTopUp(amount);

    const submit = async () => {
        if (!parsed || !cardId || busy) return;
        setBusy(true);
        setError(null);
        try {
            onDone(await walletDAO.topUp(cardId, parsed));
        } catch (err) {
            setError(t(topUpErrorKey(err)));
        } finally {
            setBusy(false);
        }
    };

    return (
        <View testID="wallet-topup-form">
            <Text className="font-outfit-bold" style={{ fontSize: 17, color: AO.text }}>{t(`${K}.title`)}</Text>
            <Text className="font-outfit-regular" style={{ fontSize: 12.5, color: AO.muted, marginTop: 4 }}>
                {t(`${K}.limits`, { min: MIN_TOP_UP, max: MAX_TOP_UP })}
            </Text>

            <View
                className="flex-row items-center"
                style={{ marginTop: 14, borderWidth: 1.5, borderColor: parsed || !amount ? AO.border : AO.red, borderRadius: 14, paddingHorizontal: 14 }}
            >
                <Text className="font-outfit-bold" style={{ fontSize: 22, color: AO.text }}>$</Text>
                <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    className="font-outfit-bold"
                    style={{ flex: 1, fontSize: 22, color: AO.text, paddingVertical: 12, marginLeft: 4 }}
                    testID="wallet-topup-amount"
                    accessibilityLabel={t(`${K}.amount`)}
                />
            </View>

            <Text className="font-outfit-bold" style={{ fontSize: 13, color: AO.text, marginTop: 16, marginBottom: 8 }}>{t(`${K}.card`)}</Text>
            {usable.length === 0 ? (
                <TouchableOpacity
                    onPress={() => {
                        onCancel();
                        router.push({ pathname: '/payment-cards', params: { returnTo: RETURN_TO_BACK } });
                    }}
                    className="flex-row items-center"
                    style={{ gap: 8, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: AO.border }}
                    testID="wallet-topup-add-card"
                >
                    <Ionicons name="add-circle-outline" size={18} color={AO.blue} />
                    <Text className="font-outfit-bold" style={{ color: AO.blue, fontSize: 14 }}>{t(`${K}.addCard`)}</Text>
                </TouchableOpacity>
            ) : (
                usable.map((card) => {
                    const selected = card.id === cardId;
                    return (
                        <TouchableOpacity
                            key={card.id}
                            onPress={() => setCardId(card.id)}
                            className="flex-row items-center"
                            style={{
                                gap: 12,
                                padding: 12,
                                marginBottom: 8,
                                borderRadius: 14,
                                borderWidth: 1.5,
                                borderColor: selected ? AO.blue : AO.border,
                                backgroundColor: selected ? AO.blueSofter : '#fff',
                            }}
                        >
                            <Ionicons name="card-outline" size={20} color={AO.blue} />
                            <Text className="font-outfit-semibold" style={{ flex: 1, fontSize: 14, color: AO.text }}>{cardLabel(card)}</Text>
                            {selected && <Ionicons name="checkmark-circle" size={20} color={AO.blue} />}
                        </TouchableOpacity>
                    );
                })
            )}

            {error && (
                <Text className="font-outfit-semibold" style={{ fontSize: 12.5, color: AO.red, marginTop: 8 }} testID="wallet-topup-error">
                    {error}
                </Text>
            )}

            <View className="flex-row" style={{ gap: 8, marginTop: 14 }}>
                <TouchableOpacity
                    onPress={onCancel}
                    disabled={busy}
                    className="flex-1 items-center"
                    style={{ paddingVertical: 13, borderRadius: 12, backgroundColor: AO.page, borderWidth: 1, borderColor: AO.border }}
                >
                    <Text className="font-outfit-bold" style={{ fontSize: 14, color: AO.muted }}>{t(`${K}.cancel`)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={submit}
                    disabled={!parsed || !cardId || busy}
                    className="flex-1 items-center justify-center"
                    style={{ paddingVertical: 13, borderRadius: 12, backgroundColor: AO.blue, opacity: !parsed || !cardId ? 0.5 : 1 }}
                    testID="wallet-topup-submit"
                    accessibilityRole="button"
                >
                    {busy ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text className="font-outfit-bold" style={{ fontSize: 14, color: '#fff' }}>
                            {parsed ? t(`${K}.submitAmount`, { amount: parsed }) : t(`${K}.submit`)}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

/** Bottom sheet around TopUpForm, for the wallet screen. */
export function TopUpSheet({ visible, cards, initialAmount, onDone, onClose }: {
    visible: boolean;
    cards: PaymentCard[];
    initialAmount?: string;
    onDone: (wallet: Wallet) => void;
    onClose: () => void;
}) {
    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose} />
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 34 }}>
                {visible && <TopUpForm cards={cards} initialAmount={initialAmount} onDone={onDone} onCancel={onClose} />}
            </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
