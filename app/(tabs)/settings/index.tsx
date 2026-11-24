import { useTabBarInset } from '@/components/ui/RoundedTabBar';
import { useRouter } from 'expo-router';
import { Bell, ChevronLeft, ChevronRight, Globe, Key, UserX } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
    const tabInset = useTabBarInset();
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const current = i18n.language?.startsWith('es') ? 'es' : 'en';

    const menuItems: { icon: typeof Bell; label: string; route: string; value?: string }[] = [
        {
            icon: Bell,
            label: t('settingsMenu.notifications'),
            route: '/settings/notifications',
        },
        {
            icon: Globe,
            label: t('settingsMenu.language'),
            route: '/settings/language',
            value: t(current === 'en' ? 'profile.language.english' : 'profile.language.spanish'),
        },
        {
            icon: Key,
            label: t('settingsMenu.password'),
            route: '/settings/password',
        },
        {
            icon: UserX,
            label: t('settingsMenu.deleteAccount'),
            route: '/settings/delete-account',
        },
    ];

    return (
        <ScrollView style={{ backgroundColor: '#F6F8FC' }} contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24, paddingBottom: 40 + tabInset }}>
            {/* Section Badge */}
            <View style={{ marginTop: 8 }}>
              <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
              <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
              <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                {t('settingsMenu.badge')}
              </Text>
            </View>
            </View>

            {/* Title */}
            <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">{t('settingsMenu.title')}</Text>

            {/* Subtitle */}
            <Text className="text-gray-500 font-outfit-regular text-base mb-8">
              {t('settingsMenu.subtitle')}
            </Text>

            <View className="bg-white rounded-3xl overflow-hidden" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 10, elevation: 5 }}>
                {menuItems.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        className="flex-row items-center px-6 py-4"
                        style={{ borderBottomWidth: index < menuItems.length - 1 ? 1 : 0, borderBottomColor: '#F3F4F6' }}
                        onPress={() => router.push(item.route)}
                    >
                        <View className="w-12 h-12 bg-blue-50 rounded-full justify-center items-center mr-4">
                            <item.icon size={24} color="#0047AB" />
                        </View>
                        <View className="flex-1 justify-center">
                            <Text className="font-outfit-semibold text-lg text-gray-900">{item.label}</Text>
                        </View>
                        {item.value ? (
                            <View className="px-2.5 py-1 rounded-full mr-2" style={{ backgroundColor: '#EAF1FF' }}>
                                <Text className="font-outfit-bold" style={{ fontSize: 13, color: '#1E56E3' }}>{item.value}</Text>
                            </View>
                        ) : null}
                        <ChevronRight size={24} color="#0047AB" />
                    </TouchableOpacity>
                ))}
            </View>

        </ScrollView>
    );
}
