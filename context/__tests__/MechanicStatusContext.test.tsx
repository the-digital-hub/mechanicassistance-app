import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import { MechanicStatusProvider, useMechanicStatus } from '../MechanicStatusContext';

let mockLastMessage: any = null;
const mockUpdateUser = jest.fn().mockResolvedValue(undefined);
const mockUser: { id: string; role?: string; mechanicStatus?: string; isOnline?: boolean } = { id: 'mech-1', mechanicStatus: 'available', isOnline: true };
const mockSetPresence = jest.fn();

jest.mock('@/context/SocketContext', () => ({
  useSocket: () => ({ lastMessage: mockLastMessage }),
}));
jest.mock('@/context/UserContext', () => ({
  useUser: () => ({ user: mockUser, updateUser: mockUpdateUser }),
}));
jest.mock('@/lib/dao/UserDAO', () => ({
  userDAO: { setPresence: (...args: unknown[]) => mockSetPresence(...args) },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MechanicStatusProvider>{children}</MechanicStatusProvider>
);

const echo = (status: string) => ({ type: 'mechanic_status', payload: { status } });

describe('MechanicStatusProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLastMessage = null;
    mockUser.role = undefined;
    mockUser.mechanicStatus = 'available';
    mockUser.isOnline = true;
    mockSetPresence.mockImplementation((_id: string, status: string) =>
      Promise.resolve({ status, isOnline: status !== 'offline' }),
    );
  });

  it('does not re-apply a stale echo when the mechanic picks a new status', async () => {
    const seen: string[] = [];
    const { result, rerender } = renderHook(() => {
      const ctx = useMechanicStatus();
      seen.push(ctx.mechanicStatus);
      return ctx;
    }, { wrapper });

    // First change, then its echo lands and stays as lastMessage.
    await act(async () => { await result.current.setMechanicStatus('busy'); });
    mockLastMessage = echo('busy');
    rerender({});

    seen.length = 0;
    await act(async () => { await result.current.setMechanicStatus('offline'); });

    expect(result.current.mechanicStatus).toBe('offline');
    expect(seen).not.toContain('busy');
  });

  it('applies a status announced by another device', () => {
    const { result, rerender } = renderHook(() => useMechanicStatus(), { wrapper });
    expect(result.current.mechanicStatus).toBe('available');

    mockLastMessage = echo('offline');
    rerender({});

    expect(result.current.mechanicStatus).toBe('offline');
    expect(mockUpdateUser).toHaveBeenCalledWith({ mechanicStatus: 'offline', isOnline: false }, false);
  });

  it('ignores an echo that arrives while its own change is in flight', async () => {
    let resolve!: (v: { status: string; isOnline: boolean }) => void;
    mockSetPresence.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const { result, rerender } = renderHook(() => useMechanicStatus(), { wrapper });

    let pending!: Promise<unknown>;
    act(() => { pending = result.current.setMechanicStatus('offline'); });
    mockLastMessage = echo('busy');
    rerender({});
    expect(result.current.mechanicStatus).toBe('offline');

    await act(async () => { resolve({ status: 'offline', isOnline: false }); await pending; });
    expect(result.current.mechanicStatus).toBe('offline');
  });

  it('shows Available once the full profile arrives after a launch with a slimmer cached one', () => {
    // Cached/login profile without the status: starts Offline.
    mockUser.mechanicStatus = undefined;
    mockUser.isOnline = false;
    const { result, rerender } = renderHook(() => useMechanicStatus(), { wrapper });
    expect(result.current.mechanicStatus).toBe('offline');

    // The refreshed profile (or the one after switching role) says Available.
    mockUser.mechanicStatus = 'available';
    mockUser.isOnline = true;
    rerender({});

    expect(result.current.mechanicStatus).toBe('available');
  });

  it('puts the profile online when switching into the technician role', async () => {
    mockUser.role = 'user';
    mockUser.mechanicStatus = 'offline';
    mockUser.isOnline = false;
    const { result, rerender } = renderHook(() => useMechanicStatus(), { wrapper });
    expect(result.current.mechanicStatus).toBe('offline');

    // The switch: the account now answers as a technician (still offline on the server).
    mockUser.role = 'mechanic';
    await act(async () => { rerender({}); });

    expect(mockSetPresence).toHaveBeenCalledWith('mech-1', 'available');
    expect(result.current.mechanicStatus).toBe('available');
  });

  it('keeps what the technician had picked when the app opens already in that role', async () => {
    mockUser.role = 'mechanic';
    mockUser.mechanicStatus = 'busy';
    const { result, rerender } = renderHook(() => useMechanicStatus(), { wrapper });
    await act(async () => { rerender({}); });

    expect(mockSetPresence).not.toHaveBeenCalled();
    expect(result.current.mechanicStatus).toBe('busy');
  });
});
