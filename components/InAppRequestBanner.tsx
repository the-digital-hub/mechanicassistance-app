import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dismissInAppBanner, useInAppBanner } from '@/lib/notifications/inAppAlerts';

/** How long it stays before going away by itself: long enough to read, short enough not to get in the way. */
const VISIBLE_MS = 8000;

/**
 * A small alert at the top of the screen for a push that arrives while the app is open: one line of title, one of
 * text, tap to open it, a cross to dismiss. It floats over whatever the person is doing and leaves it usable.
 * Renders nothing when there is no alert.
 */
export function InAppRequestBanner() {
    const { t } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const banner = useInAppBanner();
    const anim = React.useRef(new Animated.Value(0)).current;
    // Keeps the text while it slides out.
    const [shown, setShown] = React.useState(banner);

    React.useEffect(() => {
        if (banner) {
            setShown(banner);
            Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
            const timer = setTimeout(dismissInAppBanner, VISIBLE_MS);
            return () => clearTimeout(timer);
        }
        Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
            if (finished) setShown(null);
        });
        return undefined;
    }, [banner, anim]);

    if (!shown) return null;

    const open = () => {
        const route = shown.route;
        dismissInAppBanner();
        if (route) {
            try {
                router.navigate(route, { withAnchor: true });
            } catch {
                /* the navigator is not ready: the alert simply closes */
            }
        }
    };

    return (
        <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, elevation: 1000 }} testID="in-app-banner-host">
            <Animated.View
                style={{
                    marginTop: insets.top + (Platform.OS === 'android' ? 8 : 4),
                    marginHorizontal: 12,
                    opacity: anim,
                    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
                }}
            >
                <TouchableOpacity
                    onPress={open}
                    activeOpacity={0.9}
                    accessibilityRole="button"
                    accessibilityLabel={`${shown.title}. ${shown.body}`}
                    className="flex-row items-center"
                    style={{
                        gap: 12,
                        paddingVertical: 10,
                        paddingLeft: 10,
                        paddingRight: 6,
                        borderRadius: 18,
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1,
                        borderColor: '#DCE7FA',
                        shadowColor: '#0B1F5C',
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.18,
                        shadowRadius: 16,
                        elevation: 12,
                    }}
                    testID="in-app-banner"
                >
                    <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#EAF1FF' }}>
                        <Ionicons name="notifications" size={20} color="#1E56E3" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text className="font-outfit-bold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20, color: '#0B1530' }}>{shown.title}</Text>
                        <Text className="font-outfit-regular" numberOfLines={1} style={{ fontSize: 14, lineHeight: 19, color: '#6B7490' }}>{shown.body}</Text>
                    </View>
                    <View className="items-center justify-center" style={{ paddingHorizontal: 12, height: 34, borderRadius: 999, backgroundColor: '#EAF1FF' }}>
                        <Text className="font-outfit-bold" style={{ fontSize: 14, color: '#1E56E3' }}>{t('inAppAlert.view')}</Text>
                    </View>
                    <TouchableOpacity onPress={dismissInAppBanner} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('inAppAlert.dismiss')} testID="in-app-banner-close" style={{ padding: 8 }}>
                        <Ionicons name="close" size={20} color="#8C96AE" />
                    </TouchableOpacity>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}
