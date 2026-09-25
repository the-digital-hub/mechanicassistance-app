import { ApiError } from './api/types';
import { vehicleDAO } from './dao/VehicleDAO';
import type { VehicleDecodedFields, VinDecodeResult } from './dao/interfaces';

export const VEHICLE_COLORS = [
    { name: 'White', hex: '#FFFFFF', border: '#D1D5DB' },
    { name: 'Black', hex: '#1F2937', border: '#1F2937' },
    { name: 'Red', hex: '#EF4444', border: '#EF4444' },
    { name: 'Blue', hex: '#3B82F6', border: '#3B82F6' },
    { name: 'Gray', hex: '#9CA3AF', border: '#9CA3AF' },
];

export const VEHICLE_DATA = {
    'Toyota': ['Corolla', 'Camry', 'RAV4', 'Prius', 'Tacoma', 'Highlander', '4Runner', 'Sienna'],
    'Honda': ['Civic', 'Accord', 'CR-V', 'Pilot', 'Odyssey', 'Ridgeline', 'Fit', 'HR-V'],
    'Ford': ['F-150', 'Mustang', 'Explorer', 'Escape', 'Focus', 'Fusion', 'Edge', 'Ranger'],
    'Chevrolet': ['Silverado', 'Malibu', 'Equinox', 'Corvette', 'Tahoe', 'Suburban', 'Cruze', 'Camaro'],
    'Nissan': ['Altima', 'Sentra', 'Rogue', 'Pathfinder', 'Titan', 'Murano', 'Versa', 'Maxima'],
    'BMW': ['3 Series', '5 Series', 'X3', 'X5', 'M3', 'M5', 'i3', 'i8'],
    'Mercedes-Benz': ['C-Class', 'E-Class', 'S-Class', 'GLC', 'GLE', 'CLA', 'GLA', 'A-Class'],
    'Audi': ['A3', 'A4', 'A6', 'Q3', 'Q5', 'Q7', 'Q8', 'TT'],
    'Tesla': ['Model 3', 'Model S', 'Model X', 'Model Y', 'Cybertruck'],
    'Volkswagen': ['Jetta', 'Passat', 'Golf', 'Tiguan', 'Atlas', 'Beetle', 'ID.4']
} as const;

export type MakeType = string;

export const fetchMakes = async (): Promise<string[]> => {
    try {
        const response = await fetch(
            'https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/car?format=json'
        );
        const data = await response.json();
        return (data.Results || [])
            .map((m: any) => m.MakeName)
            .sort((a: string, b: string) => a.localeCompare(b));
    } catch (error) {
        console.error('Failed to fetch makes:', error);
        return [];
    }
};

export const fetchModelsByMake = async (make: string): Promise<string[]> => {
    try {
        const response = await fetch(
            `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/${encodeURIComponent(make)}?format=json`
        );
        const data = await response.json();
        return (data.Results || [])
            .map((m: any) => m.Model_Name)
            .sort((a: string, b: string) => a.localeCompare(b));
    } catch (error) {
        console.error('Failed to fetch models:', error);
        return [];
    }
};

export const getVehicleLogoUrl = (make: string): string => {
    if (!make || make === 'Select') return '';
    
    // Slugify make name: lowercase, no spaces, specialized mappings
    const slug = make.toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '');
        
    return `https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/thumb/${slug}.png`;
};

/**
 * The part of a VIN lookup that is saved with the vehicle. Fields NHTSA left
 * empty are omitted rather than sent as null.
 */
export const toVehicleDecodedFields = (r: VinDecodeResult): VehicleDecodedFields => {
    const fields: VehicleDecodedFields = {
        year: r.year ?? undefined,
        trim: r.trim ?? undefined,
        bodyClass: r.bodyClass ?? undefined,
        nhtsaVehicleType: r.nhtsaVehicleType ?? undefined,
        manufacturer: r.manufacturer ?? undefined,
        fuelTypePrimary: r.fuelTypePrimary ?? undefined,
        electrificationLevel: r.electrificationLevel ?? undefined,
        engineCylinders: r.engineCylinders ?? undefined,
        displacementL: r.displacementL ?? undefined,
        engineHp: r.engineHP ?? undefined,
        driveType: r.driveType ?? undefined,
        transmissionStyle: r.transmissionStyle ?? undefined,
        doors: r.doors ?? undefined,
        plantCountry: r.plantCountry ?? undefined,
        engineTypeId: r.suggested?.engineTypeId ?? undefined,
        vehicleTypeId: r.suggested?.vehicleTypeId ?? undefined,
        vinDecoded: r.raw,
    };
    return Object.fromEntries(
        Object.entries(fields).filter(([, v]) => v !== undefined),
    ) as VehicleDecodedFields;
};

/**
 * Looks the VIN up through our backend (which asks NHTSA vPIC). `onSuccess`
 * gets the make and model for the form, plus the decoded fields to send along
 * when the vehicle is saved.
 */
export const decodeVin = async (
    vin: string,
    onSuccess: (make: string, model: string, decoded: VehicleDecodedFields, result: VinDecodeResult) => void,
    onError: (error: string) => void
) => {
    try {
        const result = await vehicleDAO.decodeVin(vin);

        if (!result.found || !result.make) {
            onError('We could not find this VIN. Check it, or enter the vehicle manually.');
            return;
        }

        onSuccess(result.make, result.model || 'Select', toVehicleDecodedFields(result), result);
    } catch (error) {
        console.error('VIN lookup failed:', error);
        if (error instanceof ApiError && error.statusCode === 400) {
            onError('This VIN is not valid. It has 17 letters and digits, without I, O or Q.');
        } else {
            onError('Could not reach the VIN database. Please try again later, or enter the vehicle manually.');
        }
    }
};

