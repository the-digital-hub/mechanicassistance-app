import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import type { PaymentHistoryItem, WalletMovement } from '@/lib/dao/WalletDAO';

/**
 * Which service each wallet movement was for: the request on the movement (or, on older
 * backends, movement → its payment → the request) → its title. Movements without a payment (top-ups) or
 * whose request can't be read are left out.
 */
export async function movementServiceTitles(
    payments: PaymentHistoryItem[],
    movements: WalletMovement[],
): Promise<Record<string, string>> {
    const requestByPayment = new Map(payments.map((p) => [p.id, p.assistanceRequestId]));
    const requestByMovement = new Map<string, string>();
    for (const m of movements) {
        // The backend now names the service on the movement; older ones need its payment looked up.
        const requestId = m.assistanceRequestId ?? (m.paymentId ? requestByPayment.get(m.paymentId) : null);
        if (requestId) requestByMovement.set(m.id, requestId);
    }
    if (requestByMovement.size === 0) return {};
    const jobs = await assistanceDAO.summaries([...requestByMovement.values()]).catch(() => []);
    const titleByRequest = new Map(jobs.map((j) => [j.id, j.title]));
    const out: Record<string, string> = {};
    for (const [movementId, requestId] of requestByMovement) {
        const title = titleByRequest.get(requestId);
        if (title) out[movementId] = title;
    }
    return out;
}
