import { type Href, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Wallet as WalletIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import type { PaymentCard } from '@/lib/dao/interfaces';
import { type WalletMovement, walletDAO } from '@/lib/dao/WalletDAO';
import { formatMoney } from '@/lib/payments/paymentSource';
import { useWallet } from '@/lib/payments/useWallet';
import { formatLocalDateTime } from '@/lib/video/videoCallTime';

import { TopUpSheet } from './TopUpSheet';

const K = 'wallet';

/** Movements that put money in; the rest take it out. */
const CREDITS = ['deposit', 'refund', 'auto_replenish', 'adjustment_credit'];

/**
 * The wallet half of "Wallet & payments": spendable balance, what is held for
 * services in progress, "Add funds" (charged to a saved card right away) and
 * the latest movements. Services are paid from here before the card when the
 * balance covers them.
 */
export function WalletSection({ cards }: { cards: PaymentCard[] }) {
    const { t, i18n } = useTranslation();
    const router = useRouter();
    const { wallet, setWallet } = useWallet();
    const [movements, setMovements] = React.useState<WalletMovement[] | null>(null);
    const [topUpOpen, setTopUpOpen] = React.useState(false);
    const [notice, setNotice] = React.useState<string | null>(null);

    const loadMovements = React.useCallback(async () => {
        try {
            const history = await walletDAO.history(1, 10);
            setMovements(history.walletMovements.slice(0, 5));
        } catch {
            setMovements([]);
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
                        <Text className="font-outfit-bold text-[10px] tracking-widest" style={{ color: '#fff' }}>{t(`${K}.currency`)}</Text>
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
                            <Text className="font-outfit-semibold text-[11px] uppercase" style={{ color: '#DCE8FF' }}>{t(`${K}.totalBalance`)}</Text>
                            <Text className="font-outfit-bold text-base" style={{ color: '#fff' }} testID="wallet-total">
                                {formatMoney(wallet.balance)}
                            </Text>
                        </View>
                        <View className="flex-1">
                            <Text className="font-outfit-semibold text-[11px] uppercase" style={{ color: '#DCE8FF' }}>{t(`${K}.heldForServices`)}</Text>
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
                    style={{ gap: 6, marginTop: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: '#fff' }}
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

            <View className="flex-row items-center justify-between mt-6 mb-2">
                <Text className="text-gray-900 font-outfit-semibold text-base">{t(`${K}.movements`)}</Text>
                <TouchableOpacity onPress={() => router.push('/payment-activity' as Href)} accessibilityRole="link" testID="wallet-see-all">
                    <Text className="font-outfit-semibold text-sm" style={{ color: '#0047AB' }}>{t(`${K}.seeAll`)}</Text>
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
                                <Text className="text-gray-500 font-outfit-regular text-xs">{formatLocalDateTime(m.createdAt, i18n.language)}</Text>
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
    );
}
