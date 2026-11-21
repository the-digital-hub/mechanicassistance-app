import { Check, Clock } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

// Two extras an "attention" card can carry: the time left to deal with it (ticking, red when it is nearly gone) and a quick action to
// do it right there when it is simple.

export type AttentionTimerSpec = {
    /** When it runs out (ISO). */
    deadline: string;
    /** The sentence around the time left, e.g. "Confirms automatically in {time}". */
    label: (time: string) => string;
    /** Turns red under this many minutes. */
    urgentUnderMinutes?: number;
};

export type AttentionQuick = {
    label: string;
    onPress: () => void;
    busy?: boolean;
};

/** "2 d 3 h", "5 h 12 min", "12 min", "3:05" (the last minutes tick by the second). */
export function formatTimeLeft(ms: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    if (minutes < 5) return t('dashboard.attention.timer.seconds', { minutes, seconds: String(totalSeconds % 60).padStart(2, '0') });
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    if (days > 0) return t('dashboard.attention.timer.days', { days, hours });
    if (hours > 0) return t('dashboard.attention.timer.hours', { hours, minutes: minutes % 60 });
    return t('dashboard.attention.timer.minutes', { minutes });
}

export function AttentionTimer({ spec }: { spec: AttentionTimerSpec }) {
    const { t } = useTranslation();
    const [now, setNow] = React.useState(() => Date.now());
    const end = Date.parse(spec.deadline);
    const left = end - now;
    // By the minute, and by the second once the last minutes start.
    const fast = Number.isFinite(left) && left < 5 * 60_000;
    React.useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), fast ? 1000 : 30_000);
        return () => clearInterval(id);
    }, [fast]);
    if (!Number.isFinite(end) || left <= 0) return null;
    const urgent = left < (spec.urgentUnderMinutes ?? 120) * 60_000;
    const ink = urgent ? '#B4231E' : '#8A5A12';
    return (
        <View className="flex-row items-center self-start" style={{ gap: 6, marginTop: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: urgent ? '#FDECEC' : '#FEF4E2' }} testID="attention-timer">
            <Clock size={14} color={ink} />
            <Text className="font-outfit-bold" style={{ fontSize: 13, color: ink, fontVariant: ['tabular-nums'] }}>{spec.label(formatTimeLeft(left, t))}</Text>
        </View>
    );
}

export function AttentionQuickButton({ quick }: { quick: AttentionQuick }) {
    return (
        <TouchableOpacity
            onPress={quick.onPress}
            disabled={quick.busy}
            activeOpacity={0.85}
            accessibilityRole="button"
            className="flex-row items-center justify-center"
            style={{ gap: 8, minHeight: 48, borderRadius: 14, backgroundColor: '#10B981', marginTop: 12, opacity: quick.busy ? 0.7 : 1 }}
            testID="attention-quick"
        >
            {quick.busy ? <ActivityIndicator color="#FFFFFF" /> : <Check size={20} color="#FFFFFF" strokeWidth={3} />}
            <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#FFFFFF' }}>{quick.label}</Text>
        </TouchableOpacity>
    );
}
