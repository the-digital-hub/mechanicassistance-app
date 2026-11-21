import { useAcceptedSlot } from '@/lib/scheduled/slot';
import { Appointment } from '@/context/AppointmentsContext';
import { useUser } from '@/context/UserContext';
import { haversineDistanceKm, kmToMiles } from '@/lib/utils';
import { refLabel } from '@/lib/refCode';
import { approximateArea, coarseAddress } from '@/lib/maps/approximateLocation';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Calendar, Car, Clock, FileText, LucideIcon, MapPin, MessageSquare, Route, Star, Timer, Wallet } from 'lucide-react-native';
import { ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Platform, Text, TouchableOpacity, View } from 'react-native';
import { shareServiceReportPdf } from '@/components/on-site/FinalReportActions';
import { appAlert } from '@/lib/ui/appAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { formatLocalDateTime, videoCallBookedLabel } from '@/lib/video/videoCallTime';
import { BANNER_COLORS, getCardState, getTypeBar, isPastState } from './appointmentCardTheme';
import { FixedLocationMap } from './FixedLocationMap';
import { ScrollPressGuardContext } from '@/hooks/useScrollPressGuard';
import { AppointmentMechanic, useAppointmentMechanic } from '@/hooks/useAppointmentMechanic';
import { useCallExtraMinutes } from '@/hooks/useCallExtraMinutes';
import { TranscriptCard, useHasTranscript } from '@/components/video/TranscriptCard';
import { Stars } from '@/components/offer/OfferSections';
import { useCountdown } from '@/hooks/useCountdown';
import { RequestIdRow } from '@/components/ui/RequestIdRow';

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

/** A mechanic's offer waits for the owner only while it is held: how long is left, in the card of the offer. */
function OfferHeldBanner({ expiresAt }: { expiresAt: string }) {
    const { t } = useTranslation();
    const deadline = useMemo(() => {
        const ms = new Date(expiresAt).getTime();
        return Number.isFinite(ms) ? ms : null;
    }, [expiresAt]);
    const left = useCountdown(deadline);
    if (deadline === null || left <= 0) return null;
    const time = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    return (
        <View className="flex-row items-center mt-2" style={{ gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#FEF4E2' }} testID="offer-held-banner">
            <Clock size={18} color="#F08A1C" />
            <View className="flex-1">
                <Text className="font-outfit-bold text-[15px]" style={{ color: '#8A5A12' }}>{t('requestAssistance.mechanicFound.heldFor', { time })}</Text>
                <Text className="font-outfit-regular text-[13px]" style={{ color: '#8A5A12', lineHeight: 18 }}>{t('appointments.list.card.offerHeldHint')}</Text>
            </View>
        </View>
    );
}

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

function InfoRows({ rows }: { rows: { icon: LucideIcon; label: string; value?: string; node?: ReactNode }[] }) {
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
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderBottomWidth: i < rows.length - 1 ? 1 : 0,
                            borderBottomColor: C.borderSoft,
                        }}
                    >
                        <View className="items-center justify-center" style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.blueSoft }}>
                            <RowIcon size={16} color={C.blue} />
                        </View>
                        {/* One column: the label above and the value (or the stars) under it, full width: nothing squeezes or cuts. */}
                        <View className="flex-1">
                            <Text className="font-outfit-medium text-[13px]" style={{ color: C.muted, lineHeight: 17 }}>{r.label}</Text>
                            {r.node ? (
                                <View className="flex-row items-center" style={{ marginTop: 2 }}>{r.node}</View>
                            ) : (
                                <Text className="font-outfit-bold" style={{ color: C.text, fontSize: 15, lineHeight: 20, marginTop: 1 }}>
                                    {r.value}
                                </Text>
                            )}
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

function TechnicianRow({ mechanic, label, onMessage, messageLabel, chatClosed = false }: {
    mechanic: AppointmentMechanic;
    label: string;
    onMessage?: () => void;
    messageLabel: string;
    /** The job ended: the chat button is greyed and blocked. */
    chatClosed?: boolean;
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
                <Text className="font-outfit-bold text-[12px] uppercase" style={{ color: C.muted, letterSpacing: 0.8 }}>{label}</Text>
                <View className="flex-row items-center" style={{ gap: 6, marginTop: 1 }}>
                    <Text className="font-outfit-bold text-[15px] flex-shrink" style={{ color: C.text, letterSpacing: -0.2 }} numberOfLines={1}>
                        {mechanic.displayName ?? t('requestAssistance.mechanicFound.technicianFallback')}
                    </Text>
                    {mechanic.avgRating != null ? (
                        <View className="flex-row items-center" style={{ gap: 4 }}>
                            <Stars rating={mechanic.avgRating} />
                            <Text className="font-outfit-semibold text-[13px]" style={{ color: C.muted }}>
                                {t('appointments.list.card.ratingValue', { rating: Number(mechanic.avgRating).toFixed(1), count: mechanic.ratingCount })}
                            </Text>
                        </View>
                    ) : (
                        <Text className="font-outfit-semibold text-[13px]" style={{ color: C.muted }}>{t('appointments.list.card.noRatings')}</Text>
                    )}
                </View>
            </View>
            {onMessage && (
                <TouchableOpacity
                    accessibilityLabel={messageLabel}
                    onPress={onMessage}
                    disabled={chatClosed}
                    accessibilityState={{ disabled: chatClosed }}
                    activeOpacity={0.8}
                    className="items-center justify-center"
                    style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: chatClosed ? '#F1F3F8' : C.blueSoft }}
                >
                    <MessageSquare size={17} color={chatClosed ? '#A8B0C2' : C.blue} />
                </TouchableOpacity>
            )}
        </View>
    );
}

export function AppointmentCard({ appointment: base, onCancel }: AppointmentCardProps) {
    // A scheduled service is booked for the time the provider offered, not the window the owner asked for.
    const slot = useAcceptedSlot(base.id, (base.assistanceType ?? base.type) === 'scheduled' && base.source === 'appointment');
    const appointment = useMemo(() => (slot ? { ...base, date: slot.start } : base), [base, slot]);
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
        // A finished job opens its receipt (each role sees its own side), not the request.
        if (state === 'completed') {
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
            if (appointment.type === 'scheduled') {
                router.push({
                    pathname: '/request-assistance/scheduled-offers' as any,
                    params: { requestId: appointment.id },
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
        // A finished job shows when it ended: for an immediate one `time` holds the ETA ("1 min"), not a date.
        // No `cancelledAt` exists, so a cancelled one falls back to `updatedAt`.
        if (isPast) {
            const finishedAt = appointment.completedAt ?? appointment.startedAt ?? appointment.acceptedAt ?? appointment.updatedAt;
            const label = formatLocalDateTime(finishedAt, i18n.language);
            if (label) return label;
        }
        if (isVideoCall) return videoCallBookedLabel(appointment, i18n.language) ?? t('requestDetail.videoCallNow');
        if (appointment.date?.includes('T')) return formatLocalDateTime(appointment.date, i18n.language);
        const parts = [appointment.date, appointment.time].filter((v) => v && v !== 'Pending');
        return parts.length ? parts.join(' · ') : t('appointments.list.card.notAvailable');
    })();

    // The mechanic gets the area only (city / zip); the owner keeps their own address.
    const locationLabel = isMechanic
        ? coarseAddress(appointment.address, appointment.zip) || t('appointments.list.card.notAvailable')
        : appointment.address;

    // A finished or cancelled job leads with its date; an active one leads with the vehicle.
    const dateRow = { icon: Calendar, label: t(isPast ? 'appointments.list.card.rows.date' : 'appointments.list.card.rows.when'), value: whenLabel };
    // A finished call that had time added: say how much, right after its duration.
    const extraMinutes = useCallExtraMinutes(appointment.id, isVideoCall && state === 'completed' && appointment.source === 'appointment', appointment.extendedMinutes);
    const hasTranscript = useHasTranscript(appointment.id, isMechanic ? 'mechanic' : 'owner', isVideoCall && state === 'completed' && appointment.source === 'appointment', appointment.hasTranscript);
    const rows = [
        ...(isPast ? [dateRow] : []),
        // A video call: how long it lasts, before the vehicle.
        ...(isVideoCall && appointment.durationMinutes
            ? [{ icon: Timer, label: t('appointments.list.card.rows.duration'), value: t('requestAssistance.when.durationValue', { count: appointment.durationMinutes }) }]
            : []),
        ...(isVideoCall && extraMinutes > 0
            ? [{ icon: Timer, label: t('appointments.list.card.rows.extendedTime'), value: t('appointments.list.card.extendedTimeValue', { count: extraMinutes }) }]
            : []),
        // A call that was transcribed: one more data row, with the button to read it.
        ...(hasTranscript
            ? [{
                icon: FileText,
                label: t('appointments.list.card.rows.transcript'),
                node: (
                    <TranscriptCard
                        variant="row"
                        appointmentId={appointment.id}
                        role={isMechanic ? 'mechanic' : 'owner'}
                        info={{
                            ref: appointment.refCode ?? null,
                            vehicle: appointment.car ?? null,
                            callDate: whenLabel || null,
                            durationMinutes: (appointment.durationMinutes ?? 0) + extraMinutes || null,
                            selfName: [user?.name, user?.surname].filter(Boolean).join(' ') || null,
                        }}
                    />
                ),
            }]
            : []),
        { icon: Car, label: t('appointments.list.card.rows.vehicle'), value: appointment.car },
        ...(isVideoCall
            ? []
            : [
                { icon: MapPin, label: t('appointments.list.card.rows.location'), value: locationLabel },
                {
                    icon: Route,
                    label: t('appointments.list.card.rows.distance'),
                    value: distanceKm != null
                        ? t(isMechanic ? 'appointments.list.card.distanceApprox' : 'appointments.list.card.distanceExact', { miles: kmToMiles(distanceKm).toFixed(1) })
                        : t('appointments.list.card.notAvailable'),
                },
            ]),
        ...(isPast ? [] : [dateRow]),
        // The stars each side gave for this one job — the dashboard only shows the average.
        ...(state === 'completed' && appointment.source === 'appointment'
            ? ([
                ['ratingFromCustomer', appointment.reviewRating],
                ['ratingFromMechanic', appointment.clientRating],
            ] as const).map(([labelKey, stars]) => ({
                icon: Star,
                label: t(`appointments.list.card.rows.${labelKey}`),
                node: stars != null && stars > 0 ? (
                    <View className="flex-row items-center" style={{ gap: 6 }}>
                        <Stars rating={stars} size={13} />
                        <Text className="font-outfit-bold text-[13px]" style={{ color: C.text }}>{stars}/5</Text>
                    </View>
                ) : (
                    <Text className="font-outfit-semibold text-[13px]" style={{ color: C.muted }}>{t('appointments.list.card.notRated')}</Text>
                ),
            }))
            : []),
    ];

    const notCharged = state === 'canceled' || state === 'notCharged';
    const amountLabel = !isPast
        ? t('appointments.list.card.budgetLabel')
        : notCharged
            ? t('appointments.list.card.chargedLabel')
            : t(isMechanic ? 'appointments.list.card.earnedLabel' : 'appointments.list.card.paidLabel');
    // No price yet (a request still waiting for a technician): say so instead of leaving the box empty.
    const hasPrice = !!appointment.budget && !/^\s*(\$?\s*0(\.0+)?|pending|-+)\s*$/i.test(appointment.budget);
    const amount = notCharged ? '$0' : hasPrice ? appointment.budget : t('appointments.list.card.pricePending');

    // A finished or cancelled job lists what was paid (or charged) with the rest of its data (vehicle, ratings…); the other cards keep the amount in its own box.
    const amountInRows = isPast;
    const infoRows = amountInRows ? [...rows, { icon: Wallet, label: amountLabel, value: amount }] : rows;

    const ctaLabel = state === 'offered' && !isMechanic
        ? t('appointments.list.card.viewOffer')
        : state === 'completed'
            ? t('appointments.list.card.viewReceipt')
            : t('appointments.list.card.viewDetails');

    // Past jobs: the chat button is greyed and blocked.
    const canMessage = appointment.source === 'appointment';
    const openChat = guardPress(() => router.push(`/chat/${appointment.id}`));

    // The offer summary is owner-only, and needs a mechanic on the request.
    const mechanic = useAppointmentMechanic(appointment.id, !isMechanic && !!appointment.mechanicId);

    // A finished job: its service report as a PDF, next to the receipt.
    const [makingPdf, setMakingPdf] = useState(false);
    const downloadReport = async () => {
        if (makingPdf) return;
        setMakingPdf(true);
        const fullName = [user?.name, user?.surname].filter(Boolean).join(' ') || null;
        const ok = await shareServiceReportPdf({
            appointment,
            role: isMechanic ? 'mechanic' : 'user',
            ownerName: isMechanic ? null : fullName,
            mechanicName: isMechanic ? fullName : mechanic?.displayName ?? null,
            t,
            lang: i18n.language,
        });
        setMakingPdf(false);
        if (!ok) appAlert(t('appointments.report.pdf.failed'));
    };

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
                    <Text className="font-outfit-bold text-[12px] uppercase" style={{ color: C.muted, letterSpacing: 0.9 }}>
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
                <Text className="font-outfit-bold text-[12px] uppercase" style={{ color: status.title, letterSpacing: 0.8 }}>
                    {t(`appointments.list.card.status.${state}`)}
                </Text>
            </View>
            {isMechanic && state === 'offered' && appointment.offerExpiresAt ? <OfferHeldBanner expiresAt={appointment.offerExpiresAt} /> : null}

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
                                <Text className="font-outfit-medium text-[13px] mt-1.5" style={{ color: C.mutedLight }}>
                                    {t('appointments.list.card.approximateArea')}
                                </Text>
                            )}
                        </>
                    ) : (
                        <View className="items-center justify-center" style={{ height: 120, borderRadius: 14, backgroundColor: C.page, borderWidth: 1, borderColor: C.borderSoft }}>
                            <MapPin size={24} color={C.mutedLight} />
                            <Text className="font-outfit-regular text-[13px] mt-1" style={{ color: C.mutedLight }}>
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
                        chatClosed={isPast}
                        messageLabel={t('appointments.list.card.message')}
                    />
                </View>
            )}

            <View className="mt-3">
                <InfoRows rows={infoRows} />
            </View>

            {/* The amount in its own card (a finished job lists it with its data above), and the button under it at full width: never two columns. */}
            {!amountInRows && (
            <View
                className="mt-3"
                style={{
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 13,
                    backgroundColor: isPast ? C.page : C.blueSofter,
                    borderWidth: 1,
                    borderColor: isPast ? C.borderSoft : C.blueSoft,
                }}
            >
                <Text className="font-outfit-bold text-[12px] uppercase" style={{ color: C.muted, letterSpacing: 0.4 }}>{amountLabel}</Text>
                <Text className="font-outfit-bold text-xl" style={{ color: isPast ? C.text : C.blue, letterSpacing: -0.5, lineHeight: 24 }} numberOfLines={1}>{amount}</Text>
            </View>
            )}

            {/* A cancelled job has nothing to open. */}
            {!isCanceled && (
                // The same button as the rest of the app: full width, tall, radius 14, 16 px; the active one on the blue gradient with its glow.
                <TouchableOpacity
                    className="mt-3"
                    activeOpacity={0.85}
                    onPress={guardPress(openDetail)}
                    accessibilityRole="button"
                    style={isPast ? undefined : { borderRadius: 14, shadowColor: '#1E56E3', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 }}
                >
                    {isPast ? (
                        <View className="items-center justify-center" style={{ minHeight: 56, borderRadius: 14, backgroundColor: C.blueSoft }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 16, color: C.blue }}>{ctaLabel}</Text>
                        </View>
                    ) : (
                        <LinearGradient
                            colors={['#1E56E3', '#0B2A8E']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Text className="font-outfit-bold text-white" style={{ fontSize: 16 }}>{ctaLabel}</Text>
                        </LinearGradient>
                    )}
                </TouchableOpacity>
            )}

            {/* A finished job: the service report as a PDF, under the receipt button */}
            {state === 'completed' && (
                <TouchableOpacity
                    className="mt-2 flex-row items-center justify-center"
                    activeOpacity={0.8}
                    onPress={guardPress(downloadReport)}
                    disabled={makingPdf}
                    accessibilityRole="button"
                    style={{ gap: 8, minHeight: 46, borderRadius: 13, borderWidth: 1.5, borderColor: C.blueSoft, backgroundColor: C.page, opacity: makingPdf ? 0.7 : 1 }}
                    testID={`appointment-report-pdf-${appointment.id}`}
                >
                    {makingPdf ? <ActivityIndicator color={C.blue} /> : <FileText size={18} color={C.blue} />}
                    <Text className="font-outfit-bold text-[15px]" style={{ color: C.blue }}>
                        {makingPdf ? t('appointments.report.pdf.preparing') : t('appointments.report.pdf.button')}
                    </Text>
                </TouchableOpacity>
            )}

            {/* Footer: id + cancel, the same row everywhere */}
            <RequestIdRow id={appointment.id} refCode={appointment.refCode} onCancel={!isPast ? guardPress(() => onCancel(appointment.id)) : undefined} style={{ marginTop: 10 }} />
        </TouchableOpacity>
    );
}
