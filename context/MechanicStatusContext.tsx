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

  // The backend also changes the status on its own — a job starting, another
  // device toggling it — and announces it on this socket event.
  useEffect(() => {
    if (lastMessage?.type !== 'mechanic_status') return;
    const next = lastMessage.payload?.status as MechanicStatus | undefined;
    if (!next) return;
    // The backend re-announces the status we already hold all the time. Writing
    // it back anyway re-rendered UserProvider, which re-ran this very effect —
    // the "Maximum update depth exceeded" loop.
    if (next === mechanicStatus) return;
    setStatus(next);
    void updateUser({ mechanicStatus: next, isOnline: next !== 'offline' }, false);
  }, [lastMessage, mechanicStatus, updateUser]);

  const setMechanicStatus = useCallback(async (status: MechanicStatus): Promise<MechanicStatus> => {
    if (!user) return mechanicStatus;

    const previous = mechanicStatus;
    setStatus(status); // optimistic: the pill should react to the tap at once
    setIsUpdatingStatus(true);
    try {
      // The backend has the last word: with no live socket the mechanic stays
      // offline, and an active job keeps them busy.
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
      setIsUpdatingStatus(false);
    }
  }, [user, mechanicStatus, updateUser]);

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
