import { useUser } from '@/context/UserContext';
import { appointmentDAO } from '@/lib/dao/AppointmentDAO';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { pricingDAO } from '@/lib/dao/PricingDAO';
import { AssistanceRequest, AssistanceType, VehicleIssueSnapshot } from '@/lib/dao/interfaces';
import { ConfigService } from '@/lib/config/ConfigService';
import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { useSocket } from './SocketContext';

export type AppointmentStatus = 'scheduled' | 'canceled' | 'started' | 'completed' | 'pending' | 'accepted' | 'offered';

export interface AdditionalFunds {
    amount: string;
    type: string;
    details: string;
    status: 'pending' | 'approved' | 'rejected';
    timestamp?: string;
}

export interface ClientReview {
    rating: number;
    review?: string;
    experienceTags?: string[];
}

export interface Appointment {
    id: string;
    // Same union as AssistanceRequest.type — it is the catalog's `code`, not a
    // separate vocabulary.
    type: AssistanceType;
    assistanceType?: string;
    title: string;
    date: string;
    time: string;
    car: string;
    address: string;
    notes?: string;
    budget: string;
    status: AppointmentStatus;
    cancelReason?: string;
    acceptedAt?: string;
    startedAt?: string;
    completedAt?: string;
    updatedAt?: string;
    additionalFunds?: AdditionalFunds[];
    clientReview?: ClientReview;
    isReviewSubmitted?: boolean;
    isStatusUpdated?: boolean;
    currentStatus?: string;
    userId?: string;
    mechanicId?: string;
    photos?: string[];
    zip?: string;
    locationLat?: number;
    locationLng?: number;
    /** Mechanic's estimated arrival duration, e.g. "12 min" */
    eta?: string;
    /** ISO timestamp of estimated arrival (the arrival hour) */
    etaTime?: string;
    /** Vehicle issues selected for this request (from GET /api/pricing/requests/:id/issues) */
    vehicleIssues?: VehicleIssueSnapshot[];
    /**
     * Which table the row came from. An appointment row is only created once the
     * request is accepted, so `'assistance'` means "still only a request"
     * (pending/offered) and `'appointment'` means "a real appointment".
     */
    source?: 'assistance' | 'appointment';
}

interface AppointmentsContextType {
    appointments: Appointment[];
    isLoading: boolean;
    addAppointment: (appointment: Appointment) => Promise<boolean>;
    updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
    cancelAppointment: (id: string, reason: string) => Promise<void>;
    refresh: () => Promise<void>;
    getUpcoming: () => Appointment[];
    getPendingApproval: () => Appointment[];
    getPast: () => Appointment[];
    getActiveRequests: () => Appointment[];
    getAppointmentById: (id: string) => Appointment | undefined;
}

const AppointmentsContext = createContext<AppointmentsContextType | undefined>(undefined);

export function AppointmentsProvider({ children }: { children: ReactNode }) {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { user } = useUser();
    const { socket, lastMessage } = useSocket();

    // Track requests we've already notified the user about to prevent spamming alerts
    const notifiedRequests = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (user?.id) {
            loadAppointments();
        }
    }, [user?.id]);

    const loadAppointments = async () => {
        if (!user?.id) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const filters = user.role === 'mechanic'
                ? { mechanicId: user.id }
                : { userId: user.id };

            const [data, assistanceRequests] = await Promise.all([
                appointmentDAO.getAll(filters),
                assistanceDAO.getAll(user.role === 'user' ? { userId: user.id } : { mechanicId: user.id })
            ]);

            // Best-effort: vehicle issues live in the pricing service, not on
            // assistance_requests/appointments. A failed fetch for one id must
            // not block the rest of the list from loading.
            const ids = Array.from(new Set([...data.map((a: any) => a.id), ...assistanceRequests.map((r: AssistanceRequest) => r.id)]));
            const issuesEntries = await Promise.all(
                ids.map(async (id): Promise<[string, VehicleIssueSnapshot[]]> => {
                    try {
                        return [id, await pricingDAO.getRequestIssues(id)];
                    } catch (error) {
                        console.warn(`Failed to load vehicle issues for ${id}`, error);
                        return [id, []];
                    }
                })
            );
            const issuesById = new Map(issuesEntries);

            const mappedAssistance: Appointment[] = assistanceRequests
                .filter((req: AssistanceRequest) => !data.some(appt => appt.id === req.id))
                .map((req: AssistanceRequest) => ({
                    id: req.id,
                    type: req.type,
                    assistanceType: req.assistanceType,
                    title: req.title,
                    date: req.date || 'Pending',
                    time: req.eta || 'Pending',
                    car: req.car,
                    address: req.address,
                    notes: req.notes,
                    budget: req.budget,
                    status: (req.status as AppointmentStatus) || 'pending',
                    userId: req.userId,
                    zip: req.zip,
                    mechanicId: req.mechanicId,
                    updatedAt: (req as any).updatedAt,
                    photos: (() => {
                        const raw: string[] = typeof req.photos === 'string' ? JSON.parse(req.photos) : req.photos || [];
                        const base = ConfigService.getApiBaseUrl();
                        return raw.map((p: string) => p.startsWith('http') ? p : `${base}${p}`);
                    })(),
                    locationLat: req.locationLat,
                    locationLng: req.locationLng,
                    vehicleIssues: issuesById.get(req.id) || [],
                    source: 'assistance' as const
                }));

            // Build a lookup of assistance_requests by id so we can back-fill
            // locationLat/locationLng/eta for appointment rows that were created
            // before the self-heal copied those fields.
            const arById = new Map(assistanceRequests.map((r: AssistanceRequest) => [r.id, r]));

            const mappedData = data.map((appt: any) => {
                const ar = arById.get(appt.id);
                return {
                    ...appt,
                    updatedAt: appt.updatedAt,
                    locationLat: appt.locationLat ?? ar?.locationLat,
                    locationLng: appt.locationLng ?? ar?.locationLng,
                    time: appt.time || ar?.eta || 'Pending',
                    vehicleIssues: issuesById.get(appt.id) || [],
                    source: 'appointment' as const,
                };
            });

            setAppointments([...mappedAssistance, ...mappedData]);

            // GLOBAL NOTIFICATION LOGIC REMOVED
            // We will handle the alert in the Appointments screen instead.
        } catch (error) {
            console.error('Failed to load appointments', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Real-time updates via Socket. Reload on any relevant domain event, and
    // also on (re)connect to catch events missed while the socket was down
    // (events are ephemeral / not replayed). No polling.
    // The gateway can fan out several events for the same state change (and the
    // same event more than once). Refetching on every one of them re-rendered
    // every consumer screen non-stop, so identical and back-to-back events are
    // collapsed into a single refresh.
    const lastRefreshKey = useRef<string>('');
    const lastRefreshAt = useRef<number>(0);
    const REFRESH_MIN_INTERVAL_MS = 1000;

    useEffect(() => {
        if (!lastMessage) return;
        if (
            lastMessage.type !== 'assistance_update' &&
            lastMessage.type !== 'appointment_update' &&
            lastMessage.type !== 'socket_connect'
        ) return;

        const payload = lastMessage.payload || {};
        const key = `${lastMessage.type}-${payload.id || payload.requestId || ''}-${payload.status || ''}`;
        const now = Date.now();

        if (key === lastRefreshKey.current && now - lastRefreshAt.current < REFRESH_MIN_INTERVAL_MS) return;

        lastRefreshKey.current = key;
        lastRefreshAt.current = now;
        console.log(`[AppointmentsContext] ${lastMessage.type} -> refreshing`);
        loadAppointments();
    }, [lastMessage]);

    const addAppointment = async (appointment: Appointment): Promise<boolean> => {
        try {
            const newAppt = await appointmentDAO.create(appointment);
            setAppointments((prev) => {
                const filtered = prev.filter(a => a.id !== newAppt.id);
                return [newAppt, ...filtered];
            });
            return true;
        } catch (error: any) {
            console.error('Failed to create appointment', error);
            throw error;
        }
    };

    const updateAppointment = async (id: string, updates: Partial<Appointment>) => {
        try {
            await appointmentDAO.update(id, updates);
            setAppointments((prev) =>
                prev.map((appt) => (appt.id === id ? { ...appt, ...updates } : appt))
            );
        } catch (error) {
            console.error('Failed to update appointment', error);
        }
    };

    const cancelAppointment = async (id: string, reason: string) => {
        try {
            await appointmentDAO.update(id, { status: 'canceled', cancelReason: reason });
            setAppointments((prev) =>
                prev.map((appt) =>
                    appt.id === id ? { ...appt, status: 'canceled', cancelReason: reason } : appt
                )
            );
        } catch (error) {
            console.error('Failed to cancel appointment', error);
        }
    };

    // Only confirmed work belongs here. Anything still waiting for someone's
    // answer (pending/offered) goes to getPendingApproval() instead, so a row
    // never shows up in two tabs at once.
    const getUpcoming = () => {
        return appointments.filter(
            (a) => a.source !== 'assistance' &&
                (a.status === 'scheduled' || a.status === 'started' || a.status === 'accepted')
        );
    };

    /**
     * Requests that are neither confirmed nor closed — they used to be invisible
     * in the Appointments tab because an `offered` row still lives in
     * assistance_requests (the appointment is only created once the user
     * accepts). Mechanics see the offers they are waiting on; users also see
     * requests still looking for a mechanic.
     */
    const getPendingApproval = () => {
        const statuses: AppointmentStatus[] =
            user?.role === 'mechanic' ? ['offered'] : ['pending', 'offered'];
        return appointments
            .filter((a) => statuses.includes(a.status))
            .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    };

    const getPast = () => {
        return appointments.filter((a) => a.status === 'completed' || a.status === 'canceled');
    };

    /**
     * Everything the user currently has in flight: from "looking for a mechanic"
     * all the way to a job in progress. Single source of truth for the
     * dashboard's "active request" section.
     */
    const getActiveRequests = () => {
        const ACTIVE: AppointmentStatus[] = ['pending', 'offered', 'accepted', 'started'];
        return appointments
            .filter((a) => ACTIVE.includes(a.status))
            .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    };

    const getAppointmentById = (id: string) => {
        return appointments.find((a) => a.id === id);
    };

    return (
        <AppointmentsContext.Provider
            value={{
                appointments,
                isLoading,
                addAppointment,
                updateAppointment,
                cancelAppointment,
                refresh: loadAppointments,
                getUpcoming,
                getPendingApproval,
                getPast,
                getActiveRequests,
                getAppointmentById
            }}
        >
            {children}
        </AppointmentsContext.Provider>
    );
}

export function useAppointments() {
    const context = useContext(AppointmentsContext);
    if (context === undefined) {
        throw new Error('useAppointments must be used within an AppointmentsProvider');
    }
    return context;
}
