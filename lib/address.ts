import type { Address, AppRole } from './dao/interfaces';

export const US_STATES = [
    { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
    { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
    { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
    { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
    { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
    { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
    { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
    { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
];

export const normalizeStreet = (s: string) => {
    return s
        .replace(/\bCircle\b/gi, 'Cir')
        .replace(/\bStreet\b/gi, 'St')
        .replace(/\bAvenue\b/gi, 'Ave')
        .replace(/\bBoulevard\b/gi, 'Blvd')
        .replace(/\bDrive\b/gi, 'Dr')
        .replace(/\bRoad\b/gi, 'Rd')
        .replace(/\bLane\b/gi, 'Ln')
        .replace(/\bCourt\b/gi, 'Ct')
        .replace(/\bPlace\b/gi, 'Pl')
        .replace(/\bTerrace\b/gi, 'Ter')
        .replace(/\bParkway\b/gi, 'Pkwy');
};

export const getFormattedAddress = (feature: any) => {
    const { properties } = feature;
    const houseNumber = properties.housenumber || '';
    const streetPart = properties.street || properties.name || '';
    const city = properties.city || '';
    const stateName = properties.state || '';
    const zip = properties.postcode || '';

    const normalizedStreet = normalizeStreet(streetPart);
    const street = `${houseNumber} ${normalizedStreet}`.trim();

    // Try shortened state
    const stateMapping = US_STATES.find(s =>
        s.name.toLowerCase() === stateName.toLowerCase() ||
        s.code.toLowerCase() === stateName.toLowerCase()
    );
    const stateCode = stateMapping?.code || stateName;

    return `${street}, ${city}, ${stateCode} ${zip}`.replace(/,\s*$/, '');
};

/**
 * The addresses that belong to the active role: its own plus the shared ones
 * (role null or absent — every address saved before accounts held two roles).
 */
export function addressesForRole<T extends Pick<Address, 'role'>>(
    addresses: T[] | undefined,
    role: AppRole | undefined,
): T[] {
    if (!addresses) return [];
    return addresses.filter((address) => !address.role || !role || address.role === role);
}
