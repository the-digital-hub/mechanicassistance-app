import { pricingDAO } from '@/lib/dao/PricingDAO';
import type { VehicleIssueCategory } from '@/lib/dao/interfaces';
import { getLanguageId, translatedName } from '@/lib/i18n/catalogTranslations';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, Battery, ChevronLeft, ChevronRight, CircleDot, HelpCircle, Wrench, Zap } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Fallback used only if the pricing catalog can't be fetched. These ids are NOT
// real VehicleIssue UUIDs, so pricing will fall back to "TBD" when this is used.
// Wrapped in a synthetic category so the rendering path stays the same.
const FALLBACK_CATALOG: VehicleIssueCategory[] = [
    {
        id: null,
        name: '',
        icon: null,
        issues: [
            { id: 'battery', name: 'Battery / Starting issue' },
            { id: 'electrical', name: 'Electrical system' },
            { id: 'starter', name: 'Starter motor' },
            { id: 'warning', name: 'Warning light' },
            { id: 'other', name: 'Other' },
        ],
    },
];

// `icon` is a free-form key set in the admin — there is no fixed catalog, so
// unknown keys must degrade to the default instead of breaking the row.
const ICONS_BY_KEY: Record<string, typeof Wrench> = {
    bolt: Zap,
    battery: Battery,
    electrical: Zap,
    tire: CircleDot,
    wheel: CircleDot,
    warning: AlertTriangle,
    wrench: Wrench,
    tool: Wrench,
    other: HelpCircle,
    help: HelpCircle,
};

// Legacy fallback for rows with no `icon`: guess from the English name. Only
// reachable for uncategorised issues and the offline fallback list — localized
// names would not match these substrings.
const iconFromName = (label: string) => {
    const n = label.toLowerCase();
    if (n.includes('batter')) return Battery;
    if (n.includes('electric')) return Zap;
    if (n.includes('start')) return Wrench;
    if (n.includes('warning') || n.includes('light')) return AlertTriangle;
    if (n.includes('other')) return HelpCircle;
    return Wrench;
};

const iconFor = (iconKey: string | null | undefined, label: string) =>
    (iconKey ? ICONS_BY_KEY[iconKey.toLowerCase()] : undefined) ?? iconFromName(label);

export default function IssueSelectionScreen() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const params = useLocalSearchParams();
    const { type, vehicleId, vehicleName } = params;

    const [description, setDescription] = useState('');
    const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
    // Exactly one symptom across the whole screen — the single selection is a UX
    // rule, the backend imposes no such constraint.
    const [selectedSymptomId, setSelectedSymptomId] = useState<string | null>(null);
    const [catalog, setCatalog] = useState<VehicleIssueCategory[]>(FALLBACK_CATALOG);
    const [loadingIssues, setLoadingIssues] = useState(true);
    // Which row of each entity's `translations[]` to render. Null until resolved
    // (or if it can't be), which makes everything fall back to the base name.
    const [languageId, setLanguageId] = useState<number | null>(null);

    const language = i18n.language;

    // Load the real catalog so selected ids ARE the UUIDs the pricing service
    // needs. The response carries every translation, so this does NOT depend on
    // the current language — switching language only re-renders. Falls back to
    // the static list if the fetch fails.
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const data = await pricingDAO.getVehicleIssueCatalog();
                if (mounted && Array.isArray(data) && data.length > 0) {
                    setCatalog(data);
                }
            } catch (err) {
                console.warn('Could not load vehicle issue catalog; using fallback list', err);
            } finally {
                if (mounted) setLoadingIssues(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    // Map the app's locale to the languageId the translations are keyed by.
    useEffect(() => {
        let mounted = true;
        getLanguageId(language).then(id => {
            if (mounted) setLanguageId(id);
        });
        return () => { mounted = false; };
    }, [language]);

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

    const toggleIssue = (id: string, symptomIds: string[]) => {
        if (selectedIssues.includes(id)) {
            setSelectedIssues(selectedIssues.filter(item => item !== id));
            // Deselecting the issue hides its symptoms, so a symptom left
            // selected underneath would be invisible but still submitted.
            if (selectedSymptomId && symptomIds.includes(selectedSymptomId)) {
                setSelectedSymptomId(null);
            }
        } else {
            setSelectedIssues([...selectedIssues, id]);
        }
    };

    const handleContinue = () => {
        router.push({
            pathname: '/request-assistance/add-details',
            params: {
                type,
                vehicleId,
                vehicleName,
                description,
                issues: selectedIssues.join(','),
                // TODO: not persisted yet — assistance_requests has no symptom
                // column. Carried through the wizard so the screens downstream
                // can show it and so persisting it later is a backend-only change.
                symptomId: selectedSymptomId ?? '',
            }
        });
    };

    return (
        <View className="flex-1 bg-white">
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

            <ScrollView className="flex-1 px-6 pt-6">
                <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                    <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                        {getBadgeText()}
                    </Text>
                </View>

                <Text className="text-gray-900 font-outfit-medium text-3xl mb-4">{t('requestAssistance.issueSelection.title')}</Text>

                <Text className="text-gray-500 font-outfit-regular text-base mb-2">
                    {t('requestAssistance.issueSelection.subtitle')}
                </Text>

                <View className="mb-6">
                    <TextInput
                        multiline
                        numberOfLines={4}
                        placeholder={t('requestAssistance.issueSelection.placeholder')}
                        placeholderTextColor="#D1D5DB"
                        value={description}
                        onChangeText={setDescription}
                        className="bg-white border border-gray-300 rounded-2xl p-4 font-outfit-regular text-[#0F172A] text-base h-32"
                        style={{ textAlignVertical: 'top' }}
                    />
                </View>

                <View className="mb-8">
                    <Text className="text-gray-900 font-outfit-medium text-lg mb-2" style={{ fontSize: 18 }}>{t('requestAssistance.issueSelection.possibleIssues')}</Text>
                    {loadingIssues ? (
                        <View className="rounded-xl border border-gray-100 p-6 items-center">
                            <ActivityIndicator size="small" color="#0047AB" />
                        </View>
                    ) : (
                        catalog.map((category, categoryIndex) => {
                            // The trailing group (id: null) holds issues with no
                            // category — it is rendered without a heading.
                            const heading = category.id
                                ? translatedName(category, languageId)
                                : catalog.length > 1
                                    ? t('requestAssistance.issueSelection.otherIssues')
                                    : '';
                            return (
                                <View key={category.id ?? `uncategorised-${categoryIndex}`} className="mb-4">
                                    {heading ? (
                                        <Text className="text-gray-500 font-outfit-semibold text-xs tracking-widest mb-2 uppercase">
                                            {heading}
                                        </Text>
                                    ) : null}
                                    <View className="rounded-xl border border-gray-100 overflow-hidden">
                                        {category.issues.map((issue) => {
                                            const isSelected = selectedIssues.includes(issue.id);
                                            const symptoms = issue.symptoms ?? [];
                                            // Pass the BASE name, not the translated one: the
                                            // no-icon fallback matches English substrings.
                                            const Icon = iconFor(category.icon, issue.name);
                                            return (
                                                <View key={issue.id}>
                                                    <TouchableOpacity
                                                        onPress={() => toggleIssue(issue.id, symptoms.map(s => s.id))}
                                                        className={`flex-row items-center p-4 border-b border-gray-100 ${isSelected ? 'bg-blue-600' : 'bg-white'}`}
                                                    >
                                                        <Icon size={20} color={isSelected ? 'white' : '#0047AB'} />
                                                        <Text className={`ml-3 flex-1 font-outfit-medium ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                                                            {translatedName(issue, languageId)}
                                                        </Text>
                                                        {isSelected && <View className="w-2 h-2 bg-white rounded-full" />}
                                                    </TouchableOpacity>

                                                    {isSelected && symptoms.length > 0 && (
                                                        <View className="border-b border-gray-100" style={{ backgroundColor: '#F4F8FF' }}>
                                                            <Text className="px-4 pt-3 pb-1 text-gray-500 font-outfit-regular text-xs">
                                                                {t('requestAssistance.issueSelection.symptoms')}
                                                            </Text>
                                                            {symptoms.map((symptom) => {
                                                                const isSymptomSelected = selectedSymptomId === symptom.id;
                                                                return (
                                                                    <TouchableOpacity
                                                                        key={symptom.id}
                                                                        onPress={() => setSelectedSymptomId(isSymptomSelected ? null : symptom.id)}
                                                                        className="flex-row items-center px-4 py-3"
                                                                    >
                                                                        {/* Radio, not checkbox: only one symptom can be picked. */}
                                                                        <View
                                                                            className="w-5 h-5 rounded-full items-center justify-center"
                                                                            style={{ borderWidth: 1.5, borderColor: isSymptomSelected ? '#0047AB' : '#CBD5E1' }}
                                                                        >
                                                                            {isSymptomSelected && (
                                                                                <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                                                                            )}
                                                                        </View>
                                                                        <Text className={`ml-3 flex-1 font-outfit-regular ${isSymptomSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                                                                            {translatedName(symptom, languageId)}
                                                                        </Text>
                                                                    </TouchableOpacity>
                                                                );
                                                            })}
                                                        </View>
                                                    )}
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>

                <TouchableOpacity
                    onPress={handleContinue}
                    disabled={selectedIssues.length === 0}
                    activeOpacity={0.8}
                >
                    {selectedIssues.length === 0 ? (
                        <View className="bg-slate-200 rounded-lg p-4 mb-8 items-center justify-center flex-row">
                            <Text className="text-gray-500 font-outfit-bold text-center mr-2">{t('requestAssistance.continue')}</Text>
                            <ChevronRight size={20} color="#9CA3AF" />
                        </View>
                    ) : (
                        <LinearGradient
                            colors={['#2B66F8', '#081E72']}
                            start={{ x: 0, y: 1 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                                borderRadius: 10,
                                paddingVertical: 16,
                                paddingHorizontal: 16,
                                marginBottom: 32,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Text className="text-white font-outfit-bold text-center mr-2">{t('requestAssistance.continue')}</Text>
                            <ChevronRight size={20} color="white" />
                        </LinearGradient>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
