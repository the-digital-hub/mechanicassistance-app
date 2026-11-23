import { parseWorkNotes, workNoteText } from './workNotes';
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
        sections.push({ key: 'work', title: t(`${k}.workNotes`), rows: [], lines: parseWorkNotes(visit.workNotes).map((n) => ({ text: workNoteText(n) })) });
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
/** What the PDF draws from data, so it needs nothing else: the brand (ring + name, in colour) and the app's font (Outfit) in three weights. */
export interface ReportBrand {
    ring: string;
    word: string;
    fonts?: { regular: string; semibold: string; bold: string } | null;
}

/**
 * The report as a page for the PDF, in the app's own look: Outfit, the blue palette, white cards with a soft border and rounded corners,
 * a blue hero card with the title and the status, numbered sections with labelled rows (the same rows and checklist ticks the app shows).
 */
export function finalReportHtml(report: FinalReport, brand?: ReportBrand | null): string {
    const fonts = brand?.fonts;
    const face = fonts
        ? `@font-face{font-family:'Outfit';font-weight:400;src:url(${fonts.regular}) format('truetype')}
@font-face{font-family:'Outfit';font-weight:600;src:url(${fonts.semibold}) format('truetype')}
@font-face{font-family:'Outfit';font-weight:700;src:url(${fonts.bold}) format('truetype')}`
        : '';
    const sections = report.sections
        .map((sec, i) => {
            const rows = sec.rows
                .map((r) => `<div class="row"><div class="l">${esc(r.label)}</div><div class="v">${esc(r.value).replace(/\n/g, '<br/>')}</div></div>`)
                .join('');
            const lines = (sec.lines ?? [])
                .map((l) => `<div class="line">${l.done === undefined ? '<span class="dot"></span>' : `<span class="box${l.done ? ' on' : ''}">${l.done ? '✓' : ''}</span>`}<span class="t">${esc(l.text).replace(/\n/g, '<br/>')}</span></div>`)
                .join('');
            return `<div class="sec"><div class="sh2"><span class="n">${i + 1}</span><span class="st">${esc(sec.title)}</span></div>${rows}${lines}</div>`;
        })
        .join('');
    const boxes = (report.summary ?? [])
        .map((b) => `<div class="sum"><div class="sh">${esc(b.heading)}</div><div class="sv">${esc(b.value)}</div>${b.sub ? `<div class="ss">${esc(b.sub)}</div>` : ''}</div>`)
        .join('');
    const status = report.status ? `<span class="status${report.status.ok ? ' ok' : ''}">${esc(report.status.label)}</span>` : '';
    const logo = brand
        ? `<div class="logo"><img class="ring" src="${brand.ring}" alt=""/><img class="word" src="${brand.word}" alt="Mechanic Assistance"/></div>`
        : '<div class="brand">MECHANIC ASSISTANCE</div>';
    return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
${face}
@page{margin:36px}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Outfit',-apple-system,Helvetica,Arial,sans-serif;color:#0B1530;margin:0;font-size:13px;line-height:1.45}
.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.logo{display:flex;align-items:center;gap:10px}
.logo .ring{height:34px;width:34px}
.logo .word{height:15px;width:auto}
.brand{font-size:13px;font-weight:700;letter-spacing:.14em;color:#1E56E3}
.ref{text-align:right;font-size:11px;color:#6B7490;line-height:1.5}
.ref b{display:block;font-size:12px;font-weight:700;color:#0B1530;letter-spacing:.02em}
.hero{background:linear-gradient(90deg,#1E56E3,#0B2A8E);color:#fff;border-radius:20px;padding:24px 26px}
.hero .eyebrow{font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#BFD3FF}
.hero h1{font-size:30px;line-height:1.1;font-weight:700;letter-spacing:-.02em;margin:8px 0 4px;color:#fff}
.hero .sub{font-size:13px;color:#DCE7FF}
.status{display:inline-block;margin-top:16px;background:rgba(255,255,255,.16);color:#fff;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:7px 14px;border-radius:999px}
.status.ok{background:#12B76A}
.sums{display:flex;gap:10px;margin:14px 0 4px}
.sum{flex:1;border:1px solid #EEF2FA;background:#fff;padding:13px 14px;border-radius:16px;page-break-inside:avoid}
.sh{font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6B7490}
.sv{font-size:15px;font-weight:700;margin-top:6px;color:#0B1530;line-height:1.25}
.ss{font-size:11px;color:#6B7490;margin-top:4px}
.sec{margin-top:12px;border:1px solid #EEF2FA;background:#fff;border-radius:18px;padding:6px 18px 8px;page-break-inside:avoid}
.sh2{display:flex;align-items:center;gap:10px;padding:12px 0 8px}
.sh2 .n{display:inline-block;width:26px;height:26px;border-radius:9px;background:#EAF1FF;color:#1E56E3;font-size:12.5px;font-weight:700;text-align:center;line-height:26px}
.sh2 .st{font-size:15px;font-weight:700;color:#0B1530}
.row{display:flex;gap:16px;padding:9px 0;border-top:1px solid #EEF2FA}
.row .l{width:34%;color:#6B7490;font-weight:400}
.row .v{flex:1;font-weight:600;color:#0B1530}
.line{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-top:1px solid #EEF2FA}
.line .t{flex:1;font-weight:600}
.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#1E56E3;margin:6px 4px 0 5px;flex:none}
.box{display:inline-block;width:18px;height:18px;border:1.5px solid #C9D2E3;border-radius:6px;text-align:center;font-size:11px;line-height:15px;flex:none;color:#fff}
.box.on{background:#12B76A;border-color:#12B76A}
.foot{margin-top:22px;padding-top:12px;border-top:1px solid #EEF2FA;color:#9CA3AF;font-size:10px;text-align:center;line-height:1.6}
</style></head><body>
<div class="top">${logo}<div class="ref"><b>${esc(report.reference)}</b>${esc(report.generatedAt)}</div></div>
<div class="hero"><div class="eyebrow">${esc(report.subtitle ?? '')}</div><h1>${esc(report.title)}</h1>${status}</div>
${boxes ? `<div class="sums">${boxes}</div>` : ''}${sections}
<div class="foot">Mechanic Assistance &nbsp;·&nbsp; www.mechanicassistance.com<br/>${esc(report.title)} &nbsp;·&nbsp; ${esc(report.reference)} &nbsp;·&nbsp; ${esc(report.generatedAt)}</div>
</body></html>`;
}
