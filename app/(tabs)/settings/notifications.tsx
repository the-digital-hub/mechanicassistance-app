import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';

export default function NotificationsSettingsScreen() {
    const router = useRouter();
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
        { key: 'general', label: 'General Notification' },
        { key: 'sound', label: 'Sound' },
        { key: 'soundCall', label: 'Sound Call' },
        { key: 'vibrate', label: 'Vibrate' },
        { key: 'specialOffers', label: 'Special Offers' },
        { key: 'payments', label: 'Payments' },
        { key: 'promo', label: 'Promo and discount' },
        { key: 'cashback', label: 'Cashback' },
    ];

    return (
        <ScrollView style={{ backgroundColor: '#F6F8FC' }} contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24, paddingBottom: 40 }}>
            {/* Section Badge */}
            <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
              <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
              <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                NOTIFICATION SETTINGS
              </Text>
            </View>

            {/* Title */}
            <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">Notifications</Text>

            {/* Subtitle */}
            <Text className="text-gray-500 font-outfit-regular text-base mb-8">
              Customize your notification preferences
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
