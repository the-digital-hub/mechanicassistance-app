import { Button } from '@/components/ui/Button';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, UserX } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function DeleteAccountScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const [showModal, setShowModal] = useState(false);

    const handleDelete = () => {
        // API Call to delete account
        console.log('Account deleted');
        setShowModal(false);
        router.replace('/login');
    };

    return (
        <ScrollView style={{ backgroundColor: '#F6F8FC' }} contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24, paddingBottom: 40 }}>
            {/* Section Badge */}
            <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
              <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
              <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                {t('deleteAccount.badge')}
              </Text>
            </View>

            {/* Title */}
            <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">{t('deleteAccount.title')}</Text>

            {/* Subtitle */}
            <Text className="text-gray-500 font-outfit-regular text-base mb-8">
              {t('deleteAccount.subtitle')}
            </Text>

            <Text className="font-outfit-medium text-gray-900 text-lg mb-4">{t('deleteAccount.sorry')}</Text>

            <Text className="font-outfit-regular text-gray-600 leading-6 mb-4">
                {t('deleteAccount.warning')}
            </Text>

            <Text className="font-outfit-regular text-gray-600 leading-6 mb-12">
                {t('deleteAccount.confirmQuestion')}
            </Text>

            {/* Buttons Row */}
            <View className="flex-row gap-3">
                {/* Back Button - 30% width */}
                <TouchableOpacity
                    onPress={() => router.back()}
                    activeOpacity={0.8}
                    style={{ flex: 0.3 }}
                    className="py-4 rounded-lg border border-gray-300 items-center"
                >
                    <Text className="text-gray-900 font-outfit-semibold text-base">{t('deleteAccount.back')}</Text>
                </TouchableOpacity>

                {/* Delete Account Button - 70% width */}
                <TouchableOpacity
                    onPress={() => setShowModal(true)}
                    activeOpacity={0.8}
                    style={{ flex: 0.7 }}
                >
                    <LinearGradient
                        colors={['#2B66F8', '#081E72']}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                            borderRadius: 8,
                            paddingVertical: 16,
                            paddingHorizontal: 16,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Text className="text-white font-outfit-bold text-base text-center">{t('deleteAccount.title')}</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            <ConfirmationModal
                visible={showModal}
                onClose={() => setShowModal(false)}
                onConfirm={handleDelete}
                title={t('deleteAccount.confirmModalTitle')}
                message="" // Message inside title in design
                icon={UserX}
                iconColor="#00A8E8" // Cyan/Blue color from design
                confirmButtonColor="#0047AB"
                confirmText={t('deleteAccount.yes')}
                cancelText={t('deleteAccount.no')}
            />
        </ScrollView>
    );
}
