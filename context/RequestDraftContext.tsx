import React, { createContext, ReactNode, useContext, useState } from 'react';

/**
 * Vehicle details captured on the select-vehicle screen, after the user picks a vehicle:
 * the current odometer reading and who is in the vehicle to receive assistance.
 *
 * These live in a context rather than in router params because the wizard forwards its
 * params verbatim through five screens (issue-selection → add-details → location-map →
 * date-time → confirmation) before reaching the screen that submits
 * the request. Threading five more params through every hop would touch all of them.
 */
export interface VehicleDetailsDraft {
    /** Undefined when the user left the (optional) mileage field empty. */
    mileage?: number;
    /** True when the account holder is the one in the vehicle; the name/phone fields are then empty. */
    driverIsOwner: boolean;
    driverFirstName: string;
    driverLastName: string;
    driverPhone: string;
}

const EMPTY_VEHICLE_DETAILS: VehicleDetailsDraft = {
    mileage: undefined,
    driverIsOwner: true,
    driverFirstName: '',
    driverLastName: '',
    driverPhone: '',
};

interface RequestDraftContextType {
    vehicleDetails: VehicleDetailsDraft;
    setVehicleDetails: (details: VehicleDetailsDraft) => void;
    /** Call after submitting (or abandoning) a request so the next one starts clean. */
    resetDraft: () => void;
}

const RequestDraftContext = createContext<RequestDraftContextType | undefined>(undefined);

export function RequestDraftProvider({ children }: { children: ReactNode }) {
    const [vehicleDetails, setVehicleDetails] = useState<VehicleDetailsDraft>(EMPTY_VEHICLE_DETAILS);

    const resetDraft = () => setVehicleDetails(EMPTY_VEHICLE_DETAILS);

    return (
        <RequestDraftContext.Provider value={{ vehicleDetails, setVehicleDetails, resetDraft }}>
            {children}
        </RequestDraftContext.Provider>
    );
}

export function useRequestDraft() {
    const context = useContext(RequestDraftContext);
    if (context === undefined) {
        throw new Error('useRequestDraft must be used within a RequestDraftProvider');
    }
    return context;
}
