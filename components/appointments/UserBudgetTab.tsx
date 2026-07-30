import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

export function UserBudgetTab({ appointment }: { appointment: any }) {
    const { t } = useTranslation();
    if (!appointment) return null;
    return (
        <View className="gap-6" testID="user-budget-tab">
            <View className="gap-4">
                <View className="flex-row justify-between">
                    <Text className="font-outfit-bold text-blue-900">{t('appointments.userBudget.initialQuote')}</Text>
                    <Text className="text-gray-900 font-outfit-bold">$250.00</Text>
                </View>
                <View className="flex-row justify-between">
                    <Text className="font-outfit-bold text-blue-900 text-lg">{t('appointments.userBudget.totalEstimate')}</Text>
                    <Text className="text-blue-600 font-outfit-bold text-xl">$281.25</Text>
                </View>
            </View>
        </View>
    );
}
