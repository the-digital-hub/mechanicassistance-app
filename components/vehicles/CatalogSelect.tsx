import { SearchableSelect } from '@/components/ui/SearchableSelect';
import type { VehicleCatalogKind } from '@/lib/dao/VehicleCatalogDAO';
import { useVehicleCatalog, vehicleCatalogLabel } from '@/lib/vehicle-catalogs';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface CatalogSelectProps {
    kind: VehicleCatalogKind;
    value?: string | null;
    onChange: (id: string) => void;
    /** Sheet title. */
    title: string;
}

/**
 * A vehicle catalog dropdown (type, engine, fuel, spare tire). Only active
 * entries can be picked; one the vehicle already has stays listed even if it
 * was retired since.
 */
export function CatalogSelect({ kind, value, onChange, title }: CatalogSelectProps) {
    const { t } = useTranslation();
    const { all, active, loading, error, reload } = useVehicleCatalog(kind);

    const options = useMemo(() => {
        const current = all.find(e => e.id === value);
        const pickable = current && !current.isActive ? [...active, current] : active;
        return pickable.map(e => ({ value: e.id, label: vehicleCatalogLabel(t, kind, e) }));
    }, [all, active, value, kind, t]);

    return (
        <SearchableSelect
            options={options}
            value={value}
            onChange={o => onChange(o.value)}
            placeholder={t('vehicles.form.selectFromCatalog')}
            title={title}
            searchPlaceholder={t('vehicles.form.search')}
            emptyText={t('vehicles.form.noResults')}
            doneText={t('vehicles.done')}
            loading={loading}
            errorText={error ? t('vehicles.form.catalogLoadError') : undefined}
            retryText={t('vehicles.retry')}
            onRetry={reload}
        />
    );
}
