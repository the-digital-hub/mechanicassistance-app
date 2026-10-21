import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { type PaymentHistoryItem, type WalletMovement, walletDAO } from '@/lib/dao/WalletDAO';
import { formatMoney } from '@/lib/payments/paymentSource';
import { formatLocalDateTime } from '@/lib/video/videoCallTime';

const K = 'wallet';
const PAGE = 20;

/** Movements that put money in; the rest take it out. Same list as WalletSection. */
const CREDITS = ['deposit', 'refund', 'auto_replenish', 'adjustment_credit'];

/** The amount that best describes a payment in its current state. */
function headline(p: PaymentHistoryItem): string {
    if (Number(p.amountRefunded) > 0) return p.amountRefunded;
    if (Number(p.amountCharged) > 0) return p.amountCharged;
    return p.amountHeld;
}

/**
 * The customer's full payment activity: every service payment (paged) and the
 * wallet's own movements, like the portal's "Recent payment activity".
 */
export default function PaymentActivityScreen() {
    const { t, i18n } = useTranslation();
    const [payments, setPayments] = useState<PaymentHistoryItem[] | null>(null);
    const [movements, setMovements] = useState<WalletMovement[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const loadFirst = useCallback(async () => {
        setError(false);
        try {
            const res = await walletDAO.history(1, PAGE);
            setPayments(res.payments.items);
            setTotal(res.payments.total);
            setMovements(res.walletMovements);
            setPage(1);
        } catch {
            setError(true);
            setPayments((prev) => prev ?? []);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadFirst();
        }, [loadFirst]),
    );

    const loadMore = async () => {
        setLoadingMore(true);
        try {
            const res = await walletDAO.history(page + 1, PAGE);
            setPayments((prev) => [...(prev ?? []), ...res.payments.items]);
            setTotal(res.payments.total);
            setPage(page + 1);
        } catch {
            setError(true);
        } finally {
            setLoadingMore(false);
        }
    };

    const refresh = async () => {
        setRefreshing(true);
        await loadFirst();
        setRefreshing(false);
    };

    const statusLabel = (s: string) => t(`${K}.activity.status.${s}`, { defaultValue: t(`${K}.activity.status.other`) });
    const methodLabel = (m: string) => t(`${K}.activity.method.${m}`, { defaultValue: t(`${K}.activity.method.other`) });

    return (
        <ScrollView
            style={{ backgroundColor: '#F4F6FC' }}
            contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#0047AB" />}
            testID="payment-activity-screen"
        >
            <Text className="text-gray-900 font-outfit-medium text-3xl mb-6">{t(`${K}.activity.title`)}</Text>

            {error && <Text className="font-outfit-semibold text-sm mb-3" style={{ color: '#B91C1C' }}>{t(`${K}.activity.loadFailed`)}</Text>}

            <Text className="text-gray-900 font-outfit-semibold text-base mb-2">{t(`${K}.activity.payments`)}</Text>
            {payments === null ? (
                <ActivityIndicator color="#0047AB" />
            ) : payments.length === 0 ? (
                <Text className="text-gray-500 font-outfit-regular text-sm">{t(`${K}.activity.empty`)}</Text>
            ) : (
                <>
                    {payments.map((p) => (
                        <View key={p.id} className="bg-white rounded-xl px-4 py-3 mb-2 border" style={{ borderColor: '#E1EAFB' }}>
                            <View className="flex-row items-center">
                                <View className="flex-1">
                                    <Text className="text-gray-900 font-outfit-semibold text-sm">
                                        {statusLabel(p.status)} · {methodLabel(p.method)}
                                    </Text>
                                    <Text className="text-gray-500 font-outfit-regular text-xs">{formatLocalDateTime(p.createdAt, i18n.language)}</Text>
                                </View>
                                <Text className="font-outfit-bold text-sm text-gray-900">{formatMoney(headline(p))}</Text>
                            </View>
                            {Number(p.amountRefunded) > 0 && Number(p.amountCharged) > 0 && (
                                <Text className="text-gray-500 font-outfit-regular text-xs mt-1">
                                    {t(`${K}.activity.charged`, { amount: formatMoney(p.amountCharged) })}
                                </Text>
                            )}
                        </View>
                    ))}
                    {payments.length < total && (
                        <TouchableOpacity
                            onPress={loadMore}
                            disabled={loadingMore}
                            className="items-center rounded-xl border mt-1"
                            style={{ paddingVertical: 12, borderColor: '#BFD3F5', opacity: loadingMore ? 0.6 : 1 }}
                            accessibilityRole="button"
                        >
                            {loadingMore ? (
                                <ActivityIndicator color="#0047AB" />
                            ) : (
                                <Text className="font-outfit-semibold text-sm" style={{ color: '#0047AB' }}>{t(`${K}.activity.loadMore`)}</Text>
                            )}
                        </TouchableOpacity>
                    )}
                </>
            )}

            <Text className="text-gray-900 font-outfit-semibold text-base mt-6 mb-2">{t(`${K}.activity.movements`)}</Text>
            {movements.length === 0 ? (
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
        </ScrollView>
    );
}
