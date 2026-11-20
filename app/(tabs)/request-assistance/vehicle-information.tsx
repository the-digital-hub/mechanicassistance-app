import { RequestSteps, stepEyebrow } from '@/components/ui/RequestSteps';
import { ROUNDED_HEADER } from '@/lib/ui/header';
import { HeaderBackButton } from '@/components/ui/HeaderBackButton';
import { CARD_STYLE, ChoiceCard, Footer, SC, TextField } from '@/components/scheduled/ui';
import { TYPE } from '@/lib/ui/type';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CarFront, Hand, Lightbulb, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

/**
 * Kept in sync with VEHICLE_CONDITIONS in
 * appointments-service/src/common/constants/vehicle-conditions.ts — the DTO
 * rejects anything else with a 400.
 */
const CONDITIONS = ['drivable', 'unsafe_to_drive', 'pushable_only'] as const;
type Condition = (typeof CONDITIONS)[number];

/** An icon for each answer: it drives, it is not safe, it can only be pushed. */
const CONDITION_ICONS: Record<Condition, LucideIcon> = {
    drivable: CarFront,
    unsafe_to_drive: TriangleAlert,
    pushable_only: Hand,
};

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
            // A video call is remote: no photos or location. It asks for the OBD
            // scanner report (optional) and ends on "When".
            // Typed routes regenerate on the next dev-server start; until then these are unknown.
            pathname: (type === 'videocall' ? '/request-assistance/obd-scanner' : '/request-assistance/vehicle-documentation') as never,
            params: {
                ...params,
                issues,
                condition,
                details,
            },
        });
    };

    return (
        // The same look as the issue step: a tinted page, white cards, a fixed bottom action.
        <View className="flex-1" style={{ backgroundColor: SC.page }}>
            {/* Custom Header */}
            <View className="px-6 pt-20 pb-2 flex-row items-center justify-between" style={[ROUNDED_HEADER, { paddingTop: 63 }]}>
                <HeaderBackButton marginLeft={0} onPress={() => router.back()} />
                <Text style={{ fontFamily: 'Outfit_500Medium', fontSize: 18, color: '#1A1A1A', flex: 1, textAlign: 'center' }}>
                    {getTitle()}
                </Text>
                <View className="w-6" />
            </View>
            <ScrollView className="flex-1 px-6 pt-4" contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
                    <RequestSteps type={params.type} step="condition" flush />
                <View className="flex-row items-center justify-between" style={{ marginBottom: 16 }}>
                    <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                            {stepEyebrow(t, params.type, 'condition')}
                        </Text>
                    </View>
                </View>

                <Text className="text-gray-900 font-outfit-medium text-3xl mb-5">
                    {t('requestAssistance.vehicleInformation.title')}
                </Text>

                {/* Condition: one white card, one row per answer. */}
                <Text className="font-outfit-bold mb-3" style={{ ...TYPE.question, color: SC.text }}>
                    {t('requestAssistance.vehicleInformation.question')}
                </Text>
                <View style={{ gap: 10 }}>
                    {CONDITIONS.map((option) => (
                        <ChoiceCard
                            key={option}
                            icon={CONDITION_ICONS[option]}
                            title={t(`requestAssistance.vehicleInformation.condition.${option}`)}
                            sub={t(`requestAssistance.vehicleInformation.conditionSub.${option}`)}
                            on={condition === option}
                            onPress={() => setCondition(option)}
                        />
                    ))}
                </View>

                {/* Detailed explanation */}
                <Text className="font-outfit-bold" style={{ ...TYPE.question, color: SC.text, marginTop: 24, marginBottom: 12 }}>
                    {t('requestAssistance.vehicleInformation.explanationLabel')}{' '}
                    <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: SC.muted }}>
                        {t('requestAssistance.vehicleInformation.optional')}
                    </Text>
                </Text>
                <TextField
                    multiline
                    placeholder={t('requestAssistance.vehicleInformation.placeholder')}
                    value={details}
                    onChangeText={setDetails}
                    style={{ minHeight: 128, ...TYPE.body, fontFamily: 'Outfit_400Regular' }}
                />

                <TouchableOpacity
                    onPress={() => setSuggestionOpen(!suggestionOpen)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    className="flex-row items-center self-end mt-3 px-3.5 py-2 rounded-full"
                    style={{ backgroundColor: SC.blueSoft, gap: 6 }}
                >
                    <Lightbulb size={16} color={SC.blue} />
                    <Text className="font-outfit-bold" style={{ ...TYPE.helper, color: SC.blue }}>
                        {t('requestAssistance.vehicleInformation.suggestionToggle')}
                    </Text>
                </TouchableOpacity>

                {suggestionOpen && (
                    <View style={{ ...CARD_STYLE, padding: 14, marginTop: 12 }}>
                        <Text className="font-outfit-bold mb-1.5" style={{ ...TYPE.body, color: SC.text }}>
                            {t('requestAssistance.vehicleInformation.suggestionTitle')}
                        </Text>
                        <Text className="font-outfit-regular mb-3" style={{ ...TYPE.helper, color: SC.muted }}>
                            {t('requestAssistance.vehicleInformation.suggestionHint')}
                        </Text>
                        <TouchableOpacity
                            onPress={generateSuggestion}
                            disabled={!condition}
                            activeOpacity={0.85}
                            className="self-start px-4 py-2.5 rounded-xl"
                            style={{ backgroundColor: SC.blue, opacity: condition ? 1 : 0.5 }}
                        >
                            <Text className="text-white font-outfit-bold" style={TYPE.helper}>
                                {t('requestAssistance.vehicleInformation.suggestionGenerate')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            <Footer label={t('requestAssistance.vehicleInformation.continue')} disabled={!condition} onPress={handleContinue} />
        </View>
    );
}
