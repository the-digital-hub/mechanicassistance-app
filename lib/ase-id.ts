/**
 * Input mask for ASE member IDs: ASE-XXXX-XXXX.
 *
 * Follows the same shape as the phone mask in app/setup/index.tsx — the screen
 * keeps the raw digits in state and renders the formatted value, so deleting a
 * character never gets stuck on a separator the mask re-adds.
 *
 * The "ASE-" prefix is fixed: it is always rendered, even on an empty field,
 * and the user only ever types the eight digits. Because the prefix letters
 * are not digits, they are dropped by the same filter that strips the dashes,
 * so typing or pasting a full "ASE-1234-5678" needs no special case.
 *
 * Format confirmed against the loaded ASE extract: all 165,830 rows in
 * ase_mechanics.aseid match ASE-9999-9999 exactly, prefix and dashes included.
 * That is why the formatted value — not the bare digits — is what gets sent to
 * the backend, which matches aseid exactly.
 */

/** Digits in one ASE ID, excluding the "ASE-" prefix and the separators. */
export const ASE_ID_LENGTH = 8;

/** Rendered when the field is empty, and the constant head of every value. */
const ASE_PREFIX = 'ASE-';

/**
 * Reduces whatever is in the field to the bare digits, capped at
 * ASE_ID_LENGTH. Non-digits — the prefix letters, the dashes, pasted spaces —
 * are all dropped.
 */
export function toAseIdRaw(text: string): string {
    return text.replace(/\D/g, '').slice(0, ASE_ID_LENGTH);
}

/**
 * Renders raw digits as ASE-XXXX-XXXX. The prefix is always present, so an
 * empty field still shows "ASE-"; the second dash appears only once the fifth
 * digit is typed.
 */
export function formatAseId(raw: string): string {
    const first = raw.slice(0, 4);
    const second = raw.slice(4, ASE_ID_LENGTH);
    if (second) return `${ASE_PREFIX}${first}-${second}`;
    return `${ASE_PREFIX}${first}`;
}

/** True once all eight digits are present and the ID is worth looking up. */
export function isCompleteAseId(raw: string): boolean {
    return raw.length === ASE_ID_LENGTH;
}
