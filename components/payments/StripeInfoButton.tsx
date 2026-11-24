import * as WebBrowser from 'expo-web-browser';
import { Info } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity } from 'react-native';

import { appAlert } from '@/lib/ui/appAlert';

const STRIPE_URL = 'https://stripe.com';

/**
 * A small "i" that explains, in the app's own alert, what Stripe is and why it appears: for whoever sees "Stripe" on the screen and does not
 * know it. Nothing is added to the page itself; whoever has the doubt taps it, and can go on to Stripe's site from there.
 * `audience`: the technician is paid through it; the owner pays by card through it (each gets its own sentence).
 */
export function StripeInfoButton({ audience, size = 22, color = '#6B7490', testID }: { audience: 'provider' | 'customer'; size?: number; color?: string; testID?: string }) {
    const { t } = useTranslation();
    const show = () =>
        appAlert(
            t('stripeInfo.title'),
            t(`stripeInfo.${audience}`),
            [
                { text: t('stripeInfo.gotIt') },
                { text: t('stripeInfo.learnMore'), icon: 'open-outline', style: 'secondary', onPress: () => void WebBrowser.openBrowserAsync(STRIPE_URL) },
            ],
            { tone: 'info', cancelable: true },
        );
    return (
        <TouchableOpacity onPress={show} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('stripeInfo.title')} testID={testID ?? 'stripe-info'}>
            <Info size={size} color={color} />
        </TouchableOpacity>
    );
}
