import { useUser } from '@/context/UserContext';
import { userDAO } from '@/lib/dao/UserDAO';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AppState, AppStateStatus, Linking, Platform } from 'react-native';

const POSITION_TIMEOUT_MS = 10_000;

/**
 * Revalidates location every time the app is entered — once the session is
 * known after a cold start, and on every return to the foreground — for both
 * roles. Location off or permission refused: an alert pointing to the settings,
 * shown again on every entry but never blocking the app. Permission granted:
 * the current position is sent as the account's last known position.
 */
export function useLocationRevalidation() {
    const { t } = useTranslation();
    const { user } = useUser();
    const userId = user?.id;

    const inFlightRef = useRef(false);
    const alertOpenRef = useRef(false);

    const showSettingsAlert = useCallback(
        (title: string, message: string) => {
            if (alertOpenRef.current) return;
            alertOpenRef.current = true;
            const close = () => {
                alertOpenRef.current = false;
            };
            Alert.alert(
                title,
                message,
                [
                    { text: t('common.locationCheck.notNow'), style: 'cancel', onPress: close },
                    {
                        text: t('common.locationCheck.openSettings'),
                        onPress: () => {
                            close();
                            Linking.openSettings().catch(() => {});
                        },
                    },
                ],
                // Android: tapping outside dismisses without calling any button.
                { cancelable: true, onDismiss: close },
            );
        },
        [t],
    );

    const revalidate = useCallback(async () => {
        if (Platform.OS === 'web' || !userId || inFlightRef.current) return;
        inFlightRef.current = true;
        try {
            const servicesOn = await Location.hasServicesEnabledAsync();
            if (!servicesOn) {
                showSettingsAlert(
                    t('common.locationCheck.servicesOffTitle'),
                    t('common.locationCheck.servicesOffMessage'),
                );
                return;
            }

            let { status } = await Location.getForegroundPermissionsAsync();
            if (status === Location.PermissionStatus.UNDETERMINED) {
                ({ status } = await Location.requestForegroundPermissionsAsync());
            }
            if (status !== Location.PermissionStatus.GRANTED) {
                showSettingsAlert(
                    t('common.locationCheck.permissionTitle'),
                    t('common.locationCheck.permissionMessage'),
                );
                return;
            }

            let timer: ReturnType<typeof setTimeout> | undefined;
            const timeout = new Promise<null>((resolve) => {
                timer = setTimeout(() => resolve(null), POSITION_TIMEOUT_MS);
            });
            const current = await Promise.race([
                Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(
                    (error: unknown) => {
                        console.warn('[LocationRevalidation] current position failed', error);
                        return null;
                    },
                ),
                timeout,
            ]);
            clearTimeout(timer);
            const position = current ?? (await Location.getLastKnownPositionAsync());
            if (!position) return;

            const { latitude, longitude, accuracy } = position.coords;
            await userDAO.updateLastLocation(userId, {
                lat: latitude,
                lng: longitude,
                ...(accuracy != null ? { accuracyM: accuracy } : {}),
            });
        } catch (error) {
            console.warn('[LocationRevalidation] failed', error);
        } finally {
            inFlightRef.current = false;
        }
    }, [userId, showSettingsAlert, t]);

    // Cold start: as soon as the session is valid.
    useEffect(() => {
        if (userId) revalidate();
    }, [userId, revalidate]);

    // Every return to the foreground.
    useEffect(() => {
        let previous: AppStateStatus = AppState.currentState;
        const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
            const wasAway = previous === 'background' || previous === 'inactive';
            previous = next;
            if (next === 'active' && wasAway) revalidate();
        });
        return () => sub.remove();
    }, [revalidate]);

    return { revalidate };
}
