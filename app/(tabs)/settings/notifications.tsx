import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useUser } from '@/context/UserContext';
import { useInAppAlertsEnabled } from '@/lib/notifications/inAppAlerts';
import { useSoundEnabled } from '@/lib/notifications/sound';
import { useVibrateEnabled } from '@/lib/notifications/vibration';

export default function NotificationsSettingsScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { user } = useUser();
    const [inAppAlerts, setInAppAlerts] = useInAppAlertsEnabled();
    const [vibrate, setVibrate] = useVibrateEnabled();
    const [sound, setSound] = useSoundEnabled();
    const [settings, setSettings] = useState({
        general: true,
        specialOffers: false,
    });

    const toggleSwitch = (key: keyof typeof settings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const items = [
        { key: 'general', label: t('settingsNotifications.general') },
        { key: 'specialOffers', label: t('settingsNotifications.specialOffers') },
    ];

    return (
        <ScrollView style={{ backgroundColor: '#F6F8FC' }} contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24, paddingBottom: 40 }}>
            {/* Section Badge */}
            <View style={{ marginTop: 8 }}>
              <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
              <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
              <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                {t('settingsNotifications.badge')}
              </Text>
            </View>
            </View>

            {/* Title */}
            <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">{t('settingsNotifications.title')}</Text>

            {/* Subtitle */}
            <Text className="text-gray-500 font-outfit-regular text-base mb-8">
              {t('settingsNotifications.subtitle')}
            </Text>

            {user ? (
                <View className="flex-row items-center mb-8" style={{ gap: 16 }}>
                    <View style={{ flex: 1 }}>
                        <Text className="font-outfit-medium text-gray-900 text-lg">{t('settingsNotifications.inAppRequests')}</Text>
                        <Text className="font-outfit-regular text-gray-500 text-base">{t('settingsNotifications.inAppRequestsHelp')}</Text>
                    </View>
                    <Switch
                        trackColor={{ false: '#767577', true: '#0047AB' }}
                        thumbColor={inAppAlerts ? '#fff' : '#f4f3f4'}
                        ios_backgroundColor="#E5E7EB"
                        onValueChange={setInAppAlerts}
                        value={inAppAlerts}
                        testID="in-app-alerts-switch"
                    />
                </View>
            ) : null}

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
                {/* Sound and Vibrate do something: with them on, an alert that arrives while the app is open rings a bell and buzzes. */}
                <View className="flex-row justify-between items-center">
                    <Text className="font-outfit-medium text-gray-900 text-lg">{t('settingsNotifications.sound')}</Text>
                    <Switch
                        trackColor={{ false: '#767577', true: '#0047AB' }}
                        thumbColor={sound ? '#fff' : '#f4f3f4'}
                        ios_backgroundColor="#E5E7EB"
                        onValueChange={setSound}
                        value={sound}
                        testID="sound-switch"
                    />
                </View>
                {/* Vibrate does something: with it on, an alert that arrives while the app is open buzzes the phone. */}
                <View className="flex-row justify-between items-center">
                    <Text className="font-outfit-medium text-gray-900 text-lg">{t('settingsNotifications.vibrate')}</Text>
                    <Switch
                        trackColor={{ false: '#767577', true: '#0047AB' }}
                        thumbColor={vibrate ? '#fff' : '#f4f3f4'}
                        ios_backgroundColor="#E5E7EB"
                        onValueChange={setVibrate}
                        value={vibrate}
                        testID="vibrate-switch"
                    />
                </View>
            </View>
        </ScrollView>
    );
}
