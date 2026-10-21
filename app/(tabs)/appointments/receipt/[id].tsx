import { useGlobalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { Body, Card, FlowHeader, OS } from '@/components/on-site/ui';
import { useAppointments } from '@/context/AppointmentsContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { earningsDAO } from '@/lib/dao/EarningsDAO';
import type { MechanicEarning, ProviderBreakdown } from '@/lib/dao/interfaces';

// A mechanic's receipt for one finished job: what the customer paid, what the
// platform kept, and what the mechanic earns. Fees and taxes arrive as a single
// amount on purpose — the server never splits them for a provider.

const money = (v?: string | null) => {
    const n = Number(v);
    return `$${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`;
};

function Line({ label, value, strong, negative }: { label: string; value: string; strong?: boolean; negative?: boolean }) {
    return (
        <View className="flex-row items-center justify-between px-4 py-2.5">
            <Text className={strong ? 'font-outfit-bold text-[15px]' : 'font-outfit-medium text-sm'} style={{ color: strong ? OS.text : OS.muted }}>
                {label}
            </Text>
            <Text className={strong ? 'font-outfit-bold text-lg' : 'font-outfit-bold text-sm'} style={{ color: negative ? OS.red : strong ? OS.blue : OS.text }}>
                {negative ? `-${value}` : value}
            </Text>
        </View>
    );
}

export default function JobReceiptScreen() {
    const { id: rawId } = useGlobalSearchParams();
    const id = Array.isArray(rawId) ? rawId[0] : rawId || '';
    const router = useRouter();
    const { t } = useTranslation();
    const k = 'appointments.receipt';
    const { getAppointmentById } = useAppointments();
    const appointment = getAppointmentById(id);

    const [loading, setLoading] = React.useState(true);
    const [earning, setEarning] = React.useState<MechanicEarning | null>(null);
    const [breakdown, setBreakdown] = React.useState<ProviderBreakdown | null>(null);

    React.useEffect(() => {
        if (!id) return;
        let cancelled = false;
        Promise.all([
            earningsDAO.getForRequest(id).catch(() => null),
            assistanceDAO.getById(id).catch(() => null),
        ])
            .then(([e, req]) => {
                if (cancelled) return;
                setEarning(e);
                setBreakdown(req?.providerBreakdown ?? null);
            })
            .finally(() => !cancelled && setLoading(false));
        return () => { cancelled = true; };
    }, [id]);

    const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/appointments'));
    const fallbackAmount = appointment?.budget?.replace('$', '');
    const net = earning?.netAmount ?? breakdown?.total ?? fallbackAmount;

    return (
        <View className="flex-1" style={{ backgroundColor: OS.page }}>
            <FlowHeader title={t(`${k}.title`)} onBack={back} />
            {loading ? (
                <View className="flex-1 items-center justify-center"><ActivityIndicator color={OS.blue} /></View>
            ) : (
                <Body>
                    <Card>
                        <View className="px-4 pt-4 pb-2">
                            <Text className="font-outfit-bold text-[10.5px] uppercase tracking-widest" style={{ color: OS.mutedLight }}>
                                {t(`${k}.earnings`)}
                            </Text>
                            <Text className="font-outfit-bold text-[32px]" style={{ color: OS.text }}>{money(net)}</Text>
                            {appointment?.car ? (
                                <Text className="font-outfit-medium text-xs mt-0.5" style={{ color: OS.muted }}>{appointment.car}</Text>
                            ) : null}
                        </View>
                    </Card>

                    {breakdown && (
                        <Card>
                            <Text className="font-outfit-bold text-xs px-4 pt-3" style={{ color: OS.text }}>{t(`${k}.yourService`)}</Text>
                            <Line label={t(`${k}.base`)} value={money(breakdown.base)} />
                            {breakdown.timeBand && Number(breakdown.timeBand.amount) !== 0 && (
                                <Line label={t(`${k}.timeBand`)} value={money(breakdown.timeBand.amount)} />
                            )}
                            {breakdown.weather && Number(breakdown.weather.amount) !== 0 && (
                                <Line label={t(`${k}.weather`)} value={money(breakdown.weather.amount)} />
                            )}
                            <Line label={t(`${k}.serviceTotal`)} value={money(breakdown.total)} strong />
                        </Card>
                    )}

                    {earning ? (
                        <Card>
                            <Text className="font-outfit-bold text-xs px-4 pt-3" style={{ color: OS.text }}>{t(`${k}.payment`)}</Text>
                            {/* Providers see what they get, never the fee or what the customer paid. */}
                            <Line label={t(`${k}.youEarn`)} value={money(earning.netAmount)} strong />
                            <View className="px-4 pb-3">
                                <Text className="font-outfit-bold text-[10.5px] uppercase" style={{ color: OS.mutedLight }}>{t(`${k}.status`)}</Text>
                                <Text className="font-outfit-bold text-sm mt-0.5" style={{ color: OS.text }}>
                                    {t(`${k}.statusValue.${earning.status}`)}
                                </Text>
                            </View>
                        </Card>
                    ) : (
                        <Card>
                            <Text className="font-outfit-medium text-sm p-4" style={{ color: OS.muted }}>{t(`${k}.notCharged`)}</Text>
                        </Card>
                    )}
                </Body>
            )}
        </View>
    );
}
