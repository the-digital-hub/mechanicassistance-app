import { LinearGradient } from 'expo-linear-gradient';
import { Search, SlidersHorizontal, X } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import { DateRangeCalendar } from '@/components/appointments/DateRangeCalendar';
import { SlideModal } from '@/components/ui/SlideModal';
import {
    activeFilterCount,
    DEFAULT_FILTERS,
    isFiltering,
    parseDay,
    type AppointmentFilters,
    type DatePreset,
    type FilterScope,
    type StatusFilter,
} from '@/lib/appointments/filters';
import { SHEET } from '@/lib/ui/sheet';
import { TYPE } from '@/lib/ui/type';

const C = { blue: '#1E56E3', soft: '#EAF1FF', text: '#0B1530', muted: '#6B7490', border: '#E4EAF5', page: '#F6F8FC' };

/** "Nov 3 – Nov 10", "From Nov 3", "Until Nov 10". */
function rangeLabel(f: AppointmentFilters, locale: string, t: (k: string, o?: Record<string, unknown>) => string): string {
    const fmt = (d: string) => parseDay(d).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    if (f.from && f.to) return f.from === f.to ? fmt(f.from) : `${fmt(f.from)} – ${fmt(f.to)}`;
    if (f.from) return t('appointments.filters.fromDate', { date: fmt(f.from) });
    if (f.to) return t('appointments.filters.untilDate', { date: fmt(f.to) });
    return t('appointments.filters.presets.custom');
}

function useDateLabel() {
    const { t, i18n } = useTranslation();
    const locale = i18n.language?.startsWith('en') ? 'en-US' : 'es-AR';
    return (f: AppointmentFilters) => (f.preset === 'custom' ? rangeLabel(f, locale, t) : t(`appointments.filters.presets.${f.preset}`));
}

/**
 * The search and the filters of the Appointments list, in one place: a search box (code, id, vehicle, service, address), a Filters
 * button that opens the sheet, the filters in force as chips that can be removed one by one, and how many results there are.
 */
export function AppointmentsFilterBar({ filters, onChange, scope, resultCount }: {
    filters: AppointmentFilters;
    onChange: (next: AppointmentFilters) => void;
    scope: FilterScope;
    resultCount: number;
}) {
    const { t } = useTranslation();
    const [sheet, setSheet] = React.useState(false);
    const dateLabel = useDateLabel();
    const count = activeFilterCount(filters, scope);
    const filtering = isFiltering(filters, scope);

    const chips: { key: string; label: string; clear: () => void }[] = [
        ...(scope === 'past' && filters.status !== 'all' ? [{ key: 'status', label: t(`appointments.filters.status.${filters.status}`), clear: () => onChange({ ...filters, status: 'all' }) }] : []),
        ...(filters.preset !== 'any' && (filters.preset !== 'custom' || filters.from || filters.to) ? [{ key: 'date', label: dateLabel(filters), clear: () => onChange({ ...filters, preset: 'any', from: null, to: null }) }] : []),
        ...(filters.reversed ? [{ key: 'order', label: t(`appointments.filters.order.${scope}.reversed`), clear: () => onChange({ ...filters, reversed: false }) }] : []),
    ];

    return (
        <View style={{ gap: 10 }} testID="appointments-filters">
            <View className="flex-row items-center" style={{ gap: 10 }}>
                <View className="flex-1 flex-row items-center" style={{ height: 48, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, gap: 8 }}>
                    <Search size={18} color="#8C96AE" />
                    <TextInput
                        value={filters.query}
                        onChangeText={(query) => onChange({ ...filters, query })}
                        placeholder={t('appointments.filters.searchPlaceholder')}
                        placeholderTextColor="#8C96AE"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                        className="flex-1 font-outfit-regular"
                        style={{ ...TYPE.body, color: C.text, paddingVertical: 0 }}
                        testID="appointments-search"
                    />
                    {filters.query ? (
                        <TouchableOpacity onPress={() => onChange({ ...filters, query: '' })} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('appointments.filters.clearSearch')} testID="appointments-search-clear">
                            <X size={18} color="#8C96AE" />
                        </TouchableOpacity>
                    ) : null}
                </View>
                <TouchableOpacity
                    onPress={() => setSheet(true)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={t('appointments.filters.button')}
                    className="items-center justify-center"
                    style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: count > 0 ? C.blue : C.soft }}
                    testID="appointments-filters-button"
                >
                    <SlidersHorizontal size={20} color={count > 0 ? '#FFFFFF' : C.blue} />
                    {count > 0 ? (
                        <View className="items-center justify-center" style={{ position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: '#E53E3E', borderWidth: 2, borderColor: C.page }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 12, lineHeight: 15, color: '#FFFFFF' }}>{count}</Text>
                        </View>
                    ) : null}
                </TouchableOpacity>
            </View>

            {chips.length > 0 ? (
                <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
                    {chips.map((chip) => (
                        <TouchableOpacity key={chip.key} onPress={chip.clear} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`${chip.label}, ${t('appointments.filters.remove')}`} className="flex-row items-center" style={{ gap: 6, minHeight: 32, paddingLeft: 12, paddingRight: 8, borderRadius: 100, backgroundColor: C.soft }} testID={`chip-${chip.key}`}>
                            <Text className="font-outfit-bold" style={{ fontSize: 14, color: C.blue }}>{chip.label}</Text>
                            <X size={14} color={C.blue} />
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={() => onChange({ ...DEFAULT_FILTERS, query: filters.query })} hitSlop={8} accessibilityRole="button" testID="appointments-clear-all">
                        <Text className="font-outfit-semibold" style={{ fontSize: 14, color: C.muted }}>{t('appointments.filters.clearAll')}</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {/* With no results the list says so itself, with a way out: the count only shows when there is something to count. */}
            {filtering && resultCount > 0 ? (
                <Text className="font-outfit-medium" style={{ fontSize: 14, color: C.muted }} testID="appointments-result-count">
                    {t('appointments.filters.results', { count: resultCount })}
                </Text>
            ) : null}

            <FilterSheet visible={sheet} onClose={() => setSheet(false)} filters={filters} scope={scope} onApply={(next) => { onChange(next); setSheet(false); }} />
        </View>
    );
}

const PRESETS: DatePreset[] = ['any', 'today', '7d', '30d', 'month', 'custom'];

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

/** The filters in a sheet from below: status (past), date (a preset or a range on a calendar) and order. Applied together. */
function FilterSheet({ visible, onClose, filters, scope, onApply }: {
    visible: boolean;
    onClose: () => void;
    filters: AppointmentFilters;
    scope: FilterScope;
    onApply: (next: AppointmentFilters) => void;
}) {
    const { t } = useTranslation();
    const { height } = useWindowDimensions();
    const [draft, setDraft] = React.useState(filters);
    React.useEffect(() => {
        if (visible) setDraft(filters);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const statuses: StatusFilter[] = ['all', 'completed', 'cancelled'];
    return (
        <SlideModal visible={visible} onClose={onClose}>
            <View style={{ ...SHEET, paddingTop: 16 }} testID="appointments-filter-sheet">
                <View className="flex-row items-center justify-between" style={{ paddingHorizontal: 20 }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 22, letterSpacing: -0.4, color: C.text }}>{t('appointments.filters.sheetTitle')}</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" className="items-center justify-center" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#EEF1F6' }}>
                        <X size={16} color="#4B5563" />
                    </TouchableOpacity>
                </View>
                <ScrollView style={{ flexGrow: 0, maxHeight: height * 0.62 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
                    {scope === 'past' ? (
                        <Section title={t('appointments.filters.statusTitle')}>
                            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                                {statuses.map((s) => (
                                    <Pill key={s} label={t(`appointments.filters.status.${s}`)} on={draft.status === s} onPress={() => setDraft({ ...draft, status: s })} testID={`status-${s}`} />
                                ))}
                            </View>
                        </Section>
                    ) : null}

                    <Section title={t('appointments.filters.dateTitle')}>
                        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                            {PRESETS.map((p) => (
                                <Pill key={p} label={t(`appointments.filters.presets.${p}`)} on={draft.preset === p} onPress={() => setDraft({ ...draft, preset: p, ...(p !== 'custom' ? { from: null, to: null } : null) })} testID={`preset-${p}`} />
                            ))}
                        </View>
                        {draft.preset === 'custom' ? (
                            <View style={{ marginTop: 14, padding: 12, borderRadius: 16, backgroundColor: C.page }}>
                                <DateRangeCalendar from={draft.from} to={draft.to} onChange={(from, to) => setDraft({ ...draft, from, to })} />
                                <Text className="font-outfit-regular text-center" style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>{t('appointments.filters.rangeHint')}</Text>
                            </View>
                        ) : null}
                    </Section>

                    <Section title={t('appointments.filters.orderTitle')}>
                        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                            <Pill label={t(`appointments.filters.order.${scope}.natural`)} on={!draft.reversed} onPress={() => setDraft({ ...draft, reversed: false })} testID="order-natural" />
                            <Pill label={t(`appointments.filters.order.${scope}.reversed`)} on={draft.reversed} onPress={() => setDraft({ ...draft, reversed: true })} testID="order-reversed" />
                        </View>
                    </Section>
                </ScrollView>

                {/* Stacked: the action on top, the way out under it. */}
                <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 30, gap: 8 }}>
                    <TouchableOpacity onPress={() => onApply(draft)} activeOpacity={0.85} accessibilityRole="button" testID="filters-apply">
                        <LinearGradient colors={['#2B66F8', '#081E72']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                            <Text className="font-outfit-bold text-white" style={{ fontSize: 16 }}>{t('appointments.filters.apply')}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setDraft({ ...DEFAULT_FILTERS, query: draft.query })} activeOpacity={0.85} accessibilityRole="button" className="items-center justify-center" style={{ minHeight: 52, borderRadius: 14, backgroundColor: '#E6EAF2' }} testID="filters-clear">
                        <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#4A5470' }}>{t('appointments.filters.clear')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SlideModal>
    );
}
