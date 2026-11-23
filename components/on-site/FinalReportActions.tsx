import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppointments } from '@/context/AppointmentsContext';
import { onSiteDAO } from '@/lib/dao/OnSiteDAO';
import { userDAO } from '@/lib/dao/UserDAO';
import type { Appointment } from '@/context/AppointmentsContext';
import { buildFinalReport, finalReportHtml, type FinalReport, type ReportBrand } from '@/lib/onsite/finalReport';
import { buildServiceReport } from '@/lib/onsite/serviceReport';
import { walletDAO } from '@/lib/dao/WalletDAO';
import { getVinCapture } from '@/lib/onsite/vin';
import { ActionBar, Card, OS } from './ui';
import { FinalReportView } from './FinalReportView';
import { appAlert } from '@/lib/ui/appAlert';
import { TYPE } from '@/lib/ui/type';
import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';

// The final report of a visit, for the closeout screen and the report screen: the same data, as a page in
// the app or as a PDF to keep and share.

/** Loads what the report is built from and builds it. `report` is null until the visit has arrived. */
export function useFinalReport(appointmentId: string): { report: FinalReport | null; loading: boolean } {
    const { t, i18n } = useTranslation();
    const { getAppointmentById } = useAppointments();
    const appointment = getAppointmentById(appointmentId);
    const [report, setReport] = React.useState<FinalReport | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!appointmentId || !appointment) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const [visit, capture, profile] = await Promise.all([
                    onSiteDAO.get(appointmentId),
                    getVinCapture(appointmentId).catch(() => null),
                    appointment.userId ? userDAO.getPublicProfile(appointment.userId).catch(() => null) : Promise.resolve(null),
                ]);
                if (cancelled || !visit) return;
                const clientName = [profile?.name, profile?.surname].filter(Boolean).join(' ') || null;
                setReport(buildFinalReport({
                    appointment, visit, clientName, vin: capture?.vin, odometer: capture?.odometer, t, lang: i18n.language,
                }));
            } catch {
                /* no report to show: the buttons stay off */
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appointmentId, appointment?.id, i18n.language]);

    return { report, loading };
}

async function assetData(module: number, mime: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Asset } = require('expo-asset') as typeof import('expo-asset');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { File } = require('expo-file-system') as typeof import('expo-file-system');
    const asset = Asset.fromModule(module);
    await asset.downloadAsync();
    if (!asset.localUri) throw new Error('asset not available');
    return `data:${mime};base64,${await new File(asset.localUri).base64()}`;
}

/** The brand (ring and name in colour) and the app's font, as data: the PDF is drawn from the page alone. Without the logo it says the name in text; without the font, the system one. */
async function reportBrand(): Promise<ReportBrand | null> {
    try {
        const [ring, word] = await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            assetData(require('@/assets/images/brand_ring_color.png'), 'image/png'),
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            assetData(require('@/assets/images/brand_wordmark_color.png'), 'image/png'),
        ]);
        const fonts = await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            assetData(require('@expo-google-fonts/outfit/400Regular/Outfit_400Regular.ttf'), 'font/ttf'),
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            assetData(require('@expo-google-fonts/outfit/600SemiBold/Outfit_600SemiBold.ttf'), 'font/ttf'),
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            assetData(require('@expo-google-fonts/outfit/700Bold/Outfit_700Bold.ttf'), 'font/ttf'),
        ]).then(([regular, semibold, bold]) => ({ regular, semibold, bold })).catch(() => null);
        return { ring, word, fonts };
    } catch {
        return null;
    }
}

/** Makes the PDF and opens the share sheet (save to Files, send…). Returns false when it could not. */
export async function shareFinalReportPdf(report: FinalReport): Promise<boolean> {
    try {
        // Loaded here so a build made before these modules were added does not break the whole app.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Print = require('expo-print') as typeof import('expo-print');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Sharing = require('expo-sharing') as typeof import('expo-sharing');
        // The brand logo goes inside the page as data, so the PDF needs nothing else to draw it. Without it the header says the name in text.
        const logo = await reportBrand();
        // Margins on every page (iOS ignores the CSS ones), so a page cut never lands on the edge of the sheet.
        const { uri } = await Print.printToFileAsync({ html: finalReportHtml(report, logo), margins: { left: 36, right: 36, top: 36, bottom: 36 } });
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: report.title });
        }
        return true;
    } catch {
        return false;
    }
}

/**
 * The service report PDF of a finished job, from a card in the list: gathers what this viewer can read (the visit when
 * they are the technician, the owner's payments when they are the owner), builds the report and opens the share sheet.
 */
export interface ServiceReportArgs {
    appointment: Appointment;
    role: 'user' | 'mechanic';
    ownerName?: string | null;
    mechanicName?: string | null;
    t: (key: string, options?: Record<string, unknown>) => string;
    lang: string;
}

/** The service report of a finished job, as the owner or the technician sees it. Throws if something it is built from cannot be read. */
export async function loadServiceReport(args: ServiceReportArgs): Promise<FinalReport> {
    {
        const { appointment, role, t, lang } = args;
        const [visit, capture, profile, history] = await Promise.all([
            onSiteDAO.get(appointment.id).catch(() => null),
            getVinCapture(appointment.id).catch(() => null),
            role === 'mechanic' && appointment.userId ? userDAO.getPublicProfile(appointment.userId).catch(() => null) : Promise.resolve(null),
            role === 'user' ? walletDAO.history(1, 100).catch(() => null) : Promise.resolve(null),
        ]);
        let paid: { total: number; refunded: number; method: 'wallet' | 'card' | null } | null = null;
        const charges = history?.payments.items.filter((p) => p.assistanceRequestId === appointment.id && Number(p.amountCharged) > 0) ?? [];
        if (charges.length > 0) {
            paid = {
                total: charges.reduce((sum, p) => sum + Number(p.amountCharged || 0), 0),
                refunded: charges.reduce((sum, p) => sum + Number(p.amountRefunded || 0), 0),
                method: charges[0].method === 'wallet' ? 'wallet' : 'card',
            };
        }
        const ownerName = args.ownerName ?? ([profile?.name, profile?.surname].filter(Boolean).join(' ') || null);
        return buildServiceReport({
            appointment, role, visit, ownerName, mechanicName: args.mechanicName, paid, vin: capture?.vin, odometer: capture?.odometer, t, lang,
        });
    }
}

export async function shareServiceReportPdf(args: ServiceReportArgs): Promise<boolean> {
    try {
        return await shareFinalReportPdf(await loadServiceReport(args));
    } catch {
        return false;
    }
}

function ActionButton({ icon, label, onPress, busy, primary, compact, disabled, testID }: {
    icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; busy?: boolean; primary?: boolean; compact?: boolean; disabled?: boolean; testID?: string;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || busy}
            activeOpacity={0.85}
            accessibilityRole="button"
            className="flex-row items-center justify-center"
            style={{
                gap: compact ? 6 : 8, minHeight: compact ? 44 : 52, borderRadius: compact ? 12 : 14, paddingHorizontal: compact ? 12 : 16,
                backgroundColor: primary ? OS.blue : OS.blueSoft, opacity: disabled ? 0.45 : 1,
            }}
            testID={testID}
        >
            {busy ? <ActivityIndicator color={primary ? '#FFFFFF' : OS.blue} /> : <Ionicons name={icon} size={compact ? 18 : 20} color={primary ? '#FFFFFF' : OS.blue} />}
            <Text className="font-outfit-bold" style={{ fontSize: compact ? 15 : 16, lineHeight: 22, color: primary ? '#FFFFFF' : OS.blue }}>{label}</Text>
        </TouchableOpacity>
    );
}

/** Download button, with its own busy state and error. */
export function DownloadPdfButton({ report, primary, compact }: { report: FinalReport | null; primary?: boolean; compact?: boolean }) {
    const { t } = useTranslation();
    const [busy, setBusy] = React.useState(false);
    return (
        <ActionButton
            icon="download-outline"
            label={t('appointments.report.download')}
            primary={primary}
            compact={compact}
            busy={busy}
            disabled={!report}
            testID="report-download"
            onPress={async () => {
                if (!report) return;
                setBusy(true);
                const ok = await shareFinalReportPdf(report);
                setBusy(false);
                if (!ok) appAlert(t('appointments.report.pdfFailed'));
            }}
        />
    );
}

/**
 * The report as a sheet over the screen that opened it: closing it just drops the sheet, so the closeout
 * stays exactly as it was (scroll, rating typed…). A screen of its own would be a navigation away from it.
 */
export function FinalReportSheet({ report, visible, onClose }: { report: FinalReport | null; visible: boolean; onClose: () => void }) {
    const { t } = useTranslation();
    return (
        <Modal supportedOrientations={MODAL_ORIENTATIONS} visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaProvider>
                <SheetBody report={report} onClose={onClose} title={t('appointments.report.title')} />
            </SafeAreaProvider>
        </Modal>
    );
}

function SheetBody({ report, onClose, title }: { report: FinalReport | null; onClose: () => void; title: string }) {
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    return (
        <View className="flex-1" style={{ backgroundColor: OS.page, paddingTop: Math.max(insets.top, 12) }}>
            <View className="flex-row items-center justify-between px-4 pb-2">
                <Text className="font-outfit-bold" style={{ fontSize: 17, color: OS.text }}>{title}</Text>
                <TouchableOpacity
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel={t('appointments.report.close')}
                    hitSlop={8}
                    className="items-center justify-center"
                    style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: OS.blueSoft }}
                    testID="report-close"
                >
                    <Ionicons name="close" size={22} color={OS.blue} />
                </TouchableOpacity>
            </View>
            {report ? <FinalReportView report={report} /> : <View className="flex-1" />}
            <ActionBar>
                <View className="flex-1"><DownloadPdfButton report={report} primary /></View>
            </ActionBar>
        </View>
    );
}

/** Closeout card: open the report, or take it as a PDF. */
export function FinalReportCard({ appointmentId }: { appointmentId: string }) {
    const { t } = useTranslation();
    const { report, loading } = useFinalReport(appointmentId);
    const [open, setOpen] = React.useState(false);
    return (
        <Card style={{ padding: 16 }} >
            <FinalReportSheet report={report} visible={open} onClose={() => setOpen(false)} />
            <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: OS.blueSoft }}>
                    <Ionicons name="document-text-outline" size={20} color={OS.blue} />
                </View>
                <View className="flex-1">
                    <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, color: OS.text }}>{t('appointments.report.cardTitle')}</Text>
                    <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: OS.muted }}>{t('appointments.report.cardSub')}</Text>
                </View>
            </View>
            {/* Two quiet actions side by side: the report is there when wanted, not the point of the screen. */}
            <View className="flex-row mt-3.5" style={{ gap: 10 }}>
                <View className="flex-1">
                    <ActionButton
                        icon="reader-outline"
                        label={t('appointments.report.viewShort')}
                        compact
                        busy={loading && !report}
                        disabled={!report}
                        testID="report-view"
                        onPress={() => setOpen(true)}
                    />
                </View>
                <View className="flex-1"><DownloadPdfButton report={report} compact /></View>
            </View>
        </Card>
    );
}
