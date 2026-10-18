import { PulseDot } from '@/components/appointments/MechanicArrivalCard';
import { AO, card } from '@/components/offer/OfferSections';
import { formatElapsed, useElapsedSeconds } from '@/hooks/useElapsedSeconds';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const K = 'appointments.videoCall.timer';

/** A video-call session lasts 30 minutes; each extension adds the same again. */
export const VIDEO_SESSION_SECONDS = 30 * 60;
const WARN_BEFORE_SECONDS = 5 * 60;

export type TimerTone = 'normal' | 'warn' | 'over';

/** Normal until the last 5 minutes of the session, then warn, then over. */
export function timerTone(elapsed: number, limit: number): TimerTone {
    if (elapsed >= limit) return 'over';
    if (elapsed >= limit - WARN_BEFORE_SECONDS) return 'warn';
    return 'normal';
}

const TONES: Record<TimerTone, { fg: string; bg: string }> = {
    normal: { fg: AO.blue, bg: AO.blueSofter },
    warn: { fg: AO.orange, bg: AO.orangeSoft },
    over: { fg: AO.red, bg: '#FDECEC' },
};

const RING = 104;
const STROKE = 9;
const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Elapsed time of a running video call, counted from when the other person
 * joined (`startedAtMs`, on this phone's clock). The ring fills towards the
 * session limit. Extending only moves the limit on this screen: nothing is
 * charged or saved yet.
 */
export function VideoCallTimerCard({ startedAtMs, extensions, onExtend }: {
    startedAtMs: number;
    extensions: number;
    onExtend: () => void;
}) {
    const { t } = useTranslation();
    const [confirming, setConfirming] = React.useState(false);
    const elapsed = useElapsedSeconds(startedAtMs);
    const limit = VIDEO_SESSION_SECONDS * (1 + extensions);
    const tone = timerTone(elapsed, limit);
    const { fg, bg } = TONES[tone];
    const progress = Math.min(elapsed / limit, 1);

    return (
        <View style={[card, { padding: 16 }]} testID="video-call-timer">
            <View className="flex-row items-center" style={{ gap: 16 }}>
                <View style={{ width: RING, height: RING }}>
                    <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
                        <Circle cx={RING / 2} cy={RING / 2} r={RADIUS} stroke={bg} strokeWidth={STROKE} fill="none" />
                        <Circle
                            cx={RING / 2}
                            cy={RING / 2}
                            r={RADIUS}
                            stroke={fg}
                            strokeWidth={STROKE}
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
                            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
                        />
                    </Svg>
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                        <Text
                            className="font-outfit-bold"
                            style={{ fontSize: 24, color: fg, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}
                            testID="video-call-timer-elapsed"
                        >
                            {formatElapsed(elapsed)}
                        </Text>
                        <Text className="font-outfit-bold" style={{ fontSize: 10.5, color: AO.muted, marginTop: 3 }} testID="video-call-timer-label">
                            {t(tone === 'over' ? `${K}.overtime` : `${K}.elapsed`)}
                        </Text>
                    </View>
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                    <View className="flex-row items-center" style={{ alignSelf: 'flex-start', gap: 6, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 100, backgroundColor: bg }}>
                        <PulseDot color={fg} size={6} />
                        <Text className="font-outfit-bold" style={{ fontSize: 10, letterSpacing: 1, color: fg }}>
                            {t(`${K}.inProgress`).toUpperCase()}
                        </Text>
                    </View>
                    <Text className="font-outfit-semibold" style={{ fontSize: 13, color: AO.text, marginTop: 8, lineHeight: 18 }}>
                        {tone === 'over'
                            ? t(`${K}.over`)
                            : tone === 'warn'
                                ? t(`${K}.warn`)
                                : t(`${K}.session`, { minutes: limit / 60 })}
                    </Text>
                    {extensions > 0 && (
                        <View style={{ alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, backgroundColor: AO.greenSoft }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 10.5, color: AO.greenText }} testID="video-call-timer-added">
                                {t(`${K}.added`, { minutes: extensions * (VIDEO_SESSION_SECONDS / 60) })}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: AO.borderSoft }}>
                {!confirming ? (
                    <TouchableOpacity
                        onPress={() => setConfirming(true)}
                        activeOpacity={0.85}
                        className="flex-row items-center justify-center"
                        style={{ gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: AO.blueSoft }}
                        testID="video-call-extend"
                        accessibilityRole="button"
                    >
                        <Ionicons name="time-outline" size={17} color={AO.blue} />
                        <Text className="font-outfit-bold" style={{ fontSize: 14, color: AO.blue }}>{t(`${K}.extend`)}</Text>
                    </TouchableOpacity>
                ) : (
                    <View>
                        <Text className="font-outfit-bold" style={{ fontSize: 13, color: AO.text, lineHeight: 18 }}>{t(`${K}.extendTitle`)}</Text>
                        <Text className="font-outfit-regular" style={{ fontSize: 12, color: AO.muted, marginTop: 3, lineHeight: 17 }}>{t(`${K}.extendBody`)}</Text>
                        <View className="flex-row" style={{ gap: 8, marginTop: 10 }}>
                            <TouchableOpacity
                                onPress={() => setConfirming(false)}
                                activeOpacity={0.85}
                                className="flex-1 items-center"
                                style={{ paddingVertical: 11, borderRadius: 12, backgroundColor: AO.page, borderWidth: 1, borderColor: AO.border }}
                                testID="video-call-extend-cancel"
                            >
                                <Text className="font-outfit-bold" style={{ fontSize: 13.5, color: AO.muted }}>{t(`${K}.cancel`)}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    onExtend();
                                    setConfirming(false);
                                }}
                                activeOpacity={0.85}
                                className="flex-1 items-center"
                                style={{ paddingVertical: 11, borderRadius: 12, backgroundColor: AO.blue }}
                                testID="video-call-extend-confirm"
                            >
                                <Text className="font-outfit-bold" style={{ fontSize: 13.5, color: '#fff' }}>{t(`${K}.confirm`)}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}
