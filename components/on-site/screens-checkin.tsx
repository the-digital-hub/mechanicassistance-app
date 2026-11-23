import { ValidatingAnimation } from '@/components/on-site/ValidatingAnimation';
import { PinBoxes } from '@/components/on-site/PinBoxes';
import { usePinchZoom } from '@/hooks/usePinchZoom';
import { Ionicons } from '@expo/vector-icons';
import { BadgeCheck, ClipboardCheck, MapPinCheck } from 'lucide-react-native';
import { EmptyStateIcon } from '@/components/ui/EmptyStateIcon';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, LayoutAnimation, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { ObdCode, OnSiteVisit } from '@/lib/dao/OnSiteDAO';
import { ObdPanel } from './ObdPanel';
import { VinCrossCheck } from './screens-vin';
import { ExtraCaptures, MediaSlot, useExistingCaptures } from './MediaSlot';
import {
    ActionBar, Body, Card, CardTitle, Checkbox, GhostButton, InfoRow, Intro, MAINTENANCE_ITEMS, OS, PrimaryButton, Segmented, Tip, cardShadow,
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
    // Tapping the tab that is already open closes it: the camera for Scan QR, the code boxes for Enter PIN.
    const [pinFolded, setPinFolded] = React.useState(false);
    // The scanner zooms like the Camera app: starts on the main lens (the phone switches lenses and focuses by itself) and a pinch zooms.
    const { zoom, lens, touchProps } = usePinchZoom();
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
        // The PIN boxes are already in view: with the keyboard up nothing needs to scroll.
        <Body focusScroll={false}>
            <Intro eyebrow={t('appointments.checkIn.step')} title={t('appointments.checkIn.heading')} subtitle={t('appointments.checkIn.subtitle')} />

            <View className="mt-4">
                <Segmented
                    value={mode}
                    onChange={(next) => {
                        if (next === mode) {
                            if (mode === 'qr') setCameraOpen(false);
                            else setPinFolded((v) => !v);
                            return;
                        }
                        setMode(next);
                        setCameraOpen(false);
                        setPinFolded(false);
                    }}
                    options={[
                        { key: 'qr', label: t('appointments.checkIn.scanQr'), icon: 'qr-code-outline' },
                        { key: 'pin', label: t('appointments.checkIn.enterPin'), icon: 'lock-closed-outline' },
                    ]}
                />
            </View>

            {mode === 'qr' ? (
                <Card style={{ padding: 20 }}>
                    {cameraOpen ? (
                        <>
                            <View className="items-center justify-center overflow-hidden" style={{ height: 340, borderRadius: 16, backgroundColor: OS.text }} {...touchProps}>
                                <CameraView
                                    style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                                    facing="back"
                                    zoom={zoom}
                                    selectedLens={lens}
                                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                                    onBarcodeScanned={submitting ? undefined : onScanned}
                                />
                                <View pointerEvents="none" style={{ position: 'absolute', top: 24, right: 24, bottom: 24, left: 24, borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)', borderRadius: 18 }} />
                                {submitting ? <ActivityIndicator size="large" color="#FFFFFF" /> : null}
                            </View>
                            <Text className="font-outfit-medium text-center mt-3" style={{ fontSize: 14, lineHeight: 20, color: OS.muted }}>
                                {submitting ? t('appointments.checkIn.checking') : t('appointments.checkIn.scanHintZoom')}
                            </Text>
                        </>
                    ) : (
                        // No empty frame standing in for the camera: a short line and the button that opens it.
                        <View className="items-center">
                            {/* The QR tile is a button too: it opens the camera, same as "Open camera". */}
                            <TouchableOpacity
                                onPress={() => void openCamera()}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel={t('appointments.checkIn.openCamera')}
                                className="items-center justify-center"
                                style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: OS.blueSoft }}
                                testID="check-in-qr-tile"
                            >
                                <Ionicons name="qr-code-outline" size={32} color={OS.blue} />
                            </TouchableOpacity>
                            <Text className="font-outfit-medium text-center" style={{ fontSize: 15, lineHeight: 21, color: OS.muted, marginTop: 12, marginBottom: 16 }}>
                                {permission && !permission.granted && !permission.canAskAgain
                                    ? t('appointments.checkIn.cameraPermission')
                                    : t('appointments.checkIn.scanHint')}
                            </Text>
                            <View className="flex-row" style={{ alignSelf: 'stretch' }}>
                                <PrimaryButton
                                    label={permission && !permission.granted && !permission.canAskAgain ? t('appointments.checkIn.allowCamera') : t('appointments.checkIn.openCamera')}
                                    onPress={() => void openCamera()}
                                    testID="check-in-open-camera"
                                />
                            </View>
                        </View>
                    )}
                </Card>
            ) : pinFolded ? null : (
                <Card style={{ padding: 24 }}>
                    <PinBoxes value={pin} onChange={setPin} testID="check-in-pin" />
                    <View className="flex-row mt-6">
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
                <Text className="font-outfit-bold text-[13px] underline" style={{ color: OS.mutedLight }}>{t('appointments.checkIn.mismatchLink')}</Text>
            </TouchableOpacity>
        </Body>
    );
}

// ─────────── Doesn't match → retry ───────────
export function ScreenRetry({ onRetry, vehicle, refCode }: { onRetry: () => void; vehicle?: string | null; refCode?: string | null }) {
    const { t } = useTranslation();
    const router = useRouter();
    return (
        <>
            <Body>
                {/* What happened, calm: a soft warning card at the top (not a lone icon in the middle of an empty screen). */}
                <View className="mx-4 mt-4 flex-row items-start" style={{ gap: 14, padding: 16, borderRadius: 20, backgroundColor: OS.orangeSoft }}>
                    <View className="items-center justify-center" style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#FFFFFF' }}>
                        <Ionicons name="alert-circle-outline" size={28} color={OS.orange} />
                    </View>
                    <View className="flex-1">
                        <Text className="font-outfit-bold" style={{ fontSize: 19, lineHeight: 25, letterSpacing: -0.3, color: OS.text }}>{t('appointments.checkIn.mismatchTitle')}</Text>
                        <Text className="font-outfit-regular" style={{ fontSize: 15, lineHeight: 21, color: OS.muted, marginTop: 4 }}>{t('appointments.checkIn.mismatchBody')}</Text>
                    </View>
                </View>
                {/* What to compare it with: the vehicle this request is for. */}
                {vehicle || refCode ? (
                    <View className="mx-4 mt-3.5" style={cardShadow}>
                        {vehicle ? <InfoRow icon="car-outline" label={t('appointments.checkIn.mismatchVehicle')} value={vehicle} last={!refCode} /> : null}
                        {refCode ? <InfoRow icon="document-text-outline" label={t('appointments.checkIn.mismatchRef')} value={refCode} last /> : null}
                    </View>
                ) : null}
            </Body>
            <ActionBar stacked>
                <PrimaryButton label={t('appointments.checkIn.retry')} onPress={onRetry} testID="check-in-retry" />
                <GhostButton label={t('profile.menu.help')} onPress={() => router.push('/help' as never)} />
            </ActionBar>
        </>
    );
}

// ─────────── OBD scan ───────────
export function ScreenDiagnosticsObd({ appointmentId, visit, onVisit, onNext, enteredVin }: {
    appointmentId: string;
    visit: OnSiteVisit | null;
    onVisit: (v: OnSiteVisit) => void;
    onNext: () => void;
    /** The VIN the mechanic scanned or typed on the VIN step, to cross-check with the OBD one. */
    enteredVin?: string | null;
}) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.obd';
    const status = visit?.obdStatus ?? 'none';

    return (
        <>
            <Body>
                <Intro eyebrow={t(`${k}.eyebrow`)} title={t(`${k}.title`)} subtitle={t(`${k}.subtitle`)} />
                <ObdPanel appointmentId={appointmentId} visit={visit} onVisit={onVisit} />
                <VinCrossCheck entered={enteredVin} visit={visit} />
                <Tip>{t(`${k}.tipLater`)}</Tip>
            </Body>
            <ActionBar>
                <PrimaryButton label={t('appointments.onSite.common.continue')} onPress={onNext} />
            </ActionBar>
        </>
    );
}

// ─────────── Photos ───────────
/** `onNext(skipped)`: `skipped` is true when the technician chose to go on without the two required photos. */
export function ScreenDiagnosticsPhotos({ onNext }: { onNext: (skipped: boolean) => void }) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.photos';
    const plate = useExistingCaptures('plate');
    const dashboard = useExistingCaptures('dashboard');
    const walkaround = useExistingCaptures('walkaround_in');
    const [plateFilled, setPlateFilled] = React.useState(false);
    const [dashFilled, setDashFilled] = React.useState(false);
    // Folded unless something optional is already in (so it is never hidden from whoever added it).
    const [extrasOpen, setExtrasOpen] = React.useState(false);
    const hasWalkaround = Boolean(walkaround[0]);
    React.useEffect(() => { if (hasWalkaround) setExtrasOpen(true); }, [hasWalkaround]);

    const doneCount = Number(plateFilled) + Number(dashFilled);
    // The way out if the camera fails: not recommended, so it can be ticked but never pushes itself.
    const [noPhotos, setNoPhotos] = React.useState(false);
    const ready = doneCount === 2 || noPhotos;

    return (
        <>
            <Body>
                <Intro eyebrow={t(`${k}.eyebrow`)} title={t(`${k}.title`)} subtitle={t(`${k}.subtitle`)} />
                <View className="mx-4 flex-row" style={{ gap: 12 }}>
                    <MediaSlot tile padded={false} height={170} title={t(`${k}.plate`)} tileHint={t('appointments.onSite.common.addPhoto')} badge={<RequiredPill done={plateFilled} />} placeholder={t(`${k}.platePh`)} captureKind="plate" existing={plate[0]} onChange={setPlateFilled} />
                    <MediaSlot tile padded={false} height={170} title={t(`${k}.dash`)} tileHint={t('appointments.onSite.common.addPhoto')} badge={<RequiredPill done={dashFilled} />} placeholder={t(`${k}.dashPh`)} captureKind="dashboard" existing={dashboard[0]} onChange={setDashFilled} />
                </View>

                {/* The optional extras (360° video and more photos) stay folded: tap to add or see them. */}
                <TouchableOpacity
                    onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExtrasOpen((v) => !v); }}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: extrasOpen }}
                    className="mx-4 mt-6 flex-row items-center"
                    style={{ gap: 12, padding: 14, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: OS.border }}
                    testID="photos-extras-toggle"
                >
                    <View className="flex-1" style={{ minWidth: 0 }}>
                        <Text className="font-outfit-bold" style={{ fontSize: 17, lineHeight: 23, color: OS.text }}>
                            {t(`${k}.extra`)}
                            <Text className="font-outfit-medium" style={{ fontSize: 13, color: OS.mutedLight }}>  {t('appointments.onSite.common.optional')}</Text>
                        </Text>
                        <Text className="font-outfit-regular mt-1" style={{ fontSize: 14, lineHeight: 20, color: OS.muted }}>{t(`${k}.extraSub`)}</Text>
                    </View>
                    <Ionicons name={extrasOpen ? 'chevron-up' : 'chevron-down'} size={22} color={OS.muted} />
                </TouchableOpacity>
                {extrasOpen ? (
                    <View style={{ marginTop: 12 }}>
                        <ExtraCaptures videoKind="walkaround_in" photoKind="extra_in" existingVideo={walkaround[0]} videoPlaceholder={t(`${k}.videoPh`)} photoPlaceholder={t(`${k}.extraPh`)} />
                    </View>
                ) : null}

                {/* How many required photos are in: part of the page, not of the Continue bar. */}
                {!ready ? <Tip>{t(`${k}.needRequired`, { done: doneCount })}</Tip> : null}

                {/* Quiet on purpose, same as skipping the VIN: only there in case the photos do not work. */}
                {doneCount < 2 ? (
                    <TouchableOpacity
                        onPress={() => setNoPhotos((v) => !v)}
                        activeOpacity={0.8}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: noPhotos }}
                        className="flex-row items-center mx-4 mt-5"
                        style={{ gap: 12, minHeight: 56, paddingHorizontal: 16, borderRadius: 14, backgroundColor: noPhotos ? OS.blueSoft : '#F1F3F8', borderWidth: noPhotos ? 1.5 : 0, borderColor: OS.blue }}
                        testID="photos-skip"
                    >
                        <Checkbox checked={noPhotos} size={24} />
                        <View className="flex-1" style={{ paddingVertical: 8 }}>
                            <Text className="font-outfit-medium" style={{ fontSize: 15, lineHeight: 21, color: noPhotos ? OS.blue : OS.mutedLight }}>{t(`${k}.skip`)}</Text>
                            <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 19, color: noPhotos ? OS.blue : OS.mutedLight }}>{t(`${k}.skipNote`)}</Text>
                        </View>
                    </TouchableOpacity>
                ) : null}
                {noPhotos && doneCount < 2 ? <Tip tone="orange">{t(`${k}.skipWarn`)}</Tip> : null}
            </Body>
            <ActionBar>
                <PrimaryButton label={t('appointments.onSite.common.continue')} onPress={() => onNext(noPhotos && doneCount < 2)} disabled={!ready} />
            </ActionBar>
        </>
    );
}

/** "Required" until the capture is in, then a green "Added": the two mandatory photos are easy to tell apart. */
function RequiredPill({ done }: { done: boolean }) {
    const { t } = useTranslation();
    return (
        <View className="flex-row items-center" style={{ gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, backgroundColor: done ? OS.greenSoft : OS.orangeSoft }}>
            {done ? <Ionicons name="checkmark-circle" size={16} color={OS.greenDark} /> : null}
            <Text className="font-outfit-bold" style={{ fontSize: 13, color: done ? OS.greenDark : OS.orangeText }}>
                {done ? t('appointments.onSite.photos.added') : t('appointments.onSite.photos.required')}
            </Text>
        </View>
    );
}

// ─────────── Milestones: the same plate at every turn of the visit ───────────
/**
 * A full-screen stop between two parts of the on-site visit: an animated icon, what just happened, what comes next and one button.
 * The visit has three parts (check-in, assistance, check-out) and each turn gets this same plate, so the technician on the street
 * always knows where they are and what the next tap does.
 */
function Milestone({ icon, badge, title, subtitle, action, onAction, testID, children }: {
    icon: React.ComponentProps<typeof EmptyStateIcon>['icon'];
    /** A small green confirmation above the title (what was just verified). */
    badge?: string;
    title: string;
    subtitle: string;
    action: string;
    onAction: () => void;
    testID: string;
    children?: React.ReactNode;
}) {
    return (
        <>
            <Body>
                <View className="items-center" style={{ paddingTop: 40, gap: 20 }} testID={testID}>
                    <EmptyStateIcon icon={icon} />
                    {badge ? (
                        <View className="flex-row items-center" style={{ gap: 6, paddingLeft: 10, paddingRight: 12, paddingVertical: 5, borderRadius: 100, backgroundColor: OS.greenSoft }}>
                            <Ionicons name="checkmark-circle" size={16} color={OS.greenDark} />
                            <Text className="font-outfit-bold uppercase" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 0.8, color: OS.greenDark }}>{badge}</Text>
                        </View>
                    ) : null}
                    <Text className="font-outfit-bold text-center" style={{ fontSize: 26, lineHeight: 32, color: OS.text }}>{title}</Text>
                    <Text className="font-outfit-regular text-center" style={{ fontSize: 16, lineHeight: 24, color: OS.muted, maxWidth: 320 }}>{subtitle}</Text>
                </View>
                {children}
            </Body>
            <ActionBar>
                <PrimaryButton label={action} onPress={onAction} testID={`${testID}-action`} />
            </ActionBar>
        </>
    );
}

// ─────────── Arrived: the code matched, the check-in starts ───────────
export function ScreenArrived({ appointment, onStart }: { appointment: OnSiteAppointment & { refCode?: string | null }; onStart: () => void }) {
    const { t } = useTranslation();
    const k = 'appointments.checkIn.arrived';
    const rows: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }[] = [
        ...(appointment.address ? [{ icon: 'location-outline' as const, label: t(`${k}.location`), value: appointment.address }] : []),
        ...(appointment.car ? [{ icon: 'car-outline' as const, label: t(`${k}.vehicle`), value: appointment.car }] : []),
        { icon: 'construct-outline' as const, label: t(`${k}.job`), value: reportedIssue(appointment) },
    ];
    return (
        <Milestone
            icon={MapPinCheck}
            badge={t(`${k}.verified`)}
            title={t(`${k}.title`)}
            subtitle={t(`${k}.subtitle`)}
            action={t(`${k}.start`)}
            onAction={onStart}
            testID="check-in-arrived"
        >
            {/* Where, what vehicle and what job: the same things the technician confirms with the customer at the door. */}
            <Card>
                {rows.map((r, i) => (
                    <InfoRow key={r.label} icon={r.icon} label={r.label} value={r.value} last={i === rows.length - 1} />
                ))}
            </Card>
        </Milestone>
    );
}

// ─────────── Check-in done: the scanner report is in, the assistance begins ───────────
export function ScreenCheckinDone({ visit, vin, feasibility, onStart }: { visit: OnSiteVisit | null; /** The VIN given on the VIN step; empty or null when that step was skipped. */ vin?: string | null; /** What the technician answered to "can you resolve it on site?". */ feasibility?: 'yes' | 'parts' | 'no' | null; onStart: () => void }) {
    const { t } = useTranslation();
    const k = 'appointments.checkIn.done';
    const media = visit?.media ?? [];
    const photoCount = media.filter((m) => m.mediaType === 'image').length;
    const photosDone = media.some((m) => m.kind === 'plate') && media.some((m) => m.kind === 'dashboard');
    const codes = visit?.obdCodes ?? [];
    const obd = visit?.obdStatus ?? 'none';
    const obdDone = obd === 'ready' || obd === 'manual';
    // What was done in the check-in, in the order it happened. A step that was skipped shows as pending, not as done.
    const items: { key: string; label: string; sub: string; done: boolean }[] = [
        { key: 'code', label: t(`${k}.items.code`), sub: t(`${k}.items.code${visit?.checkinMethod === 'qr' ? 'Qr' : 'Pin'}`), done: true },
        { key: 'vin', label: t(`${k}.items.vin`), sub: vin ? vin : t(`${k}.items.vinSkipped`), done: !!vin },
        { key: 'photos', label: t(`${k}.items.photos`), sub: photosDone ? t(`${k}.items.photosCount`, { count: photoCount }) : t(`${k}.items.photosMissing`), done: photosDone },
        {
            key: 'scanner',
            label: t(`${k}.items.scanner`),
            sub: obd === 'manual'
                ? t(`${k}.items.scannerManual`)
                : obd === 'ready'
                ? codes.length ? t(`${k}.items.scannerCodes`, { count: codes.length }) : t(`${k}.items.scannerClean`)
                : obd === 'processing'
                ? t(`${k}.items.scannerReading`)
                : t(`${k}.items.scannerLater`),
            done: obdDone,
        },
        // The last question of the check-in: what the technician said about fixing it right there.
        ...(feasibility === 'yes' || feasibility === 'parts'
            ? [{ key: 'feasibility', label: t(`${k}.items.feasibility`), sub: t(`${k}.items.feasibility${feasibility === 'yes' ? 'Yes' : 'Parts'}`), done: true }]
            : []),
    ];
    return (
        <Milestone
            icon={ClipboardCheck}
            title={t(`${k}.title`)}
            subtitle={t(`${k}.subtitle`)}
            action={t(`${k}.start`)}
            onAction={onStart}
            testID="check-in-done"
        >
            {/* A checklist of what the check-in covered: what is in, and what is still to add later. */}
            <Card>
                {items.map((it, i) => (
                    <View key={it.key} className="flex-row items-center gap-3 px-4 py-3" style={i < items.length - 1 ? { borderBottomWidth: 1, borderBottomColor: OS.borderSoft } : undefined} testID={`check-in-done-${it.key}`}>
                        <View className="items-center justify-center" style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: it.done ? OS.greenSoft : '#F1F3F8' }}>
                            <Ionicons name={it.done ? 'checkmark' : 'remove'} size={18} color={it.done ? OS.greenDark : OS.mutedLight} />
                        </View>
                        <View className="flex-1" style={{ minWidth: 0 }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 16, lineHeight: 22, color: it.done ? OS.text : OS.muted }}>{it.label}</Text>
                            <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 19, color: OS.muted }} numberOfLines={1}>{it.sub}</Text>
                        </View>
                    </View>
                ))}
            </Card>
        </Milestone>
    );
}

// ─────────── Check-out start: the work is done, the last part of the visit begins ───────────
export function ScreenCheckoutStart({ issue, workStartedAt, checklist, onStart }: { issue: string; workStartedAt: string | null; checklist?: Record<string, boolean>; onStart: () => void }) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.checkoutStart';
    const minutes = workStartedAt ? Math.max(1, Math.round((Date.now() - new Date(workStartedAt).getTime()) / 60000)) : null;
    const checked = MAINTENANCE_ITEMS.filter((id) => checklist?.[id]).length;
    const allChecked = checked === MAINTENANCE_ITEMS.length;
    // What the assistance covered, as done items; the final check shows how many points were ticked (grey when some were left).
    const done: { key: string; label: string; sub: string; ok: boolean }[] = [
        { key: 'fixed', label: t(`${k}.items.fixed`), sub: issue, ok: true },
        ...(minutes !== null ? [{ key: 'time', label: t(`${k}.items.time`), sub: t(`${k}.minutes`, { count: minutes }), ok: true }] : []),
        { key: 'check', label: t(`${k}.items.check`), sub: t(`${k}.items.checkCount`, { done: checked, total: MAINTENANCE_ITEMS.length }), ok: allChecked },
    ];
    const next: { key: string; icon: React.ComponentProps<typeof Ionicons>['name']; label: string; sub: string }[] = [
        { key: 'photos', icon: 'camera-outline', label: t(`${k}.next.photos`), sub: t(`${k}.next.photosSub`) },
        { key: 'close', icon: 'flag-outline', label: t(`${k}.next.close`), sub: t(`${k}.next.closeSub`) },
    ];
    return (
        <Milestone
            icon={BadgeCheck}
            badge={t(`${k}.badge`)}
            title={t(`${k}.title`)}
            subtitle={t(`${k}.subtitle`)}
            action={t(`${k}.start`)}
            onAction={onStart}
            testID="checkout-start"
        >
            <Card>
                {done.map((it, i) => (
                    <View key={it.key} className="flex-row items-center gap-3 px-4 py-3" style={i < done.length - 1 ? { borderBottomWidth: 1, borderBottomColor: OS.borderSoft } : undefined} testID={`checkout-start-${it.key}`}>
                        <View className="items-center justify-center" style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: it.ok ? OS.greenSoft : '#F1F3F8' }}>
                            <Ionicons name={it.ok ? 'checkmark' : 'remove'} size={18} color={it.ok ? OS.greenDark : OS.mutedLight} />
                        </View>
                        <View className="flex-1" style={{ minWidth: 0 }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 16, lineHeight: 22, color: it.ok ? OS.text : OS.muted }}>{it.label}</Text>
                            <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 19, color: OS.muted }} numberOfLines={2}>{it.sub}</Text>
                        </View>
                    </View>
                ))}
            </Card>

            {/* Two quick things left, so the technician knows how long the check-out is. */}
            <Text className="font-outfit-bold uppercase mx-5" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 0.9, color: OS.muted, marginTop: 22 }}>{t(`${k}.next.title`)}</Text>
            <Card>
                {next.map((it, i) => (
                    <View key={it.key} className="flex-row items-center gap-3 px-4 py-3" style={i < next.length - 1 ? { borderBottomWidth: 1, borderBottomColor: OS.borderSoft } : undefined}>
                        <View className="items-center justify-center" style={{ width: 32, height: 32, borderRadius: 11, backgroundColor: OS.blueSoft }}>
                            <Ionicons name={it.icon} size={17} color={OS.blue} />
                        </View>
                        <View className="flex-1" style={{ minWidth: 0 }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 16, lineHeight: 22, color: OS.text }}>{`${i + 1}. ${it.label}`}</Text>
                            <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 19, color: OS.muted }}>{it.sub}</Text>
                        </View>
                    </View>
                ))}
            </Card>
        </Milestone>
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
        <ValidatingAnimation
            title={t('appointments.onSite.validating.title')}
            subtitle={t('appointments.onSite.validating.subtitle')}
            steps={[t('appointments.onSite.validating.stepPhotos'), t('appointments.onSite.validating.stepObd'), t('appointments.onSite.validating.stepReady')]}
        />
    );
}

// ─────────── Feasibility ───────────
export function ScreenFeasibility({ onYes, onNeedParts, onNo }: {
    // The issue, notes and OBD findings were already on the earlier steps: this one only asks the question.
    appointment?: OnSiteAppointment;
    obdCodes?: ObdCode[];
    onYes: () => void;
    onNeedParts: () => void;
    onNo: () => void;
}) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.feasibility';
    const [choice, setChoice] = React.useState<'yes' | 'parts' | 'no' | null>(null);
    const options: { id: 'yes' | 'parts' | 'no'; icon: React.ComponentProps<typeof Ionicons>['name']; title: string; sub: string; tone: 'green' | 'blue' | 'red' }[] = [
        { id: 'yes', icon: 'checkmark-circle-outline', title: t(`${k}.yes`), sub: t(`${k}.yesSub`), tone: 'green' },
        ...(ON_SITE_PARTS_ENABLED ? [{ id: 'parts' as const, icon: 'cart-outline' as const, title: t(`${k}.needParts`), sub: t(`${k}.needPartsSub`), tone: 'blue' as const }] : []),
        { id: 'no', icon: 'close-circle-outline', title: t(`${k}.no`), sub: t(`${k}.noSub`), tone: 'red' },
    ];
    const go = () => (choice === 'yes' ? onYes() : choice === 'parts' ? onNeedParts() : choice === 'no' ? onNo() : undefined);
    return (
        <>
            <Body>
                <Intro eyebrow={t(`${k}.eyebrow`)} title={t(`${k}.title`)} />
                {/* The ways out are options to choose from, in the page; the bar below only confirms the choice. */}
                <View className="mx-4 mt-3.5" style={{ gap: 10 }}>
                    {options.map((o) => {
                        const on = choice === o.id;
                        const ink = o.tone === 'green' ? OS.greenDark : o.tone === 'red' ? OS.red : OS.blue;
                        const soft = o.tone === 'green' ? OS.greenSoft : o.tone === 'red' ? OS.redSoft : OS.blueSoft;
                        return (
                            <TouchableOpacity
                                key={o.id}
                                onPress={() => setChoice(o.id)}
                                activeOpacity={0.8}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: on }}
                                className="flex-row items-center"
                                style={{ gap: 12, padding: 14, borderRadius: 18, backgroundColor: on ? soft : '#FFFFFF', borderWidth: 1.5, borderColor: on ? ink : OS.border }}
                                testID={`feasibility-${o.id}`}
                            >
                                <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: on ? '#FFFFFF' : soft }}>
                                    <Ionicons name={o.icon} size={24} color={ink} />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-outfit-bold" style={{ fontSize: 16, lineHeight: 22, color: OS.text }}>{o.title}</Text>
                                    <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: OS.muted, marginTop: 1 }}>{o.sub}</Text>
                                </View>
                                <View className="items-center justify-center" style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? ink : OS.border, backgroundColor: on ? ink : '#FFFFFF' }}>
                                    {on ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </Body>
            <ActionBar>
                <PrimaryButton label={t('appointments.onSite.common.continue')} onPress={go} disabled={!choice} testID="feasibility-continue" />
            </ActionBar>
        </>
    );
}
