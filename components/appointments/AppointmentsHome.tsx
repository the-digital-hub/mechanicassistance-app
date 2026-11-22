import { CalendarCheck, CheckCircle2, History, Send, XCircle, type LucideIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { TYPE } from '@/lib/ui/type';

const INK = { text: '#0B1530', muted: '#6B7490', border: '#EEF2FA' };

function Stat({ icon: Icon, value, label, bg, fg, onPress, testID }: { icon: LucideIcon; value: number; label: string; bg: string; fg: string; onPress?: () => void; testID?: string }) {
    const body = (
        <View className="items-center" style={{ flex: 1, gap: 6, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: INK.border }}>
            <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: bg }}>
                <Icon size={18} color={fg} />
            </View>
            <Text className="font-outfit-bold" style={{ fontSize: 24, lineHeight: 30, letterSpacing: -0.5, color: INK.text }}>{value}</Text>
            <Text className="font-outfit-semibold text-center" style={{ fontSize: 13, lineHeight: 17, color: INK.muted }}>{label}</Text>
        </View>
    );
    return onPress ? (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" style={{ flex: 1, flexDirection: 'row' }} testID={testID}>{body}</TouchableOpacity>
    ) : (
        <View style={{ flex: 1, flexDirection: 'row' }} testID={testID}>{body}</View>
    );
}

/**
 * What Appointments shows when nothing is coming up, instead of dropping the person into the past ones: that nothing is pending and
 * what is waited for, a small summary of what already happened (and the quotes waiting, for a technician) and one way to the history.
 */
export function AppointmentsHome({ isMechanic, completed, cancelled, quotes, onOpenPast, onOpenQuotes }: {
    isMechanic: boolean;
    completed: number;
    cancelled: number;
    /** Quotes sent and waiting for the customer (technician only). */
    quotes: number;
    onOpenPast: () => void;
    onOpenQuotes: () => void;
}) {
    const { t } = useTranslation();
    const k = 'appointments.home';
    const history = completed + cancelled;
    return (
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 16 }} testID="appointments-home">
            <View className="items-center" style={{ gap: 10, paddingVertical: 18 }}>
                <View className="items-center justify-center" style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#EAF1FF' }}>
                    <View className="items-center justify-center" style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF', shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 4 }}>
                        <CalendarCheck size={28} color="#1E56E3" />
                    </View>
                </View>
                <Text className="font-outfit-bold text-center" style={{ fontSize: 20, lineHeight: 26, color: INK.text }}>{t(`${k}.title`)}</Text>
                <Text className="font-outfit-regular text-center" style={{ ...TYPE.helper, color: INK.muted, maxWidth: 300 }}>{t(isMechanic ? `${k}.bodyMechanic` : `${k}.bodyOwner`)}</Text>
            </View>

            {history > 0 || quotes > 0 ? (
                <View style={{ gap: 10 }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1.2, color: INK.muted }}>{t(`${k}.summary`).toUpperCase()}</Text>
                    <View className="flex-row" style={{ gap: 10 }}>
                        <Stat icon={CheckCircle2} value={completed} label={t(`${k}.completed`)} bg="#E7F6EE" fg="#15803D" onPress={onOpenPast} testID="home-completed" />
                        <Stat icon={XCircle} value={cancelled} label={t(`${k}.cancelled`)} bg="#EEF0F4" fg="#6B7280" onPress={onOpenPast} testID="home-cancelled" />
                        {isMechanic ? <Stat icon={Send} value={quotes} label={t(`${k}.quotes`)} bg="#EAF1FF" fg="#1E56E3" onPress={onOpenQuotes} testID="home-quotes" /> : null}
                    </View>
                </View>
            ) : null}

            {history > 0 ? (
                <TouchableOpacity
                    onPress={onOpenPast}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    className="flex-row items-center justify-center"
                    style={{ gap: 8, minHeight: 56, borderRadius: 14, backgroundColor: '#E6EAF2' }}
                    testID="home-view-past"
                >
                    <History size={20} color="#4A5470" />
                    <Text className="font-outfit-bold" style={{ ...TYPE.button, color: '#4A5470' }}>{t(`${k}.viewPast`)}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}
