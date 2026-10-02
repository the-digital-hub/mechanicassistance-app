import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import { MechanicStatusProvider, useMechanicStatus } from '../MechanicStatusContext';

let mockLastMessage: any = null;
const mockUpdateUser = jest.fn().mockResolvedValue(undefined);
const mockUser = { id: 'mech-1', mechanicStatus: 'available', isOnline: true };
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
});
