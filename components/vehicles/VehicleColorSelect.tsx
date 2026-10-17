import { SearchableSelect } from '@/components/ui/SearchableSelect';
import type { VehicleColor } from '@/lib/dao/interfaces';
import { resolveVehicleColor, useVehicleColorCatalog, vehicleColorLabel } from '@/lib/vehicle-colors';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

interface VehicleColorSelectProps {
    /** Catalog id currently picked. */
    colorId?: string | null;
    /** Free-text color of a vehicle saved before the catalog ("White", …). */
    legacyColor?: string | null;
    onChange: (color: VehicleColor) => void;
}

const ColorDot = ({ hex }: { hex?: string | null }) => (
    <View
        style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: hex ?? '#E5E7EB',
            borderWidth: 1,
            borderColor: '#D1D5DB',
        }}
    />
);

/**
 * Color field of the vehicle forms, fed by the vehicle color catalog
 * (GET /api/vehicle-colors). Only active colors can be picked; one the vehicle
 * already has stays listed even if it was retired since.
 *
 * A vehicle saved before the catalog has only free text: once the catalog
 * loads, a match is reported through `onChange`, so saving the form stores
 * the `colorId` too.
 */
export function VehicleColorSelect({ colorId, legacyColor, onChange }: VehicleColorSelectProps) {
    const { t } = useTranslation();
    const { all, active, loading, error, reload } = useVehicleColorCatalog();

    const current = useMemo(
        () => resolveVehicleColor(all, { colorId, color: legacyColor }),
        [all, colorId, legacyColor],
    );

    useEffect(() => {
        if (current && current.id !== colorId) onChange(current);
        // onChange is a fresh closure every render; only a new match matters.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [current, colorId]);

    const options = useMemo(() => {
        const pickable = current && !current.isActive ? [...active, current] : active;
        return pickable.map(c => ({ value: c.id, label: vehicleColorLabel(t, c), color: c }));
    }, [active, current, t]);

    return (
        <SearchableSelect
            options={options}
            value={current?.id ?? colorId}
            onChange={o => onChange(o.color)}
            placeholder={t('vehicles.selectColor')}
            title={t('vehicles.selectColor')}
            searchPlaceholder={t('vehicles.searchColor')}
            emptyText={t('vehicles.noColorsFound')}
            doneText={t('vehicles.done')}
            loading={loading}
            errorText={error ? t('vehicles.colorsLoadError') : undefined}
            retryText={t('vehicles.retry')}
            onRetry={reload}
            fallbackLabel={legacyColor ?? undefined}
            renderLeading={o => <ColorDot hex={o.color.hex} />}
        />
    );
}
