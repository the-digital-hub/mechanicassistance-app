import { AlertCircle, Clock, RotateCw } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { BUTTON_RADIUS } from '@/lib/ui/floatingFooter';
import { TYPE } from '@/lib/ui/type';

const TONES = {
    info: { bg: '#EAF1FF', fg: '#1E56E3' },
    warn: { bg: '#FEF3C7', fg: '#B45309' },
    error: { bg: '#FEE4E2', fg: '#B42318' },
} as const;

/** The state of the code under the digits: how long it still lasts (blue, amber for the last minute), or why it is no good (red). */
export function codeStatus({ expiresIn, attemptsLeft, expiresText, expiredText, attemptsText }: {
    expiresIn: number;
    attemptsLeft: number | null;
    expiresText: string;
    expiredText: string;
    attemptsText: string;
}): { text: string; tone: keyof typeof TONES } {
    if (attemptsLeft !== null && attemptsLeft > 0) return { text: attemptsText, tone: 'error' };
    if (expiresIn > 0) return { text: expiresText, tone: expiresIn <= 60 ? 'warn' : 'info' };
    return { text: expiredText, tone: 'error' };
}

/** A pill with the state of the code ("Code expires in 09:42"). */
export function CodeStatusPill({ text, tone }: { text: string; tone: keyof typeof TONES }) {
    const { bg, fg } = TONES[tone];
    const Icon = tone === 'error' ? AlertCircle : Clock;
    return (
        <View className="items-center" style={{ marginBottom: 16 }} testID="otp-status">
            <View className="flex-row items-center" style={{ gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: bg }}>
                <Icon size={16} color={fg} />
                <Text className="font-outfit-semibold" style={{ ...TYPE.helper, color: fg }}>{text}</Text>
            </View>
        </View>
    );
}

/** "Resend code": a full secondary button (soft slate, as everywhere), with the wait written on it while it cannot be used. */
export function ResendButton({ label, disabled, loading, onPress }: { label: string; disabled: boolean; loading: boolean; onPress: () => void }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.85}
            accessibilityRole="button"
            className="flex-row items-center justify-center"
            style={{ gap: 8, minHeight: 52, borderRadius: BUTTON_RADIUS, backgroundColor: '#E6EAF2', opacity: disabled && !loading ? 0.6 : 1 }}
            testID="otp-resend"
        >
            {loading ? <ActivityIndicator color="#4A5470" /> : <RotateCw size={18} color={disabled ? '#6B7490' : '#1E56E3'} />}
            <Text className="font-outfit-bold" style={{ ...TYPE.button, color: disabled ? '#6B7490' : '#1E56E3' }}>{label}</Text>
        </TouchableOpacity>
    );
}
