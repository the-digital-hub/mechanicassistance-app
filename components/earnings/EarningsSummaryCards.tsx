import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import type { EarningsSummary } from '@/lib/dao/interfaces';
import { formatMoney } from '@/lib/payments/paymentSource';

const K = 'payments.summary';

const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 6 };

function Tile({
    label,
    value,
    hint,
    bg,
    border,
    labelColor,
    valueColor,
    testID,
}: {
    label: string;
    value: string;
    hint: string;
    bg: string;
    border: string;
    labelColor: string;
    valueColor: string;
    testID: string;
}) {
    return (
        <View className="flex-1 rounded-2xl p-3" style={{ backgroundColor: bg, borderWidth: 1, borderColor: border, minWidth: 0 }} testID={testID}>
            <Text className="font-outfit-bold text-[10px] tracking-widest" style={{ color: labelColor }} numberOfLines={1}>
                {label}
            </Text>
            <Text className="font-outfit-bold mt-1" style={{ fontSize: 20, color: valueColor }} numberOfLines={1} adjustsFontSizeToFit>
                {value}
            </Text>
            <Text className="font-outfit-regular text-[11px] mt-0.5 text-gray-500" numberOfLines={2}>
                {hint}
            </Text>
        </View>
    );
}

/**
 * Total earned (big), then pending, ready and paid out. Always net of fees and
 * for the whole account: the activity filters below do not change these.
 */
export function EarningsSummaryCards({ summary }: { summary: EarningsSummary | null }) {
    const { t } = useTranslation();

    return (
        <View className="mb-4">
            <View style={[SHADOW, { borderRadius: 20, backgroundColor: '#0047AB' }]}>
                <LinearGradient colors={['#0047AB', '#1D6FE0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 20 }}>
                    <Text className="font-outfit-bold text-xs tracking-widest" style={{ color: '#DCE8FF' }}>
                        {t(`${K}.totalEarned`)}
                    </Text>
                    {summary ? (
                        <Text className="font-outfit-bold" style={{ fontSize: 34, color: '#fff', marginTop: 4 }} testID="earnings-total">
                            {formatMoney(summary.totalEarned)}
                        </Text>
                    ) : (
                        <ActivityIndicator color="#fff" style={{ alignSelf: 'flex-start', marginTop: 12 }} />
                    )}
                    <Text className="font-outfit-regular text-sm" style={{ color: '#DCE8FF' }}>
                        {t(`${K}.totalEarnedHint`)}
                    </Text>
                </LinearGradient>
            </View>

            {summary && (
                <View className="flex-row mt-3" style={{ gap: 8 }}>
                    <Tile
                        label={t(`${K}.pending`)}
                        value={formatMoney(summary.pendingNet)}
                        hint={t(`${K}.pendingHint`, { count: summary.pendingCount })}
                        bg="#FFFBEB"
                        border="#FCD34D"
                        labelColor="#B45309"
                        valueColor="#92400E"
                        testID="earnings-pending"
                    />
                    <Tile
                        label={t(`${K}.ready`)}
                        value={formatMoney(summary.readyNet)}
                        hint={t(`${K}.readyHint`)}
                        bg="#EFF6FF"
                        border="#BFD3F5"
                        labelColor="#0047AB"
                        valueColor="#0B2A6B"
                        testID="earnings-ready"
                    />
                    <Tile
                        label={t(`${K}.paidOut`)}
                        value={formatMoney(summary.paidOut)}
                        hint={summary.payoutsCount > 0 ? t(`${K}.paidOutHint`, { count: summary.payoutsCount }) : t(`${K}.noPayouts`)}
                        bg="#F0FDF4"
                        border="#86EFAC"
                        labelColor="#15803D"
                        valueColor="#14532D"
                        testID="earnings-paid-out"
                    />
                </View>
            )}
        </View>
    );
}
