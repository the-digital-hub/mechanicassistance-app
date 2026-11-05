/**
 * The short reference people can read out or type: `AS-4H8TX2` for a request,
 * `US-7K3M9Q` for a person. Older rows or cached data may not carry one yet, so
 * fall back to the start of the id, as the screens always did.
 */
export function refLabel(refCode: string | null | undefined, id: string): string {
    return refCode || `#${id.slice(0, 8)}`;
}
