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
}

export function MechanicArrivalCard({ onStartCheckIn }: MechanicArrivalCardProps) {
    const { t } = useTranslation();

    return (
        <View
            className="mx-4 bg-white"
            style={{
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#EEF2FA',
                shadowColor: BLUE,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.18,
                shadowRadius: 16,
                elevation: 6,
            }}
        >
            <View className="flex-row items-center gap-2 px-4 pt-4 pb-2">
                <PulseDot color={BLUE} size={7} />
                <Text className="font-outfit-bold text-[15px]" style={{ color: '#0B1530' }}>
                    {t('appointments.detail.arrival.title')}
                </Text>
            </View>
            <Text className="px-4 font-outfit-regular text-xs" style={{ color: '#6B7490' }}>
                {t('appointments.detail.arrival.subtitle')}
            </Text>

            <View className="p-4">
                <TouchableOpacity onPress={onStartCheckIn} activeOpacity={0.85} testID="start-check-in">
                    <LinearGradient
                        colors={['#1E56E3', '#0B2A8E']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                            borderRadius: 14,
                            paddingVertical: 16,
                            paddingHorizontal: 16,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 10,
                        }}
                    >
                        <Ionicons name="location-outline" size={20} color="white" />
                        <Text className="text-white font-outfit-bold text-base">
                            {t('appointments.detail.arrival.startCheckIn')}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>

                <Text className="text-center mt-3 font-outfit-regular text-[13px]" style={{ color: '#6B7490' }}>
                    {t('appointments.detail.arrival.hint')}
                </Text>

                <View className="flex-row items-start gap-2 mt-3 px-3 py-2.5 rounded-xl" style={{ backgroundColor: '#F4F8FF' }}>
                    <Ionicons name="information-circle-outline" size={15} color={BLUE} style={{ marginTop: 1 }} />
                    <Text className="flex-1 font-outfit-medium text-[11px] leading-4" style={{ color: BLUE }}>
                        {t('appointments.detail.arrival.notice')}
                    </Text>
                </View>
            </View>
        </View>
    );
}
