import { useUser } from '@/context/UserContext';
import { appointmentDAO } from '@/lib/dao/AppointmentDAO';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { AssistanceRequest } from '@/lib/dao/interfaces';
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
    type: 'immediate' | 'scheduled' | 'videocall' | 'witness';
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
}

interface AppointmentsContextType {
    appointments: Appointment[];
    addAppointment: (appointment: Appointment) => Promise<boolean>;
    updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
    cancelAppointment: (id: string, reason: string) => Promise<void>;
    refresh: () => Promise<void>;
    getUpcoming: () => Appointment[];
    getPast: () => Appointment[];
    getAppointmentById: (id: string) => Appointment | undefined;
}

const AppointmentsContext = createContext<AppointmentsContextType | undefined>(undefined);

export function AppointmentsProvider({ children }: { children: ReactNode }) {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
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
        if (!user?.id) return;
        try {
            const filters = user.role === 'mechanic'
                ? { mechanicId: user.id }
                : { userId: user.id };

            const [data, assistanceRequests] = await Promise.all([
                appointmentDAO.getAll(filters),
                assistanceDAO.getAll(user.role === 'user' ? { userId: user.id } : { mechanicId: user.id })
            ]);

            const mappedAssistance: Appointment[] = assistanceRequests
                .filter((req: AssistanceRequest) => !data.some(appt => appt.id === req.id))
                .map((req: AssistanceRequest) => ({
                    id: req.id,
                    type: req.type,
                    assistanceType: req.assistanceType,
                    title: req.title,
                    date: req.date || 'Pending',
                    time: 'Pending',
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
                    locationLng: req.locationLng
                }));

            // Also map updatedAt from appointments table rows
            const mappedData = data.map((appt: any) => ({
                ...appt,
                updatedAt: appt.updatedAt,
            }));

            setAppointments([...mappedAssistance, ...mappedData]);

            // GLOBAL NOTIFICATION LOGIC REMOVED
            // We will handle the alert in the Appointments screen instead.
        } catch (error) {
            console.error('Failed to load appointments', error);
        }
    };

    // Real-time updates via Socket
    useEffect(() => {
        if (lastMessage && lastMessage.type === 'assistance_update') {
            console.log('[AppointmentsContext] Received assistance update, refreshing...');
            loadAppointments();
        }
    }, [lastMessage]);

    // Removed polling interval
    // useEffect(() => { ... }, [user?.id, user?.role]);

    // Effect to trigger alert when an offered request is found in state
    useEffect(() => {
        if (user?.role !== 'user') return;

        const offeredRequest = appointments.find(a => a.status === 'accepted' || (a as any).status === 'offered');
        // Note: appointment status type needs 'offered' too if we map it. 
        // In loadAppointments, we map it.
        // Let's filter specifically for what we want.

        // Actually, mappedAssistance casts status to AppointmentStatus. 
        // We need to update AppointmentStatus type in this file too.
    }, [appointments]);

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

    const getUpcoming = () => {
        return appointments.filter(
            (a) => a.status === 'scheduled' || a.status === 'started' || a.status === 'pending' || a.status === 'accepted' || a.status === 'offered'
        );
    };

    const getPast = () => {
        return appointments.filter((a) => a.status === 'completed' || a.status === 'canceled');
    };

    const getAppointmentById = (id: string) => {
        return appointments.find((a) => a.id === id);
    };

    return (
        <AppointmentsContext.Provider
            value={{
                appointments,
                addAppointment,
                updateAppointment,
                cancelAppointment,
                refresh: loadAppointments,
                getUpcoming,
                getPast,
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
