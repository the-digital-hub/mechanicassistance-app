// Zoom of the VIN scanner's camera. expo-camera's `zoom` goes from 0 to 1 and means a factor of `max ** zoom` (0 is a factor of 1,
// 1 is the camera's limit), so a pinch that doubles the distance between the fingers must add `ln(2) / ln(max)` to it.

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The zoom where the picture looks like the Camera app's "1x" (the main lens); 0 when the camera has no lens switching. */
export function startZoom(info: { max: number; wideAt: number } | null): number {
    if (!info || !(info.max > 1) || !(info.wideAt > 1)) return 0;
    return clamp(Math.log(info.wideAt) / Math.log(info.max), 0, 1);
}

/** The zoom after a pinch: `zoomAtStart` moved by how much the fingers spread (`ratio` = distance now / distance at the start). */
export function pinchZoom(zoomAtStart: number, ratio: number, max: number | undefined): number {
    if (!(ratio > 0)) return zoomAtStart;
    // Without the camera's own limit, assume a typical one so a pinch still feels natural.
    const limit = max && max > 1 ? max : 10;
    return clamp(zoomAtStart + Math.log(ratio) / Math.log(limit), 0, 1);
}
