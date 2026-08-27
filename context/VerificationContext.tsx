import { useSocket } from '@/context/SocketContext';
import { useUser } from '@/context/UserContext';
import { VerificationStatus } from '@/lib/dao/interfaces';
import { verificationDAO } from '@/lib/dao/VerificationDAO';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

interface VerificationContextType {
    /** Null until the first fetch resolves, or when the user never started one. */
    status: VerificationStatus | null;
    declineReason?: string;
    /** True while the first fetch for the current user is still in flight. */
    isLoading: boolean;
    /**
     * False until the first fetch for the current user has resolved.
     *
     * Read this before acting on `status`. Without it, "I have not asked yet"
     * looks exactly like "asked, and there is no verification" — both are
     * `status === null` — which made the app flip between the dashboard and the
     * blocking screen across identical launches.
     */
    hasLoaded: boolean;
    /** Approved is the only status the gated actions are allowed under. */
    isApproved: boolean;
    refresh: () => Promise<void>;
}

const VerificationContext = createContext<VerificationContextType | undefined>(undefined);

/**
 * Tracks identity verification (KYC) state for the logged-in user.
 *
 * Verification gates one action, not the whole app, and only for mechanics: an
 * unverified mechanic cannot offer on a request (enforced in
 * appointments-service). For users it is optional — an unverified user requests
 * assistance normally. This context feeds the mechanic profile badge and the
 * verification screen.
 *
 * Three things keep it fresh, fastest first:
 *   1. the `verification_update` socket event, published when a Didit webhook
 *      changes the status — this is what unblocks the app without a restart;
 *   2. a refetch when the app returns to the foreground, covering events that
 *      landed while it was closed;
 *   3. the socket_connect tick, for events missed while the socket was down
 *      (they are ephemeral, never replayed).
 */
export function VerificationProvider({ children }: { children: ReactNode }) {
    const { user } = useUser();
    const { lastMessage } = useSocket();
    const [status, setStatus] = useState<VerificationStatus | null>(null);
    const [declineReason, setDeclineReason] = useState<string | undefined>();
    const [isLoading, setIsLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    // Guards against a stale response from a previous user overwriting state.
    const currentUserId = useRef<string | undefined>(undefined);

    const refresh = useCallback(async () => {
        const userId = user?.id;
        if (!userId) {
            setStatus(null);
            setDeclineReason(undefined);
            setHasLoaded(true);
            return;
        }
        try {
            const verification = await verificationDAO.getStatus();
            if (currentUserId.current !== userId) return;
            setStatus(verification?.status ?? null);
            setDeclineReason(verification?.declineReason);
            setHasLoaded(true);
        } catch (error) {
            // Keep the last known status: flipping to null on a transient
            // network error would bounce the user to the blocking screen for
            // no reason.
            console.warn('[Verification] Could not refresh status:', error);
        }
    }, [user?.id]);

    // First load per user.
    useEffect(() => {
        currentUserId.current = user?.id;
        if (!user?.id) {
            setStatus(null);
            setDeclineReason(undefined);
            setIsLoading(false);
            setHasLoaded(true);
            return;
        }
        // Reset per user: a status carried over from the previous account would
        // be read as authoritative for this one.
        setHasLoaded(false);
        setIsLoading(true);
        refresh().finally(() => setIsLoading(false));
    }, [user?.id, refresh]);

    // Webhook-driven updates, plus a refetch on reconnect for missed events.
    useEffect(() => {
        if (!lastMessage) return;
        if (lastMessage.type === 'verification_update') {
            const payload = lastMessage.payload as
                | { status?: VerificationStatus; declineReason?: string }
                | undefined;
            if (payload?.status) {
                setStatus(payload.status);
                setDeclineReason(payload.declineReason);
                return;
            }
        }
        if (lastMessage.type === 'socket_connect') {
            void refresh();
        }
    }, [lastMessage, refresh]);

    // Foreground refetch — the app may have been closed when the webhook landed.
    useEffect(() => {
        const handleAppState = (next: AppStateStatus) => {
            if (next === 'active') void refresh();
        };
        const sub = AppState.addEventListener('change', handleAppState);
        return () => sub.remove();
    }, [refresh]);

    return (
        <VerificationContext.Provider
            value={{
                status,
                declineReason,
                isLoading,
                hasLoaded,
                isApproved: status === 'Approved',
                refresh,
            }}
        >
            {children}
        </VerificationContext.Provider>
    );
}

export function useVerification() {
    const context = useContext(VerificationContext);
    if (!context) {
        throw new Error('useVerification must be used within a VerificationProvider');
    }
    return context;
}
