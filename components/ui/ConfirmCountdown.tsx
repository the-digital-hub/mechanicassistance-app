import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

const INK = { text: '#0B1530', orange: '#C26A0A', orangeText: '#8A5A12', soft: '#FFF4E5' };

/**
 * The time left as blocks. Under a day: hours, minutes and seconds, so it visibly runs; from a day up: days, hours and minutes.
 * Floors, so 23 h 59 min left never reads as "1 day 0 h 0 min".
 */
function timeBlocks(left: number, t: (key: string) => string): { value: number; label: string }[] {
    const total = Math.max(0, Math.floor(left / 1000));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const k = 'appointments.closeout';
    return days > 0
        ? [{ value: days, label: t(`${k}.confirmUnitDays`) }, { value: hours, label: t(`${k}.confirmUnitHours`) }, { value: minutes, label: t(`${k}.confirmUnitMinutes`) }]
        : [{ value: hours, label: t(`${k}.confirmUnitHours`) }, { value: minutes, label: t(`${k}.confirmUnitMinutes`) }, { value: seconds, label: t(`${k}.confirmUnitSeconds`) }];
}

/** The time left until `deadline` as small blocks that tick (see `timeBlocks`). Nothing once past. */
export function CountdownBlocks({ deadline, tone = 'white', urgentUnderMinutes }: {
    deadline: string | null | undefined;
    /** `white`: white blocks (on the orange panel); `amber`: amber blocks (on a white card). */
    tone?: 'white' | 'amber';
    /** Under this many minutes the blocks turn red. */
    urgentUnderMinutes?: number;
}) {
    const { t } = useTranslation();
    const [now, setNow] = React.useState(() => Date.now());
    const end = deadline ? Date.parse(deadline) : NaN;
    // Under a day the seconds run, so it ticks every second; from a day up, the minute is the smallest block.
    const fast = Number.isFinite(end) && end - now < 86_400_000;
    React.useEffect(() => {
        if (!deadline) return undefined;
        const id = setInterval(() => setNow(Date.now()), fast ? 1000 : 30_000);
        return () => clearInterval(id);
    }, [deadline, fast]);
    if (!Number.isFinite(end)) return null;
    const left = end - now;
    if (left <= 0) return null;
    const minutesLeft = Math.ceil(left / 60_000);
    const units = timeBlocks(left, t);
    const urgent = urgentUnderMinutes !== undefined && minutesLeft < urgentUnderMinutes;
    const bg = tone === 'white' ? '#FFFFFF' : urgent ? '#FDECEC' : INK.soft;
    const ink = urgent ? '#B4231E' : INK.orangeText;
    return (
        <View className="flex-row" style={{ gap: 6 }} accessibilityLabel={units.map((u) => `${u.value} ${u.label}`).join(' ')} testID="countdown-blocks">
            {units.map((u) => (
                <View key={u.label} className="items-center" style={{ minWidth: 46, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 10, backgroundColor: bg }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 17, lineHeight: 20, color: urgent ? ink : INK.text, fontVariant: ['tabular-nums'] }}>{String(u.value).padStart(2, '0')}</Text>
                    <Text className="font-outfit-medium uppercase" style={{ fontSize: 11, lineHeight: 13, letterSpacing: 0.5, color: ink, opacity: 0.8 }}>{u.label}</Text>
                </View>
            ))}
        </View>
    );
}

/**
 * How long the customer has to confirm the finished service, the same block on both sides (the technician's detail and close-out,
 * and the owner's last hours): the hourglass tile and a title, the time as small blocks (days, hours, minutes) and the date it
 * confirms by itself. Ticks every 30 s; nothing once past or without a deadline.
 */
export function ConfirmCountdown({ deadline, title, note, style, testID }: {
    deadline: string | null | undefined;
    title: string;
    /** The sentence under the blocks, from the date and the time the service confirms on its own. */
    note: (date: string, time: string) => string;
    style?: React.ComponentProps<typeof View>['style'];
    testID?: string;
}) {
    const { t, i18n } = useTranslation();
    const [now, setNow] = React.useState(() => Date.now());
    const end = deadline ? Date.parse(deadline) : NaN;
    // Under a day it ticks every second (the seconds block runs); from a day up, every 30 s.
    const fast = Number.isFinite(end) && end - now < 86_400_000;
    React.useEffect(() => {
        if (!deadline) return undefined;
        const id = setInterval(() => setNow(Date.now()), fast ? 1000 : 30_000);
        return () => clearInterval(id);
    }, [deadline, fast]);
    if (!Number.isFinite(end)) return null;
    const left = end - now;
    if (left <= 0) return null;
    const units = timeBlocks(left, t);
    const when = new Date(end);
    const date = when.toLocaleDateString(i18n.language, { weekday: 'short', month: 'short', day: 'numeric' });
    const time = when.toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' });
    return (
        <View style={[{ gap: 12, padding: 14, borderRadius: 16, backgroundColor: INK.soft }, style]} testID={testID ?? 'confirm-countdown'}>
            <View className="flex-row items-center" style={{ gap: 10 }}>
                <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#FFFFFF' }}>
                    <Ionicons name="hourglass-outline" size={20} color={INK.orange} />
                </View>
                <Text className="flex-1 font-outfit-semibold uppercase" style={{ fontSize: 13, lineHeight: 17, letterSpacing: 0.5, color: INK.orangeText }}>{title}</Text>
            </View>
            <View className="flex-row" style={{ gap: 8 }} accessibilityLabel={units.map((u) => `${u.value} ${u.label}`).join(' ')}>
                {units.map((u) => (
                    <View key={u.label} className="items-center" style={{ minWidth: 62, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 12, backgroundColor: '#FFFFFF' }}>
                        <Text className="font-outfit-bold" style={{ fontSize: 22, lineHeight: 26, letterSpacing: -0.3, color: INK.text, fontVariant: ['tabular-nums'] }}>{String(u.value).padStart(2, '0')}</Text>
                        <Text className="font-outfit-semibold uppercase" style={{ fontSize: 12, lineHeight: 15, letterSpacing: 0.6, color: INK.orangeText }}>{u.label}</Text>
                    </View>
                ))}
            </View>
            <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: INK.orangeText }}>{note(date, time)}</Text>
        </View>
    );
}

/**
 * The same countdown as one quiet line, for where it is only information (the technician waiting for the customer): a small hourglass,
 * what it is, the time left in plain text and the date it happens on underneath. No panel, no blocks.
 */
export function SubtleCountdown({ deadline, label, note, testID }: {
    deadline: string | null | undefined;
    label: string;
    note: (date: string, time: string) => string;
    testID?: string;
}) {
    const { i18n } = useTranslation();
    const [now, setNow] = React.useState(() => Date.now());
    const end = deadline ? Date.parse(deadline) : NaN;
    const fast = Number.isFinite(end) && end - now < 86_400_000;
    React.useEffect(() => {
        if (!deadline) return undefined;
        const id = setInterval(() => setNow(Date.now()), fast ? 1000 : 30_000);
        return () => clearInterval(id);
    }, [deadline, fast]);
    if (!Number.isFinite(end)) return null;
    const left = end - now;
    if (left <= 0) return null;
    const total = Math.floor(left / 1000);
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    const remaining = d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${String(sec).padStart(2, '0')}s`;
    const when = new Date(end);
    const date = when.toLocaleDateString(i18n.language, { weekday: 'short', month: 'short', day: 'numeric' });
    const time = when.toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' });
    return (
        <View className="flex-row items-start" style={{ gap: 10, marginTop: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#F6F8FC' }} testID={testID ?? 'subtle-countdown'}>
            <Ionicons name="hourglass-outline" size={18} color={INK.orange} style={{ marginTop: 2 }} />
            <View className="flex-1" style={{ minWidth: 0 }}>
                <Text className="font-outfit-semibold" style={{ fontSize: 14, lineHeight: 20, color: INK.text }}>
                    {label} <Text className="font-outfit-bold" style={{ color: INK.orangeText, fontVariant: ['tabular-nums'] }}>{remaining}</Text>
                </Text>
                <Text className="font-outfit-regular" style={{ fontSize: 13, lineHeight: 18, color: '#6B7490' }}>{note(date, time)}</Text>
            </View>
        </View>
    );
}
