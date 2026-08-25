// Mirrors the `code` column of the assistance type catalog (GET /api/assistance-types).
// 'towing' exists in the catalog but has no dedicated handling in the request flow yet:
// the cards that switch on this fall through to their default branch.
export type AssistanceType =
    | 'immediate'
    | 'scheduled'
    | 'videocall'
    | 'witness'
    | 'towing';

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
    /** Odometer reading when the request was created. Snapshot: `Vehicle.mileage` gets overwritten, this doesn't. */
    mileage?: number;
    /** True when the account holder is the one in the vehicle; the driver fields below are then left empty. */
    driverIsOwner?: boolean;
    driverFirstName?: string;
    driverLastName?: string;
    driverPhone?: string;
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
    /**
     * Coordinates of the address, filled in by Google Places autocomplete.
     * Named to match the backend (`user_addresses.locationLat/locationLng`), so
     * the payload needs no renaming on the way out.
     */
    locationLat?: number;
    locationLng?: number;
}

export interface MechanicDetail {
    id: string;
    workForDealer?: boolean;
    companyName?: string;
    companyInvitation?: string;
    expertiseDetails?: string;
    yearsExperience?: string;
    /** Travel radius from the base address, in miles (1-50). Absent for
     *  mechanics who registered before the service-area slider was persisted. */
    serviceRadiusMiles?: number;
    /** "pending" until the mechanic verifies their ASE ID. Optional so older
     *  backend builds, which don't send it, still type-check. */
    aseStatus?: 'pending' | 'verified';
}

export interface MechanicAvailability {
    id: string;
    day?: string;
    startTime?: string;
    endTime?: string;
}

/**
 * Every status Didit can report. `Approved` is the only one that unblocks the
 * app — see VerificationContext and the gateway's verification gate.
 */
export type VerificationStatus =
    | 'Not Started'
    | 'In Progress'
    | 'In Review'
    | 'Approved'
    | 'Declined'
    | 'Abandoned'
    | 'Resubmitted';

/**
 * Identity verification (KYC) state. Only the status lives on our side: the
 * document data and images stay with Didit.
 */
export interface IdentityVerification {
    verificationId: string;
    sessionId: string;
    status: VerificationStatus;
    declineReason?: string;
    verifiedAt?: string;
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
    identityVerification?: IdentityVerification;
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
    /** Last known odometer reading. Overwritten on every request that reports a newer one. */
    mileage?: number;
}

export interface IVehicleDAO {
    getByUser(userId: string): Promise<Vehicle[]>;
    create(vehicle: Omit<Vehicle, 'id'>): Promise<Vehicle>;
    update(id: string, updates: Partial<Vehicle>): Promise<void>;
    delete(id: string): Promise<void>;
}

/** What any authenticated user may read about another user. */
export interface PublicUserProfile {
    id: string;
    name?: string;
    surname?: string;
    profileImage?: string;
    role?: string;
}

export interface IUserDAO {
    getAll(): Promise<UserData[]>;
    getById(id: string): Promise<UserData | null>;
    getPublicProfile(id: string): Promise<PublicUserProfile | null>;
    /** Google/Apple sign-in. Phone sign-in goes through `lib/auth/otp.ts`. */
    loginWithFirebase(idToken: string, phone?: string): Promise<UserData | null>;
    /** Upgrades a pre-refresh-token session so an app update does not log the user out. */
    exchangeLegacySession(): Promise<UserData | null>;
    logout(): Promise<void>;
    checkEmailExists(email: string): Promise<boolean>;
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

/**
 * One row of a catalog entity's `*_translations` table.
 *
 * The API never resolves the language itself: it returns the base `name` plus
 * every translation, and the client picks the one matching the language it
 * detected locally (see `lib/i18n/catalogTranslations.ts`).
 */
export interface VehicleIssueTranslation {
    id: string;
    languageId: number;
    name: string;
}

/** A language from GET /api/pricing/languages — maps a locale code to a languageId. */
export interface CatalogLanguage {
    id: number;
    code: string;
    name: string;
    isDefault?: boolean;
}

/**
 * A symptom of a vehicle issue (third level of the catalog). Has no price —
 * it only refines the issue. The client lets the user pick exactly one.
 */
export interface VehicleIssueSymptom {
    id: string;
    vehicleIssueId: string;
    name: string;
    sortOrder?: number | null;
    translations?: VehicleIssueTranslation[];
}

/** A vehicle issue from the pricing service catalog (GET /api/pricing/vehicle-issues). */
export interface VehicleIssue {
    id: string;
    name: string;
    description?: string;
    sortOrder?: number | null;
    isActiveApp?: boolean;
    /** Null for issues that belong to no category (e.g. "Other"). */
    categoryId?: string | null;
    /** Only present when the endpoint embeds them (catalog, or ?includeSymptoms=true). */
    symptoms?: VehicleIssueSymptom[];
    translations?: VehicleIssueTranslation[];
}

/**
 * A category grouping vehicle issues (first level). Has no price — it is purely
 * a visual grouping. `id: null` is the synthetic trailing group the catalog
 * endpoint uses for issues with no category.
 */
export interface VehicleIssueCategory {
    id: string | null;
    name: string;
    /** Free-form icon key (e.g. "bolt", "tire") — no fixed catalog, may be unknown to the client. */
    icon?: string | null;
    sortOrder?: number | null;
    issues: VehicleIssue[];
    translations?: VehicleIssueTranslation[];
}

/**
 * A translation row of the assistance type catalog. Unlike VehicleIssueTranslation
 * it carries no `id` — the endpoint only projects what the client renders.
 */
export interface AssistanceTypeTranslation {
    languageId: number;
    name: string;
    description?: string | null;
}

/**
 * An assistance type from GET /api/assistance-types (appointments-service).
 *
 * Every display column is nullable: they were added to a table that the web fleet
 * already owned, and the migration deliberately left the existing rows untouched.
 * Until the admin fills them in, the client falls back to its local defaults — so
 * treat `code`, `icon`, `path` and `type` as absent-by-default, not as guaranteed.
 */
export interface AssistanceTypeCatalogItem {
    id: string;
    /** Stable identifier ('immediate', 'towing', ...). Doubles as the `type` param. */
    code: string | null;
    name: string;
    description?: string | null;
    /** Free-form icon key set by the admin — may be unknown to the client. */
    icon?: string | null;
    /** Route the card navigates to. Falls back to the vehicle picker when null. */
    path?: string | null;
    /** UI grouping: 'normal' renders as a gradient card, 'additional' as a plain one. */
    type?: 'normal' | 'additional' | null;
    sortOrder?: number | null;
    isActiveApp?: boolean;
    isActiveWebFleet?: boolean;
    translations?: AssistanceTypeTranslation[];
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
    getVehicleIssueCatalog(): Promise<VehicleIssueCategory[]>;
    getLanguages(): Promise<CatalogLanguage[]>;
    calculatePrice(payload: CalculatePricePayload): Promise<PriceCalculationResult>;
    persistRequestPrice(serviceRequestId: string, payload: PersistRequestPricePayload): Promise<PriceCalculationResult>;
    getRequestIssues(serviceRequestId: string): Promise<VehicleIssueSnapshot[]>;
}
