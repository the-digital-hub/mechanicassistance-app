import { MinusCircle, Send } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import type { Payout } from '@/lib/dao/interfaces';
import { formatMoney } from '@/lib/payments/paymentSource';
import { formatLocalDateTime } from '@/lib/video/videoCallTime';

const K = 'payments.payouts';

/** Transfers already sent to the mechanic's Stripe account. */
export function PayoutHistory({ payouts }: { payouts: Payout[] | null }) {
    const { t, i18n } = useTranslation();

    return (
        <View className="mt-6" testID="payout-history">
            <Text className="text-gray-900 font-outfit-semibold text-lg mb-2">{t(`${K}.title`)}</Text>
            {payouts === null ? (
                <ActivityIndicator color="#0047AB" />
            ) : payouts.length === 0 ? (
                <View className="flex-row items-center rounded-2xl px-4 py-4" style={{ gap: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: '#BFD3F5' }}>
                    <MinusCircle size={20} color="#6B7280" />
                    <Text className="font-outfit-regular text-sm text-gray-500">{t(`${K}.empty`)}</Text>
                </View>
            ) : (
                payouts.map((p) => (
                    <View key={p.id} className="flex-row items-center bg-white rounded-2xl px-4 py-3 mb-2 border" style={{ gap: 10, borderColor: '#E1EAFB' }}>
                        <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: '#DCFCE7' }}>
                            <Send size={16} color="#15803D" />
                        </View>
                        <View className="flex-1">
                            <Text className="font-outfit-semibold text-sm text-gray-900">{formatLocalDateTime(p.createdAt, i18n.language)}</Text>
                            <Text className="font-outfit-regular text-xs text-gray-500">{t(`${K}.services`, { count: p.earningsCount })}</Text>
                        </View>
                        <Text className="font-outfit-bold text-base" style={{ color: '#15803D' }}>
                            {formatMoney(p.amount)}
                        </Text>
                    </View>
                ))
            )}
        </View>
    );
}
