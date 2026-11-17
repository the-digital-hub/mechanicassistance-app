import type { OnSiteVisit } from '@/lib/dao/OnSiteDAO';

// The mechanic's final report of one visit: what was reported, what was found and done, and how it ended.
// Built from what the app already holds (the visit, the appointment and what the mechanic captured), so the
// same data feeds the in-app screen and the PDF.

export interface ReportRow {
    label: string;
    value: string;
}

export interface ReportSection {
    key: string;
    title: string;
    rows: ReportRow[];
    /** Free lines under the rows (OBD codes, checklist items…). */
    lines?: { text: string; done?: boolean }[];
}

export interface FinalReport {
    title: string;
    reference: string;
    generatedAt: string;
    sections: ReportSection[];
}

type T = (key: string, options?: Record<string, unknown>) => string;

export interface ReportInput {
    appointment: {
        id: string;
        refCode?: string | null;
        car?: string;
        address?: string;
        notes?: string;
        title?: string;
        vehicleIssues?: { name: string }[];
    };
    visit: OnSiteVisit;
    clientName?: string | null;
    /** What the mechanic scanned or typed on the VIN step (kept on the device). */
    vin?: string | null;
    odometer?: string | null;
    t: T;
    lang: string;
}

const MAINTENANCE_IDS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'];

const money = (v?: string | null): string | null => {
    if (!v) return null;
    const n = Number(String(v).replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : null;
};

const clean = (rows: (ReportRow | null)[]): ReportRow[] => rows.filter((r): r is ReportRow => !!r && !!r.value);

export function buildFinalReport({ appointment, visit, clientName, vin, odometer, t, lang }: ReportInput): FinalReport {
    const k = 'appointments.report';
    const dash = '—';
    const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' }) : null);
    const row = (label: string, value?: string | null): ReportRow | null => (value ? { label, value } : null);

    const issue = appointment.vehicleIssues?.length ? appointment.vehicleIssues.map((i) => i.name).join(', ') : appointment.title || dash;
    const redirected = visit.outcome === 'redirected';
    const minutes = visit.checkedInAt && visit.closedAt
        ? Math.max(0, Math.round((new Date(visit.closedAt).getTime() - new Date(visit.checkedInAt).getTime()) / 60000))
        : null;
    const doneItems = MAINTENANCE_IDS.filter((id) => visit.maintenanceChecklist?.[id]);
    const photoKinds = ['plate', 'dashboard', 'walkaround_in', 'extra_in', 'proof', 'walkaround_out', 'exit_photo'];
    const photos = (visit.media ?? []).filter((m) => photoKinds.includes(m.kind)).length;
    const payout = money(visit.payoutAmount ?? visit.serviceAmount);

    const sections: ReportSection[] = [
        {
            key: 'service',
            title: t(`${k}.service`),
            rows: clean([
                row(t(`${k}.outcome`), redirected ? t(`${k}.notResolved`) : t(`${k}.resolved`)),
                redirected && visit.redirectReason ? row(t(`${k}.reason`), t(`appointments.onSite.options.reasons.${visit.redirectReason}`)) : null,
                row(t(`${k}.issue`), issue),
                row(t(`${k}.notes`), appointment.notes),
            ]),
        },
        {
            key: 'vehicle',
            title: t(`${k}.vehicle`),
            rows: clean([
                row(t(`${k}.car`), appointment.car),
                row(t(`${k}.vin`), vin || visit.obdVin),
                row(t(`${k}.odometer`), odometer ? `${Number(odometer).toLocaleString(lang)} ${t('appointments.onSite.vin.miles')}` : null),
                row(t(`${k}.client`), clientName),
                row(t(`${k}.address`), appointment.address),
            ]),
        },
        {
            key: 'timeline',
            title: t(`${k}.timeline`),
            rows: clean([
                row(t(`${k}.checkedIn`), when(visit.checkedInAt)),
                row(t(`${k}.workStarted`), when(visit.workStartedAt)),
                row(t(`${k}.closed`), when(visit.closedAt)),
                row(t(`${k}.timeOnSite`), minutes !== null ? t(`${k}.minutes`, { count: minutes }) : null),
            ]),
        },
        {
            key: 'diagnosis',
            title: t(`${k}.diagnosis`),
            rows: [],
            lines: visit.obdCodes?.length
                ? visit.obdCodes.map((c) => ({ text: c.description ? `${c.code} — ${c.description[lang.startsWith('en') ? 'en' : 'es']}` : c.code }))
                : [{ text: t(`${k}.noCodes`) }],
        },
        {
            key: 'checklist',
            title: `${t(`${k}.checklist`)} · ${doneItems.length}/${MAINTENANCE_IDS.length}`,
            rows: [],
            lines: MAINTENANCE_IDS.map((id) => ({ text: t(`appointments.onSite.maintenance.items.${id}`), done: !!visit.maintenanceChecklist?.[id] })),
        },
    ];

    if (visit.workNotes?.trim()) {
        sections.push({ key: 'work', title: t(`${k}.workNotes`), rows: [], lines: [{ text: visit.workNotes.trim() }] });
    }

    sections.push({
        key: 'payment',
        title: t(`${k}.payment`),
        rows: clean([
            row(t(`${k}.photos`), photos ? String(photos) : null),
            row(t(`${k}.serviceValue`), money(visit.serviceAmount)),
            row(t(`${k}.payout`), payout),
            row(t(`${k}.ownerRating`), visit.clientRating ? `${visit.clientRating}/5` : null),
        ]),
    });

    return {
        title: t(`${k}.title`),
        reference: appointment.refCode || `#${appointment.id.slice(0, 8)}`,
        generatedAt: new Date().toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' }),
        sections: sections.filter((s) => s.rows.length > 0 || (s.lines?.length ?? 0) > 0),
    };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The report as a printable page (PDF). */
export function finalReportHtml(report: FinalReport): string {
    const sections = report.sections
        .map((s) => {
            const rows = s.rows
                .map((r) => `<tr><td class="l">${esc(r.label)}</td><td class="v">${esc(r.value)}</td></tr>`)
                .join('');
            const lines = (s.lines ?? [])
                .map((l) => `<div class="line">${l.done === undefined ? '' : `<span class="box${l.done ? ' on' : ''}">${l.done ? '✓' : ''}</span>`}${esc(l.text).replace(/\n/g, '<br/>')}</div>`)
                .join('');
            return `<h2>${esc(s.title)}</h2>${rows ? `<table>${rows}</table>` : ''}${lines}`;
        })
        .join('');
    return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#0B1530;padding:32px;font-size:14px}
h1{font-size:24px;margin:0 0 4px}.ref{color:#6B7490;margin-bottom:20px}
h2{font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:#1E56E3;border-bottom:1px solid #E4EAF5;padding-bottom:6px;margin:24px 0 8px}
table{width:100%;border-collapse:collapse}td{padding:6px 0;vertical-align:top}.l{color:#6B7490;width:38%}.v{font-weight:600}
.line{padding:4px 0}.box{display:inline-block;width:14px;height:14px;border:1.5px solid #8C96AE;border-radius:4px;margin-right:8px;text-align:center;font-size:11px;line-height:14px;vertical-align:middle}
.box.on{background:#10B981;border-color:#10B981;color:#fff}.foot{margin-top:28px;color:#8C96AE;font-size:12px}
</style></head><body><h1>${esc(report.title)}</h1><div class="ref">${esc(report.reference)}</div>${sections}<div class="foot">${esc(report.generatedAt)}</div></body></html>`;
}
