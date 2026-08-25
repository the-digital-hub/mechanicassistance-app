import { useUser } from '@/context/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

/**
 * ASE-verification reminder pill, mirroring VerificationBadge.
 *
 * The ASE step is skippable during signup, so this is the prompt that brings a
 * mechanic back to finish it. It renders only while the credential is pending:
 * once verified there is nothing to act on, and the ASE screen already lists
 * the certifications.
 *
 * Renders nothing for non-mechanics, and nothing when aseStatus is absent — an
 * older backend that doesn't send it must not surface a false "not verified".
 */
export function AseStatusBadge() {
    const { t } = useTranslation();
    const router = useRouter();
    const { user } = useUser();

    if (user?.role !== 'mechanic') return null;
    if (user.mechanicDetails?.aseStatus !== 'pending') return null;

    return (
        <TouchableOpacity
            onPress={() => router.push('/ase' as any)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('profile.aseBadge.cta')}
        >
            <View
                className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ backgroundColor: '#F3F4F6' }}
            >
                <Ionicons name="ribbon-outline" size={14} color="#4B5563" />
                <Text className="font-outfit-semibold text-xs" style={{ color: '#4B5563' }}>
                    {t('profile.aseBadge.pending')}
                </Text>
                <Ionicons name="chevron-forward" size={12} color="#4B5563" />
            </View>
        </TouchableOpacity>
    );
}
