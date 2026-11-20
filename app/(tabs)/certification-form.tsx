import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { CertificationForm } from '@/components/profile/CertificationForm';
import type { Certification } from '@/lib/dao/CertificationsDAO';

/** Add (no params) or edit (`data`: the certification as JSON) one certification, as a normal screen. */
export default function CertificationFormScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { data } = useLocalSearchParams<{ data?: string }>();
    const initial = React.useMemo<Certification | null>(() => {
        if (!data) return null;
        try {
            return JSON.parse(String(data)) as Certification;
        } catch {
            return null;
        }
    }, [data]);

    return (
        <View className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
            <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 12 }}>
                <View style={{ marginTop: 8 }}>
<View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start', marginBottom: 12 }}>
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                    <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">{t('certifications.badge')}</Text>
                </View>
</View>
                <Text className="text-gray-900 font-outfit-medium text-3xl">{t(initial ? 'certifications.editTitle' : 'certifications.addTitle')}</Text>
            </View>
            <CertificationForm initial={initial} onSaved={() => (router.canGoBack() ? router.back() : router.replace('/other-certifications'))} />
        </View>
    );
}
