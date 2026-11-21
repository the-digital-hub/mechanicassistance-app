import { LinearGradient } from 'expo-linear-gradient';
import { CalendarDays, SlidersHorizontal, X } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import { DateRangeCalendar } from '@/components/appointments/DateRangeCalendar';
import { SlideModal } from '@/components/ui/SlideModal';
import { dayKey, parseDay } from '@/lib/appointments/filters';
import { SHEET } from '@/lib/ui/sheet';
import { TYPE } from '@/lib/ui/type';

const K = 'payments.activity';
const F = 'appointments.filters';
const C = { blue: '#1E56E3', soft: '#EAF1FF', text: '#0B1530', muted: '#6B7490', border: '#E4EAF5', page: '#F6F8FC' };

/** Local calendar day as YYYY-MM-DD. */
export function toYmd(d: Date): string {
    return dayKey(d);
}

/** The filters as the technician picks them: both days inclusive. */
export interface ActivityFilterState {
    from?: string;
    to?: string;
    sort: 'newest' | 'oldest';
}

type Preset = 'any' | 'today' | '7d' | '30d' | 'month' | 'custom';
const PRESETS: Preset[] = ['any', 'today', '7d', '30d', 'month', 'custom'];

/** The days a preset covers, ending today. */
function presetRange(preset: Preset, now: Date = new Date()): { from?: string; to?: string } {
    const day = 86_400_000;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (preset) {
        case 'today': return { from: dayKey(today), to: dayKey(today) };
        case '7d': return { from: dayKey(new Date(today.getTime() - 6 * day)), to: dayKey(today) };
        case '30d': return { from: dayKey(new Date(today.getTime() - 29 * day)), to: dayKey(today) };
        case 'month': return { from: dayKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: dayKey(today) };
        default: return {};
    }
}

/** Which preset a range is, if it is one; a range that is none of them is "custom". */
function presetOf(f: ActivityFilterState): Preset {
    if (!f.from && !f.to) return 'any';
    for (const p of ['today', '7d', '30d', 'month'] as const) {
        const r = presetRange(p);
        if (r.from === f.from && r.to === f.to) return p;
    }
    return 'custom';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View style={{ marginTop: 18 }}>
            <Text className="font-outfit-bold" style={{ ...TYPE.question, color: C.text, marginBottom: 10 }}>{title}</Text>
            {children}
        </View>
    );
}

function Pill({ label, on, onPress, testID }: { label: string; on: boolean; onPress: () => void; testID?: string }) {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="radio" accessibilityState={{ selected: on }} className="items-center justify-center" style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 100, backgroundColor: on ? C.blue : C.soft }} testID={testID}>
            <Text className="font-outfit-bold" style={{ fontSize: 14, color: on ? '#FFFFFF' : C.blue }}>{label}</Text>
        </TouchableOpacity>
    );
}

/**
 * The filters of the earnings activity, the same way as the Appointments list: one row with what is filtered by (it opens the
 * sheet) and the filter button with how many filters are in force; the filters themselves (date, order) in a sheet from below,
 * and the ones in force as chips that can be removed one by one.
 */
export function EarningsFiltersBar({ value, onChange }: {
    value: ActivityFilterState;
    onChange: (next: ActivityFilterState) => void;
}) {
    const { t, i18n } = useTranslation();
    const locale = i18n.language?.startsWith('en') ? 'en-US' : 'es-AR';
    const [sheet, setSheet] = React.useState(false);
    const preset = presetOf(value);
    const count = (preset !== 'any' ? 1 : 0) + (value.sort !== 'newest' ? 1 : 0);

    const fmt = (d: string) => parseDay(d).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    const dateLabel = preset === 'custom'
        ? value.from && value.to
            ? value.from === value.to ? fmt(value.from) : `${fmt(value.from)} – ${fmt(value.to)}`
            : value.from ? t(`${F}.fromDate`, { date: fmt(value.from) }) : value.to ? t(`${F}.untilDate`, { date: fmt(value.to) }) : t(`${F}.presets.custom`)
        : t(`${F}.presets.${preset}`);
    const summary = `${dateLabel} · ${t(`${K}.${value.sort}`)}`;

    const chips: { key: string; label: string; clear: () => void }[] = [
        ...(preset !== 'any' ? [{ key: 'date', label: dateLabel, clear: () => onChange({ ...value, from: undefined, to: undefined }) }] : []),
        ...(value.sort !== 'newest' ? [{ key: 'order', label: t(`${K}.oldest`), clear: () => onChange({ ...value, sort: 'newest' }) }] : []),
    ];

    return (
        <View style={{ gap: 10, marginBottom: 12 }} testID="earnings-filters">
            <View className="flex-row items-center" style={{ gap: 10 }}>
                <TouchableOpacity
                    onPress={() => setSheet(true)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    className="flex-1 flex-row items-center"
                    style={{ height: 48, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, gap: 8 }}
                    testID="earnings-filter-summary"
                >
                    <CalendarDays size={18} color="#8C96AE" />
                    <Text className="flex-1 font-outfit-regular" style={{ ...TYPE.body, color: C.text }} numberOfLines={1}>{summary}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setSheet(true)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={t(`${F}.button`)}
                    className="items-center justify-center"
                    style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: count > 0 ? C.blue : C.soft }}
                    testID="earnings-filters-button"
                >
                    <SlidersHorizontal size={20} color={count > 0 ? '#FFFFFF' : C.blue} />
                    {count > 0 ? (
                        <View className="items-center justify-center" style={{ position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: '#E53E3E', borderWidth: 2, borderColor: '#F4F6FC' }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 12, lineHeight: 15, color: '#FFFFFF' }}>{count}</Text>
                        </View>
                    ) : null}
                </TouchableOpacity>
            </View>

            {chips.length > 0 ? (
                <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
                    {chips.map((chip) => (
                        <TouchableOpacity key={chip.key} onPress={chip.clear} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`${chip.label}, ${t(`${F}.remove`)}`} className="flex-row items-center" style={{ gap: 6, minHeight: 32, paddingLeft: 12, paddingRight: 8, borderRadius: 100, backgroundColor: C.soft }} testID={`earnings-chip-${chip.key}`}>
                            <Text className="font-outfit-bold" style={{ fontSize: 14, color: C.blue }}>{chip.label}</Text>
                            <X size={14} color={C.blue} />
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={() => onChange({ sort: 'newest' })} hitSlop={8} accessibilityRole="button" testID="earnings-filter-clear">
                        <Text className="font-outfit-semibold" style={{ fontSize: 14, color: C.muted }}>{t(`${F}.clearAll`)}</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            <FilterSheet visible={sheet} onClose={() => setSheet(false)} value={value} onApply={(next) => { onChange(next); setSheet(false); }} />
        </View>
    );
}

/** The filters in a sheet from below: date (a preset or a range on a calendar) and order. Applied together. */
function FilterSheet({ visible, onClose, value, onApply }: {
    visible: boolean;
    onClose: () => void;
    value: ActivityFilterState;
    onApply: (next: ActivityFilterState) => void;
}) {
    const { t } = useTranslation();
    const { height } = useWindowDimensions();
    const [draft, setDraft] = React.useState<ActivityFilterState>(value);
    const [draftPreset, setDraftPreset] = React.useState<Preset>(presetOf(value));
    React.useEffect(() => {
        if (visible) {
            setDraft(value);
            setDraftPreset(presetOf(value));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const pickPreset = (p: Preset) => {
        setDraftPreset(p);
        if (p !== 'custom') setDraft({ ...draft, ...presetRange(p), ...(p === 'any' ? { from: undefined, to: undefined } : null) });
    };

    return (
        <SlideModal visible={visible} onClose={onClose}>
            <View style={{ ...SHEET, paddingTop: 16 }} testID="earnings-filter-sheet">
                <View className="flex-row items-center justify-between" style={{ paddingHorizontal: 20 }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 22, letterSpacing: -0.4, color: C.text }}>{t(`${F}.sheetTitle`)}</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" className="items-center justify-center" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#EEF1F6' }}>
                        <X size={16} color="#4B5563" />
                    </TouchableOpacity>
                </View>
                <ScrollView style={{ flexGrow: 0, maxHeight: height * 0.62 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
                    <Section title={t(`${F}.dateTitle`)}>
                        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                            {PRESETS.map((p) => (
                                <Pill key={p} label={t(`${F}.presets.${p}`)} on={draftPreset === p} onPress={() => pickPreset(p)} testID={`earnings-preset-${p}`} />
                            ))}
                        </View>
                        {draftPreset === 'custom' ? (
                            <View style={{ marginTop: 14, padding: 12, borderRadius: 16, backgroundColor: C.page }}>
                                <DateRangeCalendar from={draft.from ?? null} to={draft.to ?? null} onChange={(from, to) => setDraft({ ...draft, from: from ?? undefined, to: to ?? undefined })} />
                                <Text className="font-outfit-regular text-center" style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>{t(`${F}.rangeHint`)}</Text>
                            </View>
                        ) : null}
                    </Section>

                    <Section title={t(`${F}.orderTitle`)}>
                        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                            <Pill label={t(`${K}.newest`)} on={draft.sort === 'newest'} onPress={() => setDraft({ ...draft, sort: 'newest' })} testID="earnings-order-newest" />
                            <Pill label={t(`${K}.oldest`)} on={draft.sort === 'oldest'} onPress={() => setDraft({ ...draft, sort: 'oldest' })} testID="earnings-order-oldest" />
                        </View>
                    </Section>
                </ScrollView>

                {/* Stacked: the action on top, the way out under it. */}
                <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 30, gap: 8 }}>
                    <TouchableOpacity onPress={() => onApply(draft)} activeOpacity={0.85} accessibilityRole="button" testID="earnings-filters-apply">
                        <LinearGradient colors={['#2B66F8', '#081E72']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                            <Text className="font-outfit-bold text-white" style={{ fontSize: 16 }}>{t(`${F}.apply`)}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => { setDraft({ sort: 'newest' }); setDraftPreset('any'); }}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        className="items-center justify-center"
                        style={{ minHeight: 52, borderRadius: 14, backgroundColor: '#E6EAF2' }}
                        testID="earnings-filters-clear"
                    >
                        <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#4A5470' }}>{t(`${F}.clear`)}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SlideModal>
    );
}
