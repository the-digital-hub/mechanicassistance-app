/**
 * Video calls have no place: the backend stores a fixed Spanish line as their "address" ("Asesoría Remota por Videollamada"). Showing it
 * as is leaves Spanish text on an English screen, so wherever an address is displayed this swaps that line for the same words in the
 * language of the app (`t` is the screen's own translator). Any other address passes through untouched.
 */
const REMOTE_ADDRESS = /^\s*asesor[ií]a remota/i;

export const isRemoteAddress = (address: string | null | undefined): boolean => !!address && REMOTE_ADDRESS.test(address);

export function localizedAddress<T extends string | null | undefined>(address: T, t: (key: string) => string): T | string {
    return isRemoteAddress(address) ? t('appointments.videoCall.remoteHint') : address;
}
