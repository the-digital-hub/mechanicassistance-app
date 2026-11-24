/** A VIN as a person or a label writes it, upper-case, without spaces or dashes (the same rule as lib/onsite/vin.ts, kept here so this stays pure). */
const clean = (text: string) => text.replace(/[\s-]/g, '').toUpperCase();

/**
 * Whether `vin` is already in `vehicles` (a VIN identifies one vehicle: it is never added twice). `exceptId`: the vehicle being edited,
 * which of course has its own VIN.
 */
export function hasVin(vehicles: readonly { id?: string; vin?: string | null }[], vin: string, exceptId?: string | null): boolean {
    const wanted = clean(vin);
    if (!wanted) return false;
    return vehicles.some((v) => (exceptId == null || v.id !== exceptId) && !!v.vin && clean(v.vin) === wanted);
}
