import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Text, TouchableOpacity, View } from 'react-native';

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

interface MechanicArrivalCardProps {
    onStartCheckIn: () => void;
    /** Already checked in: the button resumes the visit instead of starting it. */
    inProgress?: boolean;
    /** Not headed out yet: shown dimmed, and check-in cannot start. */
    disabled?: boolean;
}

export function MechanicArrivalCard({ onStartCheckIn, inProgress, disabled }: MechanicArrivalCardProps) {
    const { t } = useTranslation();

    return (
        <View
            className="mx-4 bg-white"
            pointerEvents={disabled ? 'none' : 'auto'}
            accessibilityState={{ disabled: !!disabled }}
            testID="mechanic-arrival-card"
            style={{
                opacity: disabled ? 0.5 : 1,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#EEF2FA',
                shadowColor: BLUE,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: disabled ? 0.06 : 0.14,
                shadowRadius: 14,
                elevation: disabled ? 2 : 5,
            }}
        >
            <View className="flex-row px-4 pt-4" style={{ gap: 12 }}>
                <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#EAF1FF' }}>
                    <Ionicons name="location-outline" size={20} color={BLUE} />
                </View>
                <View className="flex-1">
                    <Text className="font-outfit-bold" style={{ fontSize: 17, lineHeight: 23, color: '#0B1530' }}>
                        {t('appointments.detail.arrival.title')}
                    </Text>
                    <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: '#6B7490' }}>
                        {t('appointments.detail.arrival.subtitle')}
                    </Text>
                </View>
            </View>

            <View className="p-4">
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

                {!inProgress ? (
                    disabled ? (
                        // Not headed out yet: say why the button is off, instead of a notice that contradicts it.
                        <Text className="text-center mt-3 font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: '#6B7490' }}>
                            {t('appointments.detail.arrival.disabledNote')}
                        </Text>
                    ) : (
                        // The two ways to check in, so it is clear what happens next.
                        <View className="flex-row items-center justify-center mt-3.5" style={{ gap: 10 }}>
                            <View className="flex-row items-center" style={{ gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, backgroundColor: '#F4F8FF' }}>
                                <Ionicons name="qr-code-outline" size={16} color={BLUE} />
                                <Text className="font-outfit-semibold" style={{ fontSize: 14, color: '#0B1530' }}>{t('appointments.detail.arrival.chipQr')}</Text>
                            </View>
                            <Text className="font-outfit-regular" style={{ fontSize: 14, color: '#8C96AE' }}>{t('appointments.detail.arrival.or')}</Text>
                            <View className="flex-row items-center" style={{ gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, backgroundColor: '#F4F8FF' }}>
                                <Ionicons name="keypad-outline" size={16} color={BLUE} />
                                <Text className="font-outfit-semibold" style={{ fontSize: 14, color: '#0B1530' }}>{t('appointments.detail.arrival.chipPin')}</Text>
                            </View>
                        </View>
                    )
                ) : null}
            </View>
        </View>
    );
}
