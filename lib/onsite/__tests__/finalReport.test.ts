import type { OnSiteVisit } from '@/lib/dao/OnSiteDAO';
import { buildFinalReport, finalReportHtml } from '../finalReport';

const t = (key: string, o?: Record<string, unknown>) => (o?.count !== undefined ? `${key}:${o.count}` : key);
const visit = {
    appointmentId: 'abc12345-xyz', checkedInAt: '2026-11-16T14:00:00Z', closedAt: '2026-11-16T15:01:00Z', workStartedAt: null,
    outcome: 'resolved', redirectReason: null, maintenanceChecklist: { m1: true, m2: true }, obdCodes: [], obdVin: null,
    serviceAmount: '149.00', payoutAmount: '120.00', clientRating: null, media: [{ kind: 'proof' }, { kind: 'plate' }], workNotes: ' replaced battery ',
} as unknown as OnSiteVisit;
const appointment = { id: 'abc12345-xyz', car: 'FORD Bronco', address: 'Weston', vehicleIssues: [{ name: 'Dead battery' }] };

describe('buildFinalReport', () => {
    const r = buildFinalReport({ appointment, visit, clientName: 'Diego M.', vin: '1HGCM82633A004352', odometer: '84500', t, lang: 'en' });
    const find = (key: string) => r.sections.find((s) => s.key === key);

    it('lists the sections the visit has data for', () => {
        expect(r.sections.map((s) => s.key)).toEqual(['service', 'vehicle', 'timeline', 'diagnosis', 'checklist', 'work', 'payment']);
    });
    it('counts the checklist and the time on site', () => {
        expect(find('checklist')?.title).toContain('2/7');
        expect(find('timeline')?.rows.find((x) => x.label.endsWith('timeOnSite'))?.value).toBe('appointments.report.minutes:61');
    });
    it('uses the captured VIN and photo count', () => {
        expect(find('vehicle')?.rows.find((x) => x.label.endsWith('.vin'))?.value).toBe('1HGCM82633A004352');
        expect(find('payment')?.rows.find((x) => x.label.endsWith('photos'))?.value).toBe('2');
    });
    it('falls back to a short reference and escapes the HTML', () => {
        expect(r.reference).toBe('#abc12345');
        const html = finalReportHtml({ ...r, sections: [{ key: 'x', title: '<b>', rows: [{ label: 'a', value: '&' }] }] });
        expect(html).toContain('&lt;b&gt;');
        expect(html).toContain('&amp;');
    });
});
