import { setAppLanguage } from '@/lib/i18n';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function LanguageScreen() {
    const { t, i18n } = useTranslation();
    const current = i18n.language?.startsWith('es') ? 'es' : 'en';

    return (
        <ScrollView style={{ backgroundColor: '#F6F8FC' }} contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24, paddingBottom: 40 }}>
            <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">{t('settingsMenu.languageBadge')}</Text>
            </View>
            <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">{t('settingsMenu.language')}</Text>
            <Text className="text-gray-500 font-outfit-regular text-base mb-8">{t('settingsMenu.languageSubtitle')}</Text>

            <View className="bg-white rounded-3xl overflow-hidden" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 10, elevation: 5 }}>
                {(['en', 'es'] as const).map((code, i) => {
                    const on = current === code;
                    return (
                        <TouchableOpacity
                            key={code}
                            onPress={() => setAppLanguage(code)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on }}
                            testID={`settings-lang-${code}`}
                            className="flex-row items-center px-6 py-5"
                            style={{ borderBottomWidth: i === 0 ? 1 : 0, borderBottomColor: '#F3F4F6' }}
                        >
                            <Text className="flex-1 font-outfit-semibold text-lg" style={{ color: on ? '#1E56E3' : '#111827' }}>
                                {t(code === 'en' ? 'profile.language.english' : 'profile.language.spanish')}
                            </Text>
                            {on ? <Check size={24} color="#1E56E3" /> : null}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </ScrollView>
    );
}
