import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { TIRE_PROFILES, TIRE_RIMS, TIRE_WIDTHS, TireSize } from '@/lib/vehicleTires';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

interface TireSizeSelectProps {
    /** "Front tire size", "Rear tire size". */
    title: string;
    value: TireSize;
    onChange: (value: TireSize) => void;
}

/** Width, profile and rim of one axle's tires, picked from the standard ranges. */
export function TireSizeSelect({ title, value, onChange }: TireSizeSelectProps) {
    const { t } = useTranslation();

    const part = (
        key: keyof TireSize,
        label: string,
        values: string[],
        format: (v: string) => string,
    ) => (
        <View>
            <Text className="font-outfit-medium text-[#0F172A] mb-2">{label}</Text>
            <SearchableSelect
                options={values.map(v => ({ value: v, label: format(v) }))}
                value={value[key] || null}
                onChange={o => onChange({ ...value, [key]: o.value })}
                placeholder={t('vehicles.form.select')}
                title={label}
                searchPlaceholder={t('vehicles.form.search')}
                emptyText={t('vehicles.form.noResults')}
                doneText={t('vehicles.done')}
            />
        </View>
    );

    return (
        <View className="gap-3">
            <Text className="font-outfit-semibold text-[#0F172A]">{title}</Text>
            {part('width', t('vehicles.form.tireWidth'), TIRE_WIDTHS, v => `${v} mm`)}
            {part('profile', t('vehicles.form.tireProfile'), TIRE_PROFILES, v => `${v} %`)}
            {part('rim', t('vehicles.form.tireRim'), TIRE_RIMS, v => t('vehicles.form.tireRimOption', { size: v }))}
        </View>
    );
}
