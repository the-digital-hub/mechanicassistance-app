import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { LEGAL_URLS } from '@/lib/config/legal';
import { legalDAO } from '@/lib/dao/LegalDAO';
import { type LegalPolicy, policyBlocks } from '@/lib/legal/policies';
import { appAlert } from '@/lib/ui/appAlert';
import { FLOATING_CTA, FLOATING_FOOTER } from '@/lib/ui/floatingFooter';
import { TYPE } from '@/lib/ui/type';
import { apiErrorCode } from '@/lib/payments/cardRequired';

/**
 * The legal texts, written and published from the Hub: each current version with its full text, and, while one is pending, a button that
 * records the acceptance. A published version never changes, so a new text means a new version to accept ("Update" in the profile).
 */
export default function PrivacyScreen() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const [policies, setPolicies] = useState<LegalPolicy[] | null>(null);
    const [pending, setPending] = useState<LegalPolicy[]>([]);
    const [failed, setFailed] = useState(false);
    const [accepting, setAccepting] = useState(false);

    const load = useCallback(async () => {
        setFailed(false);
        try {
            const res = await legalDAO.policies();
            // The list may carry only the versions; the full text is asked for one by one (a handful at most).
            const full = await Promise.all(res.policies.map(async (p) => {
                if (p.content) return p;
                try { return (await legalDAO.policy(p.id)) ?? p; } catch { return p; }
            }));
            setPolicies(full);
            const ids = new Set(res.pending.map((p) => p.id));
            setPending(full.filter((p) => ids.has(p.id)));
        } catch {
            setFailed(true);
        }
    }, []);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { void load(); }, [i18n.language]);

    const accept = async () => {
        if (accepting || pending.length === 0) return;
        setAccepting(true);
        try {
            const appVersion = Constants.expoConfig?.version;
            for (const p of pending) await legalDAO.accept(p.id, appVersion);
            router.back();
        } catch (error) {
            // A version that stopped being the current one while the person read: show the new one instead of failing.
            if (apiErrorCode(error) === 'policy_superseded') {
                await load();
                appAlert(t('privacy.supersededTitle'), t('privacy.supersededMessage'), undefined, { tone: 'info' });
            } else {
                appAlert(t('privacy.acceptFailedTitle'), t('privacy.acceptFailed'), undefined, { tone: 'danger' });
            }
        } finally {
            setAccepting(false);
        }
    };

    const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' }) : '');

    return (
        <View className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
            <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: pending.length > 0 ? 130 : 40 }}>
                <View style={{ marginTop: 11 }}>
                    <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">{t('privacy.badge')}</Text>
                    </View>
                </View>
                <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">{t('privacy.title')}</Text>
                <Text className="text-gray-500 font-outfit-regular text-base mb-6">{t('privacy.subtitle')}</Text>

                {policies === null && !failed ? (
                    <View className="items-center py-10"><ActivityIndicator color="#1E56E3" /></View>
                ) : null}

                {failed ? (
                    <View className="rounded-3xl bg-white p-5" testID="privacy-error">
                        <Text className="font-outfit-bold text-gray-900 mb-1" style={TYPE.cardTitle}>{t('privacy.loadFailedTitle')}</Text>
                        <Text className="font-outfit-regular text-gray-500 mb-4" style={TYPE.helper}>{t('privacy.loadFailed')}</Text>
                        <TouchableOpacity onPress={() => void load()} className="items-center justify-center" style={{ minHeight: 48, borderRadius: 14, backgroundColor: '#E6EAF2' }} accessibilityRole="button">
                            <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#4A5470' }}>{t('privacy.retry')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => void WebBrowser.openBrowserAsync(LEGAL_URLS.privacy)} className="items-center py-3" accessibilityRole="link">
                            <Text className="font-outfit-semibold" style={{ fontSize: 14, color: '#1E56E3' }}>{t('privacy.readOnWebsite')}</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                {policies && policies.length === 0 ? (
                    <View className="rounded-3xl bg-white p-5" testID="privacy-empty">
                        <Text className="font-outfit-regular text-gray-600" style={TYPE.helper}>{t('privacy.empty')}</Text>
                        <TouchableOpacity onPress={() => void WebBrowser.openBrowserAsync(LEGAL_URLS.privacy)} className="items-center py-3" accessibilityRole="link">
                            <Text className="font-outfit-semibold" style={{ fontSize: 14, color: '#1E56E3' }}>{t('privacy.readOnWebsite')}</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                {(policies ?? []).map((p) => {
                    const isPending = pending.some((x) => x.id === p.id);
                    return (
                        <View key={p.id} className="rounded-3xl bg-white mb-4 p-5" testID={`policy-${p.id}`}>
                            <View className="flex-row items-start justify-between" style={{ gap: 10 }}>
                                <Text className="flex-1 font-outfit-bold text-gray-900" style={{ fontSize: 20, lineHeight: 26 }}>{p.title}</Text>
                                {isPending ? (
                                    <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: '#FEF3C7' }}>
                                        <Text className="font-outfit-bold" style={{ fontSize: 13, color: '#92400E' }}>{t('profile.pending.update')}</Text>
                                    </View>
                                ) : p.accepted ? (
                                    <View className="flex-row items-center px-2.5 py-1 rounded-full" style={{ backgroundColor: '#F1FAF5', gap: 4 }}>
                                        <Ionicons name="checkmark-circle" size={14} color="#047857" />
                                        <Text className="font-outfit-bold" style={{ fontSize: 13, color: '#047857' }}>{t('privacy.accepted')}</Text>
                                    </View>
                                ) : null}
                            </View>
                            <Text className="font-outfit-regular text-gray-400 mt-1 mb-4" style={{ fontSize: 13 }}>
                                {[t('privacy.version', { version: p.version }), when(p.publishedAt) ? t('privacy.published', { date: when(p.publishedAt) }) : '', p.accepted && p.acceptedAt ? t('privacy.acceptedOn', { date: when(p.acceptedAt) }) : ''].filter(Boolean).join(' · ')}
                            </Text>
                            {policyBlocks(p.content ?? '').map((b, i) => b.kind === 'heading' ? (
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
                })}
            </ScrollView>

            {pending.length > 0 ? (
                <View className="absolute bottom-0 w-full" style={FLOATING_FOOTER}>
                    <TouchableOpacity onPress={() => void accept()} disabled={accepting} activeOpacity={0.8} style={FLOATING_CTA} accessibilityRole="button" testID="privacy-accept">
                        <LinearGradient colors={['#2B66F8', '#081E72']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 14, paddingVertical: 17, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                            {accepting ? <ActivityIndicator color="white" /> : <Text className="text-white font-outfit-semibold text-lg text-center">{t('privacy.accept')}</Text>}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            ) : null}
        </View>
    );
}
