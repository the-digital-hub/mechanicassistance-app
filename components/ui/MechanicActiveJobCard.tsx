import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Car, CalendarClock, MapPin, Navigation, Wrench, Zap } from 'lucide-react-native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { canCancelBeforeStart } from '@/components/appointments/CancelRequestLink';
import { InfoRows } from '@/components/ui/CardInfoRows';
import { RequestIdRow } from '@/components/ui/RequestIdRow';
import type { Appointment } from '@/context/AppointmentsContext';
import { useHeadOut } from '@/hooks/useHeadOut';
import { splitJobTitle } from '@/lib/ui/jobTitle';
import { TYPE } from '@/lib/ui/type';
import { formatZonedDateTime } from '@/lib/video/videoCallTime';
import { BANNER_COLORS, getCardState, getTypeBar, stateTextKey } from './appointmentCardTheme';

const JOIN_WINDOW_MS = 15 * 60_000;

/** "in 2 hours", "in 25 minutes", "in 3 days": how far away `at` is. */
function relativeFromNow(at: Date, t: TFunction): string {
    const mins = Math.max(1, Math.round((at.getTime() - Date.now()) / 60_000));
    if (mins < 60) return t('dashboard.mechanic.activeJob.inMinutes', { count: mins });
    if (mins < 60 * 24) return t('dashboard.mechanic.activeJob.inHours', { count: Math.round(mins / 60) });
    return t('dashboard.mechanic.activeJob.inDays', { count: Math.round(mins / 60 / 24) });
}

/**
 * The mechanic's job in flight, on their dashboard. One status pill, when it happens, the vehicle as a
 * plain row and a single main button; "Cancel request" lives in the "..." menu. While the job is accepted
 * but the mechanic has not left yet, "Head out" is offered right here (it starts sharing their position).
 */
export function MechanicActiveJobCard({ appointment }: { appointment: Appointment }) {
    const { t, i18n } = useTranslation();
    const router = useRouter();
    const { headOut, headingOut, departedNow } = useHeadOut();

    const isVideoCall = (appointment.assistanceType ?? appointment.type) === 'videocall';
    const departed = !!(appointment.departedAt ?? departedNow);
    const canHeadOut = appointment.status === 'accepted' && !isVideoCall && !departed;
    const canCancel = canCancelBeforeStart(appointment.status);

    const state = getCardState({ ...appointment, departedAt: appointment.departedAt ?? departedNow });
    const colors = BANNER_COLORS[state];
    const typeBar = getTypeBar(appointment);
    // On the dashboard an immediate job wears the same bolt as the request cards above it.
    const TypeIcon = appointment.type === 'immediate' && appointment.assistanceType !== 'witness' ? Zap : typeBar.icon;

    // When: a booked time (video call or scheduled service) with how far away it is.
    const at = !appointment.startNow && appointment.date ? new Date(appointment.date) : null;
    const hasTime = !!at && !isNaN(at.getTime());
    const inRoomNow = appointment.status === 'started' || appointment.status === 'in_progress';
    const future = hasTime && at!.getTime() > Date.now() && !inRoomNow;
    const whenLabel = hasTime ? formatZonedDateTime(at!, i18n.language) : '';
    const inRoom = appointment.status === 'started' || appointment.status === 'in_progress';
    // A call that already ended (finished and waiting for the owner, disputed, closed) has no room to enter.
    const callOpen = ['accepted', 'scheduled', 'started', 'in_progress'].includes(appointment.status);
    const joinable = isVideoCall && callOpen && (inRoom || appointment.startNow || (hasTime && at!.getTime() - Date.now() <= JOIN_WINDOW_MS));

    const { main: jobTitle, topic } = splitJobTitle(appointment.title);
    const rows: { key: string; label: string; Icon: typeof Car; value: string; sub?: string }[] = [
        topic ? { key: 'issue', label: t('appointments.list.card.rows.issue'), Icon: Wrench, value: topic } : null,
        hasTime ? { key: 'when', label: t('appointments.list.card.rows.when'), Icon: CalendarClock, value: whenLabel, sub: future ? relativeFromNow(at!, t) : undefined } : null,
        appointment.car ? { key: 'vehicle', label: t('appointments.list.card.rows.vehicle'), Icon: Car, value: appointment.car } : null,
        appointment.address && !isVideoCall ? { key: 'location', label: t('appointments.list.card.rows.location'), Icon: MapPin, value: appointment.address } : null,
    ].filter((row): row is NonNullable<typeof row> => row !== null);

    const openDetail = () => router.navigate(`/appointments/${appointment.id}`);
    const mainLabel = joinable
        ? t(inRoom ? 'appointments.videoCall.rejoin' : 'appointments.videoCall.join')
        : t('appointments.list.card.viewDetails');

    return (
        <View
            className="bg-white"
            style={{
                borderRadius: 20,
                padding: 16,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: '#EEF2FA',
                shadowColor: '#0E2F8A',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.06,
                shadowRadius: 14,
                elevation: 3,
            }}
            testID="mechanic-active-job"
        >
            {/* Header: the icon and the service. Under it the status, as one block, and then the data, each with its own tile. */}
            <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="justify-center items-center" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#EAF1FF' }}>
                    <TypeIcon size={22} color="#1E56E3" />
                </View>
                <View className="flex-1">
                    {/* What kind of assistance it is (immediate, scheduled, video call) over the service itself. */}
                    <Text className="font-outfit-bold" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 0.8, color: '#6B7490' }} testID="active-job-type">
                        {t(typeBar.labelKey).toUpperCase()}
                    </Text>
                    <Text className="font-outfit-bold" style={{ fontSize: 18, lineHeight: 23, letterSpacing: -0.3, color: '#0B1530', marginTop: 1 }} numberOfLines={2}>
                        {jobTitle}
                    </Text>
                </View>
            </View>

            {/* The dot sits at the first line; the title and its explanation share one column, so they line up. */}
            <View className="flex-row items-start" style={{ marginTop: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.bg, gap: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.title, marginTop: 6 }} />
                <View className="flex-1" style={{ gap: 3 }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 15, lineHeight: 20, color: colors.title }}>
                        {t(`appointments.list.card.title.${stateTextKey(state, true)}`)}
                    </Text>
                    <Text className="font-outfit-regular" style={{ fontSize: 15, lineHeight: 21, color: '#4A5470' }}>
                        {t(`appointments.list.card.status.${stateTextKey(state, true)}Hint`)}
                    </Text>
                </View>
            </View>

            {rows.length > 0 && (
                <View style={{ marginTop: 14 }}>
                    <InfoRows
                        rows={rows.map(({ label, Icon, value, sub }) => ({
                            icon: Icon,
                            label,
                            value,
                            node: sub ? (
                                <Text className="font-outfit-bold" style={{ fontSize: 15, lineHeight: 20, color: '#0B1530' }}>
                                    {value}
                                    <Text className="font-outfit-regular" style={{ fontSize: 14, color: '#6B7490' }}>{`  ·  ${sub}`}</Text>
                                </Text>
                            ) : undefined,
                        }))}
                    />
                </View>
            )}

            {/* One main action */}
            <View style={{ gap: 10, marginTop: 16 }}>
                {canHeadOut && (
                    <TouchableOpacity
                                                onPress={() => headOut(appointment.id)}
                        disabled={headingOut}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        testID="dashboard-head-out"
                    >
                        <LinearGradient
                            colors={['#2B66F8', '#081E72']}
                            start={{ x: 0, y: 1 }}
                            end={{ x: 1, y: 0 }}
                            style={{ borderRadius: 14, minHeight: 54, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', opacity: headingOut ? 0.6 : 1 }}
                        >
                            {headingOut ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <View className="flex-row items-center" style={{ gap: 8 }}>
                                    <Navigation size={18} color="#FFFFFF" />
                                    <Text className="text-white font-outfit-semibold text-center" style={TYPE.button} numberOfLines={1}>
                                        {t('dashboard.mechanic.activeJob.headOut')}
                                    </Text>
                                </View>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                )}
                {joinable && !canHeadOut ? (
                    <TouchableOpacity onPress={openDetail} activeOpacity={0.85} accessibilityRole="button" testID="active-job-join">
                        <LinearGradient
                            colors={['#2B66F8', '#081E72']}
                            start={{ x: 0, y: 1 }}
                            end={{ x: 1, y: 0 }}
                            style={{ borderRadius: 14, minHeight: 54, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Text className="text-white font-outfit-semibold text-center" style={TYPE.button} numberOfLines={1}>{mainLabel}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={{ borderRadius: 14, minHeight: 54, paddingHorizontal: 8, backgroundColor: '#EAF1FF', alignItems: 'center', justifyContent: 'center' }}
                        onPress={openDetail}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                    >
                        <Text className="font-outfit-semibold text-center" style={{ ...TYPE.button, color: '#1E56E3' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                            {mainLabel}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            <RequestIdRow id={appointment.id} refCode={appointment.refCode} cancelAppointmentId={canCancel ? appointment.id : undefined} style={{ marginTop: 12 }} />
        </View>
    );
}
