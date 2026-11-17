import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle2, Clock, Wallet, type LucideIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import type { EarningsSummary } from '@/lib/dao/interfaces';
import { formatMoney } from '@/lib/payments/paymentSource';
import { TYPE } from '@/lib/ui/type';

const K = 'payments.summary';

const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 6 };

/** One state of the money (pending, ready, paid out): icon, name with its detail under it, and the amount. */
function Row({
    icon: Icon,
    title,
    hint,
    value,
    iconBg,
    iconColor,
    valueColor,
    last,
    testID,
}: {
    icon: LucideIcon;
    title: string;
    hint: string;
    value: string;
    iconBg: string;
    iconColor: string;
    valueColor: string;
    last?: boolean;
    testID: string;
}) {
    return (
        <View
            className="flex-row items-center"
            style={{ gap: 14, paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: '#EEF2FA' }}
            testID={testID}
        >
            <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: iconBg }}>
                <Icon size={22} color={iconColor} />
            </View>
            <View className="flex-1" style={{ minWidth: 0 }}>
                <Text className="font-outfit-bold" style={{ ...TYPE.body, color: '#0B1530' }} numberOfLines={1}>{title}</Text>
                <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: '#6B7490', marginTop: 2 }} numberOfLines={2}>{hint}</Text>
            </View>
            <Text className="font-outfit-bold" style={{ fontSize: 22, lineHeight: 28, color: valueColor }} numberOfLines={1} adjustsFontSizeToFit>
                {value}
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
            <View style={[SHADOW, { borderRadius: 22, backgroundColor: '#0047AB' }]}>
                <LinearGradient colors={['#0047AB', '#1D6FE0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, paddingHorizontal: 22, paddingVertical: 22 }}>
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
                    <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: '#DCE8FF', marginTop: 2 }}>
                        {t(`${K}.totalEarnedHint`)}
                    </Text>
                </LinearGradient>
            </View>

            {summary && (
                <View
                    className="bg-white mt-4"
                    style={{ borderRadius: 20, borderWidth: 1, borderColor: '#E1EAFB', overflow: 'hidden', ...SHADOW, shadowOpacity: 0.06 }}
                >
                    <Row
                        icon={Clock}
                        title={t(`${K}.pendingTitle`)}
                        hint={t(`${K}.pendingHint`, { count: summary.pendingCount })}
                        value={formatMoney(summary.pendingNet)}
                        iconBg="#FEF3C7"
                        iconColor="#B45309"
                        valueColor="#92400E"
                        testID="earnings-pending"
                    />
                    <Row
                        icon={Wallet}
                        title={t(`${K}.readyTitle`)}
                        hint={t(`${K}.readyHint`)}
                        value={formatMoney(summary.readyNet)}
                        iconBg="#EAF1FF"
                        iconColor="#0047AB"
                        valueColor="#0B2A6B"
                        testID="earnings-ready"
                    />
                    <Row
                        icon={CheckCircle2}
                        title={t(`${K}.paidOutTitle`)}
                        hint={summary.payoutsCount > 0 ? t(`${K}.paidOutHint`, { count: summary.payoutsCount }) : t(`${K}.noPayouts`)}
                        value={formatMoney(summary.paidOut)}
                        iconBg="#DCFCE7"
                        iconColor="#15803D"
                        valueColor="#14532D"
                        last
                        testID="earnings-paid-out"
                    />
                </View>
            )}
        </View>
    );
}
