import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, Text, View } from 'react-native';

import { AO } from '@/components/offer/OfferSections';
import { useCallTimeAddedNotice } from '@/hooks/useCallTimeAddedNotice';

const K = 'videoCall.extend';

const VARIANTS = {
    dark: { bg: 'rgba(30,86,227,0.95)', fg: '#FFFFFF' },
    light: { bg: AO.blue, fg: '#FFFFFF' },
} as const;

/**
 * "The owner added 15 minutes to the call": a pill that slides in at the top
 * when the owner buys extra time, and goes away by itself after a few seconds
 * (or when tapped). Both sides see it — the mechanic is told, the owner gets
 * the confirmation. The screen around it stays usable.
 */
export function CallTimeAddedToast({ appointmentId, variant = 'light', top = 12 }: {
    appointmentId: string | undefined;
    variant?: keyof typeof VARIANTS;
    /** Distance from the top of the parent, e.g. below a header. */
    top?: number;
}) {
    const { t } = useTranslation();
    const { notice, dismiss } = useCallTimeAddedNotice(appointmentId);
    const anim = React.useRef(new Animated.Value(0)).current;
    // Keeps the text while it fades out after the notice is cleared.
    const [shown, setShown] = React.useState(notice);

    React.useEffect(() => {
        if (notice) {
            setShown(notice);
            Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
        } else {
            Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
                if (finished) setShown(null);
            });
        }
    }, [notice, anim]);

    if (!shown) return null;
    const { bg, fg } = VARIANTS[variant];

    return (
        <View pointerEvents="box-none" style={{ position: 'absolute', top, left: 16, right: 16, zIndex: 50, alignItems: 'center' }}>
            <Animated.View
                style={{
                    opacity: anim,
                    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
                }}
            >
                <Pressable
                    onPress={dismiss}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    testID="call-time-added-toast"
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 100,
                        backgroundColor: bg,
                        shadowColor: '#000',
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 4 },
                        elevation: 6,
                    }}
                >
                    <Ionicons name="time-outline" size={18} color={fg} />
                    <Text className="font-outfit-bold" style={{ fontSize: 13.5, color: fg }} testID="call-time-added-text">
                        {t(shown.role === 'owner' ? `${K}.addedBySelf` : `${K}.addedByOwner`, { minutes: shown.minutes })}
                    </Text>
                </Pressable>
            </Animated.View>
        </View>
    );
}
