import { Button } from '@/components/ui/Button';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, UserX } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useUser } from '@/context/UserContext';
import { deletionBlocks, isDeletionUnavailable } from '@/lib/account/deletion';
import { userDAO } from '@/lib/dao/UserDAO';
import { deletionProvider, finishFirebaseDeletion, reauthenticate, type FreshSignIn } from '@/lib/firebase/accountDeletion';
import { appAlert } from '@/lib/ui/appAlert';

export default function DeleteAccountScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { logout } = useUser();
    const [showModal, setShowModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Backend 26-nov (`DELETE /api/users/me`, plataforma/borrado-de-cuenta.md §5). Order matters: with Apple or Google, sign in again BEFORE the
    // server is called; any error from the server stops here with the account intact; only after it worked the Apple token is revoked, the
    // Firebase user deleted and the session closed.
    const handleDelete = async () => {
        setShowModal(false);
        if (deleting) return;
        setDeleting(true);
        try {
            const provider = deletionProvider();
            let fresh: FreshSignIn = {};
            if (provider) {
                try {
                    fresh = await reauthenticate(provider);
                } catch {
                    appAlert(t('deleteAccount.reauthFailedTitle'), t('deleteAccount.reauthFailed'), undefined, { tone: 'info' });
                    return;
                }
            }
            await userDAO.deleteAccount();
            if (provider) await finishFirebaseDeletion(fresh);
            await logout();
            router.replace('/onboarding');
        } catch (error) {
            const blocks = deletionBlocks(error);
            if (blocks.length > 0) {
                const lines = blocks.map((b) => `• ${t(`deleteAccount.blocked.${b.code}`, { defaultValue: b.message ?? b.code })}`);
                appAlert(t('deleteAccount.blockedTitle'), `${t('deleteAccount.blockedIntro')}\n\n${lines.join('\n')}`, undefined, { tone: 'info' });
            } else if (isDeletionUnavailable(error)) {
                appAlert(t('deleteAccount.failedTitle'), t('deleteAccount.unavailable'), undefined, { tone: 'danger' });
            } else {
                appAlert(t('deleteAccount.failedTitle'), t('deleteAccount.failed'), undefined, { tone: 'danger' });
            }
        } finally {
            setDeleting(false);
        }
    };

    return (
        <ScrollView style={{ backgroundColor: '#F6F8FC' }} contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24, paddingBottom: 40 }}>
            {/* Section Badge */}
            <View style={{ marginTop: 8 }}>
              <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
              <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
              <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                {t('deleteAccount.badge')}
              </Text>
            </View>
            </View>

            {/* Title */}
            <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">{t('deleteAccount.title')}</Text>

            {/* Subtitle */}
            <Text className="text-gray-500 font-outfit-regular text-base mb-8">
              {t('deleteAccount.subtitle')}
            </Text>

            <Text className="font-outfit-medium text-gray-900 text-xl mb-4">{t('deleteAccount.sorry')}</Text>

            <Text className="font-outfit-regular text-gray-600 text-base leading-6 mb-4">
                {t('deleteAccount.warning')}
            </Text>

            <Text className="font-outfit-regular text-gray-600 text-base leading-6 mb-12">
                {t('deleteAccount.confirmQuestion')}
            </Text>

            {/* Buttons Row */}
            <View className="gap-3">
                <TouchableOpacity
                    onPress={() => setShowModal(true)}
                    activeOpacity={0.8}
                    disabled={deleting}
                    accessibilityState={{ busy: deleting, disabled: deleting }}
                    testID="delete-account-button"
                >
                    <LinearGradient
                        colors={['#2B66F8', '#081E72']}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                            borderRadius: 14,
                            paddingVertical: 16,
                            paddingHorizontal: 16,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {deleting ? <ActivityIndicator color="white" style={{ marginRight: 10 }} /> : null}
                        <Text className="text-white font-outfit-bold text-lg text-center">{t(deleting ? 'deleteAccount.deleting' : 'deleteAccount.title')}</Text>
                    </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => router.back()}
                    activeOpacity={0.8}
                    className="items-center" style={{ paddingVertical: 16, borderRadius: 14, backgroundColor: '#E6EAF2' }}
                >
                    <Text className="font-outfit-bold" style={{ fontSize: 17, lineHeight: 23, color: '#4A5470' }}>{t('deleteAccount.back')}</Text>
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
