import React from 'react';
import type { GestureResponderEvent } from 'react-native';

import { pinchZoom, startZoom } from '@/lib/onsite/cameraZoom';
import { backCameraZoomInfo } from '@/modules/vin-text';

/**
 * Zoom for a camera view like the Camera app's: the virtual back camera (it switches lenses and focuses close up by itself),
 * starting on the main lens, and a pinch of two fingers anywhere on the picture zooms it. Spread the returned `touchProps` on
 * the view that holds the camera, and pass `zoom` and `lens` to the `CameraView`.
 */
export function usePinchZoom() {
    const zoomInfo = React.useMemo(() => backCameraZoomInfo(), []);
    const [zoom, setZoom] = React.useState(() => startZoom(zoomInfo));
    const zoomRef = React.useRef(zoom);
    zoomRef.current = zoom;
    const pinch = React.useRef<{ d0: number; z0: number } | null>(null);

    const onTouch = (e: GestureResponderEvent) => {
        const touches = e.nativeEvent.touches;
        if (touches.length < 2) {
            pinch.current = null;
            return;
        }
        const d = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
        if (!pinch.current) {
            pinch.current = { d0: d, z0: zoomRef.current };
            return;
        }
        if (pinch.current.d0 > 0) setZoom(pinchZoom(pinch.current.z0, d / pinch.current.d0, zoomInfo?.max));
    };

    return {
        zoom,
        lens: zoomInfo?.lens,
        touchProps: {
            onTouchStart: onTouch,
            onTouchMove: onTouch,
            onTouchEnd: onTouch,
            onTouchCancel: () => { pinch.current = null; },
        },
    };
}
