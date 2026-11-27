import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { type LegalPolicy, policyBlocks } from '@/lib/legal/policies';

/** One published version of a legal text (Hub, `GET /api/legal/policies`): its title, version and date, and the full text. */
export function PolicyCard({ policy }: { policy: LegalPolicy }) {
    const { t, i18n } = useTranslation();
    const published = policy.publishedAt
        ? new Date(policy.publishedAt).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })
        : '';
    return (
        <View className="rounded-3xl bg-white mb-4 p-5" testID={`policy-${policy.id}`}>
            <Text className="font-outfit-bold text-gray-900" style={{ fontSize: 20, lineHeight: 26 }}>{policy.title}</Text>
            <Text className="font-outfit-regular text-gray-400 mt-1 mb-4" style={{ fontSize: 13 }}>
                {[t('privacy.version', { version: policy.version }), published ? t('privacy.published', { date: published }) : ''].filter(Boolean).join(' · ')}
            </Text>
            {policyBlocks(policy.content ?? '').map((b, i) => b.kind === 'heading' ? (
                <Text key={i} className="font-outfit-bold text-gray-900 mt-3 mb-1" style={{ fontSize: 17, lineHeight: 23 }}>{b.text}</Text>
            ) : b.kind === 'bullet' ? (
                <View key={i} className="flex-row mb-1.5" style={{ gap: 8 }}>
                    <Text className="text-gray-600" style={{ fontSize: 15, lineHeight: 22 }}>•</Text>
                    <Text className="flex-1 font-outfit-regular text-gray-600" style={{ fontSize: 15, lineHeight: 22 }}>{b.text}</Text>
                </View>
            ) : (
                <Text key={i} className="font-outfit-regular text-gray-600 mb-3" style={{ fontSize: 15, lineHeight: 22 }}>{b.text}</Text>
            ))}
        </View>
    );
}
