import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { ExtensionRequestPanel } from '@/components/video/ExtensionRequestPanel';

// Extra time asked by the owner has to be accepted by the technician: the owner waits, the
// technician sees the minutes and Accept / Decline, never an amount.

const mockGet = jest.fn();
const mockAccept = jest.fn();
const mockDecline = jest.fn();
let mockMessage: { type: string; payload: Record<string, unknown> } | null = null;

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, opts?: { minutes?: number }) => (opts?.minutes != null ? `${key}:${opts.minutes}` : key) }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/context/SocketContext', () => ({ useSocket: () => ({ lastMessage: mockMessage }) }));
jest.mock('@/lib/dao/VideoCallDAO', () => ({
    videoCallDAO: {
        getExtensions: (...a: unknown[]) => mockGet(...a),
        acceptExtension: (...a: unknown[]) => mockAccept(...a),
        declineExtension: (...a: unknown[]) => mockDecline(...a),
    },
}));
jest.mock('@/components/ui/useMessageDialog', () => ({
    useMessageDialog: () => ({ notify: jest.fn(() => Promise.resolve()), dialog: null }),
}));

const pending = () => ({
    pendingRequest: { extensionId: 'ext-1', minutes: 15, expiresAt: new Date(Date.now() + 60_000).toISOString(), requestedAt: new Date().toISOString() },
});

describe('ExtensionRequestPanel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockMessage = null;
        mockAccept.mockResolvedValue({});
        mockDecline.mockResolvedValue({});
    });

    it('shows the owner that the technician has to answer', async () => {
        mockGet.mockResolvedValue(pending());
        const { findByText, queryByTestId } = render(<ExtensionRequestPanel appointmentId="apt-1" isOwner />);
        expect(await findByText('videoCall.extend.waitingOwner')).toBeTruthy();
        expect(queryByTestId('extension-accept')).toBeNull();
    });

    it('shows nothing when no request is pending', async () => {
        mockGet.mockResolvedValue({ pendingRequest: null });
        const { queryByTestId } = render(<ExtensionRequestPanel appointmentId="apt-1" isOwner={false} />);
        await act(async () => {});
        expect(queryByTestId('extension-request-panel')).toBeNull();
    });

    it('lets the technician accept', async () => {
        mockGet.mockResolvedValue(pending());
        const { findByTestId } = render(<ExtensionRequestPanel appointmentId="apt-1" isOwner={false} />);
        fireEvent.press(await findByTestId('extension-accept'));
        await waitFor(() => expect(mockAccept).toHaveBeenCalledWith('apt-1', 'ext-1'));
    });

    it('lets the technician decline', async () => {
        mockGet.mockResolvedValue(pending());
        const { findByTestId } = render(<ExtensionRequestPanel appointmentId="apt-1" isOwner={false} />);
        fireEvent.press(await findByTestId('extension-decline'));
        await waitFor(() => expect(mockDecline).toHaveBeenCalledWith('apt-1', 'ext-1'));
    });
});
