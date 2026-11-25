import { parseWorkNotes, workNoteText } from './workNotes';
import type { Appointment } from '@/context/AppointmentsContext';
import type { OnSiteVisit } from '@/lib/dao/OnSiteDAO';
import type { FinalReport, ReportRow, ReportSection } from '@/lib/onsite/finalReport';

// The service report of a finished job, for the PDF each past appointment can download. It follows the structure of the
// reference report (overview, timeline, diagnostics and work, financial summary, evidence), and is built from what the app
// can read: the appointment, the on-site visit when the viewer may see it (the technician), and the owner's payments.

type T = (key: string, options?: Record<string, unknown>) => string;

export interface ServiceReportInput {
    appointment: Appointment;
    role: 'user' | 'mechanic';
    /** The mechanic's on-site visit; null when there is none or this viewer cannot read it. */
    visit: OnSiteVisit | null;
    ownerName?: string | null;
    mechanicName?: string | null;
    /** What the owner was charged for this job (every charge added up) and got back; null when unknown. */
    paid?: { total: number; refunded: number; method: 'wallet' | 'card' | null } | null;
    vin?: string | null;
    odometer?: string | null;
    t: T;
    lang: string;
}

const MAINTENANCE_IDS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'];
const PHOTO_KINDS = ['plate', 'dashboard', 'walkaround_in', 'extra_in', 'proof', 'walkaround_out', 'exit_photo'];

const money = (n: number) => `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
const parseMoney = (v?: string | null): number | null => {
    if (!v) return null;
    const n = Number(String(v).replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
};

export function buildServiceReport({ appointment, role, visit, ownerName, mechanicName, paid, vin, odometer, t, lang }: ServiceReportInput): FinalReport {
    const k = 'appointments.report.pdf';
    const when = (iso?: string | null) =>
        iso ? new Date(iso).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: appointment.timezone || undefined }) : null;
    const row = (label: string, value?: string | null): ReportRow | null => (value ? { label, value } : null);
    const rows = (list: (ReportRow | null)[]) => list.filter((r): r is ReportRow => !!r);

    const isVideoCall = (appointment.assistanceType ?? appointment.type) === 'videocall';
    const redirected = visit?.outcome === 'redirected';
    const reference = appointment.refCode || `#${appointment.id.slice(0, 8).toUpperCase()}`;
    const serviceType = isVideoCall ? t(`${k}.videoCall`) : appointment.type === 'scheduled' ? t(`${k}.scheduled`) : t(`${k}.immediate`);
    const issue = appointment.vehicleIssues?.length ? appointment.vehicleIssues.map((i) => i.name).join(', ') : appointment.title;

    // Money: the owner sees what they paid; the technician what the job pays them.
    const budget = parseMoney(appointment.budget);
    const paidTotal = paid ? Math.max(0, paid.total - paid.refunded) : budget;
    const payout = parseMoney(visit?.payoutAmount ?? visit?.serviceAmount);
    const photoCount = (appointment.photos?.length ?? 0) + (visit?.media ?? []).filter((m) => PHOTO_KINDS.includes(m.kind)).length;

    const sections: ReportSection[] = [
        {
            key: 'overview',
            title: t(`${k}.overview`),
            rows: rows([
                row(t(`${k}.client`), ownerName),
                row(t(`${k}.vehicle`), appointment.car),
                row(t(`${k}.vin`), vin || visit?.obdVin),
                row(t(`${k}.odometer`), odometer ? `${Number(odometer).toLocaleString(lang)} ${t('appointments.onSite.vin.miles')}` : null),
                row(t(`${k}.assistanceNumber`), reference),
                row(t(`${k}.serviceType`), serviceType),
                row(t(`${k}.location`), isVideoCall ? null : appointment.address),
                row(t(`${k}.technician`), mechanicName),
                row(t(`${k}.outcome`), redirected ? t(`${k}.notResolved`) : t(`${k}.resolved`)),
            ]),
        },
        {
            key: 'timeline',
            title: t(`${k}.timeline`),
            rows: rows([
                row(t(`${k}.created`), when(appointment.createdAt)),
                row(t(`${k}.accepted`), when(appointment.acceptedAt)),
                row(t(`${k}.departed`), when(appointment.departedAt)),
                row(t(`${k}.checkedIn`), when(visit?.checkedInAt)),
                row(t(`${k}.started`), when(visit?.workStartedAt ?? appointment.startedAt)),
                row(t(`${k}.completed`), when(visit?.closedAt ?? appointment.completedAt)),
            ]),
        },
    ];

    const work: ReportSection = {
        key: 'work',
        title: t(`${k}.work`),
        rows: rows([
            row(t(`${k}.issue`), issue),
            row(t(`${k}.notes`), appointment.notes),
            isVideoCall && appointment.durationMinutes ? row(t(`${k}.callLength`), t(`${k}.minutes`, { count: appointment.durationMinutes + (appointment.extendedMinutes ?? 0) })) : null,
            visit?.diagnosticPhotosSkipped ? row(t(`${k}.noPhotos`), t(`${k}.noPhotosValue`)) : null,
            redirected && visit?.redirectReason ? row(t(`${k}.reason`), t(`appointments.onSite.options.reasons.${visit.redirectReason}`)) : null,
        ]),
        lines: [] as { text: string; done?: boolean }[],
    };
    if (visit) {
        const lang2 = lang.startsWith('en') ? 'en' : 'es';
        work.lines!.push(
            ...(visit.obdCodes?.length
                ? visit.obdCodes.map((c) => ({ text: `${c.code}${c.description ? ` — ${c.description[lang2]}` : ''}` }))
                : [{ text: t(`${k}.noCodes`) }]),
        );
        for (const n of parseWorkNotes(visit.workNotes)) work.lines!.push({ text: `${t(`${k}.workNotes`)} — ${workNoteText(n)}` });
        for (const id of MAINTENANCE_IDS) work.lines!.push({ text: t(`appointments.onSite.maintenance.items.${id}`), done: !!visit.maintenanceChecklist?.[id] });
    }
    sections.push(work);

    sections.push({
        key: 'financial',
        title: t(`${k}.financial`),
        rows: rows([
            role === 'user' ? row(t(`${k}.paid`), paidTotal !== null ? money(paidTotal) : null) : row(t(`${k}.serviceValue`), money(parseMoney(visit?.serviceAmount) ?? budget ?? 0)),
            role === 'user' && paid && paid.refunded > 0 ? row(t(`${k}.refunded`), money(paid.refunded)) : null,
            role === 'mechanic' && payout !== null ? row(t(`${k}.payout`), money(payout)) : null,
            role === 'user' && paid?.method ? row(t(`${k}.method`), t(`${k}.${paid.method === 'wallet' ? 'methodWallet' : 'methodCard'}`)) : null,
        ]),
    });

    const stars = (n?: number | null) => (n ? `${n}/5` : t(`${k}.notRated`));
    sections.push({
        key: 'evidence',
        title: t(`${k}.evidence`),
        rows: rows([
            row(t(`${k}.photos`), String(photoCount)),
            isVideoCall ? row(t(`${k}.transcript`), appointment.hasTranscript ? t(`${k}.transcriptYes`) : t(`${k}.transcriptNo`)) : null,
            row(t(`${k}.ownerRating`), stars(appointment.reviewRating)),
            row(t(`${k}.mechanicRating`), stars(appointment.clientRating ?? visit?.clientRating)),
        ]),
    });

    return {
        title: t(`${k}.title`),
        subtitle: t(`${k}.subtitle`),
        reference: `${t(`${k}.reportNo`)}: ${reference}`,
        generatedAt: `${t(`${k}.issued`)}: ${new Date().toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' })}`,
        status: { label: redirected ? t(`${k}.statusNotResolved`) : t(`${k}.statusDone`), ok: !redirected },
        summary: [
            { heading: t(`${k}.sumOutcome`), value: redirected ? t(`${k}.notResolved`) : t(`${k}.resolved`), sub: `${serviceType}${mechanicName ? ` | ${mechanicName}` : ''}` },
            { heading: t(`${k}.sumVehicle`), value: appointment.car || '—', sub: vin || visit?.obdVin || undefined },
            { heading: t(`${k}.sumFinancial`), value: role === 'user' ? (paidTotal !== null ? `USD ${money(paidTotal)}` : '—') : `USD ${money(payout ?? parseMoney(visit?.serviceAmount) ?? budget ?? 0)}`, sub: `${t(`${k}.photos`)}: ${photoCount}` },
        ],
        sections: sections.filter((s) => s.rows.length > 0 || (s.lines?.length ?? 0) > 0),
    };
}
