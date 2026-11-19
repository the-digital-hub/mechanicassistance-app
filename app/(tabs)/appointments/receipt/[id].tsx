import { LinearGradient } from 'expo-linear-gradient';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Banknote, Calendar, Car, CheckCircle2, CreditCard, Info, ReceiptText, RotateCcw, Wallet, Wrench, type LucideIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { Body, Card, FlowHeader, OS } from '@/components/on-site/ui';
import { useAppointments } from '@/context/AppointmentsContext';
import { useUser } from '@/context/UserContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { earningsDAO } from '@/lib/dao/EarningsDAO';
import type { MechanicEarning, ProviderBreakdown } from '@/lib/dao/interfaces';
import { walletDAO, type PaymentHistoryItem } from '@/lib/dao/WalletDAO';
import { formatLocalDateTime } from '@/lib/video/videoCallTime';

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

function IconRow({ icon: Icon, label, value, danger, last }: { icon: LucideIcon; label: string; value: string; danger?: boolean; last?: boolean }) {
    return (
        <View className="flex-row items-center px-4 py-3" style={{ gap: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: OS.borderSoft }}>
            <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: danger ? OS.redSoft : OS.blueSoft }}>
                <Icon size={18} color={danger ? OS.red : OS.blue} />
            </View>
            <Text className="font-outfit-medium" style={{ fontSize: 14, color: OS.muted }}>{label}</Text>
            <Text className="font-outfit-bold flex-1" style={{ fontSize: 16, lineHeight: 22, color: danger ? OS.red : OS.text, textAlign: 'right' }}>{value}</Text>
        </View>
    );
}

/** What the owner paid for one finished job, from the billing payment of that request. */
function OwnerReceipt({ id }: { id: string }) {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const k = 'appointments.receipt';
    const { getAppointmentById } = useAppointments();
    const appointment = getAppointmentById(id);
    const [loading, setLoading] = React.useState(true);
    // Every charge of the request: a video call that was extended is billed more than once (the call, then each
    // extension), and the receipt has to add them all up to match the amount the list shows.
    const [charges, setCharges] = React.useState<PaymentHistoryItem[]>([]);
    const payment = charges[0] ?? null;

    React.useEffect(() => {
        let cancelled = false;
        walletDAO.history(1, 100)
            .then((h) => {
                if (cancelled) return;
                const rows = h.payments.items.filter((p) => p.assistanceRequestId === id);
                const charged = rows
                    .filter((p) => Number(p.amountCharged) > 0)
                    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
                setCharges(charged.length > 0 ? charged : rows.slice(0, 1));
            })
            .catch(() => undefined)
            .finally(() => !cancelled && setLoading(false));
        return () => { cancelled = true; };
    }, [id]);

    const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/appointments'));
    const chargedTotal = charges.reduce((sum, p) => sum + Number(p.amountCharged || 0), 0);
    const refundedTotal = charges.reduce((sum, p) => sum + Number(p.amountRefunded || 0), 0);
    const paid = payment ? chargedTotal - refundedTotal : Number(appointment?.budget?.replace('$', '') ?? 0);
    const when = formatLocalDateTime(appointment?.completedAt ?? appointment?.updatedAt, i18n.language);
    const method = payment?.method === 'wallet' ? t(`${k}.owner.methodWallet`) : payment ? t(`${k}.owner.methodCard`) : null;

    const isWallet = payment?.method === 'wallet';
    const refunded = refundedTotal > 0;
    const purposeLabel = (purpose: string) =>
        t(`${k}.owner.purposes.${purpose}`, { defaultValue: purpose.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) });
    const statusKey = payment?.status ?? '';
    const statusOk = ['succeeded', 'charged', 'captured'].includes(statusKey);

    return (
        <View className="flex-1" style={{ backgroundColor: OS.page }}>
            <FlowHeader title={t(`${k}.title`)} onBack={back} />
            {loading ? (
                <View className="flex-1 items-center justify-center"><ActivityIndicator color={OS.blue} /></View>
            ) : (
                <Body>
                    <LinearGradient
                        colors={['#2B66F8', '#081E72']}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 1, y: 0 }}
                        style={{ borderRadius: 20, padding: 20, marginHorizontal: 15, marginTop: 14 }}
                    >
                        <View className="flex-row items-center" style={{ gap: 10 }}>
                            <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)' }}>
                                <ReceiptText size={20} color="#FFFFFF" />
                            </View>
                            <Text className="font-outfit-bold uppercase" style={{ fontSize: 12, letterSpacing: 1.2, color: 'rgba(255,255,255,0.8)' }}>{t(`${k}.owner.paidTitle`)}</Text>
                        </View>
                        <Text className="font-outfit-bold" style={{ fontSize: 38, letterSpacing: -1, color: '#FFFFFF', marginTop: 10 }}>{money(String(paid))}</Text>
                        <View className="flex-row items-center" style={{ gap: 8, marginTop: 8 }}>
                            {appointment?.refCode ? (
                                <Text className="font-outfit-medium" style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{appointment.refCode}</Text>
                            ) : null}
                            {payment ? (
                                <View className="flex-row items-center" style={{ gap: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' }}>
                                    {statusOk ? <CheckCircle2 size={14} color="#FFFFFF" /> : null}
                                    <Text className="font-outfit-bold" style={{ fontSize: 13, color: '#FFFFFF' }}>
                                        {t(`${k}.owner.paymentStatus.${statusKey}`, { defaultValue: statusKey })}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                    </LinearGradient>

                    <Card>
                        {appointment?.title ? <IconRow icon={Wrench} label={t(`${k}.owner.service`)} value={appointment.title} /> : null}
                        {appointment?.car ? <IconRow icon={Car} label={t(`${k}.owner.vehicle`)} value={appointment.car} /> : null}
                        {when ? <IconRow icon={Calendar} label={t(`${k}.owner.date`)} value={when} last /> : null}
                    </Card>

                    {payment ? (
                        <Card>
                            <Text className="font-outfit-bold uppercase px-4 pt-3" style={{ fontSize: 12, letterSpacing: 1.2, color: OS.mutedLight }}>{t(`${k}.owner.payment`)}</Text>
                            {method ? <IconRow icon={isWallet ? Wallet : CreditCard} label={t(`${k}.owner.paidWith`)} value={method} /> : null}
                            {charges.length > 1
                                ? charges.map((c) => (
                                      <IconRow key={c.id} icon={Banknote} label={purposeLabel(c.purpose)} value={money(c.amountCharged)} />
                                  ))
                                : null}
                            {/* The total: set apart by a line and a tinted band, like the budget's total. */}
                            <View
                                className="flex-row items-center"
                                style={{ gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: OS.blueSoft, borderTopWidth: 2, borderTopColor: OS.blue }}
                                testID="receipt-total-charged"
                            >
                                <Text className="font-outfit-bold flex-1" style={{ fontSize: 17, color: OS.text }}>{t(`${k}.owner.totalCharged`)}</Text>
                                <Text className="font-outfit-bold" style={{ fontSize: 22, letterSpacing: -0.4, color: OS.blue }}>{money(String(chargedTotal))}</Text>
                            </View>
                            {refunded ? (
                                <IconRow icon={RotateCcw} label={t(`${k}.owner.refunded`)} value={`-${money(String(refundedTotal))}`} danger last />
                            ) : null}
                        </Card>
                    ) : (
                        <Card>
                            <View className="flex-row items-center p-4" style={{ gap: 12 }}>
                                <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: OS.blueSoft }}>
                                    <Info size={18} color={OS.blue} />
                                </View>
                                <Text className="font-outfit-medium flex-1" style={{ fontSize: 14, lineHeight: 20, color: OS.muted }}>{t(`${k}.owner.notFound`)}</Text>
                            </View>
                        </Card>
                    )}
                </Body>
            )}
        </View>
    );
}

export default function JobReceiptScreen() {
    const { id: rawId } = useGlobalSearchParams();
    const id = Array.isArray(rawId) ? rawId[0] : rawId || '';
    const { user } = useUser();
    return user?.role === 'mechanic' ? <MechanicReceipt id={id} /> : <OwnerReceipt id={id} />;
}

function MechanicReceipt({ id }: { id: string }) {
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
                            <Text className="font-outfit-bold text-[12px] uppercase tracking-widest" style={{ color: OS.mutedLight }}>
                                {t(`${k}.earnings`)}
                            </Text>
                            <Text className="font-outfit-bold text-[32px]" style={{ color: OS.text }}>{money(net)}</Text>
                            {appointment?.car ? (
                                <Text className="font-outfit-medium text-[13px] mt-0.5" style={{ color: OS.muted }}>{appointment.car}</Text>
                            ) : null}
                        </View>
                    </Card>

                    {breakdown && (
                        <Card>
                            <Text className="font-outfit-bold text-[13px] px-4 pt-3" style={{ color: OS.text }}>{t(`${k}.yourService`)}</Text>
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
                            <Text className="font-outfit-bold text-[13px] px-4 pt-3" style={{ color: OS.text }}>{t(`${k}.payment`)}</Text>
                            {/* Providers see what they get, never the fee or what the customer paid. */}
                            <Line label={t(`${k}.youEarn`)} value={money(earning.netAmount)} strong />
                            <View className="px-4 pb-3">
                                <Text className="font-outfit-bold text-[13px] uppercase" style={{ color: OS.mutedLight }}>{t(`${k}.status`)}</Text>
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
