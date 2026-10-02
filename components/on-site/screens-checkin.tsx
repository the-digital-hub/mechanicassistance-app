import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MediaSlot, PhotoList } from './MediaSlot';
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

export function reportedIssue(appointment: OnSiteAppointment): string {
    if (appointment.vehicleIssues?.length) return appointment.vehicleIssues.map((i) => i.name).join(', ');
    return appointment.title || '—';
}

// ─────────── Check-in (Scan QR / Enter PIN) ───────────
export function ScreenCheckIn({ onMatch, onMismatch }: { onMatch: () => void; onMismatch: () => void }) {
    const { t } = useTranslation();
    const [mode, setMode] = React.useState<'qr' | 'pin'>('qr');
    const [cameraOpen, setCameraOpen] = React.useState(false);
    const [scanning, setScanning] = React.useState(false);
    const [pin, setPin] = React.useState('');
    const scanTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(() => () => {
        if (scanTimer.current) clearTimeout(scanTimer.current);
    }, []);

    // Simulated: there is no QR scanner in the app yet.
    const scan = () => {
        setScanning(true);
        scanTimer.current = setTimeout(() => {
            setScanning(false);
            onMatch();
        }, 1400);
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
                            height: 220, borderRadius: 16,
                            backgroundColor: cameraOpen ? OS.text : OS.page,
                            borderWidth: cameraOpen ? 0 : 2, borderStyle: 'dashed', borderColor: OS.border,
                        }}
                    >
                        {!cameraOpen ? (
                            <View className="items-center gap-3">
                                <Ionicons name="scan-outline" size={40} color={OS.mutedLight} />
                                <Text className="font-outfit-bold text-xs" style={{ color: OS.mutedLight }}>{t('appointments.checkIn.cameraOff')}</Text>
                            </View>
                        ) : scanning ? (
                            <ActivityIndicator size="large" color="#FFFFFF" />
                        ) : (
                            <>
                                <View style={{ position: 'absolute', top: 24, right: 24, bottom: 24, left: 24, borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)', borderRadius: 18 }} />
                                <Ionicons name="scan-outline" size={60} color="rgba(255,255,255,0.7)" />
                            </>
                        )}
                    </View>
                    <View className="flex-row mt-3.5">
                        <PrimaryButton
                            label={scanning ? t('appointments.checkIn.scanning') : cameraOpen ? t('appointments.checkIn.scanQr') : t('appointments.checkIn.openCamera')}
                            onPress={cameraOpen ? scan : () => setCameraOpen(true)}
                            disabled={scanning}
                        />
                    </View>
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
                        <PrimaryButton label={t('appointments.checkIn.verifyPin')} onPress={onMatch} disabled={pin.length !== 4} />
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
// Mock codes: there is no OBD reader integration yet.
export const OBD_CODES: { code: string; severity: 'High' | 'Medium' | 'Low' }[] = [
    { code: 'P0301', severity: 'High' },
    { code: 'P0171', severity: 'Medium' },
    { code: 'P0455', severity: 'Low' },
];

const SEVERITY_STYLE = {
    High: { color: '#B4231E', bg: '#FDECEC' },
    Medium: { color: OS.orangeText, bg: OS.orangeSoft },
    Low: { color: OS.muted, bg: OS.page },
};

export function ScreenDiagnosticsObd({ onNext, onFilledChange }: { onNext: () => void; onFilledChange: (v: boolean) => void }) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.obd';
    const [filled, setFilled] = React.useState(false);
    const [aiOpen, setAiOpen] = React.useState(false);

    const handleFilled = (v: boolean) => {
        setFilled(v);
        if (!v) setAiOpen(false);
        onFilledChange(v);
    };

    return (
        <>
            <Body>
                <Intro eyebrow={t(`${k}.eyebrow`)} title={t(`${k}.title`)} subtitle={t(`${k}.subtitle`)} />
                <Tip>{t(`${k}.tipLater`)}</Tip>
                <Card>
                    <CardTitle title={t(`${k}.file`)} optional />
                    <MediaSlot kind="file" height={160} placeholder={t(`${k}.placeholder`)} onChange={handleFilled} />
                </Card>
                {filled ? (
                    <Card>
                        <Text className="font-outfit-bold text-xs px-4 pt-3.5 pb-1" style={{ color: OS.text }}>{t(`${k}.codesFound`)}</Text>
                        {OBD_CODES.map((c, i) => (
                            <View key={c.code} className="px-4 py-3" style={i > 0 ? { borderTopWidth: 1, borderTopColor: OS.borderSoft } : undefined}>
                                <View className="flex-row items-center justify-between">
                                    <Text className="font-outfit-bold text-[13px]" style={{ color: OS.text }}>{c.code}</Text>
                                    <View className="px-2.5 py-0.5 rounded-full" style={{ backgroundColor: SEVERITY_STYLE[c.severity].bg }}>
                                        <Text className="font-outfit-bold text-[10.5px]" style={{ color: SEVERITY_STYLE[c.severity].color }}>{t(`${k}.severity.${c.severity}`)}</Text>
                                    </View>
                                </View>
                                <Text className="font-outfit-regular text-[12.5px] mt-1" style={{ color: OS.muted }}>{t(`${k}.codes.${c.code}`)}</Text>
                                {aiOpen ? (
                                    <View className="mt-2 px-3 py-2.5 rounded-xl" style={{ backgroundColor: OS.blueSofter }}>
                                        <Text className="font-outfit-bold text-[11px] mb-0.5" style={{ color: OS.blueDark }}>{t(`${k}.aiFix`)}</Text>
                                        <Text className="font-outfit-regular text-[12.5px] leading-5" style={{ color: OS.text }}>{t(`${k}.fixes.${c.code}`)}</Text>
                                    </View>
                                ) : null}
                            </View>
                        ))}
                        <View className="px-4 pt-1 pb-3.5">
                            <TouchableOpacity
                                onPress={() => setAiOpen((v) => !v)}
                                className="items-center py-3 rounded-xl"
                                style={{ backgroundColor: aiOpen ? OS.page : OS.blue }}
                            >
                                <Text className="font-outfit-bold text-[13px]" style={{ color: aiOpen ? OS.text : '#FFFFFF' }}>
                                    {aiOpen ? t(`${k}.hideSuggestions`) : t(`${k}.showSuggestions`)}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </Card>
                ) : (
                    <Tip tone="orange">{t(`${k}.smsTip`)}</Tip>
                )}
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
    const [plateFilled, setPlateFilled] = React.useState(false);
    const [dashFilled, setDashFilled] = React.useState(false);
    const [tab, setTab] = React.useState<'video' | 'photos'>('video');

    return (
        <>
            <Body>
                <Intro eyebrow={t(`${k}.eyebrow`)} title={t(`${k}.title`)} subtitle={t(`${k}.subtitle`)} />
                <Card>
                    <CardTitle title={t(`${k}.plate`)} />
                    <MediaSlot height={130} placeholder={t(`${k}.platePh`)} onChange={setPlateFilled} />
                </Card>
                <Card>
                    <CardTitle title={t(`${k}.dash`)} />
                    <MediaSlot height={130} placeholder={t(`${k}.dashPh`)} onChange={setDashFilled} />
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
                        <MediaSlot kind="video" height={170} placeholder={t(`${k}.videoPh`)} />
                    ) : (
                        <PhotoList placeholder={t(`${k}.extraPh`)} />
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
export function ScreenValidating({ onDone }: { onDone: () => void }) {
    const { t } = useTranslation();
    const done = React.useRef(onDone);
    done.current = onDone;
    React.useEffect(() => {
        const id = setTimeout(() => done.current(), 1600);
        return () => clearTimeout(id);
    }, []);
    return (
        <View className="flex-1 items-center justify-center gap-4 px-8">
            <Spinner />
            <Text className="font-outfit-bold text-[15px] text-center" style={{ color: OS.text }}>{t('appointments.onSite.validating.title')}</Text>
            <Text className="font-outfit-regular text-[12.5px] text-center" style={{ color: OS.muted }}>{t('appointments.onSite.validating.subtitle')}</Text>
        </View>
    );
}

// ─────────── Feasibility ───────────
export function ScreenFeasibility({ appointment, onYes, onNeedParts, onNo }: {
    appointment: OnSiteAppointment; onYes: () => void; onNeedParts: () => void; onNo: () => void;
}) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.feasibility';
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
                        value={<Text className="font-outfit-bold text-[13px] mt-1 leading-6" style={{ color: OS.text }}>{t(`${k}.findingsMock`)}</Text>}
                        last
                    />
                </View>
            </Body>
            <ActionBar stacked>
                <View className="flex-row">
                    <PrimaryButton label={t(`${k}.yes`)} onPress={onYes} tone="green" />
                </View>
                <GhostButton label={t(`${k}.needParts`)} onPress={onNeedParts} />
                <GhostButton label={t(`${k}.no`)} onPress={onNo} />
            </ActionBar>
        </>
    );
}
