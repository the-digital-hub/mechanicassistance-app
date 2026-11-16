import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Calendar, Car, Clock, CreditCard, ShieldCheck, Store, Home } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { CARD_STYLE, SC } from './ui';

/** `HH`, `MM`, `SS` of the time left, never negative. */
export function countdownParts(closeAt: string | null | undefined, now: number): { h: number; m: number; s: number; left: number } {
    const end = closeAt ? Date.parse(closeAt) : NaN;
    const left = Number.isFinite(end) ? Math.max(0, Math.floor((end - now) / 1000)) : 0;
    return { h: Math.floor(left / 3600), m: Math.floor((left % 3600) / 60), s: left % 60, left };
}

/** How much of the quote window has gone by, 0 to 1. Unknown start: counts from the longest window the backend allows. */
export function elapsedShare(createdAt: string | null | undefined, closeAt: string | null | undefined, now: number, fallbackHours = 48): number {
    const end = closeAt ? Date.parse(closeAt) : NaN;
    if (!Number.isFinite(end)) return 0;
    const start = createdAt ? Date.parse(createdAt) : NaN;
    const total = Number.isFinite(start) && end > start ? end - start : fallbackHours * 3600000;
    return Math.min(1, Math.max(0, 1 - (end - now) / total));
}

const pad = (n: number) => String(n).padStart(2, '0');

export interface HubRow {
    key: string;
    label: string;
    value: string;
    kind: 'vehicle' | 'shop' | 'home' | 'when';
}

/** The owner's view after publishing: the quote window, how many offers came in, and what was asked. */
export function WaitingHub({
    closeAt,
    createdAt,
    closed,
    offerCount,
    latestAgo,
    refCode,
    rows,
    services,
    onCompare,
    onExtend,
    extendLabel,
    onCancel,
    onHome,
    busy,
}: {
    closeAt: string | null | undefined;
    createdAt?: string | null;
    closed: boolean;
    offerCount: number;
    /** "2 h ago", or empty when nothing arrived yet. */
    latestAgo: string;
    refCode: string;
    rows: HubRow[];
    services: string[];
    onCompare: () => void;
    onExtend: () => void;
    extendLabel: string;
    onCancel: () => void;
    onHome: () => void;
    busy?: boolean;
}) {
    const { t } = useTranslation();
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);
    const { h, m, s } = countdownParts(closeAt, now);
    const pct = elapsedShare(createdAt, closeAt, now);
    const icons = { vehicle: Car, shop: Store, home: Home, when: Calendar } as const;

    return (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
            <View>
                <View className="flex-row items-center self-start rounded-full" style={{ gap: 6, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: SC.blueSoft }}>
                    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: SC.blue }} />
                    <Text className="font-outfit-bold" style={{ fontSize: 10.5, letterSpacing: 1.3, color: SC.blue }}>{t('scheduledOffers.hub.eyebrow')}</Text>
                </View>
                <Text className="font-outfit-bold" style={{ fontSize: 26, letterSpacing: -0.7, lineHeight: 29, color: SC.text, marginTop: 12 }}>{t('scheduledOffers.hub.title')}</Text>
                <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: SC.muted, marginTop: 6 }}>{t('scheduledOffers.hub.sub')}</Text>
            </View>

            <LinearGradient colors={['#2F6BFF', '#1E56E3', '#0B2A8E', '#061A66']} locations={[0, 0.38, 0.82, 1]} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ borderRadius: 22, padding: 18, paddingVertical: 20 }}>
                <View className="flex-row items-center self-start rounded-full" style={{ gap: 7, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.16)' }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: closed ? '#FCA5A5' : '#4ADE80' }} />
                    <Text className="font-outfit-bold" style={{ fontSize: 10.5, letterSpacing: 1.1, color: '#FFFFFF' }}>{closed ? t('scheduledOffers.hub.closedPill') : t('scheduledOffers.hub.openPill')}</Text>
                </View>
                <View className="flex-row items-baseline" style={{ gap: 6, marginTop: 14 }} accessibilityLabel={t('scheduledOffers.windowLeft', { hours: h, minutes: m })}>
                    <Text className="font-outfit-bold" style={{ fontSize: 46, letterSpacing: -1.5, lineHeight: 52, color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>{pad(h)}:{pad(m)}</Text>
                    <Text className="font-outfit-bold" style={{ fontSize: 20, color: 'rgba(255,255,255,0.85)', fontVariant: ['tabular-nums'] }}>:{pad(s)}</Text>
                </View>
                <Text className="font-outfit-regular" style={{ fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,0.9)', marginTop: 4 }}>{t('scheduledOffers.hub.leftNote')}</Text>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)', marginTop: 14, overflow: 'hidden' }}>
                    <View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', borderRadius: 3, backgroundColor: '#FFFFFF' }} />
                </View>
                {!closed ? (
                    <TouchableOpacity onPress={onExtend} disabled={busy} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginTop: 12, opacity: busy ? 0.6 : 1 }}>
                        <Text className="font-outfit-bold" style={{ fontSize: 12.5, color: '#FFFFFF', textDecorationLine: 'underline' }}>{extendLabel}</Text>
                    </TouchableOpacity>
                ) : null}
            </LinearGradient>

            <View style={{ ...CARD_STYLE, padding: 14, gap: 14, borderWidth: 1.5, borderColor: SC.blue }}>
                <View className="flex-row items-center" style={{ gap: 12 }}>
                    <View className="items-center justify-center" style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: SC.blueSoft }}><CreditCard size={23} color={SC.blue} /></View>
                    <View className="flex-1">
                        {offerCount > 0 ? (
                            <View className="flex-row items-baseline" style={{ gap: 5 }}>
                                <Text className="font-outfit-bold" style={{ fontSize: 26, letterSpacing: -0.8, lineHeight: 28, color: SC.blue }}>{offerCount}</Text>
                                <Text className="font-outfit-bold" style={{ fontSize: 16, color: SC.text }}>{t('scheduledOffers.hub.offersReceived', { count: offerCount })}</Text>
                            </View>
                        ) : (
                            <Text className="font-outfit-bold" style={{ fontSize: 16, color: SC.text }}>{t('scheduledOffers.hub.noOffers')}</Text>
                        )}
                        <View className="flex-row items-center flex-wrap" style={{ gap: 8, marginTop: 5 }}>
                            <Text className="font-outfit-regular" style={{ fontSize: 12.5, color: SC.muted }}>{offerCount > 0 ? t('scheduledOffers.hub.latest') : t('scheduledOffers.hub.reviewing')}</Text>
                            {offerCount > 0 && latestAgo ? (
                                <View className="flex-row items-center rounded-full" style={{ gap: 4, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: SC.blueSoft }}>
                                    <Clock size={11} color={SC.blue} />
                                    <Text className="font-outfit-bold" style={{ fontSize: 11.5, color: SC.blue }}>{latestAgo}</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>
                </View>
                {offerCount > 0 ? (
                    <TouchableOpacity onPress={onCompare} activeOpacity={0.85} accessibilityRole="button">
                        <LinearGradient colors={[SC.blue, SC.blueDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 15.5, color: '#FFFFFF' }}>{t('scheduledOffers.hub.compare')}</Text>
                            <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.4} />
                        </LinearGradient>
                    </TouchableOpacity>
                ) : null}
            </View>

            <View>
                {services.length > 0 ? (
                    <View style={{ ...CARD_STYLE, marginBottom: 14, paddingHorizontal: 14, paddingVertical: 12 }}>
                        <Text className="font-outfit-bold" style={{ fontSize: 11, letterSpacing: 1, color: SC.muted }}>{t('scheduledOffers.hub.servicesRequested')}</Text>
                        <Text className="font-outfit-bold" style={{ fontSize: 13.5, lineHeight: 20, color: SC.text, marginTop: 4 }}>{services.join(' · ')}</Text>
                    </View>
                ) : null}
                <Text className="font-outfit-bold" style={{ fontSize: 11, letterSpacing: 1.2, color: SC.muted, marginBottom: 8 }}>{t('scheduledOffers.hub.yourRequest', { ref: refCode })}</Text>
                <View style={{ ...CARD_STYLE, overflow: 'hidden' }}>
                    {rows.map((r, i) => {
                        const Icon = icons[r.kind];
                        return (
                            <View key={r.key} className="flex-row items-center" style={{ paddingHorizontal: 14, paddingVertical: 11, gap: 12, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: SC.borderSoft }}>
                                <View className="items-center justify-center" style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: SC.blueSoft }}><Icon size={17} color={SC.blue} /></View>
                                <Text className="font-outfit-medium" style={{ fontSize: 12, color: SC.muted, width: 64 }}>{r.label}</Text>
                                <Text className="font-outfit-bold flex-1" style={{ fontSize: 13, lineHeight: 18, color: SC.text, textAlign: 'right' }}>{r.value}</Text>
                            </View>
                        );
                    })}
                </View>
            </View>

            <View className="flex-row" style={{ gap: 10, padding: 12, borderRadius: 12, backgroundColor: SC.blueSofter, borderWidth: 1, borderColor: SC.blueSoft }}>
                <ShieldCheck size={18} color={SC.blue} style={{ marginTop: 1 }} />
                <Text className="font-outfit-regular flex-1" style={{ fontSize: 12.5, lineHeight: 18, color: SC.text }}>{t('scheduledOffers.hub.privacy')}</Text>
            </View>

            <TouchableOpacity onPress={onCancel} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12 }}>
                <Text className="font-outfit-bold" style={{ fontSize: 13, color: SC.red }}>{t('scheduledOffers.cancel.action')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onHome} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 13, borderRadius: 14, backgroundColor: SC.blueSoft }}>
                <Text className="font-outfit-bold" style={{ fontSize: 14.5, color: SC.blue }}>{t('scheduledOffers.hub.home')}</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}
