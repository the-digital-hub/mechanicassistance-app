import { AO, card } from '@/components/offer/OfferSections';
import type { VideoCallState } from '@/lib/dao/VideoCallDAO';
import { formatLocalDateTime, videoCallBookedLabel } from '@/lib/video/videoCallTime';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { TYPE } from '@/lib/ui/type';
import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';
import { LiveRadar } from '@/components/video/LiveRadar';

/*
 * Video-call assistance (remote): no check-in, no ETA. The mechanic finishes it,
 * the owner confirms it or reports it as not resolved, support decides disputes.
 */

const K = 'appointments.videoCall';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * "Scheduled for <local date time>"; "When: <date and time>" for a call asked for now that already took place;
 * "When: Now" only while a "now" call has not started.
 */
export function VideoCallWhenCard({ date, startNow, startedAt, completedAt, live = false }: { date?: string | null; startNow?: boolean; startedAt?: string | null; completedAt?: string | null; /** The call can be joined now: the tile pulses like a radar. */ live?: boolean }) {
    const { t, i18n } = useTranslation();
    const booked = videoCallBookedLabel({ date, startNow, startedAt, completedAt }, i18n.language);
    const label = booked ?? t('requestDetail.videoCallNow');
    return (
        <View style={[card, { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }]} testID="video-call-when">
            {live ? (
                <View style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
                    <LiveRadar size={30} color="#16A34A">
                        <Ionicons name="videocam" size={16} color="#FFFFFF" />
                    </LiveRadar>
                </View>
            ) : (
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: AO.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="calendar-outline" size={19} color={AO.blue} />
                </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 0.8, color: AO.muted }}>{booked && !startNow ? t(`${K}.scheduledFor`).toUpperCase() : t('requestDetail.videoCallWhen')}</Text>
                <Text className="font-outfit-bold" style={{ fontSize: 15, color: AO.text, marginTop: 2 }}>{label}</Text>
            </View>
        </View>
    );
}

/**
 * A secondary action that should not compete with the main one: white, thin border, grey text.
 * (Finishing a call early is something the technician rarely wants to do.)
 */
export function QuietButton({ label, icon, onPress, disabled, loading, testID }: {
    label: string;
    icon?: IconName;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
    testID?: string;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.7}
            accessibilityRole="button"
            className="flex-row items-center justify-center"
            style={{ minHeight: BUTTON_HEIGHT, borderRadius: BUTTON_RADIUS, backgroundColor: QUIET.bg, gap: 10, opacity: disabled ? 0.6 : 1 }}
            testID={testID}
        >
            {loading ? <ActivityIndicator color={QUIET.fg} /> : (
                <>
                    {icon ? <Ionicons name={icon} size={20} color={QUIET.fg} /> : null}
                    <Text className="font-outfit-bold text-center" style={{ fontSize: 16, lineHeight: 22, color: QUIET.fg }}>{label}</Text>
                </>
            )}
        </TouchableOpacity>
    );
}

/**
 * The call's button system, one rule per intent:
 *  - GradientButton `success` (green): the important actions of the call: Join video call, and "it was resolved, charge it"
 *    (the owner's confirmation).
 *  - GradientButton `primary` (blue): the other main actions (Finish assistance).
 *  - QuietButton (soft slate fill): secondary actions we do not want to encourage (Return to call).
 *  - a soft red text button: "it was not resolved" and other problem actions.
 * All share the same height, radius and type.
 */
/** The quiet button: a soft slate fill, no white and no border, so it never competes with the main action. */
const QUIET = { bg: '#E6EAF2', fg: '#4A5470' } as const;
const BUTTON_HEIGHT = 52;
const BUTTON_RADIUS = 14;
const TONES = { primary: ['#2B66F8', '#081E72'], success: ['#10B981', '#047857'] } as const;

export function GradientButton({ label, icon, onPress, disabled, loading, tone = 'primary', testID, large }: {
    label: string;
    icon?: IconName;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
    tone?: keyof typeof TONES;
    testID?: string;
    /** The 18 px label of the app's main buttons (Continue, Save), instead of the 16 px of the call screens. */
    large?: boolean;
}) {
    return (
        <TouchableOpacity onPress={onPress} disabled={disabled || loading} activeOpacity={0.85} style={{ opacity: disabled ? 0.6 : 1 }} testID={testID} accessibilityRole="button">
            <LinearGradient
                colors={[...TONES[tone]]}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={{ minHeight: BUTTON_HEIGHT, borderRadius: BUTTON_RADIUS, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
            >
                {loading ? <ActivityIndicator color="#fff" /> : icon ? <Ionicons name={icon} size={20} color="#fff" /> : null}
                <Text className="text-white font-outfit-bold text-center" style={large ? TYPE.button : { fontSize: 16, lineHeight: 22 }}>{label}</Text>
            </LinearGradient>
        </TouchableOpacity>
    );
}

/** Technician, before the call starts: how long it lasts and that the timer starts when the customer joins. */
export function SessionTimerNote({ minutes }: { minutes: number }) {
    const { t } = useTranslation();
    return (
        <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: AO.blueSofter, borderWidth: 1, borderColor: AO.blueSoft }}
            testID="session-timer-note"
        >
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: AO.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="timer-outline" size={20} color={AO.blue} />
            </View>
            <View style={{ flex: 1 }}>
                <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, lineHeight: 22, color: AO.text }}>{t(`${K}.timer.startsOnJoinTitle`, { minutes })}</Text>
                <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: AO.muted }}>{t(`${K}.timer.startsOnJoinBody`)}</Text>
            </View>
        </View>
    );
}

/** Technician: the customer is already in the video room, waiting. Shown above "Join video call". */
export function CustomerInRoomCard() {
    const { t } = useTranslation();
    return (
        <InfoCard
            icon="videocam"
            tone="green"
            title={t(`${K}.mechanic.customerInRoomTitle`)}
            testID="customer-in-room"
        />
    );
}

/** Technician: the customer has not opened the video room yet. Joining waits for them. */
export function WaitingForCustomerCard() {
    const { t } = useTranslation();
    return (
        <InfoCard
            icon="hourglass-outline"
            tone="orange"
            title={t(`${K}.mechanic.waitingForCustomerTitle`)}
            body={t(`${K}.mechanic.waitingForCustomerBody`)}
            testID="waiting-for-customer"
        />
    );
}

/**
 * `rejoin`: the call already started (the person left and came back), so it says so. `disabled`: not yet (the technician waits for the
 * customer to enter first): a grey, quiet button instead of the green one, so there is nothing to press that does not work yet.
 */
export function JoinVideoCallButton({ onPress, rejoin = false, disabled = false }: { onPress: () => void; rejoin?: boolean; disabled?: boolean }) {
    const { t } = useTranslation();
    if (disabled) {
        return (
            <View
                className="flex-row items-center justify-center"
                style={{ minHeight: BUTTON_HEIGHT, borderRadius: BUTTON_RADIUS, paddingHorizontal: 16, gap: 10, backgroundColor: '#E6EAF2' }}
                accessibilityRole="button"
                accessibilityState={{ disabled: true }}
                testID="join-video-call"
            >
                <Ionicons name="videocam" size={20} color="#9AA4BA" />
                <Text className="font-outfit-bold text-center" style={{ fontSize: 16, lineHeight: 22, color: '#8C96AE' }}>{t(`${K}.join`)}</Text>
            </View>
        );
    }
    return <GradientButton label={t(rejoin ? `${K}.rejoin` : `${K}.join`)} icon="videocam" tone="success" onPress={onPress} testID="join-video-call" />;
}

export function InfoCard({ icon, tone, title, body, children, testID }: {
    icon: IconName;
    tone: 'blue' | 'orange' | 'green' | 'gray';
    title: string;
    body?: string | null;
    children?: React.ReactNode;
    testID?: string;
}) {
    const palette = {
        blue: { bg: AO.blueSoft, fg: AO.blue },
        orange: { bg: AO.orangeSoft, fg: AO.orange },
        green: { bg: AO.greenSoft, fg: AO.greenText },
        gray: { bg: '#EEF0F4', fg: '#4B5563' },
    }[tone];
    return (
        <View style={[card, { padding: 16 }]} testID={testID}>
            {/* The text sits in its own column, under the title and not under the icon; what the card carries (buttons, a clock) goes full width below. */}
            <View className="flex-row" style={{ gap: 12, alignItems: body ? 'flex-start' : 'center' }}>
                <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={icon} size={20} color={palette.fg} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, color: AO.text, letterSpacing: -0.3, marginTop: body ? 8 : 0 }}>{title}</Text>
                    {!!body && (
                        <Text className="font-outfit-regular" style={{ fontSize: 15, lineHeight: 21, color: AO.muted, marginTop: 3 }}>{body}</Text>
                    )}
                </View>
            </View>
            {children}
        </View>
    );
}

function NoteBlock({ label, text }: { label: string; text: string }) {
    return (
        <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: AO.blueSofter }}>
            <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 0.8, color: AO.muted }}>{label.toUpperCase()}</Text>
            <Text className="font-outfit-regular" style={{ fontSize: 14, color: AO.text, lineHeight: 19, marginTop: 4 }}>{text}</Text>
        </View>
    );
}

function DeadlineLine({ deadline }: { deadline: string | null }) {
    const { t, i18n } = useTranslation();
    const when = formatLocalDateTime(deadline, i18n.language);
    if (!when) return null;
    return (
        <View className="flex-row items-center" style={{ gap: 6, marginTop: 12 }}>
            <Ionicons name="time-outline" size={14} color={AO.muted} />
            <Text className="font-outfit-medium" style={{ flex: 1, fontSize: 13, color: AO.muted }}>{t(`${K}.confirmsAutomatically`, { date: when })}</Text>
        </View>
    );
}

/**
 * Owner's "it was done" / "it was not" pair, shared by the video call and the
 * on-site close-out. testIDs: `<prefix>-not-resolved`, `<prefix>-confirm`.
 */
export function ConfirmOrDisputeRow({ busy, confirmLabel, disputeLabel, onConfirm, onDispute, testIDPrefix }: {
    busy: boolean;
    confirmLabel: string;
    disputeLabel: string;
    onConfirm: () => void;
    onDispute: () => void;
    testIDPrefix: string;
}) {
    return (
        // Never side by side: the action on top, the way out under it, both at full width.
        <View style={{ gap: 8, marginTop: 14 }}>
            <GradientButton label={confirmLabel} onPress={onConfirm} loading={busy} tone="success" testID={`${testIDPrefix}-confirm`} />
            <TouchableOpacity
                onPress={onDispute}
                disabled={busy}
                activeOpacity={0.85}
                style={{ minHeight: BUTTON_HEIGHT, borderRadius: BUTTON_RADIUS, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6EAF2', paddingHorizontal: 12, opacity: busy ? 0.6 : 1 }}
                testID={`${testIDPrefix}-not-resolved`}
            >
                <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#4A5470', textAlign: 'center' }}>{disputeLabel}</Text>
            </TouchableOpacity>
        </View>
    );
}

/** Owner: confirm / dispute card, or the outcome once it is past that. */
export function OwnerVideoCallStatusCard({ state, mechanicName, busy, onConfirm, onNotResolved }: {
    state: VideoCallState;
    mechanicName: string;
    busy: boolean;
    onConfirm: () => void;
    onNotResolved: () => void;
}) {
    const { t } = useTranslation();
    const k = `${K}.owner`;
    if (state.status === 'awaiting_confirmation') {
        return (
            <InfoCard icon="help-circle-outline" tone="blue" title={t(`${k}.awaitingTitle`)} body={t(`${k}.awaitingBody`, { name: mechanicName })} testID="owner-video-confirm-card">
                {!!state.finishNote && <NoteBlock label={t(`${k}.mechanicNote`)} text={state.finishNote} />}
                <DeadlineLine deadline={state.confirmDeadline} />
                <ConfirmOrDisputeRow
                    busy={busy}
                    confirmLabel={t(`${k}.confirm`)}
                    disputeLabel={t(`${k}.notResolved`)}
                    onConfirm={onConfirm}
                    onDispute={onNotResolved}
                    testIDPrefix="owner-video"
                />
            </InfoCard>
        );
    }
    if (state.status === 'disputed') {
        return <InfoCard icon="shield-checkmark-outline" tone="orange" title={t(`${k}.disputedTitle`)} body={t(`${k}.disputedBody`)} testID="owner-video-disputed" />;
    }
    if (state.status === 'completed' && state.currentStatus === 'not_resolved') {
        return <InfoCard icon="card-outline" tone="gray" title={t(`${k}.notChargedTitle`)} body={t(`${k}.notChargedBody`)} testID="owner-video-not-charged" />;
    }
    // Closed and confirmed: the same card the technician sees, in the owner's words.
    if (state.status === 'completed') {
        return <InfoCard icon="checkmark-circle-outline" tone="green" title={t(`${k}.completedTitle`)} body={t(`${k}.completedBody`)} testID="owner-video-completed" />;
    }
    return null;
}

/** Mechanic: what happens after "Finish assistance". Renders nothing before it. */
export function MechanicVideoCallStatusCard({ state }: { state: VideoCallState }) {
    const { t } = useTranslation();
    const k = `${K}.mechanic`;
    if (state.status === 'awaiting_confirmation') {
        return (
            <InfoCard icon="hourglass-outline" tone="blue" title={t(`${k}.awaitingTitle`)} testID="mechanic-video-awaiting">
                {!!state.finishNote && <NoteBlock label={t(`${k}.yourNote`)} text={state.finishNote} />}
                <DeadlineLine deadline={state.confirmDeadline} />
            </InfoCard>
        );
    }
    if (state.status === 'disputed') {
        return <InfoCard icon="alert-circle-outline" tone="orange" title={t(`${k}.disputedTitle`)} body={t(`${k}.disputedBody`)} testID="mechanic-video-disputed" />;
    }
    if (state.status === 'completed') {
        const notResolved = state.currentStatus === 'not_resolved';
        return (
            <InfoCard
                icon={notResolved ? 'card-outline' : 'checkmark-circle-outline'}
                tone={notResolved ? 'gray' : 'green'}
                title={notResolved ? t(`${K}.status.notCharged`) : t(`${k}.completedTitle`)}
                body={notResolved ? t(`${k}.notResolvedBody`) : t(`${k}.completedBody`)}
                testID="mechanic-video-completed"
            >
            </InfoCard>
        );
    }
    return null;
}

/**
 * Small centred sheet with a multiline note. `minLength` 0 makes the note
 * optional; the confirm button stays disabled until the text is long enough.
 */
export function NoteSheet({ visible, title, body, placeholder, confirmLabel, minLength = 0, maxLength = 1000, submitting, danger, onClose, onSubmit }: {
    visible: boolean;
    title: string;
    body: string;
    placeholder: string;
    confirmLabel: string;
    minLength?: number;
    maxLength?: number;
    submitting: boolean;
    danger?: boolean;
    onClose: () => void;
    onSubmit: (text: string) => void;
}) {
    const { t } = useTranslation();
    const [text, setText] = React.useState('');
    React.useEffect(() => {
        if (visible) setText('');
    }, [visible]);
    const trimmed = text.trim();
    const tooShort = trimmed.length < minLength;

    return (
        <Modal supportedOrientations={MODAL_ORIENTATIONS} animationType="fade" transparent visible={visible} onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-black/50 justify-center px-6">
                <View className="bg-white w-full rounded-2xl p-6">
                    <Text className="font-outfit-bold text-xl text-gray-900 mb-2">{title}</Text>
                    <Text className="text-gray-500 font-outfit-regular text-sm mb-4">{body}</Text>
                    <TextInput
                        value={text}
                        onChangeText={setText}
                        placeholder={placeholder}
                        placeholderTextColor="#9CA3AF"
                        multiline
                        maxLength={maxLength}
                        editable={!submitting}
                        className="font-outfit-regular text-gray-900"
                        style={{ minHeight: 110, maxHeight: 200, borderRadius: 12, borderWidth: 1, borderColor: AO.border, backgroundColor: AO.blueSofter, padding: 12, fontSize: 15, textAlignVertical: 'top' }}
                        testID="note-sheet-input"
                    />
                    {minLength > 0 && (
                        <Text className="font-outfit-regular" style={{ fontSize: 13, color: tooShort ? AO.mutedLight : AO.greenText, marginTop: 6, textAlign: 'right' }}>
                            {t(`${K}.minChars`, { count: minLength, current: trimmed.length })}
                        </Text>
                    )}
                    <View className="gap-3 w-full mt-5">
                        <TouchableOpacity
                            onPress={() => onSubmit(trimmed)}
                            disabled={submitting || tooShort}
                            className="py-3 rounded-[14px] items-center"
                            style={{ backgroundColor: danger ? AO.red : AO.blue, opacity: submitting || tooShort ? 0.6 : 1 }}
                            testID="note-sheet-submit"
                        >
                            {submitting ? <ActivityIndicator color="#fff" /> : <Text className="font-outfit-bold text-white">{confirmLabel}</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onClose} disabled={submitting} className="py-3 rounded-lg items-center" style={{ backgroundColor: '#E6EAF2' }} testID="note-sheet-cancel">
                            <Text className="font-outfit-bold" style={{ color: '#4A5470' }}>{t(`${K}.cancel`)}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
