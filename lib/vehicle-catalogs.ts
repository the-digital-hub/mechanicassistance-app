import { useCallback, useEffect, useState } from 'react';
import type { TFunction } from 'i18next';
import { vehicleCatalogDAO, type VehicleCatalogKind } from './dao/VehicleCatalogDAO';
import type { VehicleCatalogEntry } from './dao/interfaces';

/**
 * Name to show for a catalog entry in the app's language. The catalogs carry a
 * single `label` typed in Portal Hub, so a translation is looked up by `code`
 * (`vehicleCatalogs.<kind>.<code>`) and the label is shown when there is none.
 */
export const vehicleCatalogLabel = (
    t: TFunction,
    kind: VehicleCatalogKind,
    entry: Pick<VehicleCatalogEntry, 'code' | 'label'>,
) => t(`vehicleCatalogs.${kind}.${entry.code}`, { defaultValue: entry.label });

/**
 * One vehicle catalog. `all` is every entry (needed to show one a vehicle
 * already has after an admin retires it); `active` is what a new choice may be
 * picked from. On failure `error` is set and `reload()` tries again.
 */
export function useVehicleCatalog(kind: VehicleCatalogKind) {
    const [all, setAll] = useState<VehicleCatalogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        setError(false);
        (async () => {
            try {
                const data = await vehicleCatalogDAO.getCatalog(kind);
                if (mounted) setAll(Array.isArray(data) ? data : []);
            } catch (err) {
                console.warn(`Could not load the ${kind} catalog`, err);
                if (mounted) setError(true);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [kind, attempt]);

    const reload = useCallback(() => setAttempt(n => n + 1), []);
    const active = all.filter(e => e.isActive);

    return { all, active, loading, error, reload };
}
