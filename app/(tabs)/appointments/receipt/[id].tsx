import { LinearGradient } from 'expo-linear-gradient';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Banknote, Calendar, Car, CheckCircle2, CreditCard, Info, ReceiptText, RotateCcw, Timer, Wallet, Wrench, type LucideIcon } from 'lucide-react-native';
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
import { mechanicReceiptTotals } from '@/lib/receipt/mechanicReceipt';
import { formatLocalDateTime } from '@/lib/video/videoCallTime';

// A mechanic's receipt for one finished job: what the customer paid, what the
// platform kept, and what the mechanic earns. Fees and taxes arrive as a single
// amount on purpose — the server never splits them for a provider.

const money = (v?: string | null) => {
    const n = Number(v);
    return `$${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`;
};

function IconRow({ icon: Icon, label, value, danger, last }: { icon: LucideIcon; label: string; value: string; danger?: boolean; last?: boolean }) {
    return (
        <View className="flex-row items-center px-4 py-3" style={{ gap: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: OS.borderSoft }}>
            <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: danger ? OS.redSoft : OS.blueSoft }}>
                <Icon size={18} color={danger ? OS.red : OS.blue} />
            </View>
            <View className="flex-1">
                <Text className="font-outfit-medium" style={{ fontSize: 14, lineHeight: 18, color: OS.muted }}>{label}</Text>
                <Text className="font-outfit-bold" style={{ fontSize: 16, lineHeight: 22, color: danger ? OS.red : OS.text, marginTop: 1 }}>{value}</Text>
            </View>
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
    // What each charge was for, in the words of this job: on a video call the extra charge is the time that was added.
    const isVideoCall = appointment?.type === 'videocall';
    const purposeLabel = (purpose: string) => {
        const key = purpose === 'scope_change' ? 'scopeChange' : purpose === 'service' ? 'service' : null;
        if (key) return t(`${k}.owner.purposes.${key}${isVideoCall ? 'Video' : ''}`, { defaultValue: t(`${k}.owner.purposes.${key}`) });
        return purpose.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
    };
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
                        <Text className="font-outfit-bold" style={{ fontSize: 38, letterSpacing: -1, color: '#FFFFFF', marginTop: 10, marginLeft: 46 }}>{money(String(paid))}</Text>
                        <View className="flex-row items-center" style={{ gap: 8, marginTop: 8, marginLeft: 46 }}>
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
                            {method ? <IconRow icon={isWallet ? Wallet : CreditCard} label={t(`${k}.owner.paidWith`)} value={method} last={charges.length <= 1 && !refunded} /> : null}
                            {charges.length > 1
                                ? charges.map((c, i) => (
                                      <IconRow key={c.id} icon={Banknote} label={purposeLabel(c.purpose)} value={money(c.amountCharged)} last={i === charges.length - 1 && !refunded} />
                                  ))
                                : null}
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
    const { t, i18n } = useTranslation();
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

    // What the technician takes home is the number the list card shows (`budget`, extra time included). The service
    // breakdown holds the call alone: its lines are the price before fees and its `total` is already net of them, so
    // the difference is shown as one "fees and taxes" line, and the extra time (already net) comes after the call.
    // The technician sees only what is theirs: the value of the service, the extra time and the sum. Never what was withheld.
    const { total, extension } = mechanicReceiptTotals(breakdown, appointment?.budget, earning?.netAmount);
    const when = formatLocalDateTime(appointment?.completedAt ?? appointment?.updatedAt, i18n.language);
    const statusKey = earning?.status;

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
                            <Text className="font-outfit-bold uppercase" style={{ fontSize: 12, letterSpacing: 1.2, color: 'rgba(255,255,255,0.8)' }}>{t(`${k}.earnings`)}</Text>
                        </View>
                        <Text className="font-outfit-bold" style={{ fontSize: 38, letterSpacing: -1, color: '#FFFFFF', marginTop: 10, marginLeft: 46 }}>{money(String(total))}</Text>
                        <View className="flex-row items-center" style={{ gap: 8, marginTop: 8, marginLeft: 46 }}>
                            {appointment?.refCode ? (
                                <Text className="font-outfit-medium" style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{appointment.refCode}</Text>
                            ) : null}
                            {statusKey ? (
                                <View className="flex-row items-center" style={{ gap: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' }}>
                                    {statusKey === 'settled' ? <CheckCircle2 size={14} color="#FFFFFF" /> : null}
                                    <Text className="font-outfit-bold" style={{ fontSize: 13, color: '#FFFFFF' }}>{t(`${k}.statusValue.${statusKey}`)}</Text>
                                </View>
                            ) : null}
                        </View>
                    </LinearGradient>

                    <Card>
                        {appointment?.title ? <IconRow icon={Wrench} label={t(`${k}.owner.service`)} value={appointment.title} /> : null}
                        {appointment?.car ? <IconRow icon={Car} label={t(`${k}.owner.vehicle`)} value={appointment.car} /> : null}
                        {when ? <IconRow icon={Calendar} label={t(`${k}.owner.date`)} value={when} last /> : null}
                    </Card>

                    {breakdown || earning ? (
                        <Card>
                            <Text className="font-outfit-bold uppercase px-4 pt-3 pb-1" style={{ fontSize: 12, letterSpacing: 1.2, color: OS.mutedLight }}>{t(`${k}.yourService`)}</Text>
                            {breakdown ? (
                                <>
                                    <IconRow icon={ReceiptText} label={t(`${k}.serviceValue`)} value={money(breakdown.total)} last={extension <= 0 && !statusKey} />
                                    {extension > 0 ? (
                                        <IconRow icon={Timer} label={t(`${k}.extendedTime`)} value={money(extension.toFixed(2))} last={!statusKey} />
                                    ) : null}
                                </>
                            ) : null}

                            {statusKey ? (
                                <IconRow icon={Wallet} label={t(`${k}.status`)} value={t(`${k}.statusValue.${statusKey}`)} last />
                            ) : null}
                        </Card>
                    ) : (
                        <Card>
                            <View className="flex-row items-center p-4" style={{ gap: 12 }}>
                                <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: OS.blueSoft }}>
                                    <Info size={18} color={OS.blue} />
                                </View>
                                <Text className="font-outfit-medium flex-1" style={{ fontSize: 14, lineHeight: 20, color: OS.muted }}>{t(`${k}.notCharged`)}</Text>
                            </View>
                        </Card>
                    )}
                </Body>
            )}
        </View>
    );
}
