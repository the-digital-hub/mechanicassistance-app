import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Car, MapPin, Navigation, Zap } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { CancelRequestLink, canCancelBeforeStart } from '@/components/appointments/CancelRequestLink';
import type { Appointment } from '@/context/AppointmentsContext';
import { useHeadOut } from '@/hooks/useHeadOut';
import { TYPE } from '@/lib/ui/type';
import { BANNER_COLORS, getCardState, getTypeBar } from './appointmentCardTheme';

/**
 * The mechanic's job in flight, on their dashboard — otherwise only reachable
 * from the Appointments tab. While the job is accepted but the mechanic has not
 * left yet, "Head out" is offered right here: that is what starts sharing their
 * position with the owner.
 */
export function MechanicActiveJobCard({ appointment }: { appointment: Appointment }) {
    const { t } = useTranslation();
    const router = useRouter();
    const { headOut, headingOut, departedNow } = useHeadOut();

    const isVideoCall = (appointment.assistanceType ?? appointment.type) === 'videocall';
    const departed = !!(appointment.departedAt ?? departedNow);
    const canHeadOut = appointment.status === 'accepted' && !isVideoCall && !departed;

    const state = getCardState({ ...appointment, departedAt: appointment.departedAt ?? departedNow });
    const colors = BANNER_COLORS[state];
    const typeBar = getTypeBar(appointment);
    // On the dashboard an immediate job wears the same bolt as the request cards above it.
    const TypeIcon = appointment.type === 'immediate' && appointment.assistanceType !== 'witness' ? Zap : typeBar.icon;

    const infoRows = [
        appointment.car ? { key: 'vehicle', Icon: Car, label: t('dashboard.user.requestVehicleLabel'), value: appointment.car } : null,
        appointment.address && !isVideoCall
            ? { key: 'location', Icon: MapPin, label: t('dashboard.user.requestLocationLabel'), value: appointment.address }
            : null,
    ].filter((row): row is NonNullable<typeof row> => row !== null);

    const openDetail = () => router.navigate(`/appointments/${appointment.id}`);

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
            {/* Type + title */}
            <View className="flex-row items-center">
                <View
                    className="justify-center items-center mr-3"
                    style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#EAF1FF' }}
                >
                    <TypeIcon size={20} color="#1E56E3" />
                </View>
                <View className="flex-1">
                    <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1, color: '#6B7490' }}>
                        {t(typeBar.labelKey).toUpperCase()}
                    </Text>
                    <Text
                        className="font-outfit-bold"
                        style={{ fontSize: 18, letterSpacing: -0.3, color: '#0B1530', marginTop: 1 }}
                        numberOfLines={1}
                    >
                        {appointment.title}
                    </Text>
                </View>
            </View>

            {/* Status */}
            <View className="mt-3 px-3 py-2.5" style={{ borderRadius: 12, backgroundColor: colors.bg }}>
                <Text className="font-outfit-bold" style={{ ...TYPE.body, color: colors.title }}>
                    {t(`appointments.list.card.title.${state}`)}
                </Text>
                <Text className="font-outfit-medium" style={{ ...TYPE.helper, color: colors.hint, marginTop: 2 }}>
                    {t(`appointments.list.card.status.${state}Hint`)}
                </Text>
            </View>

            {/* Vehicle / location */}
            {infoRows.length > 0 && (
                <View className="mt-3" style={{ borderRadius: 12, backgroundColor: '#F4F8FF' }}>
                    {infoRows.map(({ key, Icon, label, value }, index) => (
                        <View
                            key={key}
                            className="flex-row items-center px-3 py-3"
                            style={index > 0 ? { borderTopWidth: 1, borderTopColor: '#E1EAFB' } : undefined}
                        >
                            <View className="items-center justify-center mr-3" style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: '#FFFFFF' }}>
                                <Icon size={18} color="#1E56E3" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-outfit-semibold" style={{ ...TYPE.caption, color: '#6B7490' }}>
                                    {label}
                                </Text>
                                <Text className="font-outfit-bold" style={{ ...TYPE.body, color: '#0B1530' }} numberOfLines={2}>
                                    {value}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Actions */}
            <View className="flex-row mt-4" style={{ gap: 10 }}>
                {canHeadOut && (
                    <TouchableOpacity
                        style={{ flex: 0.6 }}
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
                            style={{ borderRadius: 16, minHeight: 54, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', opacity: headingOut ? 0.6 : 1 }}
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
                <TouchableOpacity
                    style={{ flex: canHeadOut ? 0.4 : 1, borderRadius: 16, minHeight: 54, paddingHorizontal: 8, backgroundColor: '#EAF1FF', alignItems: 'center', justifyContent: 'center' }}
                    onPress={openDetail}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                >
                    <Text className="font-outfit-semibold text-center" style={{ ...TYPE.button, color: '#1E56E3' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                        {t('appointments.list.card.viewDetails')}
                    </Text>
                </TouchableOpacity>
            </View>
            {canCancelBeforeStart(appointment.status) && (
                <View style={{ marginTop: 6 }}>
                    <CancelRequestLink appointmentId={appointment.id} />
                </View>
            )}
        </View>
    );
}
