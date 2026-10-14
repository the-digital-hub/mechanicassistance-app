import { AO, card } from '@/components/offer/OfferSections';
import type { VideoCallState } from '@/lib/dao/VideoCallDAO';
import { formatLocalDateTime } from '@/lib/video/videoCallTime';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';

/*
 * Video-call assistance (remote): no check-in, no ETA. The mechanic finishes it,
 * the owner confirms it or reports it as not resolved, support decides disputes.
 */

const K = 'appointments.videoCall';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** "Scheduled for <local date time>". Renders nothing without a parseable date. */
export function VideoCallWhenCard({ date }: { date?: string | null }) {
    const { t, i18n } = useTranslation();
    const label = formatLocalDateTime(date, i18n.language);
    if (!label) return null;
    return (
        <View style={[card, { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }]} testID="video-call-when">
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: AO.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="calendar-outline" size={19} color={AO.blue} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text className="font-outfit-bold" style={{ fontSize: 10.5, letterSpacing: 0.8, color: AO.muted }}>{t(`${K}.scheduledFor`).toUpperCase()}</Text>
                <Text className="font-outfit-bold" style={{ fontSize: 15, color: AO.text, marginTop: 2 }}>{label}</Text>
            </View>
        </View>
    );
}

/** Primary blue gradient button (house style). */
export function GradientButton({ label, icon, onPress, disabled, loading, colors = ['#2B66F8', '#081E72'], testID }: {
    label: string;
    icon?: IconName;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
    colors?: [string, string];
    testID?: string;
}) {
    return (
        <TouchableOpacity onPress={onPress} disabled={disabled || loading} activeOpacity={0.85} style={{ opacity: disabled ? 0.6 : 1 }} testID={testID}>
            <LinearGradient
                colors={colors}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={{ borderRadius: 10, paddingVertical: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
            >
                {loading ? <ActivityIndicator color="#fff" /> : icon ? <Ionicons name={icon} size={20} color="#fff" /> : null}
                <Text className="text-white font-outfit-bold text-center">{label}</Text>
            </LinearGradient>
        </TouchableOpacity>
    );
}

export function JoinVideoCallButton({ onPress }: { onPress: () => void }) {
    const { t } = useTranslation();
    return <GradientButton label={t(`${K}.join`)} icon="videocam" onPress={onPress} testID="join-video-call" />;
}

function InfoCard({ icon, tone, title, body, children, testID }: {
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
            <View className="flex-row items-center" style={{ gap: 10 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={icon} size={19} color={palette.fg} />
                </View>
                <Text className="font-outfit-bold" style={{ flex: 1, fontSize: 15, color: AO.text, letterSpacing: -0.2 }}>{title}</Text>
            </View>
            {!!body && (
                <Text className="font-outfit-regular" style={{ fontSize: 13, color: AO.muted, lineHeight: 19, marginTop: 10 }}>{body}</Text>
            )}
            {children}
        </View>
    );
}

function NoteBlock({ label, text }: { label: string; text: string }) {
    return (
        <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: AO.blueSofter }}>
            <Text className="font-outfit-bold" style={{ fontSize: 10.5, letterSpacing: 0.8, color: AO.muted }}>{label.toUpperCase()}</Text>
            <Text className="font-outfit-regular" style={{ fontSize: 13.5, color: AO.text, lineHeight: 19, marginTop: 4 }}>{text}</Text>
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
            <Text className="font-outfit-medium" style={{ flex: 1, fontSize: 12.5, color: AO.muted }}>{t(`${K}.confirmsAutomatically`, { date: when })}</Text>
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
                <View className="flex-row" style={{ gap: 10, marginTop: 14 }}>
                    <TouchableOpacity
                        onPress={onNotResolved}
                        disabled={busy}
                        activeOpacity={0.85}
                        style={{ flex: 0.45, borderRadius: 10, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' }}
                        testID="owner-video-not-resolved"
                    >
                        <Text className="font-outfit-bold" style={{ fontSize: 13.5, color: AO.red }}>{t(`${k}.notResolved`)}</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 0.55 }}>
                        <GradientButton label={t(`${k}.confirm`)} onPress={onConfirm} loading={busy} colors={['#10B981', '#047857']} testID="owner-video-confirm" />
                    </View>
                </View>
            </InfoCard>
        );
    }
    if (state.status === 'disputed') {
        return <InfoCard icon="shield-checkmark-outline" tone="orange" title={t(`${k}.disputedTitle`)} body={t(`${k}.disputedBody`)} testID="owner-video-disputed" />;
    }
    if (state.status === 'completed' && state.currentStatus === 'not_resolved') {
        return <InfoCard icon="card-outline" tone="gray" title={t(`${k}.notChargedTitle`)} body={t(`${k}.notChargedBody`)} testID="owner-video-not-charged" />;
    }
    return null;
}

/** Mechanic: what happens after "Finish assistance". Renders nothing before it. */
export function MechanicVideoCallStatusCard({ state, onRateClient }: { state: VideoCallState; onRateClient?: () => void }) {
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
                {onRateClient && (
                    <TouchableOpacity onPress={onRateClient} activeOpacity={0.85} className="items-center py-3 mt-3.5" style={{ borderRadius: 13, backgroundColor: AO.blue }} testID="mechanic-video-rate-client">
                        <Text className="text-white font-outfit-bold text-sm">{t(`${k}.rateClient`)}</Text>
                    </TouchableOpacity>
                )}
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
        <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
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
                        <Text className="font-outfit-regular" style={{ fontSize: 11.5, color: tooShort ? AO.mutedLight : AO.greenText, marginTop: 6, textAlign: 'right' }}>
                            {t(`${K}.minChars`, { count: minLength, current: trimmed.length })}
                        </Text>
                    )}
                    <View className="flex-row gap-3 w-full mt-5">
                        <TouchableOpacity onPress={onClose} disabled={submitting} className="flex-1 bg-white border border-gray-200 py-3 rounded-lg items-center" testID="note-sheet-cancel">
                            <Text className="font-outfit-bold text-gray-700">{t(`${K}.cancel`)}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => onSubmit(trimmed)}
                            disabled={submitting || tooShort}
                            className="flex-1 py-3 rounded-lg items-center"
                            style={{ backgroundColor: danger ? AO.red : AO.blue, opacity: submitting || tooShort ? 0.6 : 1 }}
                            testID="note-sheet-submit"
                        >
                            {submitting ? <ActivityIndicator color="#fff" /> : <Text className="font-outfit-bold text-white">{confirmLabel}</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
