const mockStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async (k: string) => mockStore[k] ?? null),
        setItem: jest.fn(async (k: string, v: string) => { mockStore[k] = v; }),
    },
}));

import { addTranscriptLine, getLocalTranscript } from '../transcriptStore';

const line = (id: string, text: string) => ({ id, speaker: 'other' as const, name: 'Ana', text, at: 1 });

describe('transcript store', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('keeps lines in order and ignores a repeated id', async () => {
        await addTranscriptLine('a1', line('1', 'hello'));
        await addTranscriptLine('a1', line('2', 'the engine light is on'));
        await addTranscriptLine('a1', line('2', 'the engine light is on'));
        expect((await getLocalTranscript('a1')).map((l) => l.text)).toEqual(['hello', 'the engine light is on']);
    });

    it('saves what it heard a moment later, in one write', async () => {
        await addTranscriptLine('a2', line('1', 'one'));
        await addTranscriptLine('a2', line('2', 'two'));
        jest.advanceTimersByTime(900);
        expect(JSON.parse(mockStore['video-transcript:a2']).map((l: { text: string }) => l.text)).toEqual(['one', 'two']);
    });

    it('keeps each call apart', async () => {
        await addTranscriptLine('a3', line('1', 'only here'));
        expect(await getLocalTranscript('a4')).toEqual([]);
    });
});
