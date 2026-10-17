import { useCallback, useEffect, useState } from 'react';
import type { TFunction } from 'i18next';
import { vehicleColorDAO } from './dao/VehicleColorDAO';
import type { VehicleColor } from './dao/interfaces';

/**
 * Name to show for a catalog color in the app's language. The catalog only
 * carries an English `label`, so the translation is looked up by `code`
 * (`vehicleColors.<code>`); a code added in the backend after this build still
 * shows, in English.
 */
export const vehicleColorLabel = (t: TFunction, color: Pick<VehicleColor, 'code' | 'label'>) =>
    t(`vehicleColors.${color.code}`, { defaultValue: color.label });

const normalize = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * The catalog entry a saved vehicle points at. Vehicles saved before the
 * catalog only have the free-text `color` (the old picker sent "White",
 * "Black", …), so that is matched against `code` and `label`.
 */
export const resolveVehicleColor = (
    catalog: VehicleColor[],
    vehicle: { colorId?: string | null; color?: string | null },
): VehicleColor | undefined => {
    if (vehicle.colorId) {
        const byId = catalog.find(c => c.id === vehicle.colorId);
        if (byId) return byId;
    }
    if (!vehicle.color) return undefined;
    const wanted = normalize(vehicle.color);
    return catalog.find(c => normalize(c.code) === wanted || normalize(c.label) === wanted);
};

/**
 * The vehicle color catalog. `all` is every entry (needed to show a color a
 * vehicle already has after an admin retires it); `active` is what a new choice
 * may be picked from. There is no built-in fallback list: on failure `error`
 * is set and `reload()` tries again.
 */
export function useVehicleColorCatalog() {
    const [all, setAll] = useState<VehicleColor[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        setError(false);
        (async () => {
            try {
                const data = await vehicleColorDAO.getCatalog();
                if (mounted) setAll(Array.isArray(data) ? data : []);
            } catch (err) {
                console.warn('Could not load the vehicle color catalog', err);
                if (mounted) setError(true);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [attempt]);

    const reload = useCallback(() => setAttempt(n => n + 1), []);
    const active = all.filter(c => c.isActive);

    return { all, active, loading, error, reload };
}
