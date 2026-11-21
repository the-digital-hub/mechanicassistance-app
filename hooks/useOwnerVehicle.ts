import { vehicleDAO } from '@/lib/dao/VehicleDAO';
import type { Vehicle } from '@/lib/dao/interfaces';
import { useEffect, useState } from 'react';

/**
 * The saved vehicles of an owner, asked once and shared by every card of the list (a list of twenty assistances must not mean twenty
 * requests). A failure is not cached, so the next mount tries again.
 */
const pending = new Map<string, Promise<Map<string, Vehicle>>>();
const resolved = new Map<string, Map<string, Vehicle>>();

function load(userId: string): Promise<Map<string, Vehicle>> {
    let p = pending.get(userId);
    if (!p) {
        p = vehicleDAO
            .getByUser(userId)
            .then((list) => {
                const byId = new Map<string, Vehicle>();
                for (const v of list ?? []) if (v.id) byId.set(v.id, v);
                resolved.set(userId, byId);
                return byId;
            })
            .finally(() => pending.delete(userId));
        pending.set(userId, p);
    }
    return p;
}

/** The plate and the VIN of the vehicle a request was made for; nothing until they are known (or when the request has no vehicle). */
export function useOwnerVehicleIds(userId: string | undefined, vehicleId: string | undefined, enabled = true): { plate: string | null; vin: string | null } {
    const [vehicle, setVehicle] = useState<Vehicle | null>(() => (userId && vehicleId ? resolved.get(userId)?.get(vehicleId) ?? null : null));
    useEffect(() => {
        if (!enabled || !userId || !vehicleId) return undefined;
        const cached = resolved.get(userId)?.get(vehicleId);
        if (cached) {
            setVehicle(cached);
            return undefined;
        }
        let cancelled = false;
        load(userId)
            .then((byId) => { if (!cancelled) setVehicle(byId.get(vehicleId) ?? null); })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, [enabled, userId, vehicleId]);
    return { plate: vehicle?.plate || null, vin: vehicle?.vin || null };
}
