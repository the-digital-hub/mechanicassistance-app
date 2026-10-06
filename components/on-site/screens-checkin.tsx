import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { ObdCode, OnSiteVisit } from '@/lib/dao/OnSiteDAO';
import { ObdPanel } from './ObdPanel';
import { MediaSlot, PhotoList, useExistingCaptures } from './MediaSlot';
import {
    ActionBar, Body, Card, CardTitle, GhostButton, InfoRow, Intro, OS, PrimaryButton, Segmented, Spinner, Tip, cardShadow,
} from './ui';

// Phase 1 of the on-site flow: check-in, issue review and diagnostic.

export interface OnSiteAppointment {
    id: string;
    car?: string;
    notes?: string;
    address?: string;
    title?: string;
    vehicleIssues?: { name: string }[];
}

/**
 * The "I need to buy parts" branch is still simulated (no parts catalog or
 * payments yet). Set to false to hide it from mechanics.
 */
export const ON_SITE_PARTS_ENABLED = true;

export function reportedIssue(appointment: OnSiteAppointment): string {
    if (appointment.vehicleIssues?.length) return appointment.vehicleIssues.map((i) => i.name).join(', ');
    return appointment.title || '—';
}

// ─────────── Check-in (Scan QR / Enter PIN) ───────────
export function ScreenCheckIn({ onSubmit, onMismatch }: {
    onSubmit: (method: 'pin' | 'qr', code: string) => Promise<void>;
    onMismatch: () => void;
}) {
    const { t } = useTranslation();
    const [mode, setMode] = React.useState<'qr' | 'pin'>('qr');
    const [cameraOpen, setCameraOpen] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [pin, setPin] = React.useState('');
    const [permission, requestPermission] = useCameraPermissions();
    const handled = React.useRef(false);

    const submit = async (method: 'pin' | 'qr', code: string) => {
        setSubmitting(true);
        try {
            await onSubmit(method, code);
        } finally {
            setSubmitting(false);
            handled.current = false;
        }
    };

    const openCamera = async () => {
        if (!permission?.granted) {
            const res = await requestPermission();
            if (!res.granted) return;
        }
        setCameraOpen(true);
    };

    // The scanner fires repeatedly while the code is in view; act on the first read only.
    const onScanned = ({ data }: { data: string }) => {
        if (handled.current || submitting) return;
        handled.current = true;
        void submit('qr', data);
    };

    return (
        <Body>
            <Intro eyebrow={t('appointments.checkIn.step')} title={t('appointments.checkIn.heading')} subtitle={t('appointments.checkIn.subtitle')} />

            <View className="mt-4">
                <Segmented
                    value={mode}
                    onChange={setMode}
                    options={[
                        { key: 'qr', label: t('appointments.checkIn.scanQr'), icon: 'qr-code-outline' },
                        { key: 'pin', label: t('appointments.checkIn.enterPin'), icon: 'lock-closed-outline' },
                    ]}
                />
            </View>

            {mode === 'qr' ? (
                <Card style={{ padding: 20 }}>
                    <View
                        className="items-center justify-center overflow-hidden"
                        style={{
                            height: 260, borderRadius: 16,
                            backgroundColor: cameraOpen ? OS.text : OS.page,
                            borderWidth: cameraOpen ? 0 : 2, borderStyle: 'dashed', borderColor: OS.border,
                        }}
                    >
                        {!cameraOpen ? (
                            <View className="items-center gap-3 px-4">
                                <Ionicons name="scan-outline" size={40} color={OS.mutedLight} />
                                <Text className="font-outfit-bold text-xs text-center" style={{ color: OS.mutedLight }}>
                                    {permission && !permission.granted && !permission.canAskAgain
                                        ? t('appointments.checkIn.cameraPermission')
                                        : t('appointments.checkIn.cameraOff')}
                                </Text>
                            </View>
                        ) : (
                            <>
                                <CameraView
                                    style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                                    facing="back"
                                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                                    onBarcodeScanned={submitting ? undefined : onScanned}
                                />
                                <View pointerEvents="none" style={{ position: 'absolute', top: 24, right: 24, bottom: 24, left: 24, borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)', borderRadius: 18 }} />
                                {submitting ? <ActivityIndicator size="large" color="#FFFFFF" /> : null}
                            </>
                        )}
                    </View>
                    {cameraOpen ? (
                        <Text className="font-outfit-medium text-xs text-center mt-3" style={{ color: OS.muted }}>
                            {submitting ? t('appointments.checkIn.checking') : t('appointments.checkIn.scanHint')}
                        </Text>
                    ) : (
                        <View className="flex-row mt-3.5">
                            <PrimaryButton
                                label={permission && !permission.granted && !permission.canAskAgain ? t('appointments.checkIn.allowCamera') : t('appointments.checkIn.openCamera')}
                                onPress={() => void openCamera()}
                            />
                        </View>
                    )}
                </Card>
            ) : (
                <Card style={{ padding: 24 }}>
                    <TextInput
                        value={pin}
                        onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
                        keyboardType="number-pad"
                        maxLength={4}
                        placeholder="••••"
                        placeholderTextColor={OS.mutedLight}
                        className="font-outfit-bold text-center"
                        style={{ fontSize: 32, letterSpacing: 14, color: OS.text, borderWidth: 1.5, borderColor: OS.border, borderRadius: 14, paddingVertical: 14, backgroundColor: OS.page }}
                        testID="check-in-pin"
                    />
                    <View className="flex-row mt-4">
                        <PrimaryButton
                            label={submitting ? t('appointments.checkIn.checking') : t('appointments.checkIn.verifyPin')}
                            onPress={() => void submit('pin', pin)}
                            disabled={pin.length !== 4 || submitting}
                        />
                    </View>
                </Card>
            )}

            <Tip>{t('appointments.checkIn.secureTip')}</Tip>

            <TouchableOpacity onPress={onMismatch} className="items-center mt-3.5" testID="check-in-mismatch">
                <Text className="font-outfit-bold text-xs underline" style={{ color: OS.mutedLight }}>{t('appointments.checkIn.mismatchLink')}</Text>
            </TouchableOpacity>
        </Body>
    );
}

// ─────────── Doesn't match → retry ───────────
export function ScreenRetry({ onRetry }: { onRetry: () => void }) {
    const { t } = useTranslation();
    return (
        <>
            <View className="flex-1 items-center justify-center px-7">
                <View className="items-center justify-center mb-4" style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: OS.orangeSoft }}>
                    <Ionicons name="alert-circle-outline" size={28} color={OS.orange} />
                </View>
                <Text className="font-outfit-bold text-[19px] text-center" style={{ color: OS.text }}>{t('appointments.checkIn.mismatchTitle')}</Text>
                <Text className="font-outfit-regular text-[13.5px] text-center mt-2 leading-5" style={{ color: OS.muted }}>{t('appointments.checkIn.mismatchBody')}</Text>
            </View>
            <ActionBar>
                <PrimaryButton label={t('appointments.checkIn.retry')} onPress={onRetry} tone="orange" testID="check-in-retry" />
            </ActionBar>
        </>
    );
}

// ─────────── Issue details ───────────
export function ScreenIncidentDetails({ appointment, clientName, onNext }: { appointment: OnSiteAppointment; clientName: string; onNext: () => void }) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.incident';
    return (
        <>
            <Body>
                <Intro eyebrow={t(`${k}.eyebrow`)} tone="green" title={t(`${k}.title`)} subtitle={t(`${k}.subtitle`)} />
                <Card>
                    <InfoRow icon="car-outline" label={t(`${k}.vehicle`)} value={appointment.car || '—'} />
                    <InfoRow icon="alert-circle-outline" label={t(`${k}.issue`)} value={reportedIssue(appointment)} />
                    <InfoRow icon="document-text-outline" label={t(`${k}.notes`)} value={appointment.notes || t('appointments.detail.info.noNotes')} />
                    <InfoRow icon="location-outline" label={t(`${k}.location`)} value={appointment.address || '—'} />
                    <InfoRow icon="person-outline" label={t(`${k}.client`)} value={clientName} last />
                </Card>
                <Tip>{t(`${k}.tip`)}</Tip>
            </Body>
            <ActionBar>
                <PrimaryButton label={t(`${k}.start`)} onPress={onNext} />
            </ActionBar>
        </>
    );
}

// ─────────── OBD scan ───────────
export function ScreenDiagnosticsObd({ appointmentId, visit, onVisit, onNext }: {
    appointmentId: string;
    visit: OnSiteVisit | null;
    onVisit: (v: OnSiteVisit) => void;
    onNext: () => void;
}) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.obd';
    const status = visit?.obdStatus ?? 'none';

    return (
        <>
            <Body>
                <Intro eyebrow={t(`${k}.eyebrow`)} title={t(`${k}.title`)} subtitle={t(`${k}.subtitle`)} />
                <Tip>{t(`${k}.tipLater`)}</Tip>
                <ObdPanel appointmentId={appointmentId} visit={visit} onVisit={onVisit} />
                {status === 'none' ? <Tip tone="orange">{t(`${k}.reminderTip`)}</Tip> : null}
            </Body>
            <ActionBar>
                <PrimaryButton label={t('appointments.onSite.common.continue')} onPress={onNext} />
            </ActionBar>
        </>
    );
}

// ─────────── Photos ───────────
export function ScreenDiagnosticsPhotos({ onNext }: { onNext: () => void }) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.photos';
    const plate = useExistingCaptures('plate');
    const dashboard = useExistingCaptures('dashboard');
    const walkaround = useExistingCaptures('walkaround_in');
    const [plateFilled, setPlateFilled] = React.useState(false);
    const [dashFilled, setDashFilled] = React.useState(false);
    const [tab, setTab] = React.useState<'video' | 'photos'>('video');

    return (
        <>
            <Body>
                <Intro eyebrow={t(`${k}.eyebrow`)} title={t(`${k}.title`)} subtitle={t(`${k}.subtitle`)} />
                <Card>
                    <CardTitle title={t(`${k}.plate`)} />
                    <MediaSlot height={130} placeholder={t(`${k}.platePh`)} captureKind="plate" existing={plate[0]} onChange={setPlateFilled} />
                </Card>
                <Card>
                    <CardTitle title={t(`${k}.dash`)} />
                    <MediaSlot height={130} placeholder={t(`${k}.dashPh`)} captureKind="dashboard" existing={dashboard[0]} onChange={setDashFilled} />
                </Card>

                <Text className="font-outfit-bold text-xs mx-4 mt-3.5" style={{ color: OS.text }}>
                    {t(`${k}.extra`)}
                    <Text className="font-outfit-medium text-[10.5px]" style={{ color: OS.mutedLight }}>  {t('appointments.onSite.common.optional')}</Text>
                </Text>
                <View className="mt-2">
                    <Segmented
                        value={tab}
                        onChange={setTab}
                        options={[
                            { key: 'video', label: t('appointments.onSite.common.recordVideo') },
                            { key: 'photos', label: t(`${k}.addExtra`) },
                        ]}
                    />
                </View>
                <Card>
                    {tab === 'video' ? (
                        <MediaSlot kind="video" height={170} placeholder={t(`${k}.videoPh`)} captureKind="walkaround_in" existing={walkaround[0]} />
                    ) : (
                        <PhotoList placeholder={t(`${k}.extraPh`)} captureKind="extra_in" />
                    )}
                </Card>
            </Body>
            <ActionBar>
                <PrimaryButton label={t('appointments.onSite.common.continue')} onPress={onNext} disabled={!(plateFilled && dashFilled)} />
            </ActionBar>
        </>
    );
}

// ─────────── Validating ───────────
export function ScreenValidating({ run, onDone, onFail }: {
    run: () => Promise<void>;
    onDone: () => void;
    onFail: (message: string) => void;
}) {
    const { t } = useTranslation();
    const handlers = React.useRef({ run, onDone, onFail });
    handlers.current = { run, onDone, onFail };
    React.useEffect(() => {
        let cancelled = false;
        // Keep the spinner up briefly so the step reads as a step, not a flicker.
        const minDelay = new Promise((r) => setTimeout(r, 900));
        Promise.all([handlers.current.run(), minDelay])
            .then(() => !cancelled && handlers.current.onDone())
            .catch(() => !cancelled && handlers.current.onFail(t('appointments.onSite.validating.missing')));
        return () => {
            cancelled = true;
        };
    }, [t]);
    return (
        <View className="flex-1 items-center justify-center gap-4 px-8">
            <Spinner />
            <Text className="font-outfit-bold text-[15px] text-center" style={{ color: OS.text }}>{t('appointments.onSite.validating.title')}</Text>
            <Text className="font-outfit-regular text-[12.5px] text-center" style={{ color: OS.muted }}>{t('appointments.onSite.validating.subtitle')}</Text>
        </View>
    );
}

// ─────────── Feasibility ───────────
export function ScreenFeasibility({ appointment, obdCodes, onYes, onNeedParts, onNo }: {
    appointment: OnSiteAppointment;
    obdCodes: ObdCode[];
    onYes: () => void;
    onNeedParts: () => void;
    onNo: () => void;
}) {
    const { t, i18n } = useTranslation();
    const k = 'appointments.onSite.feasibility';
    const lang: 'en' | 'es' = i18n.language?.startsWith('en') ? 'en' : 'es';
    const findings = obdCodes.length
        ? obdCodes.map((c) => (c.description ? `${c.code} — ${c.description[lang]}` : c.code)).join('\n')
        : t(`${k}.noCodes`);
    return (
        <>
            <Body>
                <Intro eyebrow={t(`${k}.eyebrow`)} tone="green" title={t(`${k}.title`)} />
                <View className="mx-4 mt-3.5" style={cardShadow}>
                    <InfoRow icon="alert-circle-outline" label={t(`${k}.issue`)} value={reportedIssue(appointment)} />
                    <InfoRow icon="document-text-outline" label={t(`${k}.notes`)} value={appointment.notes || t('appointments.detail.info.noNotes')} />
                    <InfoRow
                        icon="construct-outline"
                        label={t(`${k}.findings`)}
                        value={<Text className="font-outfit-bold text-[13px] mt-1 leading-6" style={{ color: OS.text }}>{findings}</Text>}
                        last
                    />
                </View>
            </Body>
            <ActionBar stacked>
                <View className="flex-row">
                    <PrimaryButton label={t(`${k}.yes`)} onPress={onYes} tone="green" />
                </View>
                {ON_SITE_PARTS_ENABLED ? <GhostButton label={t(`${k}.needParts`)} onPress={onNeedParts} /> : null}
                <GhostButton label={t(`${k}.no`)} onPress={onNo} />
            </ActionBar>
        </>
    );
}
