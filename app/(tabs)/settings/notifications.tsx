import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';

export default function NotificationsSettingsScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const [settings, setSettings] = useState({
        general: true,
        sound: true,
        soundCall: true,
        vibrate: false,
        specialOffers: false,
        payments: false,
        promo: false,
        cashback: false,
    });

    const toggleSwitch = (key: keyof typeof settings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const items = [
        { key: 'general', label: t('settingsNotifications.general') },
        { key: 'sound', label: t('settingsNotifications.sound') },
        { key: 'soundCall', label: t('settingsNotifications.soundCall') },
        { key: 'vibrate', label: t('settingsNotifications.vibrate') },
        { key: 'specialOffers', label: t('settingsNotifications.specialOffers') },
        { key: 'payments', label: t('settingsNotifications.payments') },
        { key: 'promo', label: t('settingsNotifications.promo') },
        { key: 'cashback', label: t('settingsNotifications.cashback') },
    ];

    return (
        <ScrollView style={{ backgroundColor: '#F6F8FC' }} contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24, paddingBottom: 40 }}>
            {/* Section Badge */}
            <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
              <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
              <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                {t('settingsNotifications.badge')}
              </Text>
            </View>

            {/* Title */}
            <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">{t('settingsNotifications.title')}</Text>

            {/* Subtitle */}
            <Text className="text-gray-500 font-outfit-regular text-base mb-8">
              {t('settingsNotifications.subtitle')}
            </Text>

            <View className="gap-6">
                {items.map((item) => (
                    <View key={item.key} className="flex-row justify-between items-center">
                        <Text className="font-outfit-medium text-gray-900 text-lg">{item.label}</Text>
                        <Switch
                            trackColor={{ false: '#767577', true: '#0047AB' }}
                            thumbColor={settings[item.key as keyof typeof settings] ? '#fff' : '#f4f3f4'}
                            ios_backgroundColor="#E5E7EB"
                            onValueChange={() => toggleSwitch(item.key as keyof typeof settings)}
                            value={settings[item.key as keyof typeof settings]}
                        />
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}
