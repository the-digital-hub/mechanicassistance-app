import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle2, ExternalLink, Landmark } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { connectDAO } from '@/lib/dao/ConnectDAO';
import type { ConnectStatus } from '@/lib/dao/interfaces';
import { TYPE } from '@/lib/ui/type';

const K = 'payments.account';

const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 6 };

/**
 * Where the mechanic's earnings are deposited: a Stripe Express account.
 * Connecting (or finishing) opens Stripe's onboarding in the browser; once
 * connected, "Manage" opens the Stripe dashboard to change the bank account.
 * `onReturn` re-reads the status when the browser closes.
 */
export function PayoutAccountCard({
    status,
    error,
    onReturn,
}: {
    status: ConnectStatus | null;
    error: boolean;
    onReturn: () => void;
}) {
    const { t } = useTranslation();
    const [opening, setOpening] = React.useState(false);
    const [failed, setFailed] = React.useState(false);

    const ready = !!status?.canReceiveTransfers;
    const started = !!status?.connected;

    const open = async (kind: 'onboarding' | 'dashboard') => {
        setOpening(true);
        setFailed(false);
        try {
            const { url } = kind === 'dashboard' ? await connectDAO.dashboardLink() : await connectDAO.onboardingLink();
            await WebBrowser.openBrowserAsync(url);
            onReturn();
        } catch {
            setFailed(true);
        } finally {
            setOpening(false);
        }
    };

    return (
        <View className="bg-white rounded-2xl mb-5" style={{ ...SHADOW, padding: 20 }} testID="payout-account-card">
            <View className="flex-row items-center" style={{ gap: 14 }}>
                <View className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: ready ? '#DCFCE7' : '#E9F1FF' }}>
                    {ready ? <CheckCircle2 size={20} color="#15803D" /> : <Landmark size={20} color="#0047AB" />}
                </View>
                <View className="flex-1">
                    {status === null && !error ? (
                        <ActivityIndicator color="#0047AB" style={{ alignSelf: 'flex-start' }} />
                    ) : (
                        <>
                            {status !== null && (
                                <View
                                    className="px-2 py-0.5 rounded-full"
                                    style={{
                                        alignSelf: 'flex-start',
                                        backgroundColor: ready ? '#DCFCE7' : '#FEF3C7',
                                        borderWidth: 1,
                                        borderColor: ready ? '#86EFAC' : '#FCD34D',
                                    }}
                                >
                                    <Text className="font-outfit-bold" style={{ ...TYPE.eyebrow, color: ready ? '#15803D' : '#B45309' }}>
                                        {ready ? t(`${K}.connected`) : t(`${K}.notReady`)}
                                    </Text>
                                </View>
                            )}
                            <Text className="font-outfit-regular" style={{ ...TYPE.body, color: '#4B5563', marginTop: 6 }}>
                                {error && status === null
                                    ? t(`${K}.loadFailed`)
                                    : ready
                                      ? t(`${K}.ready`)
                                      : started
                                        ? t(`${K}.pendingReview`)
                                        : t(`${K}.notConnected`)}
                            </Text>
                        </>
                    )}
                </View>
            </View>

            {!ready && status !== null && (
                <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: '#6B7490', marginTop: 14 }}>{t(`${K}.keepsAccruing`)}</Text>
            )}

            {status !== null &&
                (ready ? (
                    <TouchableOpacity
                        onPress={() => open('dashboard')}
                        disabled={opening}
                        className="flex-row items-center justify-center mt-5 rounded-xl border"
                        style={{ gap: 8, minHeight: 48, borderColor: '#BFD3F5', opacity: opening ? 0.6 : 1 }}
                        accessibilityRole="button"
                        testID="payout-account-manage"
                    >
                        {opening ? <ActivityIndicator color="#0047AB" /> : <ExternalLink size={16} color="#0047AB" />}
                        <Text className="font-outfit-semibold" style={{ ...TYPE.body, color: '#0047AB' }}>{t(`${K}.manage`)}</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        onPress={() => open('onboarding')}
                        disabled={opening}
                        className="mt-5"
                        style={{ opacity: opening ? 0.6 : 1 }}
                        accessibilityRole="button"
                        testID="payout-account-connect"
                    >
                        <LinearGradient
                            colors={['#2B66F8', '#081E72']}
                            start={{ x: 0, y: 1 }}
                            end={{ x: 1, y: 0 }}
                            style={{ borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center' }}
                        >
                            {opening ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text className="text-white font-outfit-bold" style={{ fontSize: 17, lineHeight: 23 }}>{started ? t(`${K}.continue`) : t(`${K}.connect`)}</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                ))}

            {failed && <Text className="font-outfit-semibold mt-3" style={{ ...TYPE.helper, color: '#B91C1C' }}>{t(`${K}.openFailed`)}</Text>}
        </View>
    );
}
