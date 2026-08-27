import { useUser } from '@/context/UserContext';
import { useVerification } from '@/context/VerificationContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

/**
 * Identity-verification status pill. Mechanics only.
 *
 * Verification gates one action rather than the whole app — a mechanic offering
 * on a request — so this is the only always-visible signal that a mechanic
 * account still needs to verify. Every state except approved is tappable and
 * leads to the verification screen. Users see nothing: verification is optional
 * for them, and an unverified user can request assistance normally.
 *
 * Renders nothing until the status is actually known — see `hasLoaded` in
 * VerificationContext. Showing "Not verified" while the first fetch is still in
 * flight made the badge flicker on every launch.
 */

type Tone = 'verified' | 'pending' | 'unverified' | 'declined';

const TONES: Record<
    Tone,
    { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
    verified: { bg: '#D1FAE5', fg: '#047857', icon: 'checkmark-circle' },
    pending: { bg: '#FEF3C7', fg: '#B45309', icon: 'hourglass-outline' },
    unverified: { bg: '#F3F4F6', fg: '#4B5563', icon: 'shield-outline' },
    declined: { bg: '#FEE2E2', fg: '#B91C1C', icon: 'alert-circle-outline' },
};

/**
 * `Expired` and `Kyc Expired` read as `unverified`: both need a fresh session,
 * which is what that state invites the user to start.
 */
function toneFor(status: string | null): Tone {
    switch (status) {
        case 'Approved':
            return 'verified';
        case 'In Review':
        case 'In Progress':
        case 'Resubmitted':
        case 'Awaiting User':
            return 'pending';
        case 'Declined':
        case 'Abandoned':
            return 'declined';
        default:
            return 'unverified';
    }
}

export function VerificationBadge() {
    const { t } = useTranslation();
    const router = useRouter();
    const { user } = useUser();
    const { status, hasLoaded } = useVerification();

    if (user?.role !== 'mechanic') return null;
    if (!hasLoaded) return null;

    const tone = toneFor(status);
    const { bg, fg, icon } = TONES[tone];
    const isVerified = tone === 'verified';

    const content = (
        <View
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ backgroundColor: bg }}
        >
            <Ionicons name={icon} size={14} color={fg} />
            <Text className="font-outfit-semibold text-xs" style={{ color: fg }}>
                {t(`verification.badge.${tone}`)}
            </Text>
            {!isVerified && <Ionicons name="chevron-forward" size={12} color={fg} />}
        </View>
    );

    if (isVerified) return content;

    return (
        <TouchableOpacity
            onPress={() => router.push('/verify-identity' as any)}
            activeOpacity={0.7}
            accessibilityRole="button"
        >
            {content}
        </TouchableOpacity>
    );
}
