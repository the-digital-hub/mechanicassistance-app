/**
 * Whether the chat of an appointment can be used, from its status (chat-service rules):
 * - `open`: both sides can write;
 * - `closed`: completed or cancelled, the history is still readable (disputes) but nothing new is accepted;
 * - `unavailable`: no technician has accepted yet, so there is nobody to talk to.
 */
export type ChatAvailability = 'open' | 'closed' | 'unavailable';

export function chatAvailability(status?: string | null): ChatAvailability {
    switch (status) {
        case 'completed':
        case 'cancelled':
        case 'canceled':
            return 'closed';
        case 'pending':
        case 'offered':
        case undefined:
        case null:
        case '':
            return 'unavailable';
        default:
            return 'open';
    }
}
