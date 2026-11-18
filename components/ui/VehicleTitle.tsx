import React from 'react';
import { Text } from 'react-native';

type VehicleLike = { year?: string | number | null; make?: string | null; model?: string | null };

const present = (x: unknown) => x !== undefined && x !== null && x !== '';

/** "HUMMER H2" and the year apart, skipping what is missing. */
export function vehicleParts(v: VehicleLike): { name: string; year: string } {
    return {
        name: [v.make, v.model].filter(present).join(' '),
        year: present(v.year) ? String(v.year) : '',
    };
}

/** Plain text for places that cannot nest a Text: "HUMMER H2 (2008)". */
export function vehicleLine(v: VehicleLike): string {
    const { name, year } = vehicleParts(v);
    return year ? (name ? `${name} (${year})` : year) : name;
}

/**
 * A vehicle's title: make and model in the title weight, then the year in regular weight between parentheses
 * ("HUMMER H2 (2008)"), never the year first. Put it inside the Text that carries the title style.
 */
export function VehicleTitle({ vehicle }: { vehicle: VehicleLike }) {
    const { name, year } = vehicleParts(vehicle);
    return (
        <>
            {name}
            {year ? <Text className="font-outfit-regular">{name ? ` (${year})` : year}</Text> : null}
        </>
    );
}
