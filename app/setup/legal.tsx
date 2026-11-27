import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { PolicyCard } from '@/components/legal/PolicyCard';
import { SETUP_BG, SetupFooter, SetupHeading } from '@/components/setup/SetupKit';
import { useUser } from '@/context/UserContext';
import { useScrolledToEnd } from '@/hooks/useScrolledToEnd';
import { LEGAL_URLS } from '@/lib/config/legal';
import { legalDAO } from '@/lib/dao/LegalDAO';
import { type LegalPolicy, policiesForRole } from '@/lib/legal/policies';
import { apiErrorCode } from '@/lib/payments/cardRequired';
import { appAlert } from '@/lib/ui/appAlert';
import { TYPE } from '@/lib/ui/type';

/**
 * Last step of the registration (a new account, or a role added to one), for the owner and the technician: the legal texts of the role
 * (Terms, Privacy Policy…) as the Hub published them, `GET /api/legal/policies`, which the person reads to the end before accepting them,
 * `POST /api/legal/policies/:id/accept`. It comes after the account exists because the server has no public endpoint for the text
 * before it (plataforma users README, "Políticas legales"). With nothing pending it goes straight on.
 */
export default function SetupLegalScreen() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const { user } = useUser();
    const role = user?.role;
    const [pending, setPending] = useState<LegalPolicy[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [accepting, setAccepting] = useState(false);
    const { reachedEnd, reset, scrollProps } = useScrolledToEnd();

    const goOn = useCallback(() => router.replace('/(tabs)/dashboard'), [router]);

    const load = useCallback(async () => {
        try {
            const res = policiesForRole(await legalDAO.policies(), role);
            if (res.pending.length === 0) {
                goOn();
                return;
            }
            // The list may carry only the versions; the full text is asked for one by one (a handful at most).
            const full = await Promise.all(res.pending.map(async (p) => {
                if (p.content) return p;
                try { return (await legalDAO.policy(p.id)) ?? p; } catch { return p; }
            }));
            setPending(full);
            setFailed(false);
            reset();
        } catch {
            setFailed(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [role, i18n.language]);

    // The state is set after the request answers (not in the effect itself); the rule cannot see through the async function.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { void load(); }, [load]);

    const accept = async () => {
        if (accepting || !pending || pending.length === 0) return;
        setAccepting(true);
        try {
            const appVersion = Constants.expoConfig?.version;
            for (const p of pending) await legalDAO.accept(p.id, appVersion);
            goOn();
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

    return (
        <View className="flex-1" style={{ backgroundColor: SETUP_BG }}>
            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 24 }}
                showsVerticalScrollIndicator
                {...scrollProps}
            >
                <SetupHeading badge={t('setup.legal.badge')} title={t('setup.legal.title')} subtitle={t('setup.legal.subtitle')} />

                {pending === null && !failed ? <View className="items-center py-10"><ActivityIndicator color="#1E56E3" /></View> : null}

                {failed ? (
                    <View className="rounded-3xl bg-white p-5" testID="setup-legal-error">
                        <Text className="font-outfit-bold text-gray-900 mb-1" style={TYPE.cardTitle}>{t('privacy.loadFailedTitle')}</Text>
                        <Text className="font-outfit-regular text-gray-500 mb-2" style={TYPE.helper}>{t('privacy.loadFailed')}</Text>
                        <TouchableOpacity onPress={() => void WebBrowser.openBrowserAsync(LEGAL_URLS.privacy)} className="items-center py-3" accessibilityRole="link">
                            <Text className="font-outfit-semibold" style={{ fontSize: 14, color: '#1E56E3' }}>{t('privacy.readOnWebsite')}</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                {(pending ?? []).map((p) => <PolicyCard key={p.id} policy={p} />)}
            </ScrollView>

            {failed ? (
                <SetupFooter label={t('privacy.retry')} onPress={() => { setFailed(false); void load(); }} chevron={false} secondaryLabel={t('setup.legal.skip')} onSecondary={goOn} />
            ) : pending && pending.length > 0 ? (
                <SetupFooter
                    label={t('setup.legal.accept')}
                    onPress={() => void accept()}
                    disabled={!reachedEnd}
                    loading={accepting}
                    chevron={false}
                    testID="setup-legal-accept"
                    note={reachedEnd ? undefined : <Text className="font-outfit-regular text-center" style={{ ...TYPE.helper, color: '#6B7490' }}>{t('privacy.scrollToAccept')}</Text>}
                />
            ) : null}
        </View>
    );
}
