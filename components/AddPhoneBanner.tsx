import { useUser } from '@/context/UserContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Smartphone, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

const dismissKey = (userId: string) => `phone_banner_dismissed:${userId}`;

/**
 * Asks an account with no phone to add one.
 *
 * Accounts created with Google or Apple have no phone, so they can only ever
 * sign in the way they signed up. Shown on the home screen until the person
 * adds a number or dismisses it; the dismissal is remembered per account on
 * this device. The phone field in Personal info stays as the way back.
 */
export function AddPhoneBanner({ className }: { className?: string }) {
    const router = useRouter();
    const { t } = useTranslation();
    const { user } = useUser();
    const userId = user?.id;
    const needsPhone = !!userId && !user?.phone;

    // Hidden until storage answers, so a dismissed banner never flashes.
    const [dismissed, setDismissed] = useState(true);

    useEffect(() => {
        if (!needsPhone || !userId) return;
        let active = true;
        AsyncStorage.getItem(dismissKey(userId))
            .then((value) => active && setDismissed(value === '1'))
            .catch(() => active && setDismissed(false));
        return () => {
            active = false;
        };
    }, [needsPhone, userId]);

    if (!needsPhone || dismissed) return null;

    const dismiss = () => {
        setDismissed(true);
        if (userId) AsyncStorage.setItem(dismissKey(userId), '1').catch(() => undefined);
    };

    return (
        <View
            className={`bg-white rounded-2xl p-4 flex-row ${className ?? ''}`}
            style={{ borderWidth: 1, borderColor: '#DCE6FF' }}
            testID="add-phone-banner"
        >
            <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: '#E9F1FF' }}>
                <Smartphone size={20} color="#0047AB" />
            </View>
            <View className="flex-1">
                <Text className="font-outfit-semibold text-base text-[#0F172A] mb-1">{t('phoneChange.bannerTitle')}</Text>
                <Text className="font-outfit-regular text-sm text-slate-500 mb-3">{t('phoneChange.bannerMessage')}</Text>
                <TouchableOpacity onPress={() => router.push('/phone-change' as any)} activeOpacity={0.8} style={{ alignSelf: 'flex-start' }}>
                    <Text className="font-outfit-semibold text-[#0047AB]">{t('phoneChange.bannerAction')}</Text>
                </TouchableOpacity>
            </View>
            <TouchableOpacity
                onPress={dismiss}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={t('phoneChange.bannerDismiss')}
            >
                <X size={18} color="#94A3B8" />
            </TouchableOpacity>
        </View>
    );
}
