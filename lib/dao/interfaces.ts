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
    description?: string;
    zip?: string;
    /** Mechanic's proposed price for this service (set when mechanic makes an offer) */
    price?: string;
    /** Mechanic's estimated arrival time, e.g. "20 min" */
    eta?: string;
    /** ISO date string of the last update (used e.g. as cancellation date) */
    updatedAt?: string;
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
    aseMembership?: string;
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
    getAll(filters?: { userId?: string; mechanicId?: string; status?: string; zip?: string }): Promise<AssistanceRequest[]>;
    getById(id: string): Promise<AssistanceRequest | null>;
    updateStatus(id: string, mechanicId: string, status: string): Promise<void>;
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
