import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import type { OnSiteVisit } from '@/lib/dao/OnSiteDAO';
import { ObdPanel } from './ObdPanel';
import type { RedirectReason } from './screens-execution';
import { ActionBar, Body, Card, Eyebrow, InfoRow, Intro, MAINTENANCE_ITEMS, NoteInput, OS, PrimaryButton, cardShadow } from './ui';
import { appAlert } from '@/lib/ui/appAlert';
import { useAppointments } from '@/context/AppointmentsContext';
import { refLabel } from '@/lib/refCode';

// Phase 3 of the on-site flow: close-out summary and the final screen.
// Charges and the owner rating are not sent anywhere yet.

export type DoneVariant = 'completed' | 'redirected';

// ─────────── Close-out summary ───────────
function formatAmount(amount: string | null): string {
    if (!amount) return '—';
    const n = Number(String(amount).replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : amount;
}

export function ScreenCloseService({ variant, partsCost, redirectReason, serviceAmount, checkedInAt, onClose, visit, vehicle, vin, requestCode }: {
    variant: DoneVariant;
    partsCost: number;
    redirectReason: RedirectReason | null;
    /** Price agreed when the job was accepted, as the server stores it. */
    serviceAmount: string | null;
    checkedInAt: string | null;
    onClose: () => Promise<void>;
    /** The visit as the server has it: what was captured, scanned and checked. */
    visit?: OnSiteVisit | null;
    vehicle?: string | null;
    /** The VIN the technician entered at check-in. */
    vin?: string | null;
    /** The assistance's short code (`AS-4H8TX2`), for support and for the technician's own records. */
    requestCode?: string | null;
}) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.close';
    const completed = variant === 'completed';
    const [closing, setClosing] = React.useState(false);
    const minutesOnSite = checkedInAt ? Math.max(1, Math.round((Date.now() - new Date(checkedInAt).getTime()) / 60000)) : null;
    const timeValue = minutesOnSite !== null ? t(`${k}.minutes`, { minutes: minutesOnSite }) : '—';
    const amount = formatAmount(serviceAmount);

    // What was done, from the visit itself: so the summary says what the technician did and not only the outcome.
    const media = visit?.media ?? [];
    const photos = media.filter((m) => m.mediaType === 'image').length;
    const videos = media.filter((m) => m.mediaType === 'video').length;
    const mediaValue = [
        photos > 0 ? t(`${k}.photosCount`, { count: photos }) : null,
        videos > 0 ? t(`${k}.videosCount`, { count: videos }) : null,
    ].filter(Boolean).join(' · ');
    const obdCount = visit?.obdCodes?.length ?? 0;
    const obdValue = visit?.obdStatus === 'processing'
        ? t(`${k}.obdProcessing`)
        : obdCount > 0
            ? t(`${k}.obdCodes`, { count: obdCount })
            : visit?.obdStatus === 'ready' || visit?.obdStatus === 'manual'
                ? t(`${k}.obdNoCodes`)
                : t(`${k}.obdNone`);
    const checklistDone = Object.values(visit?.maintenanceChecklist ?? {}).filter(Boolean).length;
    const shownVin = vin || visit?.obdVin || null;
    const detailRows: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }[] = [
        vehicle ? { icon: 'car-outline' as const, label: t(`${k}.vehicle`), value: vehicle } : null,
        shownVin ? { icon: 'barcode-outline' as const, label: t(`${k}.vin`), value: shownVin } : null,
        visit?.checkinMethod ? { icon: 'log-in-outline' as const, label: t(`${k}.checkIn`), value: t(`${k}.checkInValue`, { method: t(`${k}.method.${visit.checkinMethod}`) }) } : null,
        visit ? { icon: 'hardware-chip-outline' as const, label: t(`${k}.obd`), value: obdValue } : null,
        visit ? { icon: 'images-outline' as const, label: t(`${k}.media`), value: mediaValue || t(`${k}.mediaNone`) } : null,
        completed && visit ? { icon: 'list-outline' as const, label: t(`${k}.checklist`), value: t(`${k}.checklistDone`, { done: checklistDone, total: MAINTENANCE_ITEMS.length }) } : null,
        visit?.workNotes?.trim() ? { icon: 'document-text-outline' as const, label: t(`${k}.notes`), value: visit.workNotes.trim() } : null,
    ].filter((r): r is NonNullable<typeof r> => r !== null);

    const finish = async () => {
        setClosing(true);
        try {
            await onClose();
        } finally {
            setClosing(false);
        }
    };

    return (
        <>
            <Body>
                <Intro eyebrow={t(`${k}.eyebrow`)} title={t(`${k}.title`)} subtitle={completed ? t(`${k}.subtitleCompleted`) : t(`${k}.redirected`)} />

                {/* What the mechanic gets, in a card of its own at the top: this is a payout, not a charge to anyone. */}
                <View className="mx-4 mt-3.5 px-5 py-4" style={[cardShadow, { backgroundColor: OS.blueSofter, borderWidth: 1, borderColor: OS.blueSoft }]} testID="close-total">
                    <Text className="font-outfit-bold uppercase" style={{ fontSize: 13, letterSpacing: 0.8, color: OS.muted }}>{t(`${k}.chargesEyebrow`)}</Text>
                    <Text className="font-outfit-bold" style={{ fontSize: 36, lineHeight: 42, letterSpacing: -1, color: OS.blueDark, marginTop: 4 }}>{amount}</Text>
                    <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: OS.muted, marginTop: 4 }}>{t(`${k}.payoutHint`)}</Text>
                </View>
                <Card>
                    {requestCode ? <InfoRow icon="pricetag-outline" label={t(`${k}.requestId`)} value={requestCode} /> : null}
                    {completed ? (
                        <>
                            <InfoRow icon="checkmark" label={t(`${k}.issue`)} value={t(`${k}.resolved`)} />
                            <InfoRow icon="time-outline" label={t(`${k}.time`)} value={timeValue} last />
                        </>
                    ) : (
                        <>
                            <InfoRow icon="arrow-forward" label={t(`${k}.issue`)} value={t(`${k}.cannotResolve`)} />
                            {redirectReason ? (
                                <InfoRow
                                    icon="alert-circle-outline"
                                    label={t(`${k}.reason`)}
                                    value={
                                        <View className="mt-0.5">
                                            <Text className="font-outfit-bold text-sm" style={{ color: OS.text }}>{redirectReason.label}</Text>
                                            {redirectReason.note ? (
                                                <Text className="font-outfit-medium text-[13px] mt-0.5" style={{ color: OS.muted }}>{redirectReason.note}</Text>
                                            ) : null}
                                        </View>
                                    }
                                />
                            ) : null}
                            <InfoRow icon="time-outline" label={t(`${k}.time`)} value={timeValue} last />
                        </>
                    )}
                </Card>

                {detailRows.length > 0 ? (
                    <>
                        <View className="px-5 pt-4"><Eyebrow>{t(`${k}.doneEyebrow`)}</Eyebrow></View>
                        <Card>
                            {detailRows.map((r, i) => (
                                <InfoRow key={r.label} icon={r.icon} label={r.label} value={r.value} last={i === detailRows.length - 1} />
                            ))}
                        </Card>
                    </>
                ) : null}

                {partsCost > 0 ? (
                    <>
                        <View className="px-5 pt-4"><Eyebrow>{t(`${k}.paidEyebrow`)}</Eyebrow></View>
                        <View className="mx-4 flex-row items-center justify-between px-4 py-3" style={cardShadow}>
                            <Text className="font-outfit-medium text-[13px]" style={{ color: OS.muted }}>{t(`${k}.partsPaid`)}</Text>
                            <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: OS.greenSoft }}>
                                <Text className="font-outfit-bold text-[13px]" style={{ color: OS.greenDark }}>{t(`${k}.paidBadge`, { amount: partsCost })}</Text>
                            </View>
                        </View>
                    </>
                ) : null}
            </Body>
            <ActionBar>
                <PrimaryButton label={closing ? t(`${k}.closing`) : t(`${k}.finish`)} onPress={() => void finish()} disabled={closing} tone="green" />
            </ActionBar>
        </>
    );
}

// ─────────── Service closed + rate the owner ───────────
function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length || name === '—') return '?';
    return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}

export function ScreenDone({ variant, appointmentId, visit, onVisit, clientName, alreadyRated, onSubmitReview, onBackToDashboard }: {
    variant: DoneVariant;
    appointmentId: string;
    visit: OnSiteVisit | null;
    onVisit: (v: OnSiteVisit) => void;
    clientName: string;
    alreadyRated: boolean;
    onSubmitReview: (rating: number, comment: string) => Promise<void>;
    onBackToDashboard: () => void;
}) {
    const { getAppointmentById } = useAppointments();
    const { t } = useTranslation();
    const k = 'appointments.onSite.done';
    const completed = variant === 'completed';
    const [rating, setRating] = React.useState(0);
    const [comment, setComment] = React.useState('');
    const [sent, setSent] = React.useState(alreadyRated);
    // The OBD report can still be uploaded after the close-out (the reminder push leads here).
    const [obdPending] = React.useState(() => visit?.obdStatus === 'none' || visit?.obdStatus === 'failed' || visit?.obdStatus === 'processing');
    const [sending, setSending] = React.useState(false);

    const submit = async () => {
        setSending(true);
        try {
            await onSubmitReview(rating, comment);
            setSent(true);
        } catch {
            appAlert(t('appointments.onSite.common.error'));
        } finally {
            setSending(false);
        }
    };

    return (
        <Body>
            <View className="items-center px-7 pt-10">
                <View className="w-full items-center gap-3 px-5 py-6" style={cardShadow}>
                    <View className="items-center justify-center" style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: completed ? OS.greenSoft : OS.orangeSoft }}>
                        <Ionicons name="checkmark" size={28} color={completed ? OS.green : OS.orange} />
                    </View>
                    <Text className="font-outfit-bold text-xl" style={{ color: OS.text }}>{completed ? t(`${k}.completed`) : t(`${k}.finished`)}</Text>
                    <Text className="font-outfit-bold text-[13px]" style={{ color: OS.mutedLight }}>
                        {t('appointments.detail.idLabel', { id: refLabel(getAppointmentById(appointmentId)?.refCode, appointmentId) })}
                    </Text>
                    <Text className="font-outfit-regular text-[14px] text-center leading-5" style={{ color: OS.muted }}>
                        {completed ? t(`${k}.completedBody`) : t(`${k}.finishedBody`)}
                    </Text>
                </View>

                {obdPending ? (
                    <View className="w-full mt-6" style={{ marginHorizontal: -16 }}>
                        <Text className="font-outfit-bold text-[15px] mx-4" style={{ color: OS.text }}>
                            {t('appointments.onSite.videoOut.obdTitle')}
                        </Text>
                        <ObdPanel appointmentId={appointmentId} visit={visit} onVisit={onVisit} />
                    </View>
                ) : null}

                {!sent ? (
                    <View className="w-full mt-7 px-4 py-5" style={cardShadow}>
                        <View className="items-center gap-2.5">
                            <View className="items-center justify-center" style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: OS.blueSoft }}>
                                <Text className="font-outfit-bold text-[22px]" style={{ color: OS.blue }}>{initials(clientName)}</Text>
                            </View>
                            <Text className="font-outfit-bold text-[17px]" style={{ color: OS.text }}>{clientName}</Text>
                            <Text className="font-outfit-medium text-[13px]" style={{ color: OS.mutedLight }}>{t(`${k}.owner`)}</Text>
                        </View>
                        <Text className="font-outfit-bold text-[16px] text-center mt-4" style={{ color: OS.text }}>{t(`${k}.rateTitle`)}</Text>
                        <Text className="font-outfit-regular text-[13px] text-center mt-1" style={{ color: OS.muted }}>{t(`${k}.rateSub`)}</Text>
                        <View className="flex-row justify-center gap-1.5 mt-3.5">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <TouchableOpacity key={n} onPress={() => setRating(n)} testID={`rate-${n}`}>
                                    <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={30} color={n <= rating ? '#F5A623' : OS.border} />
                                </TouchableOpacity>
                            ))}
                        </View>
                        <NoteInput value={comment} onChangeText={setComment} placeholder={t(`${k}.commentPh`)} rows={3} />
                        <TouchableOpacity
                            onPress={() => void submit()}
                            disabled={!rating || sending}
                            className="items-center py-3 mt-3.5 rounded-[14px]"
                            style={{ backgroundColor: rating && !sending ? OS.blue : OS.blueIce }}
                        >
                            <Text className="text-white font-outfit-bold text-[14px]">{t(`${k}.submit`)}</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <View className="w-full mt-7 flex-row items-center gap-2.5 px-4 py-3.5 rounded-2xl" style={{ backgroundColor: OS.greenSoft }}>
                            <Ionicons name="checkmark" size={16} color={OS.green} />
                            <Text className="flex-1 font-outfit-bold text-[13px]" style={{ color: OS.greenDark }}>{t(`${k}.sent`)}</Text>
                        </View>
                        <View className="w-full mt-4 flex-row items-center gap-2.5 px-4 py-3.5" style={[cardShadow, { borderRadius: 16 }]}>
                            <View className="items-center justify-center" style={{ width: 30, height: 30, borderRadius: 11, backgroundColor: OS.blueSoft }}>
                                <Text className="font-outfit-bold text-base" style={{ color: OS.blue }}>$</Text>
                            </View>
                            <Text className="flex-1 font-outfit-medium text-[13px] leading-4" style={{ color: OS.muted }}>{t(`${k}.payment`)}</Text>
                        </View>
                        <TouchableOpacity onPress={onBackToDashboard} className="mt-4 px-5 py-3 rounded-full" style={{ backgroundColor: OS.blueSoft }} testID="on-site-back-dashboard">
                            <Text className="font-outfit-bold text-[13px]" style={{ color: OS.blue }}>{t(`${k}.back`)}</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </Body>
    );
}
