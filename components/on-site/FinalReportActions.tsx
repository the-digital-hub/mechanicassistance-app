import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppointments } from '@/context/AppointmentsContext';
import { onSiteDAO } from '@/lib/dao/OnSiteDAO';
import { userDAO } from '@/lib/dao/UserDAO';
import { buildFinalReport, finalReportHtml, type FinalReport } from '@/lib/onsite/finalReport';
import { getVinCapture } from '@/lib/onsite/vin';
import { ActionBar, Card, OS } from './ui';
import { FinalReportView } from './FinalReportView';
import { appAlert } from '@/lib/ui/appAlert';
import { TYPE } from '@/lib/ui/type';

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

/** Makes the PDF and opens the share sheet (save to Files, send…). Returns false when it could not. */
export async function shareFinalReportPdf(report: FinalReport): Promise<boolean> {
    try {
        // Loaded here so a build made before these modules were added does not break the whole app.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Print = require('expo-print') as typeof import('expo-print');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Sharing = require('expo-sharing') as typeof import('expo-sharing');
        const { uri } = await Print.printToFileAsync({ html: finalReportHtml(report) });
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: report.title });
        }
        return true;
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
function FinalReportSheet({ report, visible, onClose }: { report: FinalReport | null; visible: boolean; onClose: () => void }) {
    const { t } = useTranslation();
    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
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
