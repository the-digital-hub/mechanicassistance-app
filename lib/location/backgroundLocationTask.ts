import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState, Platform } from 'react-native';
import { ApiError } from '../api/types';
import { ConfigService } from '../config/ConfigService';
import { onSiteDAO } from '../dao/OnSiteDAO';
import i18n from '../i18n';

// The mechanic's position while on the way, with the app in the background or
// the phone locked. On screen, useMechanicLocationBroadcast sends it over the
// socket; iOS suspends the socket in the background, so this task posts each
// position over HTTP (POST /appointments/:id/location) instead.
//
// The task can run with no React tree at all (the OS relaunches the app
// headless), so it is defined at module level and imported from app/_layout.tsx,
// and it reads which job it is tracking from storage, not from state.

export const MECHANIC_LOCATION_TASK = 'mechanic-location-broadcast';
const APPOINTMENT_KEY = 'ma:bg-location-appointment';

/** Answers that mean "this job is not followed any more": stop sending. */
const STOP_STATUSES = new Set([401, 403, 404, 409]);

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
    MECHANIC_LOCATION_TASK,
    async ({ data, error }) => {
        if (error) {
            console.warn('[backgroundLocation] task error:', error.message);
            return;
        }
        // On screen the socket already carries every position.
        if (AppState.currentState === 'active') return;

        const latest = data?.locations?.[data.locations.length - 1];
        if (!latest) return;

        const appointmentId = await AsyncStorage.getItem(APPOINTMENT_KEY);
        if (!appointmentId) {
            await stopBackgroundLocation();
            return;
        }

        try {
            await ConfigService.init();
            await onSiteDAO.sendLocation(appointmentId, latest.coords.latitude, latest.coords.longitude);
        } catch (e) {
            if (e instanceof ApiError && STOP_STATUSES.has(e.statusCode)) {
                await stopBackgroundLocation();
                return;
            }
            // Offline or a server hiccup: the next position comes seconds later.
            console.warn('[backgroundLocation] send failed:', (e as Error).message);
        }
    },
);

/** Whether the app may track in the background ("Allow all the time"). */
export async function hasBackgroundPermission(): Promise<boolean> {
    const { status } = await Location.getBackgroundPermissionsAsync();
    return status === 'granted';
}

/** Start background tracking for this job. Safe to call repeatedly. */
export async function startBackgroundLocation(appointmentId: string): Promise<void> {
    if (Platform.OS === 'web') return;
    await AsyncStorage.setItem(APPOINTMENT_KEY, appointmentId);
    if (!(await hasBackgroundPermission())) {
        console.warn('[backgroundLocation] background permission not granted');
        return;
    }
    if (await Location.hasStartedLocationUpdatesAsync(MECHANIC_LOCATION_TASK)) return;

    await Location.startLocationUpdatesAsync(MECHANIC_LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 10_000,
        distanceInterval: 25,
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.AutomotiveNavigation,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
            notificationTitle: i18n.t('appointments.backgroundLocation.notificationTitle'),
            notificationBody: i18n.t('appointments.backgroundLocation.notificationBody'),
            notificationColor: '#0047AB',
        },
    });
}

/** Stop background tracking, whatever job it was for. */
export async function stopBackgroundLocation(): Promise<void> {
    if (Platform.OS === 'web') return;
    await AsyncStorage.removeItem(APPOINTMENT_KEY);
    try {
        if (await Location.hasStartedLocationUpdatesAsync(MECHANIC_LOCATION_TASK)) {
            await Location.stopLocationUpdatesAsync(MECHANIC_LOCATION_TASK);
        }
    } catch (e) {
        console.warn('[backgroundLocation] stop failed:', (e as Error).message);
    }
}
