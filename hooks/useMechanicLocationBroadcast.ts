import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { useSocket } from '@/context/SocketContext';
import { AppointmentStatus } from '@/context/AppointmentsContext';

export function useMechanicLocationBroadcast({
  appointmentId,
  status,
  role,
}: {
  appointmentId: string;
  status: AppointmentStatus;
  role: string | undefined;
}): void {
  const { sendMessage } = useSocket();
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    // Clean up previous subscription before checking guard
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;

    if (role !== 'mechanic' || (status !== 'started' && status !== 'accepted')) return;

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
  }, [appointmentId, status, role]);
}
