import { useAppointments } from '@/context/AppointmentsContext';
import { ApiError } from '@/lib/api/types';
import { onSiteDAO } from '@/lib/dao/OnSiteDAO';
import * as Location from 'expo-location';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking } from 'react-native';

/**
 * "Head out": the mechanic left for the vehicle. Until then the job is accepted
 * but nobody follows them — no position shared, no live ETA. Shared by the
 * appointment detail screen and the dashboard's active-job card.
 *
 * `departedNow` covers the gap until the refreshed appointment arrives.
 */
export function useHeadOut() {
    const { t } = useTranslation();
    const { refresh: refreshAppointments } = useAppointments();
    const [departedNow, setDepartedNow] = useState<string | null>(null);
    const [headingOut, setHeadingOut] = useState(false);

    const headOut = async (appointmentId: string) => {
        if (headingOut) return;
        setHeadingOut(true);
        try {
            // Ask now, while the mechanic is looking: the broadcast starts as soon as departedAt is set.
            // "Allow all the time" is required: the customer must keep seeing the mechanic while
            // they drive with the app in the background or the phone locked.
            const { status: perm } = await Location.requestForegroundPermissionsAsync();
            const { status: bgPerm } =
                perm === 'granted' ? await Location.requestBackgroundPermissionsAsync() : { status: perm };
            if (bgPerm !== 'granted') {
                Alert.alert(
                    t('appointments.detail.locationNeededTitle'),
                    t('appointments.detail.locationAlwaysNeeded'),
                    [
                        { text: t('appointments.detail.cancelOpenSettings'), style: 'cancel' },
                        { text: t('appointments.detail.openSettings'), onPress: () => Linking.openSettings() },
                    ],
                );
                return;
            }
            const res = await onSiteDAO.depart(appointmentId);
            setDepartedNow(res.departedAt);
            refreshAppointments();
        } catch (error) {
            const message = error instanceof ApiError && error.apiMessage ? error.apiMessage : t('appointments.detail.headOutFailed');
            Alert.alert(t('appointments.videoCall.errorTitle'), message);
        } finally {
            setHeadingOut(false);
        }
    };

    return { headOut, headingOut, departedNow };
}
