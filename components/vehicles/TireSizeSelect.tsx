import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { AV, AVField } from '@/components/vehicles/vehicleFormDesign';
import { TIRE_PROFILES, TIRE_RIMS, TIRE_WIDTHS, TireSize } from '@/lib/vehicleTires';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

interface TireSizeSelectProps {
    /** "FRONT TIRE SIZE", "REAR TIRE SIZE". */
    title: string;
    value: TireSize;
    onChange: (value: TireSize) => void;
}

/**
 * Width, profile and rim of one axle's tires, picked from the standard ranges,
 * in a tinted box with the resulting size ("225/50 R17") in its header.
 */
export function TireSizeSelect({ title, value, onChange }: TireSizeSelectProps) {
    const { t } = useTranslation();
    const complete = Boolean(value.width && value.profile && value.rim);
    const spec = complete ? `${value.width}/${value.profile} R${value.rim}` : t('vehicles.form.design.notSpecified');

    const part = (key: keyof TireSize, label: string, placeholder: string, values: string[], format: (v: string) => string) => (
        <AVField label={label}>
            <SearchableSelect
                options={values.map(v => ({ value: v, label: format(v) }))}
                value={value[key] || null}
                onChange={o => onChange({ ...value, [key]: o.value })}
                placeholder={placeholder}
                title={label}
                searchPlaceholder={t('vehicles.form.search')}
                emptyText={t('vehicles.form.noResults')}
                doneText={t('vehicles.done')}
                variant="vehicle"
            />
        </AVField>
    );

    return (
        <View
            style={{
                gap: 10,
                padding: 12,
                borderRadius: 14,
                backgroundColor: AV.blueSofter,
                borderWidth: 1,
                borderColor: AV.blueSoft,
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <Text className="font-outfit-bold" style={{ fontSize: 11, letterSpacing: 1, color: AV.text }}>
                    {title}
                </Text>
                <Text
                    className="font-outfit-bold"
                    style={{
                        fontSize: 11.5,
                        color: complete ? AV.blue : AV.mutedLight,
                        fontStyle: complete ? 'normal' : 'italic',
                    }}
                >
                    {spec}
                </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                    {part('width', t('vehicles.form.tireWidth'), '225', TIRE_WIDTHS, v => v)}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                    {part('profile', t('vehicles.form.design.tireAspect'), '50', TIRE_PROFILES, v => v)}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                    {part('rim', t('vehicles.form.design.tireRim'), 'R17', TIRE_RIMS, v => `R${v}`)}
                </View>
            </View>
        </View>
    );
}
