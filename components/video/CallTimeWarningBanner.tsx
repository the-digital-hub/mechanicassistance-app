import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, Text, View } from 'react-native';

import { AO } from '@/components/offer/OfferSections';

const K = 'appointments.videoCall.live';

/**
 * "Less than 5 minutes left": an orange pill that slides in over the video
 * when the session enters its last minutes. The screen decides when it shows
 * and hides it. Tapping it lets the owner buy more time (`onPress`); the
 * mechanic, who cannot extend, just dismisses it.
 */
export function CallTimeWarningBanner({ visible, isOwner, top = 12, onPress, onDismiss }: {
    visible: boolean;
    isOwner: boolean;
    /** Distance from the top of the parent, e.g. below the top bar. */
    top?: number;
    /** Owner only: open the extension sheet. */
    onPress?: () => void;
    onDismiss: () => void;
}) {
    const { t } = useTranslation();
    const anim = React.useRef(new Animated.Value(0)).current;
    // Stays mounted while it fades out after `visible` turns false.
    const [mounted, setMounted] = React.useState(visible);

    React.useEffect(() => {
        if (visible) {
            setMounted(true);
            Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
        } else {
            Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
                if (finished) setMounted(false);
            });
        }
    }, [visible, anim]);

    if (!mounted) return null;

    return (
        <View pointerEvents="box-none" style={{ position: 'absolute', top, left: 16, right: 16, zIndex: 50, alignItems: 'center' }}>
            <Animated.View
                style={{
                    opacity: anim,
                    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
                }}
            >
                <Pressable
                    onPress={isOwner && onPress ? onPress : onDismiss}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    testID="call-time-warning"
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 100,
                        backgroundColor: AO.orange,
                        shadowColor: '#000',
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 4 },
                        elevation: 6,
                    }}
                >
                    <Ionicons name="time-outline" size={18} color="#FFFFFF" />
                    <Text className="font-outfit-bold" style={{ flexShrink: 1, fontSize: 13.5, color: '#FFFFFF' }} testID="call-time-warning-text">
                        {t(isOwner ? `${K}.warnOwner` : `${K}.warnMechanic`)}
                    </Text>
                </Pressable>
            </Animated.View>
        </View>
    );
}
