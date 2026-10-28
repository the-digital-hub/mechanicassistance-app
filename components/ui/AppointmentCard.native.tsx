import { Appointment } from '@/context/AppointmentsContext';
import { useUser } from '@/context/UserContext';
import { haversineDistanceKm } from '@/lib/utils';
import { approximateArea, coarseAddress } from '@/lib/maps/approximateLocation';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Calendar, Car, LucideIcon, MapPin, MessageSquare, Route } from 'lucide-react-native';
import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Platform, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatLocalDateTime, videoCallBookedLabel } from '@/lib/video/videoCallTime';
import { BANNER_COLORS, getCardState, getTypeBar, isPastState } from './appointmentCardTheme';
import { FixedLocationMap } from './FixedLocationMap';
import { ScrollPressGuardContext } from '@/hooks/useScrollPressGuard';
import { AppointmentMechanic, useAppointmentMechanic } from '@/hooks/useAppointmentMechanic';
import { Stars } from '@/components/offer/OfferSections';

interface AppointmentCardProps {
    appointment: Appointment;
    onCancel: (id: string) => void;
}

const C = {
    blue: '#1E56E3',
    blueSoft: '#EAF1FF',
    blueSofter: '#F4F8FF',
    text: '#0B1530',
    muted: '#6B7490',
    mutedLight: '#8C96AE',
    borderSoft: '#EEF2FA',
    page: '#F6F8FC',
    red: '#E53E3E',
    pastTile: '#EEF1F6',
};

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

function InfoRows({ rows }: { rows: { icon: LucideIcon; label: string; value: string }[] }) {
    return (
        <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.borderSoft }}>
            {rows.map((r, i) => {
                const RowIcon = r.icon;
                return (
                    <View
                        key={r.label}
                        className="flex-row items-center"
                        style={{
                            gap: 12,
                            paddingVertical: 9,
                            paddingHorizontal: 12,
                            borderBottomWidth: i < rows.length - 1 ? 1 : 0,
                            borderBottomColor: C.borderSoft,
                        }}
                    >
                        <View className="items-center justify-center" style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.blueSoft }}>
                            <RowIcon size={16} color={C.blue} />
                        </View>
                        <Text className="font-outfit-medium text-xs" style={{ color: C.muted, width: 66 }}>{r.label}</Text>
                        <Text className="flex-1 font-outfit-bold text-[13px] text-right" style={{ color: C.text }} numberOfLines={2}>
                            {r.value}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

function TechnicianRow({ mechanic, label, onMessage, messageLabel }: {
    mechanic: AppointmentMechanic;
    label: string;
    onMessage?: () => void;
    messageLabel: string;
}) {
    const { t } = useTranslation();
    return (
        <View className="flex-row items-center bg-white" style={{ gap: 10, borderRadius: 14, paddingVertical: 8, paddingLeft: 10, paddingRight: 8, borderWidth: 1, borderColor: C.borderSoft }}>
            {mechanic.profileImage ? (
                <Image source={{ uri: mechanic.profileImage }} style={{ width: 38, height: 38, borderRadius: 19 }} />
            ) : (
                <LinearGradient
                    colors={['#4A7BFF', '#0B2A8E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }}
                >
                    <Text className="font-outfit-bold text-[13px] text-white">{mechanic.initials ?? '?'}</Text>
                </LinearGradient>
            )}
            <View className="flex-1">
                <Text className="font-outfit-bold text-[10.5px] uppercase" style={{ color: C.muted, letterSpacing: 0.8 }}>{label}</Text>
                <View className="flex-row items-center" style={{ gap: 6, marginTop: 1 }}>
                    <Text className="font-outfit-bold text-[14.5px] flex-shrink" style={{ color: C.text, letterSpacing: -0.2 }} numberOfLines={1}>
                        {mechanic.displayName ?? t('requestAssistance.mechanicFound.technicianFallback')}
                    </Text>
                    {mechanic.avgRating != null ? (
                        <View className="flex-row items-center" style={{ gap: 4 }}>
                            <Stars rating={mechanic.avgRating} />
                            <Text className="font-outfit-semibold text-[11px]" style={{ color: C.muted }}>
                                {t('appointments.list.card.ratingValue', { rating: mechanic.avgRating.toFixed(1), count: mechanic.ratingCount })}
                            </Text>
                        </View>
                    ) : (
                        <Text className="font-outfit-semibold text-[11px]" style={{ color: C.muted }}>{t('appointments.list.card.noRatings')}</Text>
                    )}
                </View>
            </View>
            {onMessage && (
                <TouchableOpacity
                    accessibilityLabel={messageLabel}
                    onPress={onMessage}
                    activeOpacity={0.8}
                    className="items-center justify-center"
                    style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: C.blueSoft }}
                >
                    <MessageSquare size={17} color={C.blue} />
                </TouchableOpacity>
            )}
        </View>
    );
}

export function AppointmentCard({ appointment, onCancel }: AppointmentCardProps) {
    const router = useRouter();
    const guardPress = useContext(ScrollPressGuardContext);
    const { t, i18n } = useTranslation();
    const { user } = useUser();
    const isMechanic = user?.role === 'mechanic';
    const isVideoCall = (appointment.assistanceType ?? appointment.type) === 'videocall';
    const hasLocation = !!appointment.locationLat && !!appointment.locationLng;

    const [distanceKm, setDistanceKm] = useState<number | null>(null);

    // A mechanic's distance is measured to the approximate zone, not the real
    // point: an exact distance from a known position would give it back.
    useEffect(() => {
        if (isVideoCall || !hasLocation) return;
        const target = isMechanic
            ? approximateArea(appointment.locationLat!, appointment.locationLng!, appointment.id)
            : { latitude: appointment.locationLat!, longitude: appointment.locationLng! };
        Location.getLastKnownPositionAsync().then((pos) => {
            if (pos) {
                setDistanceKm(haversineDistanceKm(pos.coords.latitude, pos.coords.longitude, target.latitude, target.longitude));
            }
        }).catch(() => { /* permission not granted yet — leave null */ });
    }, [isVideoCall, hasLocation, isMechanic, appointment.id, appointment.locationLat, appointment.locationLng]);

    const state = getCardState(appointment);
    const isPast = isPastState(state);
    // A canceled job has no detail screen to open: its card and CTA stay inert.
    const isCanceled = state === 'canceled';
    const status = BANNER_COLORS[state];
    const typeBar = getTypeBar(appointment);
    const TypeIcon = typeBar.icon;

    /**
     * A row still sourced from assistance_requests has no appointment detail
     * screen — /appointments/[id] assumes an accepted job. Send each role to the
     * screen that can actually act on the request.
     */
    const openDetail = () => {
        // A mechanic's finished job opens its receipt, not the request.
        if (isMechanic && state === 'completed') {
            router.push({ pathname: '/(tabs)/appointments/receipt/[id]' as any, params: { id: appointment.id } });
            return;
        }
        if (appointment.source === 'assistance') {
            if (isMechanic) {
                router.push({
                    pathname: '/(tabs)/assist/[id]' as any,
                    params: {
                        id: appointment.id,
                        type: appointment.type,
                        assistanceType: appointment.assistanceType ?? '',
                        title: appointment.title,
                        car: appointment.car,
                        address: appointment.address,
                        zip: appointment.zip ?? '',
                        budget: appointment.budget ?? '',
                        userId: appointment.userId ?? '',
                        locationLat: appointment.locationLat ?? '',
                        locationLng: appointment.locationLng ?? '',
                        vehicleIssues: JSON.stringify(appointment.vehicleIssues ?? []),
                        status: appointment.status,
                    },
                });
                return;
            }
            if (appointment.status === 'offered') {
                router.push({
                    pathname: '/request-assistance/mechanic-found' as any,
                    params: { requestId: appointment.id },
                });
                return;
            }
            router.push({
                pathname: '/request-assistance/searching' as any,
                params: { requestId: appointment.id, type: appointment.type },
            });
            return;
        }
        router.navigate(`/appointments/${appointment.id}`);
    };

    const whenLabel = (() => {
        if (isVideoCall) return videoCallBookedLabel(appointment, i18n.language) ?? t('requestDetail.videoCallNow');
        if (appointment.date?.includes('T')) return formatLocalDateTime(appointment.date, i18n.language);
        const parts = [appointment.date, appointment.time].filter((v) => v && v !== 'Pending');
        return parts.length ? parts.join(' · ') : t('appointments.list.card.notAvailable');
    })();

    // The mechanic gets the area only (city / zip); the owner keeps their own address.
    const locationLabel = isMechanic
        ? coarseAddress(appointment.address, appointment.zip) || t('appointments.list.card.notAvailable')
        : appointment.address;

    const rows = [
        { icon: Car, label: t('appointments.list.card.rows.vehicle'), value: appointment.car },
        ...(isVideoCall
            ? []
            : [
                { icon: MapPin, label: t('appointments.list.card.rows.location'), value: locationLabel },
                {
                    icon: Route,
                    label: t('appointments.list.card.rows.distance'),
                    value: distanceKm != null
                        ? t(isMechanic ? 'appointments.list.card.distanceApprox' : 'appointments.list.card.distanceExact', { km: distanceKm.toFixed(1) })
                        : t('appointments.list.card.notAvailable'),
                },
            ]),
        { icon: Calendar, label: t(isPast ? 'appointments.list.card.rows.date' : 'appointments.list.card.rows.when'), value: whenLabel },
    ];

    const notCharged = state === 'canceled' || state === 'notCharged';
    const amountLabel = !isPast
        ? t('appointments.list.card.budgetLabel')
        : notCharged
            ? t('appointments.list.card.chargedLabel')
            : t(isMechanic ? 'appointments.list.card.earnedLabel' : 'appointments.list.card.paidLabel');
    const amount = notCharged ? '$0' : appointment.budget;

    const ctaLabel = state === 'offered' && !isMechanic
        ? t('appointments.list.card.viewOffer')
        : state === 'completed'
            ? t('appointments.list.card.viewReceipt')
            : t('appointments.list.card.viewDetails');

    const canMessage = !isPast && appointment.source === 'appointment';
    const openChat = guardPress(() => router.push(`/chat/${appointment.id}`));

    // The offer summary is owner-only, and needs a mechanic on the request.
    const mechanic = useAppointmentMechanic(appointment.id, !isMechanic && !!appointment.mechanicId);

    return (
        <TouchableOpacity
            className="bg-white"
            style={{ borderRadius: 20, padding: 14, borderWidth: 1, borderColor: C.borderSoft }}
            onPress={guardPress(openDetail)}
            disabled={isCanceled}
            activeOpacity={0.7}
        >
            {/* Service type + issue */}
            <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isPast ? C.pastTile : C.blueSoft }}>
                    <TypeIcon size={20} color={isPast ? C.muted : C.blue} />
                </View>
                <View className="flex-1">
                    <Text className="font-outfit-bold text-[10.5px] uppercase" style={{ color: C.muted, letterSpacing: 0.9 }}>
                        {t(typeBar.labelKey)}
                    </Text>
                    <Text className="font-outfit-bold text-[17px]" style={{ color: C.text, letterSpacing: -0.3 }} numberOfLines={1}>
                        {appointment.title || t(`appointments.list.card.title.${state}`)}
                    </Text>
                </View>
            </View>

            {/* Status pill */}
            <View className="flex-row items-center mt-3" style={{ gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: status.bg }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: status.title }} />
                <Text className="font-outfit-bold text-[11px] uppercase" style={{ color: status.title, letterSpacing: 0.8 }}>
                    {t(`appointments.list.card.status.${state}`)}
                </Text>
            </View>

            {/* Fixed map: the owner sees their own pin, a mechanic only the zone */}
            {!isPast && !isVideoCall && (
                <View className="mt-3">
                    {hasLocation ? (
                        <>
                            <FixedLocationMap
                                latitude={appointment.locationLat!}
                                longitude={appointment.locationLng!}
                                approximate={isMechanic}
                                seed={appointment.id}
                            />
                            {isMechanic && (
                                <Text className="font-outfit-medium text-[11px] mt-1.5" style={{ color: C.mutedLight }}>
                                    {t('appointments.list.card.approximateArea')}
                                </Text>
                            )}
                        </>
                    ) : (
                        <View className="items-center justify-center" style={{ height: 120, borderRadius: 14, backgroundColor: C.page, borderWidth: 1, borderColor: C.borderSoft }}>
                            <MapPin size={24} color={C.mutedLight} />
                            <Text className="font-outfit-regular text-xs mt-1" style={{ color: C.mutedLight }}>
                                {t('appointments.list.card.locationNotAvailable')}
                            </Text>
                        </View>
                    )}
                </View>
            )}

            {mechanic && (
                <View className="mt-3">
                    <TechnicianRow
                        mechanic={mechanic}
                        label={t(isPast ? 'appointments.list.card.technician' : 'appointments.list.card.assignedTechnician')}
                        onMessage={canMessage ? openChat : undefined}
                        messageLabel={t('appointments.list.card.message')}
                    />
                </View>
            )}

            <View className="mt-3">
                <InfoRows rows={rows} />
            </View>

            {/* Amount + action */}
            <View className="flex-row mt-3" style={{ gap: 10 }}>
                <View
                    style={{
                        minWidth: 96,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 13,
                        backgroundColor: isPast ? C.page : C.blueSofter,
                        borderWidth: 1,
                        borderColor: isPast ? C.borderSoft : C.blueSoft,
                    }}
                >
                    <Text className="font-outfit-bold text-[10.5px] uppercase" style={{ color: C.muted, letterSpacing: 0.4 }}>{amountLabel}</Text>
                    <Text className="font-outfit-bold text-xl" style={{ color: isPast ? C.text : C.blue, letterSpacing: -0.5, lineHeight: 23 }} numberOfLines={1}>{amount}</Text>
                </View>

                <TouchableOpacity
                    className="flex-1"
                    activeOpacity={0.8}
                    onPress={guardPress(openDetail)}
                    disabled={isCanceled}
                    accessibilityState={{ disabled: isCanceled }}
                >
                    {isPast ? (
                        <View
                            className="flex-1 items-center justify-center"
                            style={{ borderRadius: 13, backgroundColor: isCanceled ? C.pastTile : C.blueSoft, opacity: isCanceled ? 0.5 : 1 }}
                        >
                            <Text className="font-outfit-bold text-[14.5px]" style={{ color: isCanceled ? C.muted : C.blue }}>{ctaLabel}</Text>
                        </View>
                    ) : (
                        <LinearGradient
                            colors={['#2B66F8', '#081E72']}
                            start={{ x: 0, y: 1 }}
                            end={{ x: 1, y: 0 }}
                            style={{ flex: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Text className="font-outfit-bold text-[14.5px] text-white">{ctaLabel}</Text>
                        </LinearGradient>
                    )}
                </TouchableOpacity>

                {/* Chat sits in the technician row when that row is shown */}
                {canMessage && !mechanic && (
                    <TouchableOpacity
                        accessibilityLabel={t('appointments.list.card.message')}
                        onPress={openChat}
                        activeOpacity={0.8}
                        className="items-center justify-center"
                        style={{ width: 52, borderRadius: 13, backgroundColor: C.blueSoft }}
                    >
                        <MessageSquare size={18} color={C.blue} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Footer: id + cancel */}
            <View className="flex-row items-center justify-between mt-2.5">
                <Text style={{ fontFamily: MONO, fontSize: 11, color: C.mutedLight }}>#{appointment.id.slice(0, 8)}</Text>
                {!isPast && (
                    <TouchableOpacity onPress={guardPress(() => onCancel(appointment.id))} hitSlop={8}>
                        <Text className="font-outfit-bold text-xs" style={{ color: C.red }}>{t('appointments.list.card.cancelRequest')}</Text>
                    </TouchableOpacity>
                )}
            </View>
        </TouchableOpacity>
    );
}
