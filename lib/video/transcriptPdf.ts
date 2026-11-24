import type { ConsentRecord } from '@/lib/video/consent';
import type { ReportBrand } from '@/lib/onsite/finalReport';
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
    /** The brand (ring and name in colour) and the app's font, as data (see lib/pdf/brand). Without it the header says the name in text. */
    brand?: ReportBrand | null;
}

export function escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const when = (iso: string | number, locale?: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
};

/**
 * The transcript as a printable page, in the look of the service report: the brand in colour on top, a blue hero card with the title and the
 * call, boxes with the call data, a numbered card for who accepted what, then the conversation as chat bubbles. Nothing is cut in the middle:
 * every card and every message stays whole on its page, and a heading never ends a page alone.
 */
export function buildTranscriptHtml(input: TranscriptPdfInput): string {
    const { labels: L, locale, brand } = input;
    const roleName = (r: 'owner' | 'mechanic') => (r === 'owner' ? L.owner : L.mechanic);
    const other = input.role === 'owner' ? 'mechanic' : 'owner';
    const fonts = brand?.fonts;
    const face = fonts
        ? `@font-face{font-family:'Outfit';font-weight:400;src:url(${fonts.regular}) format('truetype')}
@font-face{font-family:'Outfit';font-weight:600;src:url(${fonts.semibold}) format('truetype')}
@font-face{font-family:'Outfit';font-weight:700;src:url(${fonts.bold}) format('truetype')}`
        : '';

    const boxes = [
        [L.reference, input.ref],
        [L.vehicle, input.vehicle],
        [L.callDate, input.callDate],
        [L.duration, input.durationLabel],
    ]
        .filter(([, v]) => !!v)
        .map(([k, v]) => `<div class="sum"><div class="sh">${escapeHtml(String(k))}</div><div class="sv">${escapeHtml(String(v))}</div></div>`)
        .join('');

    const consentText = (c: ConsentRecord) => {
        const who = roleName(c.role);
        if (c.kind === 'precall') return L.consentPrecall.replace('{{who}}', who);
        if (c.kind === 'captions-request') return L.consentRequest.replace('{{who}}', who);
        return (c.accepted ? L.consentAnswerYes : L.consentAnswerNo).replace('{{who}}', who);
    };
    const consentRows = input.consents.length
        ? input.consents
              .map((c) => `<div class="row"><div class="l">${escapeHtml(when(c.at, locale))}</div><div class="v">${escapeHtml(consentText(c))} <span class="ver">(v${escapeHtml(c.version)})</span></div></div>`)
              .join('')
        : `<div class="row"><div class="v">${escapeHtml(L.consentNone)}</div></div>`;

    const lines = input.lines.length
        ? input.lines
              .map((l) => {
                  const role = l.speaker === 'me' ? input.role : other;
                  const name = l.speaker === 'me' ? input.selfName : l.name;
                  const who = name ? `${roleName(role)} · ${name}` : roleName(role);
                  return `<div class="msg ${l.speaker === 'me' ? 'mine' : 'theirs'}"><div class="who">${escapeHtml(who)}${l.at ? ` · ${escapeHtml(when(l.at, locale))}` : ''}</div><div class="bubble">${escapeHtml(l.text)}</div></div>`;
              })
              .join('')
        : `<p class="empty">${escapeHtml(L.empty)}</p>`;

    const logo = brand
        ? `<div class="logo"><img class="ring" src="${brand.ring}" alt=""/><img class="word" src="${brand.word}" alt="Mechanic Assistance"/></div>`
        : '<div class="brand">MECHANIC ASSISTANCE</div>';
    const sub = [input.callDate, input.durationLabel].filter(Boolean).map((v) => escapeHtml(String(v))).join(' &nbsp;·&nbsp; ');

    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
${face}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Outfit',-apple-system,Helvetica,Arial,sans-serif;color:#0B1530;margin:0;font-size:13px;line-height:1.45}
.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.logo{display:flex;align-items:center;gap:10px}
.logo .ring{height:34px;width:34px}
.logo .word{height:15px;width:auto}
.brand{font-size:13px;font-weight:700;letter-spacing:.14em;color:#1E56E3}
.gen{text-align:right;font-size:11px;color:#6B7490;line-height:1.5}
.hero{background:linear-gradient(90deg,#1E56E3,#0B2A8E);color:#fff;border-radius:20px;padding:22px 26px;page-break-inside:avoid;break-inside:avoid}
.hero h1{font-size:28px;line-height:1.1;font-weight:700;letter-spacing:-.02em;margin:0;color:#fff}
.hero .sub{font-size:13px;color:#DCE7FF;margin-top:8px}
.sums{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 4px}
.sum{flex:1 1 40%;border:1px solid #EEF2FA;background:#fff;padding:12px 14px;border-radius:16px;page-break-inside:avoid;break-inside:avoid}
.sh{font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6B7490}
.sv{font-size:14px;font-weight:700;margin-top:5px;color:#0B1530;line-height:1.25}
.sec{margin-top:12px;border:1px solid #EEF2FA;background:#fff;border-radius:18px;padding:6px 18px 8px;page-break-inside:avoid;break-inside:avoid}
.sh2{display:flex;align-items:center;gap:10px;padding:12px 0 8px;page-break-after:avoid;break-after:avoid}
.sh2 .n{display:inline-block;width:26px;height:26px;border-radius:9px;background:#EAF1FF;color:#1E56E3;font-size:12.5px;font-weight:700;text-align:center;line-height:26px}
.sh2 .st{font-size:15px;font-weight:700;color:#0B1530}
.row{display:flex;gap:16px;padding:9px 0;border-top:1px solid #EEF2FA}
.row .l{width:34%;color:#6B7490}
.row .v{flex:1;font-weight:600;color:#0B1530}
.ver{color:#8C96AE;font-size:11px;font-weight:400}
.chat{margin-top:12px}
.chat .sh2{padding-left:2px}
.msg{margin:0 0 10px;page-break-inside:avoid;break-inside:avoid;display:flex;flex-direction:column;max-width:82%}
.msg.mine{margin-left:auto;align-items:flex-end}
.msg.theirs{margin-right:auto;align-items:flex-start}
.who{font-size:10.5px;color:#6B7490;font-weight:600;margin:0 4px 3px}
.bubble{padding:9px 14px;border-radius:16px;font-size:14px;line-height:1.4}
.mine .bubble{background:#1E56E3;color:#fff;border-bottom-right-radius:5px}
.theirs .bubble{background:#F1F4FA;color:#0B1530;border-bottom-left-radius:5px}
.empty{color:#6B7490}
.notice{margin-top:18px;padding:11px 14px;background:#F4F8FF;border:1px solid #E1EAFB;border-radius:14px;font-size:11px;color:#6B7490;line-height:1.5;page-break-inside:avoid;break-inside:avoid}
.foot{margin-top:18px;padding-top:12px;border-top:1px solid #EEF2FA;color:#9CA3AF;font-size:10px;text-align:center;line-height:1.6;page-break-inside:avoid;break-inside:avoid}
</style></head><body>
<div class="top">${logo}<div class="gen">${escapeHtml(L.generated.replace('{{date}}', when(Date.now(), locale)))}</div></div>
<div class="hero"><h1>${escapeHtml(L.title)}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
${boxes ? `<div class="sums">${boxes}</div>` : ''}
<div class="sec"><div class="sh2"><span class="n">1</span><span class="st">${escapeHtml(L.consentTitle)}</span></div>${consentRows}</div>
<div class="chat"><div class="sh2"><span class="n">2</span><span class="st">${escapeHtml(L.conversation)}</span></div>
${lines}</div>
<div class="notice">${escapeHtml(L.notice)}</div>
<div class="foot">Mechanic Assistance &nbsp;·&nbsp; www.mechanicassistance.com</div>
</body></html>`;
}
