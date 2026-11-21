import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import type { PaymentHistoryItem, WalletMovement } from '@/lib/dao/WalletDAO';
import { refLabel } from '@/lib/refCode';

/** The service behind a payment or a wallet movement: its title (when it can be read) and its short code. */
export interface ServiceInfo {
    title?: string;
    ref: string;
}

export interface WalletServiceInfo {
    movements: Record<string, ServiceInfo>;
    payments: Record<string, ServiceInfo>;
}

export const NO_SERVICE_INFO: WalletServiceInfo = { movements: {}, payments: {} };

/**
 * Which service each payment and wallet movement was for: the request on the movement (or, on older
 * backends, movement → its payment → the request) → its title and code. Movements without a payment (top-ups)
 * are left out. The code is always there once the request is known (the start of its id if the backend does not
 * send one); the title only when the request can be read.
 */
export async function walletServiceInfo(
    payments: PaymentHistoryItem[],
    movements: WalletMovement[],
): Promise<WalletServiceInfo> {
    const requestByPayment = new Map(payments.map((p) => [p.id, p.assistanceRequestId]));
    const requestByMovement = new Map<string, string>();
    for (const m of movements) {
        // The backend now names the service on the movement; older ones need its payment looked up.
        const requestId = m.assistanceRequestId ?? (m.paymentId ? requestByPayment.get(m.paymentId) : null);
        if (requestId) requestByMovement.set(m.id, requestId);
    }
    const requestIds = new Set<string>(requestByMovement.values());
    for (const p of payments) if (p.assistanceRequestId) requestIds.add(p.assistanceRequestId);
    if (requestIds.size === 0) return NO_SERVICE_INFO;

    const jobs = await assistanceDAO.summaries([...requestIds]).catch(() => []);
    const jobById = new Map(jobs.map((j) => [j.id, j]));
    const infoOf = (requestId: string): ServiceInfo => {
        const job = jobById.get(requestId);
        return { title: job?.title || undefined, ref: refLabel(job?.refCode, requestId) };
    };

    const out: WalletServiceInfo = { movements: {}, payments: {} };
    for (const [movementId, requestId] of requestByMovement) out.movements[movementId] = infoOf(requestId);
    for (const p of payments) if (p.assistanceRequestId) out.payments[p.id] = infoOf(p.assistanceRequestId);
    return out;
}
