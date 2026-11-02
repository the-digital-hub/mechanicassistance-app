/**
 * Tire size options of the vehicle form — the same ranges the vehicle owner
 * portal offers. Saved as standard notation, e.g. "225/50R17".
 */
export const TIRE_WIDTHS = Array.from({ length: 19 }, (_, i) => String(145 + i * 10)); // 145–325 mm
export const TIRE_PROFILES = Array.from({ length: 13 }, (_, i) => String(25 + i * 5)); // 25–85 %
export const TIRE_RIMS = Array.from({ length: 12 }, (_, i) => String(13 + i)); // R13–R24

export interface TireSize {
    width: string;
    profile: string;
    rim: string;
}

export const EMPTY_TIRE_SIZE: TireSize = { width: '', profile: '', rim: '' };

/** "225/50R17" for a complete size; null while any part is missing. */
export const formatTireSize = ({ width, profile, rim }: TireSize): string | null =>
    width && profile && rim ? `${width}/${profile}R${rim}` : null;

/**
 * Parts of a saved size. Tolerates a leading "P"/"LT", spaces and "ZR"/"-";
 * anything else comes back empty, so the form shows it as not set.
 */
export const parseTireSize = (value?: string | null): TireSize => {
    const match = value?.toUpperCase().match(/(\d{3})\s*\/\s*(\d{2})\s*Z?R?\s*-?\s*(\d{2})/);
    return match ? { width: match[1], profile: match[2], rim: match[3] } : EMPTY_TIRE_SIZE;
};
