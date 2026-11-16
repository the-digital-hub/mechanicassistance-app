import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Calendar, Clock } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';

import { dateFromKey, formatMinutes, toDateKey } from '@/lib/scheduled/draft';
import { CARD_STYLE, SC } from './ui';

const IOS = Platform.OS === 'ios';

function Field({ icon: Icon, text, onPress }: { icon: typeof Calendar; text: string; onPress: () => void }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            className="flex-row items-center"
            style={{ ...CARD_STYLE, padding: 14, gap: 10 }}
        >
            <Icon size={20} color={SC.blue} />
            <Text className="font-outfit-semibold flex-1" style={{ fontSize: 15, color: SC.text }}>{text}</Text>
        </TouchableOpacity>
    );
}

/** Month calendar for the service day, limited to the bookable range. iOS shows it inline; Android opens its dialog. */
export function DayCalendar({
    value,
    min,
    max,
    locale,
    onChange,
}: {
    value: string;
    min: Date;
    max: Date;
    locale: string;
    onChange: (key: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const current = value ? dateFromKey(value) : min;

    const handle = (e: DateTimePickerEvent, d?: Date) => {
        if (!IOS) setOpen(false);
        if (e.type === 'set' && d) onChange(toDateKey(d));
    };

    const picker = (
        <DateTimePicker
            value={current}
            mode="date"
            display={IOS ? 'inline' : 'default'}
            minimumDate={min}
            maximumDate={max}
            locale={locale}
            accentColor={SC.blue}
            themeVariant="light"
            onChange={handle}
        />
    );

    if (IOS) {
        return (
            <View style={{ ...CARD_STYLE, padding: 6, alignItems: 'center' }}>
                {picker}
            </View>
        );
    }
    return (
        <>
            <Field
                icon={Calendar}
                text={value ? current.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' }) : '—'}
                onPress={() => setOpen(true)}
            />
            {open ? picker : null}
        </>
    );
}

const dateAtMinutes = (m: number) => {
    const d = new Date(2000, 0, 1);
    d.setHours(Math.floor(m / 60), m % 60, 0, 0);
    return d;
};

/** One time of day (minutes from midnight), in 30-minute steps. iOS wheel; Android dialog. */
export function TimeWheel({
    label,
    minutes,
    min,
    max,
    onChange,
}: {
    label: string;
    minutes: number;
    min: number;
    max: number;
    onChange: (m: number) => void;
}) {
    const [open, setOpen] = useState(false);

    const handle = (e: DateTimePickerEvent, d?: Date) => {
        if (!IOS) setOpen(false);
        if (e.type !== 'set' || !d) return;
        const m = d.getHours() * 60 + d.getMinutes();
        onChange(Math.min(max, Math.max(min, m)));
    };

    const picker = (
        <DateTimePicker
            value={dateAtMinutes(minutes)}
            mode="time"
            display={IOS ? 'spinner' : 'default'}
            minuteInterval={30}
            minimumDate={dateAtMinutes(min)}
            maximumDate={dateAtMinutes(max)}
            themeVariant="light"
            onChange={handle}
        />
    );

    return (
        <View style={{ flex: 1 }}>
            <Text className="font-outfit-semibold" style={{ fontSize: 12, color: SC.muted, marginBottom: 6 }}>{label}</Text>
            {IOS ? (
                <View style={{ ...CARD_STYLE, overflow: 'hidden' }}>{picker}</View>
            ) : (
                <>
                    <Field icon={Clock} text={formatMinutes(minutes)} onPress={() => setOpen(true)} />
                    {open ? picker : null}
                </>
            )}
        </View>
    );
}
