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
    /** Headline under the title ("Final status: service completed"); `ok` colours it green. */
    status?: { label: string; ok: boolean };
    /** Up to three boxes under the header: a heading, a main value and a small line. */
    summary?: { heading: string; value: string; sub?: string }[];
    /** Small text next to the title ("Service report"). */
    subtitle?: string;
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

/** The report as a printable page (PDF): a dark header with the reference, summary boxes and numbered section bars. */
export function finalReportHtml(report: FinalReport): string {
    const sections = report.sections
        .map((sec, i) => {
            const rows = sec.rows
                .map((r) => `<tr><td class="l">${esc(r.label)}</td><td class="v">${esc(r.value).replace(/\n/g, '<br/>')}</td></tr>`)
                .join('');
            const lines = (sec.lines ?? [])
                .map((l) => `<div class="line">${l.done === undefined ? '' : `<span class="box${l.done ? ' on' : ''}">${l.done ? '✓' : ''}</span>`}${esc(l.text).replace(/\n/g, '<br/>')}</div>`)
                .join('');
            return `<div class="sec"><h2><span class="n">${i + 1}.</span> ${esc(sec.title)}</h2>${rows ? `<table>${rows}</table>` : ''}${lines}</div>`;
        })
        .join('');
    const boxes = (report.summary ?? [])
        .map((b) => `<div class="sum"><div class="sh">${esc(b.heading)}</div><div class="sv">${esc(b.value)}</div>${b.sub ? `<div class="ss">${esc(b.sub)}</div>` : ''}</div>`)
        .join('');
    const status = report.status ? `<div class="status${report.status.ok ? ' ok' : ''}">${esc(report.status.label)}</div>` : '';
    return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
@page{margin:0}
*{box-sizing:border-box}
body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#0B1530;margin:0;font-size:13px}
.head{background:#0F1E3C;color:#fff;padding:26px 36px 22px}
.brand{font-size:13px;font-weight:700;letter-spacing:.14em}
.head h1{font-size:25px;font-weight:400;color:#8CC8F0;margin:14px 0 2px}
.head .sub{font-size:12px;color:#D6E4F5}
.meta{margin-top:12px;font-size:11px;color:#C5D6EC;line-height:1.7}
.status{margin-top:12px;display:inline-block;background:#B45309;color:#fff;font-size:11px;font-weight:700;letter-spacing:.04em;padding:8px 12px;text-transform:uppercase}
.status.ok{background:#0E9F6E}
.rule{height:3px;background:#8CC8F0}
.body{padding:20px 36px 28px}
.sums{display:flex;gap:12px;margin-bottom:18px}
.sum{flex:1;border:1px solid #B9D6EC;background:#F3F9FD;padding:10px 12px}
.sh{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#334155}
.sv{font-size:14px;margin-top:6px;color:#0F1E3C;font-weight:600}
.ss{font-size:11px;color:#64748B;margin-top:4px}
.sec{margin-bottom:6px;page-break-inside:avoid}
h2{background:#0F1E3C;color:#fff;font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;margin:18px 0 6px;padding:9px 12px;border-left:4px solid #8CC8F0}
h2 .n{opacity:.8}
table{width:100%;border-collapse:collapse}
td{padding:7px 4px;vertical-align:top;border-bottom:1px solid #EDF1F6}
.l{color:#64748B;width:36%}.v{font-weight:500}
.line{padding:5px 4px;border-bottom:1px solid #EDF1F6}
.box{display:inline-block;width:14px;height:14px;border:1.5px solid #8C96AE;border-radius:3px;margin-right:8px;text-align:center;font-size:10px;line-height:13px;vertical-align:middle}
.box.on{background:#10B981;border-color:#10B981;color:#fff}
.foot{margin-top:26px;padding-top:10px;border-top:1px solid #B9D6EC;color:#64748B;font-size:10.5px}
</style></head><body>
<div class="head"><div class="brand">MECHANIC ASSISTANCE</div><h1>${esc(report.title)}</h1>${report.subtitle ? `<div class="sub">${esc(report.subtitle)}</div>` : ''}
<div class="meta">${esc(report.reference)}<br/>${esc(report.generatedAt)}</div>${status}</div><div class="rule"></div>
<div class="body">${boxes ? `<div class="sums">${boxes}</div>` : ''}${sections}<div class="foot">www.mechanicassistance.com &nbsp;|&nbsp; MECHANIC ASSISTANCE - ${esc(report.title)} &nbsp;|&nbsp; ${esc(report.reference)} &nbsp;|&nbsp; ${esc(report.generatedAt)}</div></div>
</body></html>`;
}
