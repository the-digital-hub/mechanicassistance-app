import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { useSocket } from '@/context/SocketContext';
import { AppointmentStatus } from '@/context/AppointmentsContext';

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

  useEffect(() => {
    // Clean up previous subscription before checking guard
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;

    if (isVideoCall || role !== 'mechanic') return;
    if (status !== 'started' && !(status === 'accepted' && departed)) return;

    let cancelled = false;

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
