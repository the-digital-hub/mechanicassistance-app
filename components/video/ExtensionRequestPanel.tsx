import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { useMessageDialog } from '@/components/ui/useMessageDialog';
import { useCountdown } from '@/hooks/useCountdown';
import { type ExtensionOutcome, usePendingExtension } from '@/hooks/usePendingExtension';
import { ApiError } from '@/lib/api/types';
import { videoCallDAO } from '@/lib/dao/VideoCallDAO';

const K = 'videoCall.extend';

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const OUTCOME_KEY: Record<ExtensionOutcome, string> = {
    declined: `${K}.outcomeDeclined`,
    expired: `${K}.outcomeExpired`,
    failed: `${K}.outcomeFailed`,
};

/**
 * Extra time that has to be approved by the technician, over the live call.
 * Owner: "Waiting for the technician…" with the time left to answer, and a message when the
 * request ends without adding time. Technician: the minutes asked for, the countdown, what
 * they would earn for it (never the owner's price) and Accept / Decline. The call underneath stays usable.
 */
export function ExtensionRequestPanel({ appointmentId, isOwner, top = 12, refreshKey = 0, inline = false }: {
    appointmentId: string;
    isOwner: boolean;
    top?: number;
    /** Bump it after the owner sends a request: no event comes back to the one who asked. */
    refreshKey?: number;
    /** In the page's flow (the appointment detail) instead of floating over the call. */
    inline?: boolean;
}) {
    const { t } = useTranslation();
    const { pending, outcome, clearOutcome, reload } = usePendingExtension(appointmentId);
    const { notify, dialog } = useMessageDialog();
    const [acting, setActing] = React.useState<'accept' | 'decline' | null>(null);
    const deadline = pending ? Date.parse(pending.expiresAt) : null;
    const secondsLeft = useCountdown(Number.isFinite(deadline) ? deadline : null);

    React.useEffect(() => {
        if (refreshKey > 0) void reload();
    }, [refreshKey, reload]);

    // The owner is told once how a request that was pending ended.
    React.useEffect(() => {
        if (!outcome) return;
        if (isOwner) void notify(t(`${K}.outcomeTitle`), t(OUTCOME_KEY[outcome]), outcome === 'failed' ? 'red' : 'orange');
        clearOutcome();
    }, [outcome, isOwner, notify, clearOutcome, t]);

    const answer = async (kind: 'accept' | 'decline') => {
        if (!pending || acting) return;
        setActing(kind);
        try {
            if (kind === 'accept') await videoCallDAO.acceptExtension(appointmentId, pending.extensionId);
            else await videoCallDAO.declineExtension(appointmentId, pending.extensionId);
        } catch (error) {
            const gone = error instanceof ApiError && error.statusCode === 409;
            void notify(t(`${K}.outcomeTitle`), t(gone ? `${K}.answerExpired` : `${K}.answerFailed`));
        } finally {
            setActing(null);
            void reload();
        }
    };

    const open = !!pending && secondsLeft > 0;

    return (
        <>
            {dialog}
            {open && pending ? (
                <View pointerEvents="box-none" style={inline ? undefined : { position: 'absolute', top, left: 16, right: 16, zIndex: 40 }} testID="extension-request-panel">
                    {isOwner ? (
                        <View
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: 'rgba(11,21,48,0.88)' }}
                        >
                            <ActivityIndicator color="#FFFFFF" />
                            <View style={{ flex: 1 }}>
                                <Text className="font-outfit-bold" style={{ fontSize: 16, lineHeight: 22, color: '#FFFFFF' }}>{t(`${K}.waitingOwner`)}</Text>
                                <Text className="font-outfit-regular" style={{ fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.75)' }}>{t(`${K}.waitingOwnerHint`)}</Text>
                            </View>
                            <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#FFFFFF' }} testID="extension-countdown">{clock(secondsLeft)}</Text>
                        </View>
                    ) : (
                        <View
                            style={{ borderRadius: 24, backgroundColor: '#FFFFFF', overflow: 'hidden', shadowColor: '#0B1530', shadowOpacity: inline ? 0.08 : 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: inline ? 2 : 10 }}
                        >
                            <LinearGradient colors={['#1E56E3', '#0B2A8E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 18, paddingVertical: 16 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' }}>
                                        <Ionicons name="time-outline" size={24} color="#FFFFFF" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text className="font-outfit-semibold" style={{ fontSize: 12, letterSpacing: 1.2, color: '#DCE7FF' }}>{t(`${K}.requestedEyebrow`).toUpperCase()}</Text>
                                        <Text className="font-outfit-bold" style={{ fontSize: 20, lineHeight: 26, color: '#FFFFFF' }}>
                                            {t(`${K}.requestedTitle`, { minutes: pending.minutes })}
                                        </Text>
                                    </View>
                                    <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)' }}>
                                        <Text className="font-outfit-bold" style={{ fontSize: 14, color: '#FFFFFF' }} testID="extension-countdown">{clock(secondsLeft)}</Text>
                                    </View>
                                </View>
                            </LinearGradient>
                            <View style={{ padding: 16 }}>
                                {pending.providerAmount ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: '#F1FAF5', borderWidth: 1, borderColor: '#CBEBDA' }} testID="extension-earn">
                                        <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDF3E7' }}>
                                            <Ionicons name="cash-outline" size={22} color="#047857" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text className="font-outfit-semibold" style={{ fontSize: 12, letterSpacing: 1.2, color: '#4B6B5C' }}>{t(`${K}.youEarn`).toUpperCase()}</Text>
                                            <Text className="font-outfit-regular" style={{ fontSize: 13, lineHeight: 18, color: '#4B6B5C' }}>{t(`${K}.youEarnNote`)}</Text>
                                        </View>
                                        <Text className="font-outfit-bold" style={{ fontSize: 24, color: '#047857' }}>{`$${pending.providerAmount}`}</Text>
                                    </View>
                                ) : null}
                                <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: '#6B7490', marginTop: pending.providerAmount ? 12 : 0 }}>{t(`${K}.requestedHint`)}</Text>
                            <View style={{ flexDirection: 'column', gap: 10, marginTop: 14 }}>
                                <TouchableOpacity
                                    onPress={() => answer('accept')}
                                    disabled={!!acting}
                                    style={{ opacity: acting ? 0.6 : 1 }}
                                    accessibilityRole="button"
                                    testID="extension-accept"
                                >
                                    <LinearGradient colors={['#10B981', '#047857']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                                        {acting === 'accept' ? <ActivityIndicator color="#FFFFFF" /> : (
                                            <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#FFFFFF' }}>{t(`${K}.accept`)}</Text>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => answer('decline')}
                                    disabled={!!acting}
                                    style={{ minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6EAF2', opacity: acting ? 0.6 : 1 }}
                                    accessibilityRole="button"
                                    testID="extension-decline"
                                >
                                    {acting === 'decline' ? <ActivityIndicator color="#4A5470" /> : (
                                        <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#4A5470' }}>{t(`${K}.decline`)}</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                            </View>
                        </View>
                    )}
                </View>
            ) : null}
        </>
    );
}
