import { useGlobalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { DownloadPdfButton, useFinalReport } from '@/components/on-site/FinalReportActions';
import { FinalReportView } from '@/components/on-site/FinalReportView';
import { ActionBar, FlowHeader, OS, Spinner } from '@/components/on-site/ui';
import { goBackOr } from '@/lib/navigation/goBackOr';

// The final report of a visit, read in the app. Same data as the PDF.
export default function FinalReportScreen() {
    const { id: rawId } = useGlobalSearchParams();
    const id = Array.isArray(rawId) ? rawId[0] : rawId || '';
    const router = useRouter();
    const { t } = useTranslation();
    const { report, loading } = useFinalReport(id);

    return (
        <View className="flex-1" style={{ backgroundColor: OS.page }}>
            <FlowHeader title={t('appointments.report.title')} onBack={() => goBackOr(router, '/(tabs)/appointments')} />
            {!report ? (
                <View className="flex-1 items-center justify-center px-8">
                    {loading ? <Spinner /> : <Text className="font-outfit-medium text-center" style={{ fontSize: 16, lineHeight: 22, color: OS.muted }}>{t('appointments.report.unavailable')}</Text>}
                </View>
            ) : (
                <>
                    <FinalReportView report={report} />
                    <ActionBar>
                        <View className="flex-1"><DownloadPdfButton report={report} primary /></View>
                    </ActionBar>
                </>
            )}
        </View>
    );
}
