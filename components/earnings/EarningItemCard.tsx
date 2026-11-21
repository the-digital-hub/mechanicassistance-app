import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { MechanicEarning } from '@/lib/dao/interfaces';
import { refLabel } from '@/lib/refCode';
import { formatMoney } from '@/lib/payments/paymentSource';
import type { EarningRow } from '@/lib/payments/useEarnings';
import { TYPE } from '@/lib/ui/type';
import { formatLocalDateTime } from '@/lib/video/videoCallTime';

const K = 'payments';

const BADGE: Record<MechanicEarning['status'], { bg: string; border: string; text: string }> = {
    pending: { bg: '#FFFBEB', border: '#FCD34D', text: '#B45309' },
    ready: { bg: '#EFF6FF', border: '#93C5FD', text: '#1D4ED8' },
    settled: { bg: '#F0FDF4', border: '#86EFAC', text: '#15803D' },
    void: { bg: '#F3F4F6', border: '#D1D5DB', text: '#6B7280' },
};

/**
 * One charged service: what it was, its assistance id, when, where, the net
 * amount and its payout state. Never the gross or the fee: providers see what
 * they get.
 */
export function EarningItemCard({ row }: { row: EarningRow }) {
    const { t, i18n } = useTranslation();
    const badge = BADGE[row.status] ?? BADGE.void;
    const job = row.job;

    return (
        <View className="bg-white rounded-2xl px-4 py-4 mb-3 border" style={{ borderColor: '#E1EAFB' }} testID={`earning-${row.id}`}>
            <View className="flex-row items-start" style={{ gap: 10 }}>
                <View className="flex-1" style={{ minWidth: 0 }}>
                    <Text className="font-outfit-semibold text-gray-900" style={TYPE.body} numberOfLines={1}>
                        {job?.title || t(`${K}.activity.fallbackTitle`)}
                    </Text>
                    <Text className="font-outfit-medium mt-1" style={{ ...TYPE.helper, color: '#0047AB' }}>
                        {formatLocalDateTime(row.createdAt, i18n.language)}
                    </Text>
                    {(!job || job.address) && (
                        <Text className="font-outfit-medium mt-0.5" style={{ ...TYPE.helper, color: job ? '#0047AB' : '#9CA3AF' }} numberOfLines={2}>
                            {job ? t(`${K}.activity.location`, { address: job.address }) : t(`${K}.activity.unavailable`)}
                        </Text>
                    )}
                    <Text className="text-gray-400 font-outfit-regular mt-1" style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={1} selectable>
                        {refLabel(job?.refCode, row.assistanceRequestId)}
                    </Text>
                </View>
                <View className="items-end" style={{ gap: 6 }}>
                    <Text
                        className="font-outfit-bold"
                        style={{ fontSize: 18, lineHeight: 24, color: row.status === 'void' ? '#9CA3AF' : '#111827', textDecorationLine: row.status === 'void' ? 'line-through' : 'none' }}
                    >
                        {formatMoney(row.netAmount)}
                    </Text>
                    <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: badge.bg, borderWidth: 1, borderColor: badge.border }}>
                        <Text className="font-outfit-bold text-[12px] tracking-widest" style={{ color: badge.text }}>
                            {t(`${K}.status.${row.status}`)}
                        </Text>
                    </View>
                </View>
            </View>
            {(row.status === 'pending' || row.status === 'ready') && (
                <Text className="font-outfit-regular text-gray-500 mt-2.5" style={TYPE.helper}>{t(`${K}.statusHint.${row.status}`)}</Text>
            )}
        </View>
    );
}
