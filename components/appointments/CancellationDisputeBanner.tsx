import type { CancellationDispute } from '@/lib/dao/interfaces';
import { formatMoney } from '@/lib/payments/paymentSource';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

interface CancellationDisputeBannerProps {
    dispute: CancellationDispute;
    /** Owner = what they are/were charged; mechanic = what they are/were compensated. */
    role: 'owner' | 'mechanic';
}

/** Dispute amounts come in cents. */
function centsToMoney(cents: number | null | undefined, currency: string): string {
    return formatMoney((cents ?? 0) / 100, (currency || 'usd').toUpperCase());
}

const TONES = {
    review: { bg: '#FFF7E6', border: '#FCD9A0', icon: '#D97706', title: '#92400E', body: '#A16207' },
    charged: { bg: '#EEF2FF', border: '#C7D2FE', icon: '#1E56E3', title: '#0B1530', body: '#4B5563' },
    none: { bg: '#EEF0F4', border: '#E4EAF5', icon: '#6B7490', title: '#4B5563', body: '#6B7490' },
} as const;

/**
 * Shown on a cancelled appointment that has a cancellation dispute: the owner
 * cancelled after the mechanic headed out and past the free window, so the hold
 * was kept for staff to decide (or for the visit fee to be auto-captured).
 */
export function CancellationDisputeBanner({ dispute, role }: CancellationDisputeBannerProps) {
    const { t } = useTranslation();
    const k = 'appointments.cancellationDispute';
    const captured = dispute.capturedAmount ?? 0;

    let tone: keyof typeof TONES;
    let icon: React.ComponentProps<typeof Ionicons>['name'];
    let title: string;
    let body: string;

    if (dispute.status === 'open') {
        tone = 'review';
        icon = 'hourglass-outline';
        const amount = centsToMoney(dispute.heldAmount, dispute.currency);
        title = t(role === 'owner' ? `${k}.ownerReviewTitle` : `${k}.mechanicReviewTitle`);
        body = t(role === 'owner' ? `${k}.ownerReviewBody` : `${k}.mechanicReviewBody`, { amount });
    } else if (captured > 0) {
        tone = 'charged';
        icon = role === 'owner' ? 'card-outline' : 'cash-outline';
        const amount = centsToMoney(captured, dispute.currency);
        title = t(role === 'owner' ? `${k}.ownerChargedTitle` : `${k}.mechanicPaidTitle`, { amount });
        body = t(role === 'owner' ? `${k}.ownerChargedBody` : `${k}.mechanicPaidBody`);
    } else {
        tone = 'none';
        icon = 'checkmark-circle-outline';
        title = t(role === 'owner' ? `${k}.ownerNoChargeTitle` : `${k}.mechanicNoneTitle`);
        body = t(role === 'owner' ? `${k}.ownerNoChargeBody` : `${k}.mechanicNoneBody`);
    }

    const c = TONES[tone];
    return (
        <View
            style={{ flexDirection: 'row', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, backgroundColor: c.bg, borderColor: c.border }}
            testID={`cancellation-dispute-${dispute.status}`}
        >
            <Ionicons name={icon} size={22} color={c.icon} />
            <View style={{ flex: 1 }}>
                <Text className="font-outfit-bold" style={{ fontSize: 15, color: c.title }}>{title}</Text>
                <Text className="font-outfit-regular" style={{ fontSize: 12.5, lineHeight: 17, marginTop: 3, color: c.body }}>{body}</Text>
            </View>
        </View>
    );
}
