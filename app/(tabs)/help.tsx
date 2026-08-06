import { useRouter } from 'expo-router';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutAnimation, Platform, ScrollView, Text, TouchableOpacity, UIManager, View } from 'react-native';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

export default function HelpScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const [expandedIds, setExpandedIds] = useState<number[]>([]);

    const toggleExpand = (id: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (expandedIds.includes(id)) {
            setExpandedIds(expandedIds.filter(i => i !== id));
        } else {
            setExpandedIds([...expandedIds, id]);
        }
    };

    const faqs = [1, 2, 3, 4].map((id) => ({
        id,
        question: t(`help.faqs.q${id}.question`),
        answer: t(`help.faqs.q${id}.answer`),
    }));

    return (
        <View className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
        <ScrollView className="flex-1 px-6 pt-6">
            {/* Section Badge */}
            <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
              <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
              <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                {t('help.badge')}
              </Text>
            </View>

            {/* Title */}
            <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">{t('help.title')}</Text>

            {/* Subtitle */}
            <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                {t('help.subtitle')}
            </Text>

            {/* Action Buttons */}
            <View className="flex-row flex-wrap gap-3 mb-8">
                <TouchableOpacity className="flex-1 min-w-[45%] border border-gray-800 rounded-lg py-3 items-center">
                    <Text className="font-outfit-bold text-gray-900">{t('help.contactUs')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    className="flex-1 min-w-[45%] border border-gray-800 rounded-lg py-3 items-center"
                    onPress={() => router.push('/live-chat')}
                >
                    <Text className="font-outfit-bold text-gray-900">{t('help.liveChat')}</Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-1 min-w-[45%] border border-gray-800 rounded-lg py-3 items-center">
                    <Text className="font-outfit-bold text-gray-900">{t('help.faq')}</Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-1 min-w-[45%] border border-gray-200 rounded-lg py-3 items-center">
                    <Text className="font-outfit-bold text-gray-900">{t('help.website')}</Text>
                </TouchableOpacity>
            </View>

            {/* Accordion FAQ */}
            <View className="gap-3 mb-10">
                {faqs.map((faq) => {
                    const isExpanded = expandedIds.includes(faq.id);
                    return (
                        <View key={faq.id} className="border border-blue-100 rounded-lg overflow-hidden bg-blue-50/30">
                            <TouchableOpacity
                                onPress={() => toggleExpand(faq.id)}
                                className={`flex-row justify-between items-center p-4 ${isExpanded ? 'bg-blue-600' : 'bg-transparent'}`}
                            >
                                <Text className={`font-outfit-bold text-base ${isExpanded ? 'text-white' : 'text-blue-900'}`}>
                                    {faq.question}
                                </Text>
                                {isExpanded ? <ChevronUp size={20} color="white" /> : <ChevronDown size={20} color="#0047AB" />}
                            </TouchableOpacity>
                            {isExpanded && (
                                <View className="p-4 bg-gray-50">
                                    <Text className="text-gray-600 font-outfit-regular leading-5">
                                        {faq.answer}
                                    </Text>
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>
        </ScrollView>
        </View>
    );
}
