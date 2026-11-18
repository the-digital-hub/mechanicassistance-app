import type { ConsentRecord } from '@/lib/video/consent';
import type { TranscriptLine } from '@/lib/video/transcriptStore';

export interface TranscriptPdfLabels {
    title: string;
    reference: string;
    vehicle: string;
    callDate: string;
    duration: string;
    generated: string;
    consentTitle: string;
    consentNone: string;
    consentPrecall: string;
    consentRequest: string;
    consentAnswerYes: string;
    consentAnswerNo: string;
    owner: string;
    mechanic: string;
    conversation: string;
    empty: string;
    notice: string;
}

export interface TranscriptPdfInput {
    ref?: string | null;
    vehicle?: string | null;
    callDate?: string | null;
    durationLabel?: string | null;
    /** The role of the person downloading it, to tell which lines are theirs. */
    role: 'owner' | 'mechanic';
    selfName?: string | null;
    lines: TranscriptLine[];
    consents: ConsentRecord[];
    labels: TranscriptPdfLabels;
    locale?: string;
}

export function escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const when = (iso: string | number, locale?: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
};

/** The transcript as a printable page: call data, who accepted what and when, then what was said. */
export function buildTranscriptHtml(input: TranscriptPdfInput): string {
    const { labels: L, locale } = input;
    const roleName = (r: 'owner' | 'mechanic') => (r === 'owner' ? L.owner : L.mechanic);
    const other = input.role === 'owner' ? 'mechanic' : 'owner';

    const facts = [
        [L.reference, input.ref],
        [L.vehicle, input.vehicle],
        [L.callDate, input.callDate],
        [L.duration, input.durationLabel],
    ]
        .filter(([, v]) => !!v)
        .map(([k, v]) => `<tr><td class="k">${escapeHtml(String(k))}</td><td>${escapeHtml(String(v))}</td></tr>`)
        .join('');

    const consentText = (c: ConsentRecord) => {
        const who = roleName(c.role);
        if (c.kind === 'precall') return L.consentPrecall.replace('{{who}}', who);
        if (c.kind === 'captions-request') return L.consentRequest.replace('{{who}}', who);
        return (c.accepted ? L.consentAnswerYes : L.consentAnswerNo).replace('{{who}}', who);
    };
    const consentRows = input.consents.length
        ? input.consents
              .map((c) => `<tr><td class="k">${escapeHtml(when(c.at, locale))}</td><td>${escapeHtml(consentText(c))} <span class="v">(v${escapeHtml(c.version)})</span></td></tr>`)
              .join('')
        : `<tr><td colspan="2">${escapeHtml(L.consentNone)}</td></tr>`;

    const lines = input.lines.length
        ? input.lines
              .map((l) => {
                  const role = l.speaker === 'me' ? input.role : other;
                  const name = l.speaker === 'me' ? input.selfName : l.name;
                  const who = name ? `${roleName(role)} · ${name}` : roleName(role);
                  return `<div class="line"><div class="who">${escapeHtml(who)}${l.at ? ` · ${escapeHtml(when(l.at, locale))}` : ''}</div><div class="text">${escapeHtml(l.text)}</div></div>`;
              })
              .join('')
        : `<p>${escapeHtml(L.empty)}</p>`;

    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #0B1530; padding: 28px; }
  h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 15px; margin: 22px 0 8px; color: #1E56E3; text-transform: uppercase; letter-spacing: .06em; }
  .sub { color: #6B7490; font-size: 12px; margin-bottom: 14px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; } td { padding: 5px 8px; border-bottom: 1px solid #EEF2FA; vertical-align: top; }
  td.k { color: #6B7490; width: 38%; } .v { color: #8C96AE; font-size: 11px; }
  .line { margin: 0 0 10px; page-break-inside: avoid; } .who { font-size: 11px; color: #6B7490; font-weight: 600; } .text { font-size: 14px; line-height: 1.4; }
  .notice { margin-top: 26px; padding: 10px 12px; background: #F4F8FF; border-radius: 8px; font-size: 11px; color: #6B7490; line-height: 1.5; }
</style></head><body>
<h1>${escapeHtml(L.title)}</h1>
<div class="sub">${escapeHtml(L.generated.replace('{{date}}', when(Date.now(), locale)))}</div>
<table>${facts}</table>
<h2>${escapeHtml(L.consentTitle)}</h2>
<table>${consentRows}</table>
<h2>${escapeHtml(L.conversation)}</h2>
${lines}
<div class="notice">${escapeHtml(L.notice)}</div>
</body></html>`;
}
