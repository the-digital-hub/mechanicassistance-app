import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { useRequestObdVinCheck, useVisitObdVinCheck, vinCheckVariant } from '@/hooks/useRequestObdVinCheck';

import { RequestVinCheckModal } from '../RequestVinCheckModal';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/on-site/MediaSlot', () => ({ MediaSlot: () => null }));
jest.mock('@/components/on-site/ui', () => ({
    OS: { red: 'red', redSoft: 'r', orange: 'o', orangeSoft: 'os', text: 't', muted: 'm', page: 'p', blue: 'b', border: 'bd' },
}));
const mockGet = jest.fn();
jest.mock('@/lib/dao/RequestObdDAO', () => ({ requestObdDAO: { get: (...a: unknown[]) => mockGet(...a), attach: jest.fn() } }));
const mockVisitGet = jest.fn();
jest.mock('@/lib/dao/OnSiteDAO', () => ({ onSiteDAO: { get: (...a: unknown[]) => mockVisitGet(...a) } }));
const mockStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: (k: string) => Promise.resolve(mockStore[k] ?? null),
    setItem: (k: string, v: string) => {
        mockStore[k] = v;
        return Promise.resolve();
    },
}));
let mockLastMessage: unknown = null;
jest.mock('@/context/SocketContext', () => ({ useSocket: () => ({ lastMessage: mockLastMessage }) }));

const K = 'requestAssistance.searching.vinCheck';

describe('vinCheckVariant', () => {
    it('asks about another vehicle, and about a vehicle with no VIN on file', () => {
        expect(vinCheckVariant('5GRGN23818H104280', true)).toBe('mismatch');
        expect(vinCheckVariant('5GRGN23818H104280', null)).toBe('unknown');
    });

    it('asks nothing when no VIN was read or it is the same vehicle', () => {
        expect(vinCheckVariant(null, null)).toBeNull();
        expect(vinCheckVariant(null, true)).toBeNull();
        expect(vinCheckVariant('5GRGN23818H104280', false)).toBeNull();
    });
});

describe('RequestVinCheckModal', () => {
    const props = { requestId: 'req-1', obdVin: '5GRGN23818H104280', vehicleVin: 'WBAJA7C50KWW00001' };

    it('shows the mismatch copy and both VINs', () => {
        const { getByTestId, getByText } = render(
            <RequestVinCheckModal {...props} variant="mismatch" onContinue={jest.fn()} onReplaced={jest.fn()} onCancelRequest={jest.fn()} />,
        );
        expect(getByTestId('vin-check-title').props.children).toBe(`${K}.mismatch.title`);
        expect(getByText('5GRGN23818H104280')).toBeTruthy();
        expect(getByText('WBAJA7C50KWW00001')).toBeTruthy();
    });

    it('shows the unknown copy with a placeholder for the missing vehicle VIN', () => {
        const { getByTestId, getByText } = render(
            <RequestVinCheckModal {...props} vehicleVin="" variant="unknown" onContinue={jest.fn()} onReplaced={jest.fn()} onCancelRequest={jest.fn()} />,
        );
        expect(getByTestId('vin-check-title').props.children).toBe(`${K}.unknown.title`);
        expect(getByText(`${K}.noVin`)).toBeTruthy();
    });

    it('only offers "got it" on an on-site visit', () => {
        const { getByTestId, queryByTestId, getByText } = render(
            <RequestVinCheckModal {...props} variant="mismatch" textKey="appointments.onSite.obd.ownerVinCheck" onContinue={jest.fn()} />,
        );
        expect(getByTestId('vin-check-title').props.children).toBe('appointments.onSite.obd.ownerVinCheck.mismatch.title');
        expect(getByText('appointments.onSite.obd.ownerVinCheck.continue')).toBeTruthy();
        expect(queryByTestId('vin-check-replace')).toBeNull();
        expect(queryByTestId('vin-check-cancel')).toBeNull();
    });

    it('continues, offers another upload, and cancels', () => {
        const onContinue = jest.fn();
        const onCancelRequest = jest.fn();
        const { getByTestId, queryByTestId } = render(
            <RequestVinCheckModal {...props} variant="mismatch" onContinue={onContinue} onReplaced={jest.fn()} onCancelRequest={onCancelRequest} />,
        );
        fireEvent.press(getByTestId('vin-check-continue'));
        expect(onContinue).toHaveBeenCalled();
        fireEvent.press(getByTestId('vin-check-replace'));
        expect(queryByTestId('vin-check-replace')).toBeNull();
        fireEvent.press(getByTestId('vin-check-cancel'));
        expect(onCancelRequest).toHaveBeenCalled();
    });
});

describe('useRequestObdVinCheck', () => {
    let latest: ReturnType<typeof useRequestObdVinCheck>;
    function Probe({ enabled = true }: { enabled?: boolean }) {
        latest = useRequestObdVinCheck('req-1', enabled);
        return null;
    }
    const update = (over: Record<string, unknown>) => ({
        type: 'obd_update',
        payload: { id: 'req-1', scope: 'request', obdStatus: 'ready', obdVin: '5GRGN23818H104280', obdVinMismatch: true, ...over },
    });

    beforeEach(() => {
        mockLastMessage = null;
        mockGet.mockReset().mockRejectedValue(new Error('none'));
    });

    it('opens on a reading for this request', async () => {
        const utils = render(<Probe />);
        mockLastMessage = update({});
        utils.rerender(<Probe />);
        await waitFor(() => expect(latest.check).toEqual({ vin: '5GRGN23818H104280', variant: 'mismatch' }));
    });

    it('ignores another request and on-site readings', () => {
        const utils = render(<Probe />);
        mockLastMessage = update({ id: 'req-2' });
        utils.rerender(<Probe />);
        mockLastMessage = update({ scope: 'visit' });
        utils.rerender(<Probe />);
        expect(latest.check).toBeNull();
    });

    it('picks up a reading that landed before the screen mounted', async () => {
        mockGet.mockResolvedValue({ vin: '5GRGN23818H104280', vinMismatch: null });
        render(<Probe />);
        await waitFor(() => expect(latest.check?.variant).toBe('unknown'));
    });

    it('does not ask twice about the same reading, but does after a replacement', async () => {
        const utils = render(<Probe />);
        mockLastMessage = update({});
        utils.rerender(<Probe />);
        await waitFor(() => expect(latest.check).not.toBeNull());
        act(() => latest.dismiss());
        mockLastMessage = update({});
        utils.rerender(<Probe />);
        expect(latest.check).toBeNull();

        act(() => latest.replaced());
        mockLastMessage = update({});
        utils.rerender(<Probe />);
        await waitFor(() => expect(latest.check).not.toBeNull());
    });

    it('does nothing outside a video call', () => {
        const utils = render(<Probe enabled={false} />);
        mockLastMessage = update({});
        utils.rerender(<Probe enabled={false} />);
        expect(mockGet).not.toHaveBeenCalled();
        expect(latest.check).toBeNull();
    });
});

describe('useVisitObdVinCheck', () => {
    let latest: ReturnType<typeof useVisitObdVinCheck>;
    function Probe({ enabled = true }: { enabled?: boolean }) {
        latest = useVisitObdVinCheck('appt-1', enabled);
        return null;
    }
    const visit = (over: Record<string, unknown> = {}) => ({
        obdVin: '5GRGN23818H104280',
        obdVinMismatch: true,
        vehicleVin: 'WAUZZZ4M1JD000001',
        ...over,
    });

    beforeEach(() => {
        mockLastMessage = null;
        mockVisitGet.mockReset().mockResolvedValue(null);
        for (const k of Object.keys(mockStore)) delete mockStore[k];
    });

    it('tells the owner about a reading that landed before the screen opened', async () => {
        mockVisitGet.mockResolvedValue(visit());
        render(<Probe />);
        await waitFor(() =>
            expect(latest.check).toEqual({ vin: '5GRGN23818H104280', variant: 'mismatch', vehicleVin: 'WAUZZZ4M1JD000001' }),
        );
    });

    it('reloads the visit when the reading arrives by socket', async () => {
        const utils = render(<Probe />);
        await waitFor(() => expect(mockVisitGet).toHaveBeenCalledTimes(1));
        mockVisitGet.mockResolvedValue(visit({ obdVinMismatch: null, vehicleVin: null }));
        mockLastMessage = { type: 'obd_update', payload: { id: 'appt-1', obdStatus: 'ready', obdVin: '5GRGN23818H104280', obdVinMismatch: null } };
        utils.rerender(<Probe />);
        await waitFor(() => expect(latest.check?.variant).toBe('unknown'));
    });

    it('ignores video-call readings and other appointments', async () => {
        const utils = render(<Probe />);
        await waitFor(() => expect(mockVisitGet).toHaveBeenCalledTimes(1));
        mockLastMessage = { type: 'obd_update', payload: { id: 'appt-1', scope: 'request', obdVin: 'X' } };
        utils.rerender(<Probe />);
        mockLastMessage = { type: 'obd_update', payload: { id: 'appt-2', obdVin: 'X' } };
        utils.rerender(<Probe />);
        expect(mockVisitGet).toHaveBeenCalledTimes(1);
    });

    it('does not tell the owner again once they saw it', async () => {
        mockVisitGet.mockResolvedValue(visit());
        const first = render(<Probe />);
        await waitFor(() => expect(latest.check).not.toBeNull());
        act(() => latest.dismiss());
        first.unmount();

        render(<Probe />);
        await waitFor(() => expect(mockVisitGet).toHaveBeenCalledTimes(2));
        await new Promise((r) => setTimeout(r, 0));
        expect(latest.check).toBeNull();
    });

    it('stays quiet when the VIN matches, and for mechanics', async () => {
        mockVisitGet.mockResolvedValue(visit({ obdVinMismatch: false }));
        render(<Probe />);
        await waitFor(() => expect(mockVisitGet).toHaveBeenCalled());
        expect(latest.check).toBeNull();

        mockVisitGet.mockClear();
        render(<Probe enabled={false} />);
        expect(mockVisitGet).not.toHaveBeenCalled();
    });
});
