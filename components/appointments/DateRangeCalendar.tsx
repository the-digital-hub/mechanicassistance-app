import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { dayKey, parseDay } from '@/lib/appointments/filters';

const BLUE = '#1E56E3';
const SOFT = '#EAF1FF';

/**
 * A month calendar to pick a range of days: the first tap sets the start, the second the end (a tap before the start moves the start;
 * a tap once both are set begins a new range). Days can be in the past or the future.
 */
export function DateRangeCalendar({ from, to, onChange }: {
    from: string | null;
    to: string | null;
    onChange: (from: string | null, to: string | null) => void;
}) {
    const { i18n } = useTranslation();
    const locale = i18n.language?.startsWith('en') ? 'en-US' : 'es-AR';
    const [month, setMonth] = React.useState(() => {
        const base = from ? parseDay(from) : new Date();
        return new Date(base.getFullYear(), base.getMonth(), 1);
    });

    const first = month.getDay(); // Sunday first
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: (string | null)[] = [
        ...Array.from({ length: first }, () => null),
        ...Array.from({ length: daysInMonth }, (_, i) => dayKey(new Date(month.getFullYear(), month.getMonth(), i + 1))),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2021, 5, 6 + i).toLocaleDateString(locale, { weekday: 'narrow' }));
    const today = dayKey(new Date());

    const pick = (day: string) => {
        if (!from || (from && to)) onChange(day, null);
        else if (day < from) onChange(day, null);
        else onChange(from, day);
    };
    const shift = (delta: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

    return (
        <View testID="date-range-calendar">
            <View className="flex-row items-center justify-between" style={{ marginBottom: 8 }}>
                <TouchableOpacity onPress={() => shift(-1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Previous month" className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: SOFT }}>
                    <ChevronLeft size={18} color={BLUE} />
                </TouchableOpacity>
                <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#0B1530' }}>
                    {month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
                </Text>
                <TouchableOpacity onPress={() => shift(1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Next month" className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: SOFT }}>
                    <ChevronRight size={18} color={BLUE} />
                </TouchableOpacity>
            </View>
            <View className="flex-row">
                {weekdays.map((w, i) => (
                    <Text key={i} className="font-outfit-semibold text-center" style={{ flex: 1, fontSize: 13, lineHeight: 24, color: '#8C96AE' }}>{w}</Text>
                ))}
            </View>
            {Array.from({ length: cells.length / 7 }, (_, row) => (
                <View key={row} className="flex-row">
                    {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                        if (!day) return <View key={col} style={{ flex: 1, height: 42 }} />;
                        const isStart = day === from;
                        const isEnd = day === to;
                        const inside = !!from && !!to && day > from && day < to;
                        const edge = isStart || isEnd;
                        return (
                            <TouchableOpacity
                                key={col}
                                onPress={() => pick(day)}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityState={{ selected: edge || inside }}
                                accessibilityLabel={day}
                                testID={`day-${day}`}
                                style={{ flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: inside || (edge && from && to && from !== to) ? SOFT : 'transparent', borderTopLeftRadius: isStart ? 21 : 0, borderBottomLeftRadius: isStart ? 21 : 0, borderTopRightRadius: isEnd || (isStart && !to) ? 21 : 0, borderBottomRightRadius: isEnd || (isStart && !to) ? 21 : 0 }}
                            >
                                <View className="items-center justify-center" style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: edge ? BLUE : 'transparent', borderWidth: day === today && !edge ? 1.5 : 0, borderColor: BLUE }}>
                                    <Text className="font-outfit-semibold" style={{ fontSize: 15, color: edge ? '#FFFFFF' : '#0B1530' }}>{Number(day.slice(8))}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ))}
        </View>
    );
}
