import { type Href, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Wallet as WalletIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import type { PaymentCard } from '@/lib/dao/interfaces';
import { type PaymentHistoryItem, type WalletMovement, walletDAO } from '@/lib/dao/WalletDAO';
import { paymentHeadline } from '@/lib/payments/paymentHeadline';
import { NO_SERVICE_INFO, type WalletServiceInfo, walletServiceInfo } from '@/lib/payments/movementServices';
import { formatMoney } from '@/lib/payments/paymentSource';
import { useWallet } from '@/lib/payments/useWallet';
import { formatLocalDateTime } from '@/lib/video/videoCallTime';

import { TopUpSheet } from './TopUpSheet';
import { TYPE } from '@/lib/ui/type';

const K = 'wallet';

/** Movements that put money in; the rest take it out. */
const CREDITS = ['deposit', 'refund', 'auto_replenish', 'adjustment_credit'];

/**
 * The wallet half of "Wallet & payments": spendable balance, what is held for
 * services in progress, "Add funds" (charged to a saved card right away) and
 * the latest movements. Services are paid from here before the card when the
 * balance covers them.
 */
export function WalletSection({ cards, cardsContent }: { cards: PaymentCard[]; cardsContent?: React.ReactNode }) {
    const { t, i18n } = useTranslation();
    const router = useRouter();
    const { wallet, setWallet } = useWallet();
    const [movements, setMovements] = React.useState<WalletMovement[] | null>(null);
    const [payments, setPayments] = React.useState<PaymentHistoryItem[] | null>(null);
    // The balance stays on top; what is under it is one thing at a time, so nothing has to be scrolled past to reach the rest.
    const [tab, setTab] = React.useState<'activity' | 'payments' | 'cards'>('activity');
    const [info, setInfo] = React.useState<WalletServiceInfo>(NO_SERVICE_INFO);
    const [topUpOpen, setTopUpOpen] = React.useState(false);
    const [notice, setNotice] = React.useState<string | null>(null);

    const loadMovements = React.useCallback(async () => {
        try {
            const history = await walletDAO.history(1, 10);
            const recent = history.walletMovements.slice(0, 5);
            setMovements(recent);
            setPayments(history.payments.items.slice(0, 5));
            walletServiceInfo(history.payments.items, recent).then(setInfo).catch(() => setInfo(NO_SERVICE_INFO));
        } catch {
            setMovements([]);
            setPayments([]);
        }
    }, []);

    React.useEffect(() => {
        loadMovements();
    }, [loadMovements]);

    const held = Number(wallet?.heldBalance ?? 0);

    return (
        <View className="mb-8" testID="wallet-section">
            <TopUpSheet
                visible={topUpOpen}
                cards={cards}
                onClose={() => setTopUpOpen(false)}
                onDone={(next) => {
                    setWallet(next);
                    setTopUpOpen(false);
                    setNotice(t(`${K}.topUp.done`, { balance: formatMoney(next.availableBalance) }));
                    loadMovements();
                }}
            />

            <LinearGradient colors={['#0047AB', '#1D6FE0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 20 }}>
                <View className="flex-row items-center" style={{ gap: 8 }}>
                    <WalletIcon size={18} color="#DCE8FF" />
                    <Text className="font-outfit-semibold text-sm flex-1" style={{ color: '#DCE8FF' }}>{t(`${K}.available`)}</Text>
                    <View className="px-2 py-0.5 rounded-full" style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
                        <Text className="font-outfit-bold text-[12px] tracking-widest" style={{ color: '#fff' }}>{t(`${K}.currency`)}</Text>
                    </View>
                </View>
                {wallet ? (
                    <Text className="font-outfit-bold" style={{ fontSize: 34, color: '#fff', marginTop: 6 }} testID="wallet-available">
                        {formatMoney(wallet.availableBalance)}
                    </Text>
                ) : (
                    <ActivityIndicator color="#fff" style={{ alignSelf: 'flex-start', marginTop: 12 }} />
                )}
                {wallet && (
                    <View className="flex-row mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', gap: 12 }}>
                        <View className="flex-1">
                            <Text className="font-outfit-semibold text-[13px] uppercase" style={{ color: '#DCE8FF' }}>{t(`${K}.totalBalance`)}</Text>
                            <Text className="font-outfit-bold text-base" style={{ color: '#fff' }} testID="wallet-total">
                                {formatMoney(wallet.balance)}
                            </Text>
                        </View>
                        <View className="flex-1">
                            <Text className="font-outfit-semibold text-[13px] uppercase" style={{ color: '#DCE8FF' }}>{t(`${K}.heldForServices`)}</Text>
                            <Text className="font-outfit-bold text-base" style={{ color: '#fff' }} testID="wallet-held">
                                {formatMoney(held)}
                            </Text>
                        </View>
                    </View>
                )}
                <TouchableOpacity
                    onPress={() => {
                        setNotice(null);
                        setTopUpOpen(true);
                    }}
                    className="flex-row items-center justify-center"
                    style={{ gap: 6, marginTop: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: '#fff' }}
                    testID="wallet-add-funds"
                    accessibilityRole="button"
                >
                    <Plus size={18} color="#0047AB" />
                    <Text className="font-outfit-bold text-base" style={{ color: '#0047AB' }}>{t(`${K}.addFunds`)}</Text>
                </TouchableOpacity>
            </LinearGradient>

            {notice && (
                <Text className="font-outfit-semibold text-sm mt-3" style={{ color: '#15803D' }} testID="wallet-notice">
                    {notice}
                </Text>
            )}

            <Text className="text-gray-500 font-outfit-regular text-sm mt-3">{t(`${K}.howItWorks`)}</Text>

            {/* One thing at a time under the balance. */}
            <View className="flex-row" style={{ marginTop: 18, padding: 4, borderRadius: 16, backgroundColor: '#EEF2FA' }} accessibilityRole="tablist">
                {([
                    { id: 'activity', label: t(`${K}.tabs.activity`) },
                    { id: 'payments', label: t(`${K}.tabs.payments`) },
                    ...(cardsContent ? [{ id: 'cards', label: t(`${K}.tabs.cards`) }] : []),
                ] as { id: 'activity' | 'payments' | 'cards'; label: string }[]).map((item) => {
                    const on = tab === item.id;
                    return (
                        <TouchableOpacity
                            key={item.id}
                            onPress={() => setTab(item.id)}
                            activeOpacity={0.8}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: on }}
                            className="flex-1 items-center justify-center"
                            style={on
                                ? { minHeight: 46, borderRadius: 12, backgroundColor: '#FFFFFF', shadowColor: '#0E2F8A', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }
                                : { minHeight: 46, borderRadius: 12 }}
                            testID={`wallet-tab-${item.id}`}
                        >
                            <Text className="font-outfit-bold" style={{ fontSize: 15, color: on ? '#0047AB' : '#8C96AE' }} numberOfLines={1}>{item.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {tab === 'activity' ? (
                <View style={{ marginTop: 16 }}>
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-gray-900 font-outfit-bold" style={{ ...TYPE.section }}>{t(`${K}.movements`)}</Text>
                        <TouchableOpacity
                            onPress={() => router.push('/payment-activity' as Href)}
                            accessibilityRole="link"
                            className="px-3 py-1.5 rounded-full"
                            style={{ backgroundColor: '#E9F1FF' }}
                            testID="wallet-see-all"
                        >
                            <Text className="font-outfit-bold" style={{ fontSize: 13, lineHeight: 18, color: '#1E56E3' }}>{t(`${K}.seeAll`)}</Text>
                        </TouchableOpacity>
                    </View>
                    {movements === null ? (
                        <ActivityIndicator color="#0047AB" />
                    ) : movements.length === 0 ? (
                        <Text className="text-gray-500 font-outfit-regular text-sm">{t(`${K}.noMovements`)}</Text>
                    ) : (
                        movements.map((m) => {
                            const credit = CREDITS.includes(m.type);
                            return (
                                <View key={m.id} className="flex-row items-center bg-white rounded-xl px-4 py-3 mb-2">
                                    <View className="flex-1">
                                        <Text className="text-gray-900 font-outfit-semibold text-sm">
                                            {t(`${K}.movementType.${m.type}`, { defaultValue: t(`${K}.movementType.other`) })}
                                        </Text>
                                        {info.movements[m.id]?.title ? (
                                            <Text className="text-gray-600 font-outfit-regular text-[13px]" numberOfLines={1}>{info.movements[m.id].title}</Text>
                                        ) : null}
                                        <Text className="text-gray-500 font-outfit-regular text-[13px]">{formatLocalDateTime(m.createdAt, i18n.language)}</Text>
                                        {info.movements[m.id] && <Text className="text-gray-400 font-outfit-regular" style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={1} selectable>{info.movements[m.id].ref}</Text>}
                                    </View>
                                    <Text className="font-outfit-bold text-sm" style={{ color: credit ? '#15803D' : '#111827' }}>
                                        {credit ? '+' : '−'}
                                        {formatMoney(Math.abs(Number(m.amount)))}
                                    </Text>
                                </View>
                            );
                        })
                    )}
                </View>
            ) : null}

            {tab === 'payments' ? (
                <View style={{ marginTop: 16 }}>
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-gray-900 font-outfit-bold" style={{ ...TYPE.section }}>{t(`${K}.activity.title`)}</Text>
                        <TouchableOpacity
                            onPress={() => router.push('/payment-activity' as Href)}
                            accessibilityRole="link"
                            className="px-3 py-1.5 rounded-full"
                            style={{ backgroundColor: '#E9F1FF' }}
                            testID="wallet-see-all-payments"
                        >
                            <Text className="font-outfit-bold" style={{ fontSize: 13, lineHeight: 18, color: '#1E56E3' }}>{t(`${K}.seeAll`)}</Text>
                        </TouchableOpacity>
                    </View>
                    {payments === null ? (
                        <ActivityIndicator color="#0047AB" />
                    ) : payments.length === 0 ? (
                        <Text className="text-gray-500 font-outfit-regular text-sm">{t(`${K}.activity.empty`)}</Text>
                    ) : (
                        payments.map((p) => (
                            <View key={p.id} className="flex-row items-center bg-white rounded-xl px-4 py-3 mb-2">
                                <View className="flex-1">
                                    <Text className="text-gray-900 font-outfit-semibold text-sm">
                                        {t(`${K}.activity.status.${p.status}`, { defaultValue: t(`${K}.activity.status.other`) })} · {t(`${K}.activity.method.${p.method}`, { defaultValue: t(`${K}.activity.method.other`) })}
                                    </Text>
                                    <Text className="text-gray-500 font-outfit-regular text-[13px]">{formatLocalDateTime(p.createdAt, i18n.language)}</Text>
                                    {info.payments[p.id] && <Text className="text-gray-400 font-outfit-regular" style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={1} selectable>{info.payments[p.id].ref}</Text>}
                                </View>
                                <Text className="font-outfit-bold text-sm text-gray-900">{formatMoney(paymentHeadline(p))}</Text>
                            </View>
                        ))
                    )}
                </View>
            ) : null}

            {tab === 'cards' && cardsContent ? <View style={{ marginTop: 16 }}>{cardsContent}</View> : null}
        </View>
    );
}
