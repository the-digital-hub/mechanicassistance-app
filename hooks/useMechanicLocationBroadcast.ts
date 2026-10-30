import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { useSocket } from '@/context/SocketContext';
import { AppointmentStatus } from '@/context/AppointmentsContext';
import { startBackgroundLocation, stopBackgroundLocation } from '@/lib/location/backgroundLocationTask';

export function useMechanicLocationBroadcast({
  appointmentId,
  status,
  role,
  isVideoCall = false,
  departed = false,
}: {
  appointmentId: string;
  status: AppointmentStatus;
  role: string | undefined;
  /** A video call is remote: the mechanic's position is never shared. */
  isVideoCall?: boolean;
  /** Tapped "Head out". An accepted job shares no position before that. */
  departed?: boolean;
}): void {
  const { sendMessage } = useSocket();
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  /** Whether this mount started background tracking: only then may it stop it. */
  const trackingRef = useRef(false);

  useEffect(() => {
    // Clean up previous subscription before checking guard
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;

    const followed =
      !isVideoCall &&
      role === 'mechanic' &&
      (status === 'started' || (status === 'accepted' && departed));
    if (!followed) {
      // Only on a real change (the job finished or was cancelled, or the
      // mechanic switched role). An empty list while the app is still loading — or was
      // relaunched in the background by the OS — must not stop it: the server's
      // 409 does that once the job is really over.
      if (trackingRef.current) {
        trackingRef.current = false;
        stopBackgroundLocation().catch(() => undefined);
      }
      return;
    }

    let cancelled = false;
    trackingRef.current = true;

    // Keeps sending with the app in the background or the phone locked. It is
    // stopped when the job stops being followed (above, or by the server's 409),
    // never just because the app left the screen.
    startBackgroundLocation(appointmentId).catch((e) =>
      console.warn('[useMechanicLocationBroadcast] background start failed:', e),
    );

    (async () => {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== 'granted') {
        console.warn('[useMechanicLocationBroadcast] Location permission denied');
        return;
      }
      if (cancelled) return;

      const sub = await Location.watchPositionAsync(
        { timeInterval: 5_000, distanceInterval: 10 },
        (location) => {
          sendMessage('mechanic_location_update', {
            appointmentId,
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          });
        },
      );

      if (cancelled) {
        sub.remove();
      } else {
        subscriptionRef.current = sub;
      }
    })();

    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [appointmentId, status, role, isVideoCall, departed]);
}
