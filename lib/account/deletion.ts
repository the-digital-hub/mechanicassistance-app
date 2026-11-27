import { ApiError } from '@/lib/api/types';

/**
 * `DELETE /api/users/me` (backend 26-nov, App Store 5.1.1(v)): see `plataforma/borrado-de-cuenta.md` in the analysis repo.
 *   200 { deleted: true }  already gone, close the session on the phone
 *   409 ACCOUNT_DELETION_BLOCKED, `details.reasons: [{ code, message }]`   something open stops it
 *   503  could not check (nothing was deleted): try again
 */

/** The reasons that stop a deletion, with the texts the screen has for them (`deleteAccount.blocked.<code>`). */
export const DELETION_BLOCK_CODES = [
    'open_request',
    'open_job',
    'open_driver_request',
    'open_dispute',
    'open_payment',
    'debt',
    'wallet_balance',
    'unpaid_earnings',
    'open_adjustment',
    'sole_organization_admin',
] as const;

export interface DeletionBlock {
    code: string;
    /** The sentence the server wrote, used when the app has no text of its own for the code. */
    message?: string;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;

/** What stopped the deletion (409), whichever way the envelope carries the list; empty for any other failure. */
export function deletionBlocks(error: unknown): DeletionBlock[] {
    if (!(error instanceof ApiError) || error.statusCode !== 409) return [];
    const payload = asRecord(error.apiError);
    const reasons = asRecord(payload?.details)?.reasons ?? payload?.reasons;
    if (!Array.isArray(reasons)) return [];
    return reasons
        .map((r) => asRecord(r))
        .filter((r): r is Record<string, unknown> => !!r && typeof r.code === 'string')
        .map((r) => ({ code: r.code as string, message: typeof r.message === 'string' ? r.message : undefined }));
}

/** The server could not check whether the account can go (503): nothing was deleted. */
export const isDeletionUnavailable = (error: unknown): boolean => error instanceof ApiError && error.statusCode === 503;
