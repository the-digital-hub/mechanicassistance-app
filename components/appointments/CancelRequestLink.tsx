import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

/** Statuses where a job can still be called off before work starts. */
export function canCancelBeforeStart(status?: string | null): boolean {
    return status === 'accepted' || status === 'scheduled' || status === 'pending';
}

/**
 * "Cancel request" link with the same confirmation the Appointments list uses;
 * confirming continues to the cancel-reason screen, which performs the cancel.
 */
export function CancelRequestLink({ appointmentId, align = 'flex-end' }: { appointmentId: string; align?: 'flex-end' | 'center' }) {
    const { t } = useTranslation();
    const router = useRouter();
    const [visible, setVisible] = useState(false);

    const confirm = () => {
        setVisible(false);
        router.push({ pathname: '/appointments/cancel-reason' as any, params: { id: appointmentId } });
    };

    return (
        <>
            <TouchableOpacity
                onPress={() => setVisible(true)}
                hitSlop={8}
                style={{ alignSelf: align, paddingVertical: 6 }}
                accessibilityRole="button"
                testID="cancel-request-link"
            >
                <Text className="font-outfit-bold text-xs" style={{ color: '#E53E3E' }}>{t('appointments.list.card.cancelRequest')}</Text>
            </TouchableOpacity>

            <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
                <View className="flex-1 justify-center items-center bg-black/40 px-6">
                    <View className="bg-white rounded-2xl w-full p-6 items-center shadow-lg">
                        <View className="w-16 h-16 rounded-full border-2 border-red-500 items-center justify-center mb-4">
                            <X size={32} color="#EF4444" />
                        </View>
                        <Text className="text-xl font-outfit-medium text-blue-900 mb-2">{t('appointments.list.cancelModalTitle')}</Text>
                        <Text className="text-gray-500 text-center font-outfit-regular mb-6">{t('appointments.list.cancelModalMessage')}</Text>
                        <View className="flex-row gap-4 w-full">
                            <TouchableOpacity className="flex-1 py-3 border border-gray-200 rounded-lg" onPress={() => setVisible(false)}>
                                <Text className="text-center font-outfit-medium text-gray-700">{t('appointments.list.no')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity className="flex-1 py-3 bg-blue-700 rounded-lg" onPress={confirm}>
                                <Text className="text-center font-outfit-medium text-white">{t('appointments.list.yesCancel')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}
