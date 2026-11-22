import { Check, Clock } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

// Two extras an "attention" card can carry: the time left to deal with it (ticking, red when it is nearly gone) and a quick action to
// do it right there when it is simple.

/**
 * The card of one "Needs your attention" alert, the same for both roles: a tint of its tone, a firmer border and a shadow in the tone's own
 * colour, so it stands out from the white cards around it instead of lying flat on the page.
 */
export function attentionCardStyle(tone: 'amber' | 'blue') {
    const amber = tone === 'amber';
    return {
        backgroundColor: amber ? '#FFF8E8' : '#EEF4FF',
        borderWidth: 1.5,
        borderColor: amber ? '#F2D79A' : '#C9DBFA',
        borderRadius: 20,
        shadowColor: amber ? '#B7791F' : '#1E56E3',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 14,
        elevation: 6,
    } as const;
}

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

/** "2d 3h", "5h 12m", "12 min", "3:05" (the last minutes tick by the second). */
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

export function AttentionTimer({ spec, chip }: { spec: AttentionTimerSpec; /** Inside an alert card: the chip's colours, instead of the amber/red ones. */ chip?: { bg: string; ink: string } }) {
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
    const ink = chip ? (urgent ? '#B4231E' : chip.ink) : urgent ? '#B4231E' : '#8A5A12';
    return (
        <View className="flex-row items-center self-start" style={{ gap: 6, marginTop: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: chip ? chip.bg : urgent ? '#FAD4D4' : '#FCE3B5' }} testID="attention-timer">
            <Clock size={14} color={ink} />
            <Text className="font-outfit-bold" style={{ fontSize: 13, color: ink, ...(fast ? { fontVariant: ['tabular-nums' as const] } : null) }}>{spec.label(formatTimeLeft(left, t))}</Text>
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

/** "Hide" on an alert: a small soft slate badge beside the main one, smaller than it so it never competes, the same in both roles. */
export function AttentionHideBadge({ label, onPress }: { label: string; onPress: () => void }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            // The badge is small, the touch area is not.
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.8}
            accessibilityRole="button"
            className="items-center justify-center"
            style={{ minHeight: 28, paddingHorizontal: 11, borderRadius: 100, backgroundColor: '#EBEEF4' }}
            testID="attention-hide"
        >
            <Text className="font-outfit-medium" style={{ fontSize: 13, lineHeight: 17, color: '#6B7490' }}>{label}</Text>
        </TouchableOpacity>
    );
}
