import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { MediaSlot, PhotoList } from './MediaSlot';
import type { RedirectReason } from './screens-execution';
import { ActionBar, Body, Card, Eyebrow, InfoRow, Intro, NoteInput, OS, PrimaryButton, Segmented, Tip, cardShadow } from './ui';

// Phase 3 of the on-site flow: exit capture, close-out summary and the final screen.
// Charges and the owner rating are not sent anywhere yet.

export type DoneVariant = 'completed' | 'redirected';

// ─────────── Check-out capture ───────────
export function ScreenVideoOut({ obdPending, onNext }: { obdPending: boolean; onNext: () => void }) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.videoOut';
    const [tab, setTab] = React.useState<'video' | 'photos'>('video');
    const [videoFilled, setVideoFilled] = React.useState(false);
    const [photoFilled, setPhotoFilled] = React.useState(false);
    const ready = videoFilled || photoFilled;

    return (
        <>
            <Body>
                <Intro eyebrow={t(`${k}.eyebrow`)} title={t(`${k}.title`)} subtitle={t(`${k}.subtitle`)} />

                {obdPending ? (
                    <>
                        <View className="px-5 pt-3.5">
                            <Text className="font-outfit-bold text-[15px]" style={{ color: OS.text }}>
                                {t(`${k}.obdTitle`)}
                                <Text className="font-outfit-medium text-xs" style={{ color: OS.mutedLight }}>  {t('appointments.onSite.common.optional')}</Text>
                            </Text>
                            <Text className="font-outfit-regular text-[12.5px] mt-1" style={{ color: OS.muted }}>{t(`${k}.obdSub`)}</Text>
                        </View>
                        <Card>
                            <MediaSlot kind="file" height={140} placeholder={t('appointments.onSite.obd.placeholder')} />
                        </Card>
                    </>
                ) : null}

                <View className="px-5 pt-4">
                    <Text className="font-outfit-bold text-[15px]" style={{ color: OS.text }}>
                        {t(`${k}.mediaTitle`)}
                        <Text className="font-outfit-medium text-xs" style={{ color: OS.mutedLight }}>  {t('appointments.onSite.common.optional')}</Text>
                    </Text>
                    <Text className="font-outfit-regular text-[12.5px] mt-1" style={{ color: OS.muted }}>{t(`${k}.mediaSub`)}</Text>
                </View>
                <View className="mt-2.5">
                    <Segmented
                        value={tab}
                        onChange={setTab}
                        options={[
                            { key: 'video', label: t('appointments.onSite.common.recordVideo') },
                            { key: 'photos', label: t(`${k}.addPhotos`) },
                        ]}
                    />
                </View>
                <Card>
                    {tab === 'video' ? (
                        <>
                            <MediaSlot kind="video" height={220} placeholder={t('appointments.onSite.photos.videoPh')} onChange={setVideoFilled} />
                            <View className="px-4 pb-4 -mt-2">
                                <NoteInput placeholder={t(`${k}.videoNotePh`)} />
                            </View>
                        </>
                    ) : (
                        <PhotoList placeholder={t(`${k}.photoPh`)} height={150} onAnyFilled={setPhotoFilled} />
                    )}
                </Card>

                <Tip tone="green">{t(`${k}.tip`)}</Tip>
            </Body>
            <ActionBar>
                <PrimaryButton label={ready ? t('appointments.onSite.common.continue') : t(`${k}.skip`)} onPress={onNext} />
            </ActionBar>
        </>
    );
}

// ─────────── Close-out summary ───────────
const SERVICE_FEE = 85; // mock — pricing for on-site close-out is not wired yet

export function ScreenCloseService({ variant, partsCost, redirectReason, onClose }: {
    variant: DoneVariant; partsCost: number; redirectReason: RedirectReason | null; onClose: () => void;
}) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.close';
    const completed = variant === 'completed';

    return (
        <>
            <Body>
                <Intro eyebrow={t(`${k}.eyebrow`)} title={t(`${k}.title`)} subtitle={completed ? undefined : t(`${k}.redirected`)} />
                <Card>
                    {completed ? (
                        <>
                            <InfoRow icon="checkmark" label={t(`${k}.issue`)} value={t(`${k}.resolved`)} />
                            <InfoRow icon="list-outline" label={t(`${k}.checklist`)} value={t(`${k}.checklistValue`)} />
                            <InfoRow icon="time-outline" label={t(`${k}.time`)} value={t(`${k}.timeCompleted`)} last />
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
                            <InfoRow icon="time-outline" label={t(`${k}.time`)} value={t(`${k}.timeRedirected`)} last />
                        </>
                    )}
                </Card>

                {partsCost > 0 ? (
                    <>
                        <View className="px-5 pt-4"><Eyebrow>{t(`${k}.paidEyebrow`)}</Eyebrow></View>
                        <View className="mx-4 flex-row items-center justify-between px-4 py-3" style={cardShadow}>
                            <Text className="font-outfit-medium text-[12.5px]" style={{ color: OS.muted }}>{t(`${k}.partsPaid`)}</Text>
                            <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: OS.greenSoft }}>
                                <Text className="font-outfit-bold text-xs" style={{ color: OS.greenDark }}>{t(`${k}.paidBadge`, { amount: partsCost })}</Text>
                            </View>
                        </View>
                    </>
                ) : null}

                <View className="px-5 pt-4"><Eyebrow>{t(`${k}.chargesEyebrow`)}</Eyebrow></View>
                <View className="mx-4" style={cardShadow}>
                    <View className="flex-row justify-between px-4 py-3" style={{ borderBottomWidth: 1, borderBottomColor: OS.borderSoft }}>
                        <Text className="font-outfit-medium text-[12.5px]" style={{ color: OS.muted }}>{t(`${k}.serviceValue`)}</Text>
                        <Text className="font-outfit-bold text-[13px]" style={{ color: OS.text }}>${SERVICE_FEE}</Text>
                    </View>
                    <View className="flex-row justify-between px-4 py-3">
                        <Text className="font-outfit-bold text-[13px]" style={{ color: OS.text }}>{t(`${k}.total`)}</Text>
                        <Text className="font-outfit-bold text-[15px]" style={{ color: OS.blueDark }}>${SERVICE_FEE}</Text>
                    </View>
                </View>
            </Body>
            <ActionBar>
                <PrimaryButton label={t(`${k}.finish`)} onPress={onClose} tone="green" />
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

export function ScreenDone({ variant, appointmentId, clientName, onBackToDashboard }: {
    variant: DoneVariant; appointmentId: string; clientName: string; onBackToDashboard: () => void;
}) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.done';
    const completed = variant === 'completed';
    const [rating, setRating] = React.useState(0);
    const [comment, setComment] = React.useState('');
    const [sent, setSent] = React.useState(false);

    return (
        <Body>
            <View className="items-center px-7 pt-10">
                <View className="w-full items-center gap-3 px-5 py-6" style={cardShadow}>
                    <View className="items-center justify-center" style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: completed ? OS.greenSoft : OS.orangeSoft }}>
                        <Ionicons name="checkmark" size={28} color={completed ? OS.green : OS.orange} />
                    </View>
                    <Text className="font-outfit-bold text-xl" style={{ color: OS.text }}>{completed ? t(`${k}.completed`) : t(`${k}.finished`)}</Text>
                    <Text className="font-outfit-bold text-[10.5px]" style={{ color: OS.mutedLight }}>
                        {t('appointments.detail.idLabel', { id: appointmentId.slice(0, 8) })}
                    </Text>
                    <Text className="font-outfit-regular text-[13.5px] text-center leading-5" style={{ color: OS.muted }}>
                        {completed ? t(`${k}.completedBody`) : t(`${k}.finishedBody`)}
                    </Text>
                </View>

                {!sent ? (
                    <View className="w-full mt-7 px-4 py-5" style={cardShadow}>
                        <View className="items-center gap-2.5">
                            <View className="items-center justify-center" style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: OS.blueSoft }}>
                                <Text className="font-outfit-bold text-[22px]" style={{ color: OS.blue }}>{initials(clientName)}</Text>
                            </View>
                            <Text className="font-outfit-bold text-[17px]" style={{ color: OS.text }}>{clientName}</Text>
                            <Text className="font-outfit-medium text-[12.5px]" style={{ color: OS.mutedLight }}>{t(`${k}.owner`)}</Text>
                        </View>
                        <Text className="font-outfit-bold text-[15.5px] text-center mt-4" style={{ color: OS.text }}>{t(`${k}.rateTitle`)}</Text>
                        <Text className="font-outfit-regular text-[12.5px] text-center mt-1" style={{ color: OS.muted }}>{t(`${k}.rateSub`)}</Text>
                        <View className="flex-row justify-center gap-1.5 mt-3.5">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <TouchableOpacity key={n} onPress={() => setRating(n)} testID={`rate-${n}`}>
                                    <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={30} color={n <= rating ? '#F5A623' : OS.border} />
                                </TouchableOpacity>
                            ))}
                        </View>
                        <NoteInput value={comment} onChangeText={setComment} placeholder={t(`${k}.commentPh`)} rows={3} />
                        <TouchableOpacity
                            onPress={() => setSent(true)}
                            disabled={!rating}
                            className="items-center py-3 mt-3.5 rounded-xl"
                            style={{ backgroundColor: rating ? OS.blue : OS.blueIce }}
                        >
                            <Text className="text-white font-outfit-bold text-[13.5px]">{t(`${k}.submit`)}</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <View className="w-full mt-7 flex-row items-center gap-2.5 px-4 py-3.5 rounded-2xl" style={{ backgroundColor: OS.greenSoft }}>
                            <Ionicons name="checkmark" size={16} color={OS.green} />
                            <Text className="flex-1 font-outfit-bold text-[12.5px]" style={{ color: OS.greenDark }}>{t(`${k}.sent`)}</Text>
                        </View>
                        <View className="w-full mt-4 flex-row items-center gap-2.5 px-4 py-3.5" style={[cardShadow, { borderRadius: 16 }]}>
                            <View className="items-center justify-center" style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: OS.blueSoft }}>
                                <Text className="font-outfit-bold text-base" style={{ color: OS.blue }}>$</Text>
                            </View>
                            <Text className="flex-1 font-outfit-medium text-xs leading-4" style={{ color: OS.muted }}>{t(`${k}.payment`)}</Text>
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
