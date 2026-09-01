import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, ChevronLeft, Lightbulb } from 'lucide-react-native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

/**
 * Kept in sync with VEHICLE_CONDITIONS in
 * appointments-service/src/common/constants/vehicle-conditions.ts — the DTO
 * rejects anything else with a 400.
 */
const CONDITIONS = ['drivable', 'unsafe_to_drive', 'pushable_only'] as const;
type Condition = (typeof CONDITIONS)[number];

export default function VehicleInformationScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { type, issues } = params;

    const [condition, setCondition] = useState<Condition | null>(null);
    const [details, setDetails] = useState('');
    const [suggestionOpen, setSuggestionOpen] = useState(false);

    const getTitle = () => {
        switch (type) {
            case 'immediate': return t('requestAssistance.header.immediate');
            case 'scheduled': return t('requestAssistance.header.scheduled');
            case 'videocall': return t('requestAssistance.header.videoCall');
            case 'witness': return t('requestAssistance.header.accident');
            default: return t('requestAssistance.header.default');
        }
    };

    const getBadgeText = () => {
        switch (type) {
            case 'immediate': return t('requestAssistance.badge.immediate');
            case 'scheduled': return t('requestAssistance.badge.scheduled');
            case 'videocall': return t('requestAssistance.badge.videoCall');
            case 'witness': return t('requestAssistance.badge.accident');
            default: return t('requestAssistance.badge.default');
        }
    };

    /**
     * Fills the textarea with a starting point built locally from what the user
     * already picked. No network call and no AI: the value is only a draft the
     * user is expected to edit.
     */
    const generateSuggestion = () => {
        if (!condition) return;

        const conditionPhrase = t(`requestAssistance.vehicleInformation.conditionPhrase.${condition}`);
        // `issues` holds catalog ids; `description` is the human-readable text
        // the earlier screens forward, which is what belongs in the draft.
        const issueLabel = typeof params.description === 'string' ? params.description.trim() : '';

        setDetails(
            issueLabel
                ? t('requestAssistance.vehicleInformation.suggestionTemplate', {
                    condition: conditionPhrase,
                    issues: issueLabel,
                })
                : t('requestAssistance.vehicleInformation.suggestionTemplateNoIssues', {
                    condition: conditionPhrase,
                })
        );
    };

    const handleContinue = () => {
        if (!condition) return;

        router.push({
            pathname: '/request-assistance/vehicle-documentation',
            params: {
                ...params,
                issues,
                condition,
                details,
            },
        });
    };

    return (
        <View className="flex-1" style={{ backgroundColor: '#F4F6FC' }}>
            {/* Custom Header */}
            <View className="px-6 pt-20 pb-2 flex-row items-center justify-between" style={{ backgroundColor: '#F4F5FA', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 3, borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB' }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <View className="w-10 h-10 rounded-full justify-center items-center" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
                        <ChevronLeft size={20} color="#0047AB" />
                    </View>
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Outfit_500Medium', fontSize: 18, color: '#1A1A1A', flex: 1, textAlign: 'center' }}>
                    {getTitle()}
                </Text>
                <View className="w-6" />
            </View>

            <ScrollView className="flex-1 px-6 pt-6" keyboardShouldPersistTaps="handled">
                <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                    <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                        {getBadgeText()}
                    </Text>
                </View>

                <Text className="text-gray-900 font-outfit-medium text-3xl mb-6">
                    {t('requestAssistance.vehicleInformation.title')}
                </Text>

                {/* Condition */}
                <View className="rounded-2xl p-4 mb-6" style={{ backgroundColor: '#E9F1FF' }}>
                    <Text className="text-gray-900 font-outfit-semibold text-sm mb-3">
                        {t('requestAssistance.vehicleInformation.question')}
                    </Text>

                    {CONDITIONS.map((option) => {
                        const selected = condition === option;
                        return (
                            <TouchableOpacity
                                key={option}
                                onPress={() => setCondition(option)}
                                activeOpacity={0.85}
                                className="flex-row items-center justify-between rounded-xl px-4 py-3 mb-2"
                                style={{
                                    backgroundColor: selected ? '#0047AB' : '#FFFFFF',
                                    borderWidth: selected ? 0 : 1,
                                    borderColor: '#E4EAF5',
                                }}
                            >
                                <Text
                                    className="font-outfit-semibold text-sm flex-1 pr-2"
                                    style={{ color: selected ? '#FFFFFF' : '#0F172A' }}
                                >
                                    {t(`requestAssistance.vehicleInformation.condition.${option}`)}
                                </Text>
                                {selected && <Check size={18} color="#FFFFFF" />}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Detailed explanation */}
                <View className="rounded-2xl p-4 mb-8" style={{ backgroundColor: '#F4F8FF' }}>
                    <Text className="text-gray-900 font-outfit-semibold text-sm mb-3">
                        {t('requestAssistance.vehicleInformation.explanationLabel')}{' '}
                        <Text className="text-gray-500 font-outfit-regular text-xs">
                            {t('requestAssistance.vehicleInformation.optional')}
                        </Text>
                    </Text>

                    <TextInput
                        multiline
                        numberOfLines={4}
                        placeholder={t('requestAssistance.vehicleInformation.placeholder')}
                        placeholderTextColor="#D1D5DB"
                        value={details}
                        onChangeText={setDetails}
                        className="bg-white border border-gray-200 rounded-2xl p-4 font-outfit-regular text-[#0F172A] text-base h-32"
                        style={{ textAlignVertical: 'top' }}
                    />

                    <TouchableOpacity
                        onPress={() => setSuggestionOpen(!suggestionOpen)}
                        className="flex-row items-center self-end mt-3 px-3 py-1.5 rounded-lg bg-white"
                        style={{ borderWidth: 1, borderColor: '#E4EAF5' }}
                    >
                        <Lightbulb size={14} color="#0047AB" />
                        <Text className="text-[#0047AB] font-outfit-bold text-xs ml-1.5">
                            {t('requestAssistance.vehicleInformation.suggestionToggle')}
                        </Text>
                    </TouchableOpacity>

                    {suggestionOpen && (
                        <View className="bg-white rounded-xl p-3 mt-3" style={{ borderWidth: 1, borderColor: '#E4EAF5' }}>
                            <Text className="text-gray-900 font-outfit-semibold text-xs mb-1.5">
                                {t('requestAssistance.vehicleInformation.suggestionTitle')}
                            </Text>
                            <Text className="text-gray-600 font-outfit-regular text-xs mb-3">
                                {t('requestAssistance.vehicleInformation.suggestionHint')}
                            </Text>
                            <TouchableOpacity
                                onPress={generateSuggestion}
                                disabled={!condition}
                                className="self-start px-3.5 py-2 rounded-lg"
                                style={{ backgroundColor: '#0047AB', opacity: condition ? 1 : 0.5 }}
                            >
                                <Text className="text-white font-outfit-bold text-xs">
                                    {t('requestAssistance.vehicleInformation.suggestionGenerate')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <TouchableOpacity onPress={handleContinue} disabled={!condition} activeOpacity={0.8}>
                    <LinearGradient
                        colors={condition ? ['#2B66F8', '#081E72'] : ['#C7D2E4', '#A9B6CC']}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                            borderRadius: 10,
                            paddingVertical: 16,
                            paddingHorizontal: 16,
                            marginBottom: 32,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Text className="text-white font-outfit-bold text-center">
                            {t('requestAssistance.vehicleInformation.continue')}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
