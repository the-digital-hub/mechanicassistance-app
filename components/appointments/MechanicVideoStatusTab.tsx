import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AO } from '@/components/offer/OfferSections';
import { formatLocalDateTime } from '@/lib/video/videoCallTime';

const K = 'appointments.videoCall.statusTab';

type StepState = 'done' | 'current' | 'pending';

/**
 * The Status tab on a video call, for the technician (default) or the vehicle owner: where the assistance is, step by step —
 * accepted, call open, closed (waiting for the client's confirmation), rate the customer.
 * It says what is happening now and what comes next; the facts of the request live in Details.
 */
export function MechanicVideoStatusTab({ status, callStarted, notResolved, reviewSent, times, role = 'mechanic' }: {
    /** accepted | in_progress | awaiting_confirmation | disputed | completed */
    status: string | undefined;
    /** The client joined and the timer is running. */
    callStarted: boolean;
    /** Closed without charging: the client said it was not resolved. */
    notResolved: boolean;
    /** The other person was already rated. */
    reviewSent: boolean;
    /** When each step happened (ISO), shown next to its title once it has: accepted, the call, closed. */
    times?: { accepted?: string | null; call?: string | null; closed?: string | null };
    /** Whose phone this is: the owner reads the same steps with their own wording (`statusTab.owner.*`). */
    role?: 'mechanic' | 'owner';
}) {
    const { t: translate, i18n } = useTranslation();
    const t = (key: string) => translate(role === 'owner' ? [key.replace(`${K}.`, `${K}.owner.`), key] : key);
    const closed = status === 'completed';
    const waiting = status === 'awaiting_confirmation';
    const disputed = status === 'disputed';

    const callSub = closed || waiting || disputed
        ? t(`${K}.callEnded`)
        : callStarted
            ? t(`${K}.callInProgress`)
            : t(`${K}.callReady`);
    const closedSub = closed
        ? notResolved ? t(`${K}.closedNotCharged`) : t(`${K}.closedDone`)
        : waiting
            ? t(`${K}.closedWaiting`)
            : disputed
                ? t(`${K}.closedDisputed`)
                : t(`${K}.closedPending`);
    const reviewSub = reviewSent
        ? t(`${K}.reviewSent`)
        : closed
            ? t(`${K}.reviewNow`)
            : t(`${K}.reviewLater`);

    const steps: { key: string; title: string; sub: string; state: StepState; at?: string | null }[] = [
        { key: 'accepted', title: t(`${K}.acceptedTitle`), sub: t(`${K}.acceptedSub`), state: 'done', at: times?.accepted },
        { key: 'call', title: t(`${K}.callTitle`), sub: callSub, state: closed || waiting || disputed ? 'done' : 'current', at: callStarted || closed || waiting || disputed ? times?.call : undefined },
        { key: 'closed', title: t(`${K}.closedTitle`), sub: closedSub, state: closed ? 'done' : waiting || disputed ? 'current' : 'pending', at: closed || waiting || disputed ? times?.closed : undefined },
        { key: 'review', title: t(`${K}.reviewTitle`), sub: reviewSub, state: reviewSent ? 'done' : closed ? 'current' : 'pending' },
    ];

    return (
        <View
            style={{ backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#EEF2FA', padding: 18, shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 2 }}
            testID={role === 'owner' ? 'owner-video-status-tab' : 'mechanic-video-status-tab'}
        >
            {steps.map((step, i) => {
                const last = i === steps.length - 1;
                const done = step.state === 'done';
                const current = step.state === 'current';
                return (
                    <View key={step.key} style={{ flexDirection: 'row', gap: 14 }}>
                        <View style={{ alignItems: 'center' }}>
                            <View
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: done ? '#DDF1E7' : current ? '#DCE6FB' : '#F1F3F8',
                                }}
                            >
                                {done ? (
                                    <Ionicons name="checkmark" size={17} color="#2E9468" />
                                ) : (
                                    <Text className="font-outfit-bold" style={{ fontSize: 14, color: current ? AO.blue : AO.mutedLight }}>{i + 1}</Text>
                                )}
                            </View>
                            {!last ? <View style={{ flex: 1, width: 2, marginVertical: 4, backgroundColor: done ? '#BFE3D0' : '#E6EAF3', minHeight: 20 }} /> : null}
                        </View>
                        <View style={{ flex: 1, paddingBottom: last ? 0 : 18 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                                <Text className="font-outfit-bold" style={{ flexShrink: 1, fontSize: 16, lineHeight: 22, color: step.state === 'pending' ? AO.mutedLight : AO.text }}>{step.title}</Text>
                                {step.at && formatLocalDateTime(step.at, i18n.language) ? (
                                    <Text className="font-outfit-medium" style={{ fontSize: 13, lineHeight: 18, color: AO.muted }} testID={`status-time-${step.key}`}>{formatLocalDateTime(step.at, i18n.language)}</Text>
                                ) : null}
                            </View>
                            <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: current ? AO.blue : AO.muted }}>{step.sub}</Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
}
