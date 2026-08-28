import { useVerification } from '@/context/VerificationContext';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

/**
 * Which gated action is being attempted — picks the explanatory copy.
 *
 * Only the mechanic's offer is gated. Requesting assistance used to be too, but
 * verification is optional for users now, so `'request'` was removed rather than
 * left as a no-op: a call site still passing it should fail to compile.
 */
export type GatedAction = 'offer';

const REASON_KEY: Record<GatedAction, string> = {
    offer: 'verification.requiredToOffer',
};

/**
 * Wraps an action that needs a verified identity.
 *
 * One action is gated: a mechanic offering on a request. The server is the real
 * enforcement — appointments-service answers 403 VERIFICATION_REQUIRED — and this
 * only moves the redirect ahead of the round trip, to the moment of intent.
 *
 * The button stays enabled on purpose: tapping it opens the verification flow
 * instead of the action, which converts better than a greyed-out control.
 *
 * While the status is still unknown (`!hasLoaded`) the action runs. The server
 * refuses it if it must, and blocking optimistically would punish every verified
 * user for the latency of a status fetch.
 */
export function useVerifiedAction() {
    const router = useRouter();
    const { t } = useTranslation();
    const { hasLoaded, isApproved } = useVerification();

    return useCallback(
        <T extends (...args: any[]) => void | Promise<void>>(
            action: GatedAction,
            run: T,
        ) =>
            ((...args: Parameters<T>) => {
                if (hasLoaded && !isApproved) {
                    Alert.alert(
                        t('verification.notStartedTitle'),
                        t(REASON_KEY[action]),
                        [
                            { text: t('verification.notNow'), style: 'cancel' },
                            {
                                text: t('verification.startButton'),
                                onPress: () => router.push('/verify-identity' as any),
                            },
                        ],
                    );
                    return;
                }
                void run(...args);
            }) as T,
        [hasLoaded, isApproved, router, t],
    );
}
