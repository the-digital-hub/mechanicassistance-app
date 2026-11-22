import { FileText } from 'lucide-react-native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import type { Appointment } from '@/context/AppointmentsContext';
import { FinalReportSheet, loadServiceReport, shareServiceReportPdf } from '@/components/on-site/FinalReportActions';
import type { FinalReport } from '@/lib/onsite/finalReport';
import { appAlert } from '@/lib/ui/appAlert';
import { TYPE } from '@/lib/ui/type';

const INK = { text: '#0B1530', muted: '#6B7490', blue: '#1E56E3', blueSoft: '#EAF1FF', line: '#EEF2FA' };

/** A closed assistance: its service report, to read in the app (View) or keep and share as a PDF (Download). Same card for the owner and the technician. */
export function ServiceReportCard({ appointment, role = 'user', ownerName, mechanicName }: { appointment: Appointment; role?: 'user' | 'mechanic'; ownerName?: string | null; mechanicName?: string | null }) {
    const { t, i18n } = useTranslation();
    const [busy, setBusy] = useState<'view' | 'pdf' | null>(null);
    const [report, setReport] = useState<FinalReport | null>(null);
    const [open, setOpen] = useState(false);
    const args = { appointment, role, ownerName, mechanicName, t, lang: i18n.language };

    const view = async () => {
        if (busy) return;
        if (report) { setOpen(true); return; }
        setBusy('view');
        try {
            setReport(await loadServiceReport(args));
            setOpen(true);
        } catch {
            appAlert(t('appointments.report.pdf.failed'));
        }
        setBusy(null);
    };
    const download = async () => {
        if (busy) return;
        setBusy('pdf');
        const ok = await shareServiceReportPdf(args);
        setBusy(null);
        if (!ok) appAlert(t('appointments.report.pdf.failed'));
    };
    const Button = ({ label, onPress, loading, primary, testID }: { label: string; onPress: () => void; loading: boolean; primary?: boolean; testID: string }) => (
        <TouchableOpacity
            onPress={onPress}
            disabled={!!busy}
            activeOpacity={0.85}
            accessibilityRole="button"
            className="flex-1 items-center justify-center flex-row"
            style={{ gap: 8, minHeight: 52, borderRadius: 14, backgroundColor: primary ? INK.blue : INK.blueSoft, opacity: busy && !loading ? 0.6 : 1 }}
            testID={testID}
        >
            {loading ? <ActivityIndicator color={primary ? '#fff' : INK.blue} /> : null}
            <Text className="font-outfit-bold" style={{ ...TYPE.button, color: primary ? '#fff' : INK.blue }}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <View className="bg-white" style={{ borderRadius: 20, padding: 16, gap: 14, borderWidth: 1, borderColor: INK.line, shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 2 }} testID="service-report-card">
            <FinalReportSheet report={report} visible={open} onClose={() => setOpen(false)} />
            <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: INK.blueSoft }}>
                    <FileText size={22} color={INK.blue} />
                </View>
                <View className="flex-1" style={{ minWidth: 0 }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 17, lineHeight: 22, color: INK.text }}>{t('appointments.report.ownerCardTitle')}</Text>
                    <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: INK.muted }}>{t(role === 'mechanic' ? 'appointments.report.mechanicCardHint' : 'appointments.report.ownerCardHint')}</Text>
                </View>
            </View>
            <View className="flex-row" style={{ gap: 10 }}>
                <Button label={t('appointments.report.viewShort')} onPress={view} loading={busy === 'view'} testID="service-report-view" />
                <Button label={t('appointments.report.download')} onPress={download} loading={busy === 'pdf'} primary testID="service-report-download" />
            </View>
        </View>
    );
}

/** The way out of a closed assistance: a soft slate button, nothing that competes with the report. */
export function BackToDashboardButton({ onPress }: { onPress: () => void }) {
    const { t } = useTranslation();
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.85}
            accessibilityRole="button"
            className="items-center justify-center"
            style={{ minHeight: 56, borderRadius: 14, backgroundColor: '#E6EAF2' }}
            testID="back-to-dashboard"
        >
            <Text className="font-outfit-bold" style={{ fontSize: 18, lineHeight: 24, color: '#4A5470' }}>{t('appointments.closeout.back')}</Text>
        </TouchableOpacity>
    );
}
