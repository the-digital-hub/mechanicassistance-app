import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { ArrowDownUp, CalendarDays } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, Text, TouchableOpacity, View } from 'react-native';

const K = 'payments.activity';

/** Local calendar day as YYYY-MM-DD. */
export function toYmd(d: Date): string {
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

function fromYmd(s: string): Date {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
}

/** The filters as the mechanic picks them: both days inclusive. */
export interface ActivityFilterState {
    from?: string;
    to?: string;
    sort: 'newest' | 'oldest';
}

function DateField({
    label,
    value,
    onChange,
    minimumDate,
    maximumDate,
    testID,
}: {
    label: string;
    value?: string;
    onChange: (v: string) => void;
    minimumDate?: Date;
    maximumDate?: Date;
    testID: string;
}) {
    const { t, i18n } = useTranslation();
    const [iosOpen, setIosOpen] = React.useState(false);
    const [draft, setDraft] = React.useState<Date>(value ? fromYmd(value) : new Date());

    const open = () => {
        const current = value ? fromYmd(value) : new Date();
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: current,
                mode: 'date',
                minimumDate,
                maximumDate,
                onChange: (event, date) => {
                    if (event.type === 'set' && date) onChange(toYmd(date));
                },
            });
            return;
        }
        setDraft(current);
        setIosOpen(true);
    };

    return (
        <View className="flex-1" style={{ minWidth: 0 }}>
            <Text className="font-outfit-bold text-[10px] tracking-widest text-gray-500 mb-1">{label}</Text>
            <TouchableOpacity
                onPress={open}
                className="flex-row items-center bg-white rounded-xl border px-3"
                style={{ height: 44, borderColor: '#D6E0F0', gap: 6 }}
                accessibilityRole="button"
                testID={testID}
            >
                <CalendarDays size={16} color="#0047AB" />
                <Text className="font-outfit-medium text-sm flex-1" style={{ color: value ? '#111827' : '#9CA3AF' }} numberOfLines={1}>
                    {value ? fromYmd(value).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' }) : t(`${K}.any`)}
                </Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
                <Modal visible={iosOpen} transparent animationType="fade" onRequestClose={() => setIosOpen(false)}>
                    <Pressable className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={() => setIosOpen(false)}>
                        <Pressable className="bg-white rounded-t-3xl px-4 pt-4 pb-10" onPress={() => {}}>
                            <Text className="font-outfit-semibold text-base text-gray-900 mb-2">{label}</Text>
                            <DateTimePicker
                                value={draft}
                                mode="date"
                                display="inline"
                                minimumDate={minimumDate}
                                maximumDate={maximumDate}
                                onChange={(_, date) => date && setDraft(date)}
                            />
                            <TouchableOpacity
                                onPress={() => {
                                    onChange(toYmd(draft));
                                    setIosOpen(false);
                                }}
                                className="items-center rounded-xl mt-2"
                                style={{ backgroundColor: '#0047AB', paddingVertical: 14 }}
                                accessibilityRole="button"
                            >
                                <Text className="text-white font-outfit-bold">OK</Text>
                            </TouchableOpacity>
                        </Pressable>
                    </Pressable>
                </Modal>
            )}
        </View>
    );
}

/** From / To / Sort / Clear for the earnings activity list, like the portal. */
export function EarningsFiltersBar({
    value,
    onChange,
}: {
    value: ActivityFilterState;
    onChange: (next: ActivityFilterState) => void;
}) {
    const { t } = useTranslation();
    const dirty = !!value.from || !!value.to || value.sort !== 'newest';

    return (
        <View className="mb-3">
            <View className="flex-row" style={{ gap: 8 }}>
                <DateField
                    label={t(`${K}.from`)}
                    value={value.from}
                    maximumDate={value.to ? fromYmd(value.to) : new Date()}
                    onChange={(from) => onChange({ ...value, from })}
                    testID="earnings-filter-from"
                />
                <DateField
                    label={t(`${K}.to`)}
                    value={value.to}
                    minimumDate={value.from ? fromYmd(value.from) : undefined}
                    maximumDate={new Date()}
                    onChange={(to) => onChange({ ...value, to })}
                    testID="earnings-filter-to"
                />
            </View>
            <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
                <TouchableOpacity
                    onPress={() => onChange({ ...value, sort: value.sort === 'newest' ? 'oldest' : 'newest' })}
                    className="flex-row items-center bg-white rounded-xl border px-3 flex-1"
                    style={{ height: 40, borderColor: '#D6E0F0', gap: 6 }}
                    accessibilityRole="button"
                    accessibilityLabel={t(`${K}.sort`)}
                    testID="earnings-filter-sort"
                >
                    <ArrowDownUp size={16} color="#0047AB" />
                    <Text className="font-outfit-medium text-sm text-gray-900">{t(`${K}.${value.sort}`)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => onChange({ sort: 'newest' })}
                    disabled={!dirty}
                    className="items-center justify-center rounded-xl border px-4"
                    style={{ height: 40, borderColor: '#BFD3F5', backgroundColor: '#E9F1FF', opacity: dirty ? 1 : 0.5 }}
                    accessibilityRole="button"
                    testID="earnings-filter-clear"
                >
                    <Text className="font-outfit-semibold text-sm" style={{ color: '#0047AB' }}>{t(`${K}.clear`)}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
