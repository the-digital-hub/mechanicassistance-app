export type AssistanceType = 'immediate' | 'scheduled' | 'videocall' | 'witness';

export interface AssistanceRequest {
    id: string;
    type: AssistanceType;
    assistanceType?: string;
    title: string;
    car: string;
    address: string;
    notes?: string;
    budget: string;
    distance?: string;
    date?: string;
    userId?: string;
    mechanicId?: string;
    status?: 'pending' | 'accepted' | 'canceled' | 'offered';
    locationLat?: number;
    locationLng?: number;
    photos?: string[];
    vehicleId?: string;
    zip?: string;
    /** Mechanic's proposed price for this service (set when mechanic makes an offer) */
    price?: string;
    /** Mechanic's estimated arrival time, e.g. "20 min" */
    eta?: string;
    /** ISO date string of the last update (used e.g. as cancellation date) */
    updatedAt?: string;
    /** Vehicle issues selected for this request (from GET /api/pricing/requests/:id/issues) */
    vehicleIssues?: VehicleIssueSnapshot[];
}

export interface Address {
    id: string;
    type?: string;
    street?: string;
    apartment?: string;
    city?: string;
    state?: string;
    zip?: string;
}

export interface MechanicDetail {
    id: string;
    workForDealer?: boolean;
    companyName?: string;
    companyInvitation?: string;
    expertiseDetails?: string;
    yearsExperience?: string;
}

export interface MechanicAvailability {
    id: string;
    day?: string;
    startTime?: string;
    endTime?: string;
}

export interface IdentityDocument {
    id: string;
    documentType: string;
    frontImageUrl: string;
    backImageUrl: string;
    frontImageKey?: string;
    backImageKey?: string;
    status: string;
}

export interface UserData {
    id: string;
    email: string;
    name: string;
    surname: string;
    phone: string;
    dob: string;
    profileImage?: string;
    role: 'mechanic' | 'user';
    isOnline?: boolean;
    addresses?: Address[];
    vehicles?: Vehicle[];
    mechanicDetails?: MechanicDetail;
    mechanicAvailabilities?: MechanicAvailability[];
    identityDocument?: IdentityDocument;
}

export interface Vehicle {
    id?: string;
    userId?: string;
    make: string;
    model: string;
    color: string;
    plate: string;
    vin: string;
    details: string;
}

export interface IVehicleDAO {
    getByUser(userId: string): Promise<Vehicle[]>;
    create(vehicle: Omit<Vehicle, 'id'>): Promise<Vehicle>;
    update(id: string, updates: Partial<Vehicle>): Promise<void>;
    delete(id: string): Promise<void>;
}

export interface IUserDAO {
    getAll(): Promise<UserData[]>;
    getById(id: string): Promise<UserData | null>;
    login(phone: string): Promise<UserData | null>;
    checkPhoneExists(phone: string): Promise<boolean>;
    register(setupData: any): Promise<any>;
    update(id: string, updates: Partial<UserData>): Promise<void>;
}

export interface IAssistanceDAO {
    getAll(filters?: { userId?: string; mechanicId?: string; status?: string; zip?: string; lat?: number; lng?: number; radiusKm?: number }): Promise<AssistanceRequest[]>;
    getById(id: string): Promise<AssistanceRequest | null>;
    updateStatus(id: string, mechanicId: string, status: string, extra?: { eta?: string; price?: string }): Promise<void>;
    create(request: Partial<AssistanceRequest>): Promise<AssistanceRequest>;
}

export interface IAppointmentDAO {
    getAll(filters?: { userId?: string; mechanicId?: string }): Promise<any[]>;
    create(appointment: any): Promise<any>;
    update(id: string, updates: any): Promise<void>;
}

export interface ISetupDAO {
    getProgress(key: string): Promise<any>;
    saveProgress(key: string, value: any): Promise<void>;
}

/** A vehicle issue from the pricing service catalog (GET /api/pricing/vehicle-issues). */
export interface VehicleIssue {
    id: string;
    name: string;
    description?: string;
    sortOrder?: number;
    isActiveApp?: boolean;
}

/** Body for POST /api/pricing/calculate. Jurisdiction is resolved server-side from `zipcode`. */
export interface CalculatePricePayload {
    vehicle_issue_id: string;
    latitude: number;
    longitude: number;
    zipcode?: string;
    add_on_ids?: string[];
}

/** Body for POST /api/pricing/requests/:serviceRequestId/price. */
export interface PersistRequestPricePayload {
    vehicle_issue_ids: string[];
    latitude: number;
    longitude: number;
    zipcode?: string;
}

/** A vehicle issue previously persisted for a request (GET /api/pricing/requests/:id/issues). */
export interface VehicleIssueSnapshot {
    vehicleIssueId: string;
    name: string;
    priceSnapshot?: number;
    quantity?: number;
}

/** Response from POST /api/pricing/calculate — only `final_price` is consumed today. */
export interface PriceCalculationResult {
    vehicle_issue?: { id: string; name: string; assistance_type?: string | null };
    pricing_breakdown: {
        final_price: number;
        base_price?: number;
        adjusted_price?: number;
        [key: string]: unknown;
    };
}

export interface IPricingDAO {
    getVehicleIssues(): Promise<VehicleIssue[]>;
    calculatePrice(payload: CalculatePricePayload): Promise<PriceCalculationResult>;
    persistRequestPrice(serviceRequestId: string, payload: PersistRequestPricePayload): Promise<PriceCalculationResult>;
    getRequestIssues(serviceRequestId: string): Promise<VehicleIssueSnapshot[]>;
}
