import { buildTranscriptHtml, escapeHtml } from '../transcriptPdf';

const labels = {
    title: 'Video call transcript', reference: 'Reference', vehicle: 'Vehicle', callDate: 'Call date', duration: 'Duration',
    generated: 'Generated on {{date}}', consentTitle: 'Consent', consentNone: 'No consent recorded on this phone.',
    consentPrecall: '{{who}} accepted the conditions of the call', consentRequest: '{{who}} asked to turn on captions and transcript',
    consentAnswerYes: '{{who}} accepted captions and transcript', consentAnswerNo: '{{who}} declined captions and transcript',
    owner: 'Vehicle owner', mechanic: 'Technician', conversation: 'Conversation', empty: 'Nothing was said.', notice: 'Generated automatically.',
};

describe('transcript pdf html', () => {
    it('escapes what people said', () => {
        expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;');
        const html = buildTranscriptHtml({
            role: 'owner', lines: [{ id: '1', speaker: 'other', name: 'Ana <b>', text: '<img src=x onerror=1>', at: 0 }], consents: [], labels,
        });
        expect(html).not.toContain('<img src=x');
        expect(html).toContain('&lt;img src=x onerror=1&gt;');
    });

    it('names the roles from the point of view of who downloads it', () => {
        const html = buildTranscriptHtml({
            role: 'mechanic', selfName: 'Diego',
            lines: [
                { id: '1', speaker: 'me', name: '', text: 'Hello', at: 0 },
                { id: '2', speaker: 'other', name: 'Juan', text: 'Hi', at: 0 },
            ],
            consents: [], labels,
        });
        expect(html).toContain('Technician · Diego');
        expect(html).toContain('Vehicle owner · Juan');
    });

    it('lists who accepted what, with the version of the text', () => {
        const html = buildTranscriptHtml({
            role: 'owner', lines: [],
            consents: [
                { id: 'a', version: '2026-11-18', kind: 'precall', role: 'owner', accepted: true, at: '2026-11-18T10:00:00.000Z' },
                { id: 'b', version: '2026-11-18', kind: 'captions-answer', role: 'mechanic', accepted: false, at: '2026-11-18T10:05:00.000Z' },
            ],
            labels,
        });
        expect(html).toContain('Vehicle owner accepted the conditions of the call');
        expect(html).toContain('Technician declined captions and transcript');
        expect(html).toContain('v2026-11-18');
        expect(html).toContain('Nothing was said.');
    });

    it('says so when no consent is on this phone', () => {
        expect(buildTranscriptHtml({ role: 'owner', lines: [], consents: [], labels })).toContain('No consent recorded on this phone.');
    });
});
