import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { TYPE } from '@/lib/ui/type';

const BLUE = '#1E56E3';

/** Small dot that softly pulses — marks a live status or the next step. */
export function PulseDot({ color, size = 8 }: { color: string; size?: number }) {
    const opacity = React.useRef(new Animated.Value(1)).current;

    React.useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 0.35, duration: 800, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [opacity]);

    return (
        <Animated.View
            style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity }}
        />
    );
}

/**
 * What happens after "Head out", under the button: the client is told, and check-in comes on arrival.
 * One small block of two aligned rows, instead of loose lines of text around the button.
 */
export function HeadOutNextSteps() {
    const { t } = useTranslation();
    const rows = [
        { icon: 'notifications-outline' as const, text: t('appointments.detail.headOutHint') },
        { icon: 'qr-code-outline' as const, text: t('appointments.detail.arrival.laterHint') },
    ];
    return (
        <View
            style={{ marginTop: 14, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF2FA', overflow: 'hidden' }}
            testID="head-out-next"
        >
            {rows.map((r, i) => (
                <View
                    key={r.icon}
                    className="flex-row items-center"
                    style={{ gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: '#EEF2FA' }}
                >
                    <View className="items-center justify-center" style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#EAF1FF' }}>
                        <Ionicons name={r.icon} size={17} color={BLUE} />
                    </View>
                    <Text className="flex-1 font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: '#6B7490' }}>{r.text}</Text>
                </View>
            ))}
        </View>
    );
}

interface MechanicArrivalCardProps {
    onStartCheckIn: () => void;
    /** Already checked in: the button resumes the visit instead of starting it. */
    inProgress?: boolean;
}

export function MechanicArrivalCard({ onStartCheckIn, inProgress }: MechanicArrivalCardProps) {
    const { t } = useTranslation();

    return (
        <View
            className="mx-4 bg-white"
            accessibilityState={{ disabled: false }}
            testID="mechanic-arrival-card"
            style={{
                opacity: 1,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#EEF2FA',
                shadowColor: BLUE,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.14,
                shadowRadius: 14,
                elevation: 5,
            }}
        >
            <View className="px-4 pt-4">
                <TouchableOpacity onPress={onStartCheckIn} activeOpacity={0.85} testID="start-check-in" accessibilityRole="button">
                    <LinearGradient
                        colors={['#1E56E3', '#0B2A8E']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                            borderRadius: 16,
                            minHeight: 56,
                            paddingHorizontal: 16,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 10,
                        }}
                    >
                        <Ionicons name="checkmark-circle-outline" size={22} color="white" />
                        <Text className="text-white font-outfit-bold" style={{ fontSize: 17, lineHeight: 23 }}>
                            {inProgress ? t('appointments.detail.arrival.continueVisit') : t('appointments.detail.arrival.startCheckIn')}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            <View className="flex-row px-4 pt-4 pb-4" style={{ gap: 12 }}>
                <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#EAF1FF' }}>
                    <Ionicons name="location-outline" size={20} color={BLUE} />
                </View>
                <View className="flex-1">
                    <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, color: '#0B1530' }}>
                        {t('appointments.detail.arrival.title')}
                    </Text>
                    <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: '#6B7490' }}>
                        {t('appointments.detail.arrival.subtitle')}
                    </Text>
                </View>
            </View>

        </View>
    );
}
