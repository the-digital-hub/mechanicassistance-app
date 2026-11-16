import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Calendar, Check, ChevronDown, Clock } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';

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
    compact,
}: {
    value: string;
    min: Date;
    max: Date;
    locale: string;
    onChange: (key: string) => void;
    /** One tappable date (iOS compact picker) instead of the whole month. */
    compact?: boolean;
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
            display={IOS ? (compact ? 'compact' : 'inline') : 'default'}
            minimumDate={min}
            maximumDate={max}
            locale={locale}
            accentColor={SC.blue}
            themeVariant="light"
            onChange={handle}
        />
    );

    if (IOS && compact) {
        return <View style={{ alignItems: 'flex-start' }}>{picker}</View>;
    }
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

// ───────────── Fields styled like the design's form inputs ─────────────

const FIELD_BOX = {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E4EAF5',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
} as const;

/** A date as a bordered field with a calendar icon; tapping opens the calendar (inline on iOS, a dialog on Android). */
export function DateField({
    value,
    min,
    max,
    locale,
    onChange,
    accessibilityLabel,
}: {
    value: string;
    min: Date;
    max: Date;
    locale: string;
    onChange: (key: string) => void;
    accessibilityLabel: string;
}) {
    const [open, setOpen] = useState(false);
    const current = value ? dateFromKey(value) : min;
    const text = value ? current.toLocaleDateString(locale, { month: '2-digit', day: '2-digit', year: 'numeric' }) : '';

    const handle = (e: DateTimePickerEvent, d?: Date) => {
        if (!IOS) setOpen(false);
        if (e.type === 'set' && d) {
            onChange(toDateKey(d));
            if (IOS) setOpen(false);
        }
    };

    return (
        <View>
            <TouchableOpacity
                onPress={() => setOpen(!open)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
                className="flex-row items-center"
                style={{ ...FIELD_BOX, borderColor: open ? SC.blue : '#E4EAF5', gap: 10 }}
            >
                <Text className="font-outfit-medium flex-1" style={{ fontSize: 16, color: text ? SC.text : SC.mutedLight }}>{text || '—'}</Text>
                <Calendar size={18} color={SC.text} />
            </TouchableOpacity>
            {open ? (
                <View style={IOS ? { ...CARD_STYLE, padding: 6, alignItems: 'center', marginTop: 8 } : undefined}>
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
                </View>
            ) : null}
        </View>
    );
}

export interface SelectOption {
    value: number;
    label: string;
    disabled?: boolean;
}

/** A dropdown: a bordered field with a chevron that opens the options in a bottom sheet. */
export function SelectField({
    value,
    options,
    placeholder,
    onSelect,
    accessibilityLabel,
}: {
    value: number | null;
    options: SelectOption[];
    placeholder: string;
    onSelect: (v: number) => void;
    accessibilityLabel: string;
}) {
    const [open, setOpen] = useState(false);
    const selected = options.find((o) => o.value === value);
    return (
        <>
            <TouchableOpacity
                onPress={() => setOpen(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
                className="flex-row items-center"
                style={{ ...FIELD_BOX, gap: 8 }}
            >
                <Text className="font-outfit-medium flex-1" style={{ fontSize: 16, color: selected ? SC.text : SC.mutedLight }}>{selected?.label ?? placeholder}</Text>
                <ChevronDown size={16} color={SC.blue} />
            </TouchableOpacity>
            <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <TouchableOpacity activeOpacity={1} onPress={() => setOpen(false)} accessibilityLabel="Close" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(11,21,48,0.45)' }} />
                    <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: 28, maxHeight: '60%' }}>
                        <View style={{ width: 40, height: 4, borderRadius: 4, backgroundColor: '#E4EAF5', alignSelf: 'center', marginBottom: 10 }} />
                        <ScrollView>
                            {options.map((o) => (
                                <TouchableOpacity
                                    key={o.value}
                                    disabled={o.disabled}
                                    onPress={() => { onSelect(o.value); setOpen(false); }}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: o.value === value, disabled: o.disabled }}
                                    className="flex-row items-center"
                                    style={{ paddingHorizontal: 20, paddingVertical: 14, opacity: o.disabled ? 0.35 : 1, backgroundColor: o.value === value ? SC.blueSofter : '#FFFFFF' }}
                                >
                                    <Text className="font-outfit-semibold flex-1" style={{ fontSize: 16, color: SC.text }}>{o.label}</Text>
                                    {o.value === value ? <Check size={18} color={SC.blue} strokeWidth={3} /> : null}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </>
    );
}
