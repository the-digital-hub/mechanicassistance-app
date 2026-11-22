/**
 * The work notes of a visit: what the technician did, each thing with a title and its explanation ("Brakes" / "Replaced the front pads…").
 * Stored in the visit's single `workNotes` text: entries separated by a blank line, and in each one the first line is the title and
 * the rest the explanation. A note written the old way (one plain line) reads as an entry with just a title.
 */
export interface WorkNote {
    title: string;
    body: string;
}

export function parseWorkNotes(text: string | null | undefined): WorkNote[] {
    return (text ?? '')
        .split(/\n\s*\n/)
        .map((block) => block.split('\n').map((l) => l.trim()))
        .map((lines) => {
            const [title = '', ...rest] = lines.filter(Boolean);
            return { title, body: rest.join('\n') };
        })
        .filter((n) => n.title);
}

export function serializeWorkNotes(notes: WorkNote[]): string {
    return notes
        .map((n) => {
            const title = n.title.replace(/\s+/g, ' ').trim();
            const body = n.body.split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
            return body ? `${title}\n${body}` : title;
        })
        .filter(Boolean)
        .join('\n\n');
}

/** One entry as plain text for a report: "Title: explanation". */
export function workNoteText(n: WorkNote): string {
    return n.body ? `${n.title}: ${n.body.replace(/\n/g, ' ')}` : n.title;
}
