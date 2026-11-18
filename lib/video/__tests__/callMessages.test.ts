import { applyDraw, parseCallMessage } from '../callMessages';

describe('parseCallMessage', () => {
    it('accepts the three kinds of message', () => {
        expect(parseCallMessage({ t: 'clear' })).toEqual({ t: 'clear' });
        expect(parseCallMessage({ t: 'chat', id: 'a', text: 'P0301' })).toEqual({ t: 'chat', id: 'a', text: 'P0301' });
        expect(parseCallMessage({ t: 'draw', id: 's', pts: [[0.1, 0.2]], end: true })).toEqual({ t: 'draw', id: 's', pts: [[0.1, 0.2]], end: true });
    });

    it('drops what is not ours or is malformed', () => {
        expect(parseCallMessage(null)).toBeNull();
        expect(parseCallMessage('hi')).toBeNull();
        expect(parseCallMessage({ t: 'other' })).toBeNull();
        expect(parseCallMessage({ t: 'chat', id: 1, text: 'x' })).toBeNull();
    });

    it('keeps only points inside the picture and caps chat length', () => {
        const draw = parseCallMessage({ t: 'draw', id: 's', pts: [[0.5, 0.5], [2, 0.5], ['a', 1], [0.1]] });
        expect(draw).toEqual({ t: 'draw', id: 's', pts: [[0.5, 0.5]], end: false });
        const chat = parseCallMessage({ t: 'chat', id: 'a', text: 'x'.repeat(900) });
        expect(chat && chat.t === 'chat' && chat.text.length).toBe(500);
    });
});

describe('applyDraw', () => {
    it('starts a stroke and then extends it', () => {
        const first = applyDraw([], { t: 'draw', id: 's', pts: [[0, 0]] });
        const next = applyDraw(first, { t: 'draw', id: 's', pts: [[0.5, 0.5]] });
        expect(next).toEqual([{ id: 's', pts: [[0, 0], [0.5, 0.5]] }]);
    });

    it('keeps separate strokes apart', () => {
        const strokes = applyDraw(applyDraw([], { t: 'draw', id: 'a', pts: [[0, 0]] }), { t: 'draw', id: 'b', pts: [[1, 1]] });
        expect(strokes.map((s) => s.id)).toEqual(['a', 'b']);
    });
});
