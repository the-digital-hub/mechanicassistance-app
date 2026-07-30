import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

interface CancellationModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export function CancellationModal({ visible, onClose, onConfirm }: CancellationModalProps) {
    const { t } = useTranslation();
    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/50 justify-center items-center px-6">
                <View className="bg-white w-full rounded-2xl p-6 items-center">
                    {/* Header with Red X */}
                    <View className="w-16 h-16 rounded-full border-2 border-red-100 items-center justify-center mb-4">
                        <Ionicons name="close-outline" size={32} color="#EF4444" />
                    </View>

                    <Text className="font-outfit-bold text-xl text-gray-900 mb-2">{t('appointments.list.cancelModalTitle')}</Text>
                    <Text className="text-gray-500 text-center font-outfit-regular text-sm mb-6">
                        {t('appointments.cancellationModal.message')}
                    </Text>

                    <View className="flex-row gap-4 w-full">
                        <TouchableOpacity
                            onPress={onClose}
                            className="flex-1 bg-white border border-gray-200 py-3 rounded-lg items-center"
                        >
                            <Text className="font-outfit-bold text-gray-700">{t('appointments.list.no')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={onConfirm}
                            className="flex-1 bg-blue-600 py-3 rounded-lg items-center"
                        >
                            <Text className="font-outfit-bold text-white">{t('appointments.list.yesCancel')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
