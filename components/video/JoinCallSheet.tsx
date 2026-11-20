import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { VideoCallTimerCard } from '@/components/appointments/VideoCallTimerCard';
import { GradientButton } from '@/components/appointments/VideoCallSections';
import { AO } from '@/components/offer/OfferSections';
import { SheetDim } from '@/components/ui/SheetDim';
import { SheetHandle } from '@/components/ui/SheetHandle';
import { LiveRadar } from '@/components/video/LiveRadar';
import { useVideoCallJoin, type VideoRoomEntry } from '@/hooks/useVideoCallJoin';
import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';
import { SHEET } from '@/lib/ui/sheet';
import { TYPE } from '@/lib/ui/type';
import { contractedSeconds } from '@/lib/video/callLength';

const L = 'videoCall.lobby';

/**
 * What opens from "Join video call": the conditions of the call (acceptance, recommendations) and "Connect".
 * It replaces the separate lobby screen: the same steps, without leaving the appointment.
 */
export function JoinCallSheet({ visible, appointmentId, onClose, onEnter }: {
    visible: boolean;
    appointmentId: string;
    onClose: () => void;
    onEnter: (room: VideoRoomEntry) => void;
}) {
    const { t } = useTranslation();
    const join = useVideoCallJoin(appointmentId, visible, onEnter);
    const { appointment, isUserRole, rejoin, minutes, callState } = join;

    const tips = [1, 2, 3].map((n) => t(`${L}.tips.${isUserRole ? 'owner' : 'mechanic'}${n}`));
    const rows = [
        appointment?.car ? { icon: 'car-sport-outline' as const, label: t(`${L}.labels.vehicle`), text: appointment.car } : null,
        join.otherPartyName ? { icon: 'person-outline' as const, label: t(isUserRole ? `${L}.labels.technician` : `${L}.labels.customer`), text: join.otherPartyName } : null,
        { icon: 'timer-outline' as const, label: t(`${L}.labels.duration`), text: t('requestAssistance.when.durationValue', { count: minutes }) },
    ].filter((r): r is NonNullable<typeof r> => r !== null);

    const title = t(rejoin ? `${L}.rejoinTitle` : isUserRole ? `${L}.startTitle` : `${L}.joinTitle`);
    const hint = rejoin ? t(`${L}.rejoinHint`) : isUserRole ? t(`${L}.startHint`) : join.roomUrl ? t(`${L}.joinHint`) : t(`${L}.waitingHint`);
    const waitingForRoom = !isUserRole && !join.roomUrl && !join.checkingRoom;

    return (
        <Modal supportedOrientations={MODAL_ORIENTATIONS} transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <SheetDim color="rgba(11,21,48,0.45)" />
            <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={t('videoCall.joinSheet.close')} />
            <View style={{ ...SHEET, maxHeight: '72%', paddingTop: 12 }} testID="join-call-sheet">
                <SheetHandle />
                <View className="flex-row items-center" style={{ gap: 6, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
                    <View style={{ marginLeft: -10, marginVertical: -10 }}>
                        <LiveRadar size={42}>
                            <Ionicons name="videocam" size={22} color="#FFFFFF" />
                        </LiveRadar>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text className="font-outfit-bold" style={{ ...TYPE.group, color: AO.text }}>{title}</Text>
                        <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: AO.muted, marginTop: 2 }}>{hint}</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('videoCall.joinSheet.close')} style={{ alignSelf: 'flex-start' }}>
                        <Ionicons name="close" size={24} color={AO.muted} />
                    </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 14 }} showsVerticalScrollIndicator={false}>
                    {rejoin && callState?.startedAtLocalMs != null ? (
                        <VideoCallTimerCard
                            startedAtMs={callState.startedAtLocalMs}
                            limitSeconds={contractedSeconds(callState)}
                            addedMinutes={Math.max(0, (callState.contractedMinutes ?? 0) - (callState.baseMinutes ?? 0))}
                        />
                    ) : null}

                    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: AO.borderSoft, paddingHorizontal: 14, paddingVertical: 4 }}>
                        {rows.map((r, i) => (
                            <View key={r.icon} className="flex-row items-center" style={{ gap: 12, paddingVertical: 11, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: AO.borderSoft }}>
                                <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: AO.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name={r.icon} size={18} color={AO.blue} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text className="font-outfit-semibold" style={{ ...TYPE.eyebrow, textTransform: 'uppercase', color: AO.mutedLight }}>{r.label}</Text>
                                    <Text className="font-outfit-semibold" numberOfLines={1} style={{ ...TYPE.body, color: AO.text }}>{r.text}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    <View style={{ backgroundColor: AO.blueSofter, borderRadius: 18, borderWidth: 1, borderColor: AO.blueSoft, padding: 14, gap: 8 }} testID="lobby-consent">
                        <View className="flex-row items-center" style={{ gap: 12 }}>
                            <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: AO.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="shield-checkmark-outline" size={18} color={AO.blue} />
                            </View>
                            <Text className="font-outfit-bold" style={{ flex: 1, ...TYPE.body, color: AO.text }}>{t(`${L}.consent.title`)}</Text>
                        </View>
                        {[1, 2, 3].map((n) => (
                            <View key={n} className="flex-row items-start" style={{ gap: 10 }}>
                                <Ionicons name="ellipse" size={6} color={AO.muted} style={{ marginTop: 8 }} />
                                <Text className="font-outfit-regular" style={{ flex: 1, ...TYPE.helper, color: AO.muted }}>{t(`${L}.consent.point${n}`)}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: AO.borderSoft, paddingHorizontal: 14, paddingVertical: 10, gap: 4 }}>
                        <Text className="font-outfit-bold" style={{ ...TYPE.body, color: AO.text, paddingVertical: 4 }}>{t(`${L}.tipsTitle`)}</Text>
                        {tips.map((tip) => (
                            <View key={tip} className="flex-row items-start" style={{ gap: 10, paddingVertical: 5 }}>
                                <Ionicons name="checkmark-circle" size={18} color={AO.blue} />
                                <Text className="font-outfit-regular" style={{ flex: 1, ...TYPE.helper, color: AO.muted }}>{tip}</Text>
                            </View>
                        ))}
                    </View>

                    <View className="flex-row items-center" style={{ gap: 12, padding: 14, borderRadius: 16, backgroundColor: AO.blueSofter, borderWidth: 1, borderColor: AO.blueSoft }}>
                        <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: AO.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="time-outline" size={18} color={AO.blue} />
                        </View>
                        <Text className="font-outfit-regular" style={{ flex: 1, ...TYPE.helper, color: AO.muted }}>{t(`${L}.footer`, { minutes })}</Text>
                    </View>
                </ScrollView>

                <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, gap: 10, borderTopWidth: 1, borderTopColor: AO.borderSoft }}>
                    {/* The acceptance stays here, under the conditions and above the button: it never sits at the bottom of a long text. */}
                    <TouchableOpacity
                        onPress={() => !join.acceptedAt && join.setAccepted((v) => !v)}
                        activeOpacity={0.8}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: join.accepted }}
                        className="flex-row items-center"
                        style={{ gap: 12 }}
                        testID="lobby-consent-check"
                    >
                        <Ionicons name={join.accepted ? 'checkbox' : 'square-outline'} size={26} color={join.accepted ? AO.blue : AO.mutedLight} />
                        <View style={{ flex: 1 }}>
                            <Text className="font-outfit-semibold" style={{ ...TYPE.helper, color: AO.text }}>{t(`${L}.consent.accept`)}</Text>
                            {join.acceptedAt ? (
                                <Text className="font-outfit-regular" style={{ ...TYPE.caption, color: AO.muted }}>{t(`${L}.consent.acceptedOn`, { date: new Date(join.acceptedAt).toLocaleString() })}</Text>
                            ) : null}
                        </View>
                    </TouchableOpacity>
                    {waitingForRoom ? (
                        <View className="flex-row items-center justify-center" style={{ gap: 8 }}>
                            <ActivityIndicator size="small" color={AO.muted} />
                            <Text className="font-outfit-regular" style={{ ...TYPE.caption, color: AO.muted }}>{t(`${L}.waiting`)}</Text>
                        </View>
                    ) : null}
                    <GradientButton
                        label={t(rejoin ? 'videoCall.joinSheet.reconnect' : 'videoCall.joinSheet.connect')}
                        icon="videocam"
                        tone="success"
                        onPress={() => void join.connect()}
                        disabled={!join.canConnect}
                        loading={join.connecting}
                        testID="join-call-connect"
                    />
                </View>
            </View>
        </Modal>
    );
}
