import { useUser } from '@/context/UserContext';
import { appointmentDAO } from '@/lib/dao/AppointmentDAO';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { pricingDAO } from '@/lib/dao/PricingDAO';
import { AssistanceRequest, AssistanceType, VehicleIssueSnapshot } from '@/lib/dao/interfaces';
import { Attachment, parseAttachments } from '@/lib/media/attachments';
import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { useSocket } from './SocketContext';

// 'in_progress' = the mechanic checked in at the vehicle (appointments-service on-site flow).
// 'awaiting_confirmation' / 'disputed' = video calls only: the mechanic finished it and the
// owner has to confirm it, or reported it as not resolved and support decides. Both are active.
export type AppointmentStatus =
    | 'scheduled'
    // The backend stores 'cancelled'; older rows and events still say 'canceled'.
    | 'cancelled'
    | 'canceled'
    | 'started'
    | 'in_progress'
    | 'completed'
    | 'pending'
    | 'accepted'
    | 'offered'
    | 'awaiting_confirmation'
    | 'disputed';

/** True for either spelling of a cancelled status. */
export function isCancelledStatus(status?: string | null): boolean {
    return status === 'cancelled' || status === 'canceled';
}

/** Confirmed work that is not over yet — shown as active, never as past. */
export const IN_FLIGHT_STATUSES: AppointmentStatus[] = ['scheduled', 'accepted', 'started', 'in_progress', 'awaiting_confirmation', 'disputed'];

/** "$70.00" for a priced video call; null for anything else or while it has no price. */
function videoCallBudget(req: AssistanceRequest, forMechanic: boolean): string | null {
    if (req.type !== 'videocall' && req.assistanceType !== 'videocall') return null;
    const amount = Number((forMechanic ? req.providerBreakdown?.total : null) ?? req.price);
    return Number.isFinite(amount) && amount > 0 ? `$${amount.toFixed(2)}` : null;
}

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
    /** Video calls: minutes the owner chose; absent on older requests. */
    durationMinutes?: number | null;
    status: AppointmentStatus;
    /** Video calls only: asked for "now" rather than booked (then `date` is only its creation time). */
    startNow?: boolean;
    timezone?: string;
    cancelReason?: string;
    acceptedAt?: string;
    startedAt?: string;
    completedAt?: string;
    /** When it was cancelled (ISO); absent on older rows, which fall back to `updatedAt`. */
    cancelledAt?: string | null;
    /** When the mechanic tapped "Head out" (ISO). Until then the owner sees no live map. */
    departedAt?: string | null;
    /**
     * Until when (ISO) the owner can still cancel for free once the mechanic has
     * headed out (`departedAt` + grace). Null before they head out. After it, a
     * cancellation keeps the hold and opens a cancellation dispute.
     */
    freeCancelUntil?: string | null;
    updatedAt?: string;
    /** When the request was made (ISO); the searching timer counts from it. */
    createdAt?: string;
    additionalFunds?: AdditionalFunds[];
    clientReview?: ClientReview;
    isReviewSubmitted?: boolean;
    /** Short reference for support, e.g. `AS-4H8TX2` (the request's; a booking made without one has none). */
    refCode?: string;
    /** While `offered`: when the hold on the mechanic's offer ends (ISO); the owner has until then to confirm. */
    offerExpiresAt?: string | null;
    /** A scheduled request: when the window to receive offers ends (ISO). */
    offersCloseAt?: string | null;
    /** Stars (1–5) the customer gave the mechanic for this job; null until reviewed. List rows only. */
    reviewRating?: number | null;
    /** Stars (1–5) the mechanic gave the customer for this job; null until rated. List rows only. */
    clientRating?: number | null;
    /** Video calls: the call has a transcript on the server. Absent on an older backend. */
    hasTranscript?: boolean;
    transcriptLines?: number;
    /** Video calls: minutes bought on top of the chosen length (`contractedMinutes - baseMinutes`). Absent on an older backend. */
    extendedMinutes?: number;
    isStatusUpdated?: boolean;
    currentStatus?: string;
    userId?: string;
    /** The saved vehicle the request was made for (the owner's cards look up its plate and VIN). */
    vehicleId?: string;
    mechanicId?: string;
    /** Legacy rows hold plain URL strings; current ones hold attachment objects. */
    photos?: string[] | Attachment[];
    zip?: string;
    locationLat?: number;
    locationLng?: number;
    /** Mechanic's estimated arrival duration, e.g. "12 min" */
    eta?: string;
    /** ISO timestamp of estimated arrival (the arrival hour) */
    etaTime?: string;
    /** Vehicle issues selected for this request (from GET /api/pricing/requests/:id/issues) */
    vehicleIssues?: VehicleIssueSnapshot[];
    /** How drivable the vehicle is: 'drivable' | 'unsafe_to_drive' | 'pushable_only'. */
    vehicleCondition?: string | null;
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
    /**
     * Puts a request the mechanic just made an offer on into the list as `offered`, right away.
     * The full reload takes a few round trips; this keeps Pending from looking empty meanwhile,
     * and the reload then replaces the row with the server's.
     */
    markOffered: (row: Appointment) => void;
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

    // Several reloads can overlap (socket events, focus, pull-to-refresh) and their
    // responses can come back out of order: an older, slower one landing last would
    // overwrite the list with a stale (or partial) snapshot — an appointment would
    // "disappear". Only the latest call is allowed to write.
    const loadSeq = useRef(0);

    const loadAppointments = async () => {
        const seq = ++loadSeq.current;
        const isLatest = () => seq === loadSeq.current;
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
                    refCode: req.refCode,
                    type: req.type,
                    assistanceType: req.assistanceType,
                    title: req.title,
                    date: req.date || 'Pending',
                    time: req.eta || 'Pending',
                    car: req.car,
                    address: req.address,
                    notes: req.notes,
                    // A video call is priced when it is requested (nobody quotes it): the owner sees
                    // that price, the technician what they would earn (else the same price).
                    budget: videoCallBudget(req, user?.role === 'mechanic') ?? req.budget,
                    durationMinutes: req.durationMinutes ?? null,
                    status: (req.status as AppointmentStatus) || 'pending',
                    startNow: req.startNow,
                    timezone: req.timezone,
                    userId: req.userId,
                    vehicleId: req.vehicleId,
                    zip: req.zip,
                    mechanicId: req.mechanicId,
                    updatedAt: (req as any).updatedAt,
                    createdAt: req.createdAt,
                    offerExpiresAt: req.status === 'offered' ? req.offerExpiresAt ?? null : null,
                    offersCloseAt: req.offersCloseAt ?? null,
                    // `photos` holds `{url,type,note}` objects now, and plain URL
                    // strings on older rows. `parseAttachments` is the one reader
                    // that handles both; hand-rolling it here crashed with
                    // "p.startsWith is not a function" on the new shape.
                    // Left relative on purpose — AttachmentStrip absolutizes.
                    photos: parseAttachments(req.photos),
                    locationLat: req.locationLat,
                    locationLng: req.locationLng,
                    vehicleIssues: issuesById.get(req.id) || [],
                    vehicleCondition: req.vehicleCondition ?? null,
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
                    refCode: appt.refCode ?? ar?.refCode,
                    // The appointment row can come without its title: the request has it.
                    title: appt.title || ar?.title || appt.title,
                    vehicleId: appt.vehicleId ?? ar?.vehicleId,
                    assistanceType: appt.assistanceType ?? ar?.assistanceType,
                    updatedAt: appt.updatedAt,
                    locationLat: appt.locationLat ?? ar?.locationLat,
                    locationLng: appt.locationLng ?? ar?.locationLng,
                    time: appt.time || ar?.eta || 'Pending',
                    // A video call's slot (or its "now") lives on the request; the
                    // appointment row may not carry it.
                    ...((appt.assistanceType ?? appt.type) === 'videocall'
                        ? { date: appt.date || ar?.date, startNow: appt.startNow ?? ar?.startNow, timezone: (appt as { timezone?: string }).timezone ?? ar?.timezone }
                        : {}),
                    // A scheduled service is booked for a day: the appointment row may not carry it.
                    ...((appt.assistanceType ?? appt.type) === 'scheduled' && !appt.date && ar?.date
                        ? { date: ar.date }
                        : {}),
                    // The photos and clips the owner attached to the request belong to the job: the appointment row does not carry them.
                    photos: parseAttachments(appt.photos ?? ar?.photos),
                    vehicleIssues: issuesById.get(appt.id) || [],
                    vehicleCondition: appt.vehicleCondition ?? ar?.vehicleCondition ?? null,
                    source: 'appointment' as const,
                };
            });

            if (!isLatest()) return;
            setAppointments([...mappedAssistance, ...mappedData]);

            // GLOBAL NOTIFICATION LOGIC REMOVED
            // We will handle the alert in the Appointments screen instead.
        } catch (error) {
            console.error('Failed to load appointments', error);
        } finally {
            if (isLatest()) setIsLoading(false);
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

    const markOffered = (row: Appointment) => {
        setAppointments((prev) => [
            { ...row, status: 'offered', source: 'assistance', updatedAt: new Date().toISOString() },
            ...prev.filter((a) => a.id !== row.id),
        ]);
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
            await appointmentDAO.update(id, { status: 'cancelled', cancelReason: reason });
            setAppointments((prev) =>
                prev.map((appt) =>
                    appt.id === id ? { ...appt, status: 'cancelled', cancelReason: reason } : appt
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
                IN_FLIGHT_STATUSES.includes(a.status)
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
        return appointments.filter((a) => a.status === 'completed' || isCancelledStatus(a.status));
    };

    /**
     * Everything the user currently has in flight: from "looking for a mechanic"
     * all the way to a job in progress. Single source of truth for the
     * dashboard's "active request" section.
     */
    const getActiveRequests = () => {
        const ACTIVE: AppointmentStatus[] = ['pending', 'offered', 'accepted', 'started', 'in_progress', 'awaiting_confirmation', 'disputed'];
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
                markOffered,
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
