import { useSocket } from '@/context/SocketContext';
import { useUser } from '@/context/UserContext';
import { userDAO } from '@/lib/dao/UserDAO';
import type { MechanicStatus } from '@/lib/dao/interfaces';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type { MechanicStatus };

interface MechanicStatusContextType {
  mechanicStatus: MechanicStatus;
  /** Persists the choice. Resolves to the status the backend actually applied. */
  setMechanicStatus: (status: MechanicStatus) => Promise<MechanicStatus>;
  /** True while a change is in flight, so callers can disable the control. */
  isUpdatingStatus: boolean;
}

const MechanicStatusContext = createContext<MechanicStatusContextType | undefined>(undefined);

export function MechanicStatusProvider({ children }: { children: React.ReactNode }) {
  const { user, updateUser } = useUser();
  const { lastMessage } = useSocket();
  const [mechanicStatus, setStatus] = useState<MechanicStatus>('offline');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Seed from the account. This used to be a bare useState('available'), which
  // meant every app launch claimed the mechanic was available regardless of
  // what they had picked.
  const seededFor = useRef<string | null>(null);
  // Keyed on the fields actually read, not the whole `user` object, so this
  // stops re-running on every unrelated profile update.
  const userId = user?.id ?? null;
  const seedStatus: MechanicStatus =
    user?.mechanicStatus ?? (user?.isOnline ? 'available' : 'offline');
  useEffect(() => {
    if (!userId) {
      seededFor.current = null;
      setStatus('offline');
      return;
    }
    if (seededFor.current === userId) return;
    seededFor.current = userId;
    setStatus(seedStatus);
  }, [userId, seedStatus]);

  // Read through refs so neither the socket effect nor setMechanicStatus has to
  // depend on the status itself.
  const statusRef = useRef(mechanicStatus);
  statusRef.current = mechanicStatus;
  const inFlightRef = useRef(false);
  const handledMessageRef = useRef<unknown>(null);

  // Another of the mechanic's devices changing the status is announced on this
  // socket event.
  useEffect(() => {
    // Each message is handled once. `lastMessage` keeps holding the previous
    // echo, so re-running on a status change used to re-apply that stale value
    // over the one just picked — the pill bounced back and forth on every tap.
    if (lastMessage === handledMessageRef.current) return;
    handledMessageRef.current = lastMessage;
    if (lastMessage?.type !== 'mechanic_status') return;
    const next = lastMessage.payload?.status as MechanicStatus | undefined;
    if (!next) return;
    // While our own change is in flight its HTTP answer is authoritative; an
    // echo arriving now may belong to an earlier tap.
    if (inFlightRef.current) return;
    // The backend re-announces the status we already hold all the time. Writing
    // it back anyway re-rendered UserProvider, which re-ran this very effect —
    // the "Maximum update depth exceeded" loop.
    if (next === statusRef.current) return;
    setStatus(next);
    void updateUser({ mechanicStatus: next, isOnline: next !== 'offline' }, false);
  }, [lastMessage, updateUser]);

  const setMechanicStatus = useCallback(async (status: MechanicStatus): Promise<MechanicStatus> => {
    if (!user) return statusRef.current;

    const previous = statusRef.current;
    setStatus(status); // optimistic: the pill should react to the tap at once
    inFlightRef.current = true;
    setIsUpdatingStatus(true);
    try {
      // The backend applies the choice as sent; its answer is still what we
      // store, so every device agrees on one value.
      const applied = await userDAO.setPresence(user.id, status);
      setStatus(applied.status);
      await updateUser(
        { mechanicStatus: applied.status, isOnline: applied.isOnline },
        false,
      );
      return applied.status;
    } catch (error) {
      setStatus(previous);
      throw error;
    } finally {
      inFlightRef.current = false;
      setIsUpdatingStatus(false);
    }
  }, [user, updateUser]);

  const value = useMemo(
    () => ({ mechanicStatus, setMechanicStatus, isUpdatingStatus }),
    [mechanicStatus, setMechanicStatus, isUpdatingStatus],
  );

  return (
    <MechanicStatusContext.Provider value={value}>
      {children}
    </MechanicStatusContext.Provider>
  );
}

export function useMechanicStatus() {
  const context = useContext(MechanicStatusContext);
  if (!context) {
    throw new Error('useMechanicStatus must be used within a MechanicStatusProvider');
  }
  return context;
}
