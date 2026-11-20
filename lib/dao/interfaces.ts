import type { Attachment } from '../media/attachments';

// Mirrors the `code` column of the assistance type catalog (GET /api/assistance-types).
// 'towing' exists in the catalog but has no dedicated handling in the request flow yet:
// the cards that switch on this fall through to their default branch.
export type AssistanceType =
    | 'immediate'
    | 'scheduled'
    | 'videocall'
    | 'witness'
    | 'towing';

/** What a mechanic earns for a job, as 2-decimal strings ("149.00"). */
export interface ProviderBreakdown {
    base: string;
    timeBand?: { dayType: string; multiplier: number | string; amount: string } | null;
    weather?: { type: string; multiplier: number | string; amount: string } | null;
    total: string;
}

/** One charged service in `GET /api/earnings/me`. `platformFee` is fees and taxes together. */
export interface MechanicEarning {
    id: string;
    assistanceRequestId: string;
    grossAmount: string;
    platformFee: string;
    netAmount: string;
    currency: string;
    status: 'pending' | 'ready' | 'settled' | 'void';
    settledAt: string | null;
    createdAt: string;
}

/** All-time totals of `GET /api/earnings/me` (`summary`). Amounts are decimal strings, net of fees. */
export interface EarningsSummary {
    totalEarned: string;
    pendingNet: string;
    pendingCount: number;
    readyNet: string;
    readyCount: number;
    paidOut: string;
    payoutsCount: number;
    currency: string;
}

/** `GET /api/earnings/me`. `summary` ignores the filters; `items` holds at most 200. */
export interface EarningsList {
    owedNet: string;
    owedBackForRefunds: string;
    summary: EarningsSummary;
    items: MechanicEarning[];
}

export interface EarningsFilters {
    status?: MechanicEarning['status'];
    /** YYYY-MM-DD, inclusive. */
    from?: string;
    /** YYYY-MM-DD, exclusive. */
    to?: string;
    sort?: 'newest' | 'oldest';
}

/** One transfer to the mechanic's Stripe account, covering several earnings. */
export interface Payout {
    id: string;
    stripeTransferId: string;
    amount: string;
    currency: string;
    earningsCount: number;
    createdAt: string;
}

export interface PayoutPage {
    items: Payout[];
    total: number;
    page: number;
    limit: number;
}

/** `GET /api/connect/me`: where the mechanic's Stripe payout account stands. */
export interface ConnectStatus {
    connected: boolean;
    detailsSubmitted: boolean;
    payoutsEnabled: boolean;
    /** What decides whether earnings can be paid out. */
    canReceiveTransfers: boolean;
    requirementsDue: string[];
}

/** `POST /api/assistance/summaries`: what a job was, for lists that only hold its id. */
export interface AssistanceSummary {
    id: string;
    assistanceType: string;
    title: string;
    address: string | null;
    createdAt: string;
    isVideoCall: boolean;
}

export interface AssistanceRequest {
    id: string;
    /** Short reference for support, e.g. `AS-4H8TX2`. */
    refCode?: string;
    type: AssistanceType;
    assistanceType?: string;
    title: string;
    car: string;
    address: string;
    notes?: string;
    budget: string;
    distance?: string;
    date?: string;
    /** Video calls only: asked for "now" rather than booked; the server dates it. */
    startNow?: boolean;
    /** Video calls only: the owner's IANA time zone when they booked (e.g. "America/Chicago"), so a technician elsewhere can see both clocks. */
    timezone?: string;
    /** Video calls only: minutes the owner chose (15/30/45). Null/absent on older requests: the default applies. */
    durationMinutes?: number | null;
    userId?: string;
    mechanicId?: string;
    status?: 'pending' | 'accepted' | 'cancelled' | 'canceled' | 'offered';
    locationLat?: number;
    locationLng?: number;
    /**
     * Attachments. New requests carry `{ url, type, note }` objects; older ones
     * a plain array of URLs, and the API may hand back the raw JSON string.
     * Always read it through `parseAttachments` (lib/media/attachments.ts).
     */
    photos?: string[] | Attachment[] | string;
    /** How drivable the vehicle is: 'drivable' | 'unsafe_to_drive' | 'pushable_only'. */
    vehicleCondition?: string;
    /** Scheduled requests only: the catalog services the owner asked for (max 20). */
    services?: RequestedService[];
    /** Scheduled requests: when the offer window closes (ISO). The owner can extend it. */
    offersCloseAt?: string | null;
    vehicleId?: string;
    zip?: string;
    /** Odometer reading when the request was created. Snapshot: `Vehicle.mileage` gets overwritten, this doesn't. */
    mileage?: number;
    /** True when the account holder is the one in the vehicle; the driver fields below are then left empty. */
    driverIsOwner?: boolean;
    driverFirstName?: string;
    driverLastName?: string;
    driverPhone?: string;
    /**
     * Saved card (`PaymentCard.id`) this request is charged to, or `'wallet'`
     * for the prepaid wallet. Null on requests made before the app sent it.
     */
    paymentMethodId?: string | null;
    /** Mechanic's proposed price for this service (set when mechanic makes an offer) */
    price?: string;
    /** Mechanic's estimated arrival time, e.g. "20 min" */
    eta?: string;
    /** Mechanic-only: how the amount they earn is built. Fees and taxes never appear here. */
    providerBreakdown?: ProviderBreakdown | null;
    /** While `offered`: when the offer stops being held (ISO). Then the request goes back to `pending`. */
    offerExpiresAt?: string | null;
    /** The saved vehicle, included by GET /api/assistance/:id. */
    vehicle?: { make?: string | null; model?: string | null; vin?: string | null } | null;
    /** ISO date string of when the request was made; the searching timer counts from it */
    createdAt?: string;
    /** ISO date string of the last update (used e.g. as cancellation date) */
    updatedAt?: string;
    /** Vehicle issues selected for this request (from GET /api/pricing/requests/:id/issues) */
    vehicleIssues?: VehicleIssueSnapshot[];
}

/** The name category of an address. `work` is shown as "Office"; `other` carries the user's text in `label`. */
export type AddressNameType = 'home' | 'work' | 'other';

export interface Address {
    id: string;
    /** Name category; null or absent = the address has no name. */
    type?: AddressNameType | null;
    /** Free-text name, only when `type` is `other` (the backend clears it otherwise). */
    label?: string | null;
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
    /**
     * Which of the account's roles the address belongs to. Null or absent means
     * shared by both — every address saved before an account could hold two
     * roles. Lists show the active role's addresses plus the shared ones.
     */
    role?: AppRole | null;
    /** The address the mechanic receives requests from. At most one per account. */
    isServiceBase?: boolean;
}

/** The two roles a person can hold in the app. */
export type AppRole = 'user' | 'mechanic';

/**
 * Roles the profile's role sheet can add. Towing and locksmith go through the
 * mechanic wizard and are registered on the account, but never become the
 * active role: the app has no screens for them yet.
 */
export type AddableRole = AppRole | 'towing_driver' | 'locksmith_technician';

/**
 * Answer of POST /api/roles/self/add-role and /api/roles/self/active-role.
 *
 * `session` is null when nothing changed (switching to the role that is
 * already active). Otherwise every other session of the account was revoked,
 * because permissions travel inside the token, and this pair replaces the one
 * the app held.
 */
export interface RoleChangeResult {
    userId: string;
    primaryRole: AppRole;
    roles: string[];
    permissions: string[];
    session: { accessToken: string; refreshToken: string; expiresIn: number } | null;
    /** Work left open on the role just left; it did not block the change. */
    openWork?: OpenWork;
}

/** What the role just left still has open (users-service `openWork`). */
export interface OpenWork {
    /** Requests still open as vehicle owner; their notices wait in that role. */
    ownerRequestsOpen: number;
    /** Booked services as mechanic not started yet, soonest first. ISO 8601 `date`. */
    upcomingMechanicJobs: { appointmentId: string; date: string | null }[];
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
 * The `availability` block of `POST`/`PATCH /api/users`. Times are "HH:mm",
 * 24-hour; `schedule`, when present, wins over `selectedDays`.
 */
export interface AvailabilityPayload {
    selectedDays: string[];
    startTime: string;
    endTime: string;
    applySameTime: boolean;
    /** Miles, 1-50. */
    serviceRadius: number;
    schedule?: { day: string; startTime: string; endTime: string }[];
    /** IANA zone the times are in, one for the whole week, e.g. "America/New_York". */
    timezone?: string;
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
 * Identity verification (KYC) state. The document images stay with Didit; the
 * fields below are the slice of its decision the backend keeps.
 */
export interface IdentityVerification {
    verificationId: string;
    sessionId: string;
    status: VerificationStatus;
    declineReason?: string;
    verifiedAt?: string;
    /** status === 'Approved'. Optional: builds predate migration 0007. */
    identityVerified?: boolean;
    /** Name as read from the identity document. */
    verifiedName?: string;
    /** Face-match score, 0-100: the selfie against the document photo. */
    matchScore?: number;
    /**
     * Worst warning Didit raised. Unlike declineReason this can be present on
     * an approved verification — worth surfacing, never a reason to block.
     */
    identityWarning?: string;
}

/** The two legal documents a mechanic files. Mirrors MECHANIC_DOCUMENT_TYPES in users-service. */
export type LegalDocumentType = 'LIABILITY_INSURANCE' | 'BUSINESS_LICENSE';

export type LegalDocumentStatus = 'pending' | 'approved' | 'declined';

/**
 * A mechanic's liability insurance policy or business licence.
 *
 * The file itself lives in media-service; this is the pointer to it plus the
 * review outcome. `status` is absent during signup, where nothing has been
 * reviewed yet.
 */
export interface LegalDocument {
    /** Set once the document exists server-side; absent for a fresh upload during signup. */
    id?: string;
    type: LegalDocumentType;
    fileKey: string;
    fileUrl: string;
    originalName?: string;
    mimeType?: string;
    sizeBytes?: number;
    status?: LegalDocumentStatus;
    declineReason?: string;
    reviewedAt?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface IMechanicDocumentsDAO {
    list(): Promise<LegalDocument[]>;
    upsert(document: LegalDocument): Promise<LegalDocument>;
    remove(documentId: string): Promise<void>;
}

export interface UserData {
    id: string;
    /** Short reference for support, e.g. `US-7K3M9Q`. */
    refCode?: string;
    email: string;
    name: string;
    surname: string;
    phone: string;
    dob: string;
    profileImage?: string;
    /**
     * Primary role. Kept as the narrow union because every screen branches on
     * it — the backend guarantees it stays one of these two for an app user.
     */
    role: 'mechanic' | 'user';
    /**
     * Every role held, when the backend sent them. A person can be both a
     * mechanic and a fleet_manager, which `role` alone cannot express, so this
     * is a plain string[] rather than the union above.
     *
     * Optional because a session cached before roles existed will not have it,
     * and because the app itself only ever needs `role`.
     */
    roles?: string[];
    /** Permission codes those roles grant, e.g. 'verification.read.any'. */
    permissions?: string[];
    isOnline?: boolean;
    /** Live status of a mechanic. `isOnline` is derived from it. */
    mechanicStatus?: MechanicStatus;
    addresses?: Address[];
    vehicles?: Vehicle[];
    mechanicDetails?: MechanicDetail;
    mechanicAvailabilities?: MechanicAvailability[];
    identityVerification?: IdentityVerification;
    legalDocuments?: LegalDocument[];
}

export type MechanicStatus = 'available' | 'busy' | 'offline';

/**
 * One entry of the vehicle color catalog (users-service, GET /api/vehicle-colors).
 * `label` is English; the app shows `vehicleColors.<code>` from i18n and falls
 * back to `label` for codes it has no translation for.
 */
export interface VehicleColor {
    id: string;
    code: string;
    label: string;
    hex?: string | null;
    sortOrder?: number | null;
    isActive: boolean;
}

/**
 * A card saved by the signed-in customer (billing-service,
 * /api/payment-methods/me). Only what Stripe reports back — never the number.
 */
export interface PaymentCard {
    id: string;
    type: string;
    brand: string | null;
    last4: string | null;
    expMonth: number | null;
    expYear: number | null;
    label: string | null;
    isDefault: boolean;
    createdAt: string;
}

/** Answer of POST /api/payment-methods/me/setup-intent — confirmed by the card form. */
export interface CardSetupIntent {
    clientSecret: string;
    setupIntentId: string;
    publishableKey: string | null;
}

/** `publishableKey` is null when the backend has no Stripe configured. */
export interface StripeConfig {
    publishableKey: string | null;
}

export interface Vehicle {
    id?: string;
    userId?: string;
    make: string;
    model: string;
    /** Free-text color kept for older records and readers. Sent as the catalog label. */
    color: string;
    /** Catalog color (vehicle_colors.id). Wins over `color` for display. */
    colorId?: string | null;
    /** The catalog entry behind `colorId`, as the API returns it. */
    colorCatalog?: VehicleColor | null;
    plate: string;
    vin: string;
    details: string;
    /** Last known odometer reading. Overwritten on every request that reports a newer one. */
    mileage?: number | null;
    year?: number | null;
    /** 2-letter US state of the plate. The backend defaults it to FL. */
    plateState?: string;
    vehicleTypeId?: string;
    engineTypeId?: string;
    fuelTypeId?: string | null;
    spareTireTypeId?: string;
    /** Standard tire notation, e.g. "225/50R17". */
    frontTires?: string | null;
    rearTires?: string | null;
    insuranceCompany?: string | null;
    /** NAIC code of the insurer, 5 digits. */
    insuranceCompanyCode?: string | null;
    insurancePolicyNumber?: string | null;
    trim?: string | null;
    bodyClass?: string | null;
    transmissionStyle?: string | null;
    driveType?: string | null;
    doors?: number | null;
    displacementL?: number | null;
    engineHp?: number | null;
    engineCylinders?: number | null;
    /** Operational lifecycle. The backend defaults it to `active`. */
    status?: VehicleStatus;
    /** Carries a GPS / telematics tracker. The backend defaults it to true. */
    hasGps?: boolean;
}

/** Operational status of a vehicle (users-service `VEHICLE_STATUSES`). */
export type VehicleStatus = 'active' | 'maintenance' | 'out_of_service' | 'unregistered';

/**
 * An entry of the vehicle type, engine, fuel or spare-tire catalog
 * (users-service, managed from Portal Hub). Same shape for all four.
 */
export interface VehicleCatalogEntry {
    id: string;
    code: string;
    label: string;
    sortOrder?: number | null;
    isActive: boolean;
}

/**
 * What GET /api/vehicles/vin/:vin answers. Values come from NHTSA; null means
 * NHTSA has no data on that field, not that the car lacks it.
 */
export interface VinDecodeResult {
    vin: string;
    found: boolean;
    checkDigitValid: boolean;
    errorCodes: string[];
    warnings: string[];
    make: string | null;
    model: string | null;
    year: number | null;
    trim: string | null;
    series: string | null;
    manufacturer: string | null;
    bodyClass: string | null;
    nhtsaVehicleType: string | null;
    doors: number | null;
    seats: number | null;
    fuelTypePrimary: string | null;
    fuelTypeSecondary: string | null;
    electrificationLevel: string | null;
    engineCylinders: number | null;
    displacementL: number | null;
    engineHP: number | null;
    engineModel: string | null;
    engineConfiguration: string | null;
    turbo: string | null;
    driveType: string | null;
    transmissionStyle: string | null;
    transmissionSpeeds: number | null;
    gvwr: string | null;
    curbWeightLb: number | null;
    plantCountry: string | null;
    plantState: string | null;
    plantCity: string | null;
    suggested: { engineTypeId: string | null; vehicleTypeId: string | null };
    raw: Record<string, string>;
}

/**
 * The decoded values a vehicle is saved with (POST /api/vehicles, or each
 * entry of `vehicles` in POST /api/users). Built from a VinDecodeResult by
 * `toVehicleDecodedFields` in lib/vehicle.ts; only the fields NHTSA filled in.
 */
export interface VehicleDecodedFields {
    year?: number;
    trim?: string;
    bodyClass?: string;
    nhtsaVehicleType?: string;
    manufacturer?: string;
    fuelTypePrimary?: string;
    electrificationLevel?: string;
    engineCylinders?: number;
    displacementL?: number;
    engineHp?: number;
    driveType?: string;
    transmissionStyle?: string;
    doors?: number;
    plantCountry?: string;
    engineTypeId?: string;
    vehicleTypeId?: string;
    vinDecoded?: Record<string, string>;
}

export interface IVehicleDAO {
    decodeVin(vin: string, modelYear?: number): Promise<VinDecodeResult>;
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
    /** Adds a second role to the signed-in account, with the wizard's data. */
    addOwnRole(setupData: Record<string, unknown>): Promise<RoleChangeResult>;
    /** Makes another role the account already holds the active one. */
    switchActiveRole(role: AppRole): Promise<RoleChangeResult>;
    update(id: string, updates: Partial<UserData>): Promise<void>;
    /** Sets a mechanic's live status; returns the status the backend applied. */
    setPresence(id: string, status: MechanicStatus): Promise<{ status: MechanicStatus; isOnline: boolean }>;
}

/** What the owner sees before confirming a mechanic's offer (GET /api/assistance/:id/offer-summary). */
export interface AssistanceOfferSummary {
    requestId: string;
    status: string | null;
    /** When the offer stops being held (ISO), null when there is no running hold. */
    offerExpiresAt: string | null;
    /** Server clock when the answer was built (ISO) — count down against this, not the phone clock. */
    serverNow: string;
    price: string | null;
    eta: string | null;
    mechanic: {
        id: string;
        displayName: string | null;
        initials: string | null;
        profileImage: string | null;
        avgRating: number | null;
        ratingCount: number;
        servicesCount: number;
        aseCertified: boolean;
        idVerified: boolean;
        /** Optional: older backends don't send these. */
        about?: string | null;
        yearsExperience?: string | null;
        /** ISO date the mechanic joined. */
        memberSince?: string | null;
        specialties?: string[];
        aseCodes?: string[];
        /** Verified, current certifications besides ASE (manufacturer, industry, other). Optional: older backends don't send it. */
        certifications?: { name?: string | null; issuer?: string | null }[];
    };
    /** Dollar amounts as strings ("180.00"); null when the request has no stored breakdown. */
    breakdown: { service: string; fees: string; taxes: string; total: string } | null;
}

/** What the assigned mechanic sees about the vehicle owner (GET /api/assistance/:id/client-summary). */
export interface AssistanceClientSummary {
    client: {
        displayName: string | null;
        initials: string | null;
        profileImage: string | null;
        /** Average of the ratings mechanics gave this client; null when nobody has rated them yet. */
        avgRating: number | null;
        ratingCount: number;
        servicesCount: number;
        idVerified: boolean;
        /** ISO date the client joined. */
        memberSince: string | null;
    };
}

export interface IAssistanceDAO {
    getAll(filters?: { userId?: string; mechanicId?: string; status?: string; zip?: string; lat?: number; lng?: number; radiusKm?: number }): Promise<AssistanceRequest[]>;
    getById(id: string): Promise<AssistanceRequest | null>;
    getOfferSummary(id: string): Promise<AssistanceOfferSummary>;
    getClientSummary(id: string): Promise<AssistanceClientSummary>;
    updateStatus(id: string, mechanicId: string, status: string, extra?: { eta?: string; price?: string }): Promise<void>;
    create(request: Partial<AssistanceRequest>): Promise<AssistanceRequest>;
    reject(id: string): Promise<void>;
    setPaymentMethod(id: string, paymentMethodId: string): Promise<void>;
    uploadPhoto(localUri: string): Promise<string>;
    uploadVideo(localUri: string): Promise<string>;
}

/** `GET /api/appointments/stats/me`: the signed-in mechanic's own rating and finished jobs. */
export interface MechanicStats {
    /** Average stars customers gave, one decimal; null when nobody has rated yet. */
    avgRating: number | null;
    ratingCount: number;
    completedCount: number;
}

/**
 * What happened to the hold when the owner cancelled after the mechanic headed
 * out and past the free-cancel window (GET /api/appointments/:id/cancellation-dispute).
 * Amounts are in cents. `open` = staff still have to decide; `resolved` = staff
 * captured `capturedAmount` (0 = released); `auto_captured` = the visit fee was
 * captured before the hold expired.
 */
export interface CancellationDispute {
    status: 'open' | 'resolved' | 'auto_captured';
    heldAmount: number;
    capturedAmount: number | null;
    currency: string;
    resolvedAt: string | null;
}

export interface IAppointmentDAO {
    getAll(filters?: { userId?: string; mechanicId?: string }): Promise<any[]>;
    getMyStats(): Promise<MechanicStats>;
    create(appointment: any): Promise<any>;
    update(id: string, updates: any): Promise<void>;
    getCancellationDispute(id: string): Promise<CancellationDispute | null>;
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
    /** Required except for a video call, which is a flat fee. */
    vehicle_issue_id?: string;
    /** Required except for a video call (remote: no location). */
    latitude?: number;
    longitude?: number;
    /** "videocall" prices the flat video-call fee: no issue, location or tax. */
    assistance_type?: string;
    zipcode?: string;
    add_on_ids?: string[];
    /**
     * ISO instant (with a time of day) the service is priced for. The backend
     * resolves the night/weekend/holiday surcharge in the timezone of
     * latitude/longitude at this instant. Omit to price for right now.
     */
    service_at?: string;
    /** IANA zone of the phone; prices a video call (no location) in its local time band. */
    timezone?: string;
    /** Video call: the length the owner chose; it picks the base price (15/30/45 → 60/70/80). */
    duration_minutes?: number;
}

/** Body for POST /api/pricing/requests/:serviceRequestId/price. */
export interface PersistRequestPricePayload {
    vehicle_issue_ids: string[];
    /** Selected symptom UUIDs, from any of vehicle_issue_ids. Unpriced; stored for the mechanic. */
    vehicle_issue_symptom_ids?: string[];
    /** Required except for a video call (remote: no location). */
    latitude?: number;
    longitude?: number;
    /** "videocall" persists the flat video-call fee. */
    assistance_type?: string;
    zipcode?: string;
    /** See CalculatePricePayload.service_at. Defaults to the request's own date. */
    service_at?: string;
    /** IANA zone of the phone; prices a video call (no location) in its local time band. */
    timezone?: string;
    /** Video call: the length the owner chose. Same value as the quote. */
    duration_minutes?: number;
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

/** A service of the scheduled-services catalog (pricing-service `service_catalog`). */
export interface ScheduledServiceItem {
    id: string;
    /** Stable identifier: what the request sends. Never changes when the name does. */
    code: string;
    categoryId?: string | null;
    /** English name; `translations` holds the other languages. */
    name: string;
    details?: string | null;
    /** A hint to show, never the price charged (scheduled services are quoted by offers). */
    estimatedPrice?: string | null;
    /** Where it can be done: `shop` and/or `home`. Informational for now. */
    availableModes?: string[];
    sortOrder?: number | null;
    translations?: { languageId: number; name: string; details?: string | null }[];
}

/** A category of the scheduled-services catalog, with its services nested. */
export interface ScheduledServiceCategory {
    id: string;
    code: string;
    name: string;
    icon?: string | null;
    sortOrder?: number | null;
    translations?: { languageId: number; name: string }[];
    services: ScheduledServiceItem[];
}

/** One service the owner asks to have done in a scheduled request. */
export interface RequestedService {
    code: string;
    /** 1 to 10; the backend defaults it to 1. */
    quantity?: number;
}

/** What the owner pays for an offer, as the backend calculated it. Amounts are decimal strings. */
export interface OfferCustomerTotal {
    /** `price`: the total is over the final price; `diagnostic_fee`: over the diagnostic fee only. */
    basis: 'price' | 'diagnostic_fee';
    /** The total to pay. Exactly this goes back as `expectedTotal` when the offer is selected. */
    amount: string;
    /** The provider's own price (what the provider is paid). */
    baseAmount: string;
    fees: string;
    taxes: string;
    state?: string | null;
    county?: string | null;
}

/** An offer a provider sent to a scheduled request (`GET /assistance/:id/offers`). */
export interface MarketplaceOffer {
    id: string;
    /** `submitted` is the only one that can be selected; the others must be tolerated when listing. */
    status: 'submitted' | 'accepted' | 'not_selected' | 'withdrawn' | 'expired' | (string & {});
    quoteType: 'final' | 'diagnostic_then_quote';
    price?: string | null;
    diagnosticFee?: string | null;
    description?: string | null;
    parts?: { name: string; quantity?: number | null; price?: string | null }[] | null;
    proposedStart?: string | null;
    proposedEnd?: string | null;
    warrantyDays?: number | null;
    warrantyCoverage?: string | null;
    validUntil?: string | null;
    createdAt?: string | null;
    /** Straight-line miles from the provider's base to the service place, when the backend sends it. */
    distanceMiles?: number | null;
    /** Null when it could not be calculated: that offer cannot be accepted. */
    customerTotal: OfferCustomerTotal | null;
}

/**
 * A scheduled request as a provider sees it (`GET /marketplace/requests`): the reduced view.
 * Never carries the customer, the exact address, the plate or any price.
 */
export interface MarketplaceRequest {
    id: string;
    assistanceType?: string | null;
    title?: string | null;
    notes?: string | null;
    /** The service day / start the owner asked for (ISO). */
    date?: string | null;
    zip?: string | null;
    /** Coordinates rounded to ~1 km. */
    approximateLocation?: { lat?: number; lng?: number; latitude?: number; longitude?: number } | null;
    distanceMiles?: number | null;
    vehicle?: { make?: string | null; model?: string | null; year?: number | string | null; vin?: string | null; mileage?: number | null; condition?: string | null } | null;
    services?: { name: string; quantity?: number | null }[] | null;
    photos?: unknown;
    /** When the offer window closes (ISO). */
    offersCloseAt?: string | null;
    /** The provider's own quote, when it already sent one. */
    myOffer?: Partial<MarketplaceOffer> | null;
}

/** What a provider sends to quote a scheduled request (`POST /assistance/:id/offers`). */
export interface OfferInput {
    quoteType: 'final' | 'diagnostic_then_quote';
    /** `"150.00"`. Required on `final`. */
    price?: string;
    /** Required on `diagnostic_then_quote`, forbidden on `final`. */
    diagnosticFee?: string;
    /** At least 10 characters. */
    description: string;
    parts?: { name: string; quantity?: number; price?: string }[];
    proposedStart?: string;
    proposedEnd?: string;
    warrantyDays?: number;
    warrantyCoverage?: string;
}

/** The provider's proposed final price for a service taken with a diagnostic (`GET /assistance/:id/final-quote`). */
export interface FinalQuote {
    id: string;
    /** `pending` is the only one that can be decided. */
    status: 'pending' | 'approved' | 'rejected' | 'expired' | 'replaced' | 'withdrawn' | (string & {});
    price?: string | null;
    description?: string | null;
    parts?: { name: string; quantity?: number | null; price?: string | null }[] | null;
    warrantyDays?: number | null;
    warrantyCoverage?: string | null;
    /** The proposal stays open 48 h. */
    expiresAt?: string | null;
    createdAt?: string | null;
}

export interface FinalQuoteView {
    quote: FinalQuote;
    /** The full total for the whole job, diagnostic included. Goes back as `expectedTotal` on approve. */
    customerTotal: OfferCustomerTotal | null;
    /** Already held for the diagnostic. */
    alreadyHeld?: string | null;
    /** What approving holds on top of `alreadyHeld`. */
    additionalToHold?: string | null;
}

/** The chat of one appointment (chat-service). Its id is the appointment id. */
export interface ChatConversation {
    id: string;
    userId: string;
    mechanicId: string;
    /** `closed` once the appointment is completed or cancelled: read-only. */
    status: 'open' | 'closed';
    canWrite: boolean;
}

export interface ChatMessageDTO {
    id: string;
    conversationId: string;
    senderId: string;
    kind: 'text' | 'image';
    text: string | null;
    /** Signed, short-lived photo link (absolutized by ChatDAO). */
    mediaUrl: string | null;
    clientMessageId: string;
    /** ISO 8601, UTC. */
    createdAt: string;
}

export interface ChatMessagePage {
    /** Newest first. */
    items: ChatMessageDTO[];
    /** Pass as `before` for the next, older page; null at the first message. */
    nextCursor: string | null;
}

export interface SendChatMessagePayload {
    clientMessageId: string;
    kind: 'text' | 'image';
    text?: string;
    /** `key` from `mediaDAO.uploadPhoto(uri, { purpose: 'chat' })`. */
    mediaKey?: string;
}

export interface IChatDAO {
    getConversation(appointmentId: string): Promise<ChatConversation>;
    listMessages(appointmentId: string, before?: string | null): Promise<ChatMessagePage>;
    sendMessage(appointmentId: string, payload: SendChatMessagePayload): Promise<ChatMessageDTO>;
}

export interface IPricingDAO {
    getServiceCategories(): Promise<ScheduledServiceCategory[]>;
    getVehicleIssues(): Promise<VehicleIssue[]>;
    getVehicleIssueCatalog(): Promise<VehicleIssueCategory[]>;
    getLanguages(): Promise<CatalogLanguage[]>;
    calculatePrice(payload: CalculatePricePayload): Promise<PriceCalculationResult>;
    persistRequestPrice(serviceRequestId: string, payload: PersistRequestPricePayload): Promise<PriceCalculationResult>;
    getRequestIssues(serviceRequestId: string): Promise<VehicleIssueSnapshot[]>;
}
