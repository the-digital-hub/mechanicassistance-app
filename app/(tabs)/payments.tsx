import * as Sharing from 'expo-sharing';
import { ChevronLeft, ChevronRight, Clock, FileDown } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { EarningItemCard } from '@/components/earnings/EarningItemCard';
import { type ActivityFilterState, EarningsFiltersBar, toYmd } from '@/components/earnings/EarningsFiltersBar';
import { EarningsSummaryCards } from '@/components/earnings/EarningsSummaryCards';
import { PayoutAccountCard } from '@/components/earnings/PayoutAccountCard';
import { PayoutHistory } from '@/components/earnings/PayoutHistory';
import { earningsDAO } from '@/lib/dao/EarningsDAO';
import type { EarningsFilters } from '@/lib/dao/interfaces';
import { useConnectStatus, useEarnings, usePayouts } from '@/lib/payments/useEarnings';
import { TYPE } from '@/lib/ui/type';

const K = 'payments';
const PAGE_SIZE = 10;

/** The day after `ymd`: billing's `to` is exclusive, the picker's is inclusive. */
function nextDay(ymd: string): string {
    const [y, m, d] = ymd.split('-').map(Number);
    return toYmd(new Date(y, m - 1, d + 1));
}

/**
 * The mechanic's "Provider payouts": the Stripe account earnings are deposited
 * into, the totals, the earnings activity with date filters, the account
 * statement PDF and the payouts already sent. Payouts are automatic (2 days
 * after the charge, then the next run), so there is nothing to request here.
 */
export default function PaymentsScreen() {
    const { t } = useTranslation();
    const [filters, setFilters] = useState<ActivityFilterState>({ sort: 'newest' });
    const [pendingOnly, setPendingOnly] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [statementError, setStatementError] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(0);

    const period = useMemo(
        () => ({ from: filters.from, to: filters.to ? nextDay(filters.to) : undefined }),
        [filters.from, filters.to],
    );
    const query = useMemo<EarningsFilters>(
        () => ({ ...period, sort: filters.sort, ...(pendingOnly ? { status: 'pending' as const } : {}) }),
        [period, filters.sort, pendingOnly],
    );

    const connect = useConnectStatus();
    const earnings = useEarnings(query);
    const { payouts, reload: reloadPayouts } = usePayouts();

    const refresh = async () => {
        setRefreshing(true);
        await Promise.all([connect.reload(), earnings.reload(), reloadPayouts()]);
        setRefreshing(false);
    };

    const downloadStatement = async () => {
        setDownloading(true);
        setStatementError(false);
        try {
            const uri = await earningsDAO.downloadStatement(period);
            await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: t(`${K}.actions.statement`) });
        } catch {
            setStatementError(true);
        } finally {
            setDownloading(false);
        }
    };

    const rows = earnings.rows;
    const pageCount = rows ? Math.max(1, Math.ceil(rows.length / PAGE_SIZE)) : 1;
    const current = Math.min(page, pageCount - 1);
    const pageRows = rows ? rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE) : [];
    const go = (p: number) => setPage(Math.max(0, Math.min(pageCount - 1, p)));

    return (
        <ScrollView
            style={{ backgroundColor: '#F4F6FC' }}
            contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#0047AB" />}
            testID="earnings-screen"
        >
            <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">{t(`${K}.badge`)}</Text>
            </View>
            <Text className="text-gray-900 font-outfit-medium text-3xl mb-2">{t(`${K}.title`)}</Text>
            <Text className="text-gray-500 font-outfit-regular text-base mb-6">{t(`${K}.subtitle`)}</Text>

            <PayoutAccountCard status={connect.status} error={connect.error} onReturn={connect.reload} />

            <EarningsSummaryCards summary={earnings.summary} />

            <View className="mb-2" style={{ gap: 8 }}>
                <TouchableOpacity
                    onPress={downloadStatement}
                    disabled={downloading}
                    className="flex-row items-center justify-center rounded-xl border bg-white px-3"
                    style={{ minHeight: 48, borderColor: '#BFD3F5', gap: 8, opacity: downloading ? 0.6 : 1 }}
                    accessibilityRole="button"
                    testID="earnings-statement"
                >
                    {downloading ? <ActivityIndicator color="#0047AB" /> : <FileDown size={16} color="#0047AB" />}
                    <Text className="font-outfit-semibold" style={{ ...TYPE.helper, color: '#0047AB' }} numberOfLines={1}>
                        {t(`${K}.actions.statement`)}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => { setPendingOnly((v) => !v); setPage(0); }}
                    className="flex-row items-center justify-center rounded-xl border px-3"
                    style={{
                        minHeight: 48,
                        gap: 8,
                        borderColor: '#FCD34D',
                        backgroundColor: pendingOnly ? '#FEF3C7' : '#FFFBEB',
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: pendingOnly }}
                    testID="earnings-pending-toggle"
                >
                    <Clock size={16} color="#B45309" />
                    <Text className="font-outfit-semibold" style={{ ...TYPE.helper, color: '#B45309' }}>
                        {pendingOnly ? t(`${K}.actions.all`) : t(`${K}.actions.pending`)}
                    </Text>
                </TouchableOpacity>
            </View>
            {statementError && (
                <Text className="font-outfit-semibold text-base mb-2" style={{ color: '#B91C1C' }}>
                    {t(`${K}.actions.statementFailed`)}
                </Text>
            )}
            <Text className="text-gray-500 font-outfit-regular mb-7 mt-1" style={TYPE.helper}>{t(`${K}.howItWorks`)}</Text>

            <View className="flex-row items-end justify-between mb-3">
                <Text className="text-gray-900 font-outfit-semibold text-lg">{t(`${K}.activity.title`)}</Text>
                {rows && (
                    <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF' }}>
                        <Text className="font-outfit-bold" style={{ ...TYPE.caption, color: '#1E56E3' }}>
                            {t(`${K}.activity.count`, { count: rows.length })}
                        </Text>
                    </View>
                )}
            </View>

            <EarningsFiltersBar value={filters} onChange={(f) => { setFilters(f); setPage(0); }} />

            {rows === null ? (
                <ActivityIndicator color="#0047AB" style={{ marginTop: 12 }} />
            ) : earnings.error ? (
                <Text className="font-outfit-regular text-base text-gray-500">{t(`${K}.activity.loadFailed`)}</Text>
            ) : rows.length === 0 ? (
                <Text className="font-outfit-regular text-base text-gray-500">{t(`${K}.activity.empty`)}</Text>
            ) : (
                <>
                    {pageRows.map((row) => <EarningItemCard key={row.id} row={row} />)}
                    {rows.length > PAGE_SIZE && (
                        <View className="flex-row items-center justify-between mt-1 mb-2" testID="earnings-pager">
                            <TouchableOpacity
                                onPress={() => go(current - 1)}
                                disabled={current === 0}
                                className="w-11 h-11 rounded-full items-center justify-center bg-white border"
                                style={{ borderColor: '#BFD3F5', opacity: current === 0 ? 0.4 : 1 }}
                                accessibilityRole="button"
                                accessibilityLabel={t(`${K}.activity.prevPage`)}
                                testID="earnings-prev"
                            >
                                <ChevronLeft size={20} color="#0047AB" />
                            </TouchableOpacity>
                            <Text className="font-outfit-semibold" style={{ ...TYPE.helper, color: '#4B5563' }}>
                                {t(`${K}.activity.pageRange`, { from: current * PAGE_SIZE + 1, to: Math.min((current + 1) * PAGE_SIZE, rows.length), total: rows.length })}
                            </Text>
                            <TouchableOpacity
                                onPress={() => go(current + 1)}
                                disabled={current >= pageCount - 1}
                                className="w-11 h-11 rounded-full items-center justify-center bg-white border"
                                style={{ borderColor: '#BFD3F5', opacity: current >= pageCount - 1 ? 0.4 : 1 }}
                                accessibilityRole="button"
                                accessibilityLabel={t(`${K}.activity.nextPage`)}
                                testID="earnings-next"
                            >
                                <ChevronRight size={20} color="#0047AB" />
                            </TouchableOpacity>
                        </View>
                    )}
                </>
            )}

            <PayoutHistory payouts={payouts} />
        </ScrollView>
    );
}
