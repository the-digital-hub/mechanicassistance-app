import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';

import { AO } from '@/components/offer/OfferSections';
import { CardPickerModal } from '@/components/payments/CardPickerModal';
import { InsufficientFundsSheet } from '@/components/payments/InsufficientFundsSheet';
import { ApiError } from '@/lib/api/types';
import { type VideoExtension, type VideoExtensions, videoCallDAO } from '@/lib/dao/VideoCallDAO';
import { WALLET_METHOD, cardLabel } from '@/lib/payments/cardLabel';
import { apiErrorCode } from '@/lib/payments/cardRequired';
import { formatMoney, pickDefaultSource } from '@/lib/payments/paymentSource';
import { usePaymentCards } from '@/lib/payments/usePaymentCards';
import { useWallet } from '@/lib/payments/useWallet';

const K = 'videoCall.extend';

/** A fresh key per attempt: a refused payment's key cannot be used again. */
function newKey(): string {
    return `ext-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** What went wrong, as a translation key; null for "not enough balance", which has its own sheet. */
function errorKey(error: unknown): string | null {
    const code = apiErrorCode(error);
    if (code === 'insufficient_funds') return null;
    if (code === 'card_declined') return `${K}.cardDeclined`;
    if (error instanceof ApiError && error.statusCode === 409) return `${K}.notNow`;
    if (error instanceof ApiError && error.statusCode === 403) return `${K}.notOwner`;
    return `${K}.failed`;
}

/**
 * "Add time" for the vehicle owner during a video call: pick 15, 30 or 45
 * minutes (as the hub set them) at the price service-price quotes, choose how
 * to pay (the wallet when it covers it, else the default card) and confirm.
 * The money is held now and charged with the call. When the wallet is short,
 * the owner can add the missing money or pay this block with a card.
 */
export function ExtendCallSheet({ visible, appointmentId, onClose, onExtended }: {
    visible: boolean;
    appointmentId: string;
    onClose: () => void;
    onExtended: (extension: VideoExtension) => void;
}) {
    const { t } = useTranslation();
    const { cards, defaultCard } = usePaymentCards();
    const { wallet, setWallet } = useWallet();
    const [catalog, setCatalog] = React.useState<VideoExtensions | null>(null);
    const [loadFailed, setLoadFailed] = React.useState(false);
    const [minutes, setMinutes] = React.useState<number | null>(null);
    const [picked, setPicked] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [pickerOpen, setPickerOpen] = React.useState(false);
    const [shortOpen, setShortOpen] = React.useState(false);

    React.useEffect(() => {
        if (!visible) return;
        setCatalog(null);
        setLoadFailed(false);
        setMinutes(null);
        setPicked(null);
        setError(null);
        setShortOpen(false);
        videoCallDAO
            .getExtensions(appointmentId)
            .then((c) => {
                setCatalog(c);
                setMinutes(c.options[0]?.minutes ?? null);
            })
            .catch(() => setLoadFailed(true));
    }, [visible, appointmentId]);

    const option = catalog?.options.find((o) => o.minutes === minutes) ?? null;
    const amount = option ? Number(option.price) : null;
    const source = picked ?? pickDefaultSource(amount, wallet, defaultCard);
    const sourceCard = source && source !== WALLET_METHOD ? cards.find((c) => c.id === source) ?? null : null;
    const sourceLabel =
        source === WALLET_METHOD
            ? t('paymentCards.walletWithBalance', { available: formatMoney(wallet?.availableBalance ?? 0) })
            : sourceCard
                ? cardLabel(sourceCard)
                : t(`${K}.sameAsCall`);
    const atLimit = !!catalog && catalog.extensionsUsed >= catalog.maxExtensions;

    const buy = async (paymentMethodId: string | null) => {
        if (!option || busy) return;
        setBusy(true);
        setError(null);
        try {
            const extension = await videoCallDAO.extend(appointmentId, option.minutes, newKey(), paymentMethodId ?? undefined);
            setShortOpen(false);
            onExtended(extension);
            onClose();
        } catch (err) {
            const key = errorKey(err);
            if (key === null) setShortOpen(true);
            else {
                setShortOpen(false);
                setError(t(key));
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Modal transparent visible={visible && !pickerOpen && !shortOpen} animationType="slide" onRequestClose={onClose}>
                <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={busy ? undefined : onClose} />
                <View
                    style={{ backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 34 }}
                    testID="extend-call-sheet"
                >
                    <Text className="font-outfit-bold" style={{ fontSize: 17, color: AO.text }}>{t(`${K}.title`)}</Text>
                    <Text className="font-outfit-regular" style={{ fontSize: 12.5, color: AO.muted, marginTop: 4, lineHeight: 17 }}>
                        {t(`${K}.body`)}
                    </Text>

                    {loadFailed ? (
                        <Text className="font-outfit-semibold" style={{ fontSize: 13, color: AO.red, marginTop: 16 }}>{t(`${K}.loadFailed`)}</Text>
                    ) : !catalog ? (
                        <ActivityIndicator color={AO.blue} style={{ marginVertical: 24 }} />
                    ) : atLimit || catalog.options.length === 0 ? (
                        <Text className="font-outfit-semibold" style={{ fontSize: 13, color: AO.muted, marginTop: 16 }} testID="extend-call-limit">
                            {atLimit ? t(`${K}.limit`, { max: catalog.maxExtensions }) : t(`${K}.unavailable`)}
                        </Text>
                    ) : (
                        <>
                            <View className="flex-row" style={{ gap: 8, marginTop: 16 }}>
                                {catalog.options.map((o) => {
                                    const selected = o.minutes === minutes;
                                    return (
                                        <TouchableOpacity
                                            key={o.id}
                                            onPress={() => setMinutes(o.minutes)}
                                            className="flex-1 items-center"
                                            style={{
                                                paddingVertical: 14,
                                                borderRadius: 14,
                                                borderWidth: 1.5,
                                                borderColor: selected ? AO.blue : AO.border,
                                                backgroundColor: selected ? AO.blueSofter : '#fff',
                                            }}
                                            testID={`extend-option-${o.minutes}`}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected }}
                                        >
                                            <Text className="font-outfit-bold" style={{ fontSize: 20, color: selected ? AO.blue : AO.text }}>+{o.minutes}</Text>
                                            <Text className="font-outfit-semibold" style={{ fontSize: 11, color: AO.muted }}>{t(`${K}.minutes`)}</Text>
                                            <Text className="font-outfit-bold" style={{ fontSize: 14, color: AO.text, marginTop: 6 }}>{formatMoney(o.price, o.currency)}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            <Text className="font-outfit-regular" style={{ fontSize: 11.5, color: AO.muted, marginTop: 8 }}>
                                {t(`${K}.remaining`, { left: catalog.maxExtensions - catalog.extensionsUsed })}
                            </Text>

                            <View className="flex-row items-center" style={{ marginTop: 16, padding: 12, borderRadius: 14, backgroundColor: AO.page, gap: 10 }}>
                                <Ionicons name={source === WALLET_METHOD ? 'wallet-outline' : 'card-outline'} size={18} color={AO.blue} />
                                <View style={{ flex: 1 }}>
                                    <Text className="font-outfit-semibold" style={{ fontSize: 11, color: AO.muted }}>{t(`${K}.payWith`)}</Text>
                                    <Text className="font-outfit-bold" style={{ fontSize: 13.5, color: AO.text }} testID="extend-call-source">{sourceLabel}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setPickerOpen(true)} hitSlop={8} testID="extend-call-change-source">
                                    <Text className="font-outfit-bold" style={{ fontSize: 12.5, color: AO.blue }}>{t(`${K}.change`)}</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}

                    {error && (
                        <Text className="font-outfit-semibold" style={{ fontSize: 12.5, color: AO.red, marginTop: 10 }} testID="extend-call-error">
                            {error}
                        </Text>
                    )}

                    <View className="flex-row" style={{ gap: 8, marginTop: 16 }}>
                        <TouchableOpacity
                            onPress={onClose}
                            disabled={busy}
                            className="flex-1 items-center"
                            style={{ paddingVertical: 13, borderRadius: 12, backgroundColor: AO.page, borderWidth: 1, borderColor: AO.border }}
                        >
                            <Text className="font-outfit-bold" style={{ fontSize: 14, color: AO.muted }}>{t(`${K}.cancel`)}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => buy(source)}
                            disabled={!option || busy || atLimit}
                            className="flex-1 items-center justify-center"
                            style={{ paddingVertical: 13, borderRadius: 12, backgroundColor: AO.blue, opacity: !option || atLimit ? 0.5 : 1 }}
                            testID="extend-call-confirm"
                            accessibilityRole="button"
                        >
                            {busy ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text className="font-outfit-bold" style={{ fontSize: 14, color: '#fff' }}>
                                    {option ? t(`${K}.confirm`, { minutes: option.minutes, price: formatMoney(option.price, option.currency) }) : t(`${K}.confirmEmpty`)}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <CardPickerModal
                visible={visible && pickerOpen}
                cards={cards}
                selectedId={source}
                onSelect={(card) => {
                    setPicked(card.id);
                    setPickerOpen(false);
                }}
                onSelectWallet={() => {
                    setPicked(WALLET_METHOD);
                    setPickerOpen(false);
                }}
                wallet={wallet}
                amount={amount}
                onClose={() => setPickerOpen(false)}
            />

            <InsufficientFundsSheet
                visible={visible && shortOpen}
                amount={amount ?? 0}
                wallet={wallet}
                cards={cards}
                busy={busy}
                onClose={() => setShortOpen(false)}
                onToppedUp={(next) => {
                    setWallet(next);
                    setPicked(WALLET_METHOD);
                    buy(WALLET_METHOD);
                }}
                onPayWithCard={(cardId) => {
                    setPicked(cardId);
                    buy(cardId);
                }}
            />
        </>
    );
}
