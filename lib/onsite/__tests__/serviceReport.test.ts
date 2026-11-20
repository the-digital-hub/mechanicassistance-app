import { finalReportHtml } from '../finalReport';
import { buildServiceReport } from '../serviceReport';

const t = (key: string, options?: Record<string, unknown>) => (options?.count !== undefined ? `${options.count} min` : key.split('.').pop() as string);

const appointment = {
    id: 'abcdef12-0000-0000-0000-000000000000', refCode: 'AS-2ABVE7', car: '2008 HUMMER H2', title: 'Tire Assistance', type: 'videocall', assistanceType: 'videocall',
    address: '', budget: '$107.00', status: 'completed', createdAt: '2026-10-31T14:34:00Z', acceptedAt: '2026-10-31T17:40:00Z', completedAt: '2026-11-03T13:34:00Z',
    timezone: 'America/New_York', durationMinutes: 20, hasTranscript: true, reviewRating: 4, clientRating: null, photos: [],
} as never;

describe('buildServiceReport', () => {
    it('builds an owner report with the paid amount, the technician and the ratings', () => {
        const r = buildServiceReport({
            appointment, role: 'user', visit: null, ownerName: 'Juan', mechanicName: 'Diego M.',
            paid: { total: 107, refunded: 0, method: 'wallet' }, t, lang: 'en',
        });
        const flat = r.sections.flatMap((s) => s.rows.map((x) => `${x.label}=${x.value}`));
        expect(flat).toContain('paid=$107.00');
        expect(flat).toContain('technician=Diego M.');
        expect(flat).toContain('method=methodWallet');
        expect(r.status?.ok).toBe(true);
        expect(r.summary).toHaveLength(3);
        expect(r.reference).toContain('AS-2ABVE7');
    });

    it('falls back to the amount on the card when the payments are not known', () => {
        const r = buildServiceReport({ appointment, role: 'user', visit: null, paid: null, t, lang: 'en' });
        expect(r.sections.flatMap((s) => s.rows).find((x) => x.label === 'paid')?.value).toBe('$107.00');
    });

    it('prints a page with the header, the summary and a numbered bar per section', () => {
        const html = finalReportHtml(buildServiceReport({ appointment, role: 'user', visit: null, paid: null, t, lang: 'en' }));
        expect(html).toContain('MECHANIC ASSISTANCE');
        expect(html).toContain('class="sum"');
        expect(html).toContain('<span class="n">1.</span>');
        if (process.env.DUMP_REPORT_HTML) require('fs').writeFileSync(process.env.DUMP_REPORT_HTML, html);
    });
});
