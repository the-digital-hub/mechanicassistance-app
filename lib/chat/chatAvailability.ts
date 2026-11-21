/**
 * Whether the chat of an appointment can be used, from its status (chat-service rules):
 * - `open`: both sides can write;
 * - `closed`: the assistance is over (the technician finished it, even while the owner's confirmation is still pending, or it was completed or
 *   cancelled): nothing new is written and the buttons that lead to the chat are blocked; the history stays readable;
 * - `unavailable`: no technician has accepted yet, so there is nobody to talk to.
 */
export type ChatAvailability = 'open' | 'closed' | 'unavailable';

export function chatAvailability(status?: string | null): ChatAvailability {
    switch (status) {
        case 'awaiting_confirmation':
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
