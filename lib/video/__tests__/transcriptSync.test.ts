const mockLines: { id: string; speaker: 'me' | 'other'; name: string; text: string; at: number; speakerId?: string }[] = [];
const mockPut = jest.fn();

jest.mock('@/lib/video/transcriptStore', () => ({ getLocalTranscript: jest.fn(async () => [...mockLines]) }));
jest.mock('@/lib/dao/VideoCallDAO', () => ({ videoCallDAO: { putTranscript: (...args: unknown[]) => mockPut(...args) } }));

import { syncTranscript } from '../transcriptSync';

describe('sending the transcript', () => {
    beforeEach(() => {
        mockLines.length = 0;
        mockPut.mockReset();
    });

    it('sends nothing for a call that has no lines', async () => {
        expect(await syncTranscript('a0', 'owner', 'en')).toBe('nothing');
        expect(mockPut).not.toHaveBeenCalled();
    });

    it("sends each line with who spoke (Daily's user id) and falls back to the role", async () => {
        mockLines.push(
            { id: '1', speaker: 'me', name: 'Ana', text: 'hello', at: 1000, speakerId: 'u-owner' },
            { id: '2', speaker: 'other', name: 'Leo', text: 'hi', at: 2000 },
        );
        mockPut.mockResolvedValue({ status: 'stored' });
        expect(await syncTranscript('a1', 'owner', 'es')).toBe('stored');
        const body = mockPut.mock.calls[0][1];
        expect(body.language).toBe('es');
        expect(body.lines).toEqual([
            { id: '1', speakerId: 'u-owner', role: 'owner', name: 'Ana', text: 'hello', at: new Date(1000).toISOString() },
            { id: '2', role: 'mechanic', name: 'Leo', text: 'hi', at: new Date(2000).toISOString() },
        ]);
    });

    it('does not send the same lines twice', async () => {
        mockLines.push({ id: '1', speaker: 'me', name: 'Ana', text: 'hello', at: 1 });
        mockPut.mockResolvedValue({ status: 'stored' });
        await syncTranscript('a2', 'mechanic', 'en');
        expect(await syncTranscript('a2', 'mechanic', 'en')).toBe('nothing');
        expect(mockPut).toHaveBeenCalledTimes(1);
    });

    it('keeps the local copy and tries again later when a consent is missing', async () => {
        mockLines.push({ id: '1', speaker: 'me', name: 'Ana', text: 'hello', at: 1 });
        mockPut.mockResolvedValueOnce({ status: 'consent_required', missing: ['captions-answer:owner'] });
        expect(await syncTranscript('a3', 'owner', 'en')).toBe('consent_required');
        mockPut.mockResolvedValueOnce({ status: 'stored' });
        expect(await syncTranscript('a3', 'owner', 'en')).toBe('stored');
    });

    it('never throws when the network fails', async () => {
        mockLines.push({ id: '1', speaker: 'me', name: 'Ana', text: 'hello', at: 1 });
        mockPut.mockRejectedValue(new Error('offline'));
        expect(await syncTranscript('a4', 'owner', 'en')).toBe('failed');
    });
});
