import * as Location from 'expo-location';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { DetailCard, DetailRow } from './DetailCard';
import { OwnerRouteMap } from './owner/OwnerRouteMap';
import { formatEtaTime, useAppointmentEta } from '@/hooks/useAppointmentEta';
import { videoCallBookedLabel } from '@/lib/video/videoCallTime';

interface MechanicAssistanceInfoTabProps {
    appointment: any;
    /** Sub-navbar split: `trip` = arrival, ETA, address and map; `vehicle` = car, issue, notes. Omitted = everything. */
    section?: 'trip' | 'vehicle';
}

export function MechanicAssistanceInfoTab({ appointment, section }: MechanicAssistanceInfoTabProps) {
    const { t, i18n } = useTranslation();
    // A video call is remote: no GPS, map, route or ETA.
    const isVideoCall = (appointment?.assistanceType ?? appointment?.type) === 'videocall';
    const [mechanicCoords, setMechanicCoords] = React.useState<{ latitude: number; longitude: number } | null>(null);

    // Request location coords are the client's chosen point (default address or
    // the spot they dropped on the map) — always the destination reference.
    const requestCoords =
        appointment?.locationLat != null && appointment?.locationLng != null
            ? { latitude: appointment.locationLat, longitude: appointment.locationLng }
            : null;

    // Live ETA / arrival hour (shared with the client via the same hook).
    const { minutesAway, etaTime, loading: etaLoading, polyline } = useAppointmentEta(
        isVideoCall ? undefined : appointment?.id,
        isVideoCall ? undefined : appointment?.status,
    );

    // Track mechanic's live position — watch continuously so the marker moves as they drive.
    // Local marker only: sharing it with the owner is MechanicLocationBroadcaster's job.
    React.useEffect(() => {
        if (isVideoCall) return;
        let sub: Location.LocationSubscription | null = null;
        let cancelled = false;
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;
                if (cancelled) return;
                sub = await Location.watchPositionAsync(
                    { timeInterval: 4_000, distanceInterval: 5 },
                    (loc) => {
                        if (cancelled) return;
                        const { latitude, longitude } = loc.coords;
                        setMechanicCoords({ latitude, longitude });
                    },
                );
            } catch {
                // no-op: mechanic marker simply won't render
            }
        })();
        return () => {
            cancelled = true;
            sub?.remove();
        };
    }, [isVideoCall]);

    const arrivalValue = etaLoading
        ? t('appointments.detail.info.calculating')
        : minutesAway !== null
            ? t('appointments.detail.info.minAway', { minutes: minutesAway })
            : t('appointments.detail.info.onTheWay');
    const etaValue = etaTime ? formatEtaTime(etaTime) : etaLoading ? '—' : t('appointments.detail.info.pending');
    const issueValue = appointment.vehicleIssues?.length
        ? appointment.vehicleIssues.map((i: { name: string }) => i.name).join(', ')
        : '—';

    if (isVideoCall) {
        // A call asked for "now" (or with no date on the row) reads "Now".
        const scheduled = videoCallBookedLabel(appointment, i18n.language) ?? t('requestDetail.videoCallNow');
        return (
            <View className="gap-3.5">
                <DetailCard>
                    <DetailRow icon="videocam-outline" label={t('appointments.ownerAccepted.rows.service')} value={t('appointments.detail.types.videocall')} />
                    <DetailRow icon="calendar-outline" label={t('appointments.videoCall.scheduledFor')} value={scheduled} />
                    <DetailRow icon="car-outline" label={t('appointments.detail.info.car')} value={appointment.car} />
                    <DetailRow icon="construct-outline" label={t('appointments.detail.info.carIssue')} value={issueValue} />
                    <DetailRow
                        icon="document-text-outline"
                        label={t('appointments.detail.info.notes')}
                        value={appointment.notes || t('appointments.detail.info.noNotes')}
                    />
                    <DetailRow
                        icon="cash-outline"
                        label={t('appointments.ownerAccepted.rows.serviceValue')}
                        value={appointment.budget ? `$${appointment.budget.replace(/^\$/, '')}` : '—'}
                        last
                    />
                </DetailCard>
            </View>
        );
    }

    const showTrip = section !== 'vehicle';
    const showVehicle = section !== 'trip';

    return (
        <View className="gap-3.5">
            {showTrip && (
                <>
                    {/* Trip logistics — grouped with the map right below */}
                    <DetailCard>
                        <DetailRow icon="time-outline" label={t('appointments.detail.info.arrivalTime')} value={arrivalValue} />
                        <DetailRow icon="calendar-outline" label={t('appointments.detail.info.estimatedArrival')} value={etaValue} />
                        <DetailRow icon="location-outline" label={t('appointments.detail.info.address')} value={appointment.address} last />
                    </DetailCard>

                    {/* Route map — client pin, own GPS dot, road route; tap for full screen */}
                    <OwnerRouteMap destination={requestCoords} mechanic={mechanicCoords} polyline={polyline} height={220} />
                </>
            )}

            {showVehicle && (
                <DetailCard>
                    <DetailRow icon="car-outline" label={t('appointments.detail.info.car')} value={appointment.car} />
                    <DetailRow icon="construct-outline" label={t('appointments.detail.info.carIssue')} value={issueValue} />
                    <DetailRow
                        icon="document-text-outline"
                        label={t('appointments.detail.info.notes')}
                        value={appointment.notes || t('appointments.detail.info.noNotes')}
                        last
                    />
                </DetailCard>
            )}
        </View>
    );
}
