import { pricingDAO } from '@/lib/dao/PricingDAO';
import type { VehicleIssueCategory } from '@/lib/dao/interfaces';
import { getLanguageId, translatedName } from '@/lib/i18n/catalogTranslations';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, Battery, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleDot, HelpCircle, Search, Wrench, X, Zap } from 'lucide-react-native';
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

const Checkbox = ({ selected }: { selected: boolean }) => (
    <View
        className="w-5 h-5 rounded items-center justify-center"
        style={{ borderWidth: 1.5, borderColor: selected ? '#0047AB' : '#CBD5E1', backgroundColor: selected ? '#0047AB' : 'white' }}
    >
        {selected && <Check size={13} color="white" strokeWidth={3} />}
    </View>
);

export default function IssueSelectionScreen() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const params = useLocalSearchParams();
    const { type, vehicleId, vehicleName } = params;

    // Issues with no symptoms are selected directly by tapping their row.
    const [directSelectedIssues, setDirectSelectedIssues] = useState<string[]>([]);
    // Exactly one symptom across the whole screen — the single selection is a UX
    // rule, the backend imposes no such constraint. Picking a symptom implicitly
    // selects its parent issue, so it doesn't need its own direct toggle.
    const [selectedSymptomId, setSelectedSymptomId] = useState<string | null>(null);
    const [catalog, setCatalog] = useState<VehicleIssueCategory[]>(FALLBACK_CATALOG);
    // Categories and issues expand/collapse independently — several can be open at once.
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
    const [loadingIssues, setLoadingIssues] = useState(true);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
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

    const toggleCategory = (categoryKey: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(categoryKey)) next.delete(categoryKey); else next.add(categoryKey);
            return next;
        });
    };

    const toggleIssueExpanded = (issueId: string) => {
        setExpandedIssues(prev => {
            const next = new Set(prev);
            if (next.has(issueId)) next.delete(issueId); else next.add(issueId);
            return next;
        });
    };

    const toggleDirectIssue = (id: string) => {
        setDirectSelectedIssues(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const toggleSymptom = (symptomId: string) => {
        setSelectedSymptomId(prev => (prev === symptomId ? null : symptomId));
    };

    const toggleSearch = () => {
        setSearchOpen(prev => {
            const next = !prev;
            if (!next) setSearchQuery('');
            return next;
        });
    };

    // Filters the whole tree (category/issue/symptom names) as the user types.
    // A match at any level keeps that branch, and matching categories/issues
    // keep all of their children so context around the match stays visible.
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const matchesQuery = (text: string) => text.toLowerCase().includes(normalizedQuery);
    const filteredCatalog = normalizedQuery
        ? catalog
            .map((category) => {
                const categoryHeading = category.id ? translatedName(category, languageId) : '';
                const categoryMatches = categoryHeading ? matchesQuery(categoryHeading) : false;
                const issues = category.issues
                    .map((issue) => {
                        if (categoryMatches || matchesQuery(translatedName(issue, languageId))) {
                            return issue;
                        }
                        const matchingSymptoms = (issue.symptoms ?? []).filter(s => matchesQuery(translatedName(s, languageId)));
                        return matchingSymptoms.length > 0 ? { ...issue, symptoms: matchingSymptoms } : null;
                    })
                    .filter((issue) => issue !== null);
                return { ...category, issues };
            })
            .filter((category) => category.issues.length > 0)
        : catalog;

    // The issue that owns the single selected symptom, if any — picking a
    // symptom implicitly selects its parent issue.
    const symptomOwnerIssueId = catalog
        .flatMap(category => category.issues)
        .find(issue => (issue.symptoms ?? []).some(s => s.id === selectedSymptomId))?.id ?? null;

    const selectedIssues = Array.from(new Set([
        ...directSelectedIssues,
        ...(symptomOwnerIssueId ? [symptomOwnerIssueId] : []),
    ]));

    const handleContinue = () => {
        router.push({
            pathname: '/request-assistance/add-details',
            params: {
                type,
                vehicleId,
                vehicleName,
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

                <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-gray-900 font-outfit-medium text-3xl flex-1">{t('requestAssistance.issueSelection.title')}</Text>
                    <TouchableOpacity onPress={toggleSearch}>
                        <View className="w-10 h-10 rounded-full items-center justify-center ml-3" style={{ backgroundColor: searchOpen ? '#0047AB' : '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
                            {searchOpen ? <X size={18} color="white" /> : <Search size={18} color="#0047AB" />}
                        </View>
                    </TouchableOpacity>
                </View>

                <Text className="text-gray-500 font-outfit-regular text-base mb-2">
                    {t('requestAssistance.issueSelection.possibleIssues')}
                </Text>

                {searchOpen && (
                    <View className="flex-row items-center bg-white border border-gray-200 rounded-2xl px-4 mb-4" style={{ height: 52 }}>
                        <Search size={18} color="#9CA3AF" />
                        <TextInput
                            autoFocus
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder={t('requestAssistance.issueSelection.searchPlaceholder')}
                            placeholderTextColor="#D1D5DB"
                            className="ml-2 flex-1 font-outfit-regular text-[#0F172A] text-base"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <X size={18} color="#9CA3AF" />
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                <View className="mb-8">
                    {loadingIssues ? (
                        <View className="rounded-xl border border-gray-100 p-6 items-center">
                            <ActivityIndicator size="small" color="#0047AB" />
                        </View>
                    ) : normalizedQuery && filteredCatalog.length === 0 ? (
                        <View className="rounded-xl border border-gray-100 p-6 items-center">
                            <Text className="text-gray-500 font-outfit-regular text-sm">{t('requestAssistance.issueSelection.noResults')}</Text>
                        </View>
                    ) : (
                        filteredCatalog.map((category, categoryIndex) => {
                            const categoryKey = category.id ?? `uncategorised-${categoryIndex}`;
                            // The trailing group (id: null) holds issues with no
                            // category — it is rendered without an icon/heading row.
                            const heading = category.id
                                ? translatedName(category, languageId)
                                : catalog.length > 1
                                    ? t('requestAssistance.issueSelection.otherIssues')
                                    : '';
                            const isCategoryExpanded = normalizedQuery ? true : expandedCategories.has(categoryKey);
                            const categorySelectedCount = category.issues.filter(issue => selectedIssues.includes(issue.id)).length;
                            const CategoryIcon = iconFor(category.icon, heading || category.issues[0]?.name || '');
                            const CategoryChevron = isCategoryExpanded ? ChevronUp : ChevronDown;

                            return (
                                <View key={categoryKey} className="rounded-xl border border-gray-100 overflow-hidden mb-4">
                                    <TouchableOpacity
                                        onPress={() => toggleCategory(categoryKey)}
                                        className="flex-row items-center p-4 bg-white"
                                        disabled={!heading}
                                    >
                                        {heading ? (
                                            <View className="w-9 h-9 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: '#E9F1FF' }}>
                                                <CategoryIcon size={18} color="#0047AB" />
                                            </View>
                                        ) : null}
                                        <Text className="flex-1 font-outfit-medium text-gray-900">
                                            {heading || t('requestAssistance.issueSelection.otherIssues')}
                                        </Text>
                                        {categorySelectedCount > 0 && (
                                            <View className="px-2 py-1 rounded-full mr-2" style={{ backgroundColor: '#E9F1FF' }}>
                                                <Text className="text-blue-600 font-outfit-semibold text-xs">
                                                    {t('requestAssistance.issueSelection.selectedCount', { count: categorySelectedCount })}
                                                </Text>
                                            </View>
                                        )}
                                        {heading ? <CategoryChevron size={18} color="#6B7490" /> : null}
                                    </TouchableOpacity>

                                    {(isCategoryExpanded || !heading) && (
                                        <View className="border-t border-gray-100">
                                            {category.issues.map((issue) => {
                                                const symptoms = issue.symptoms ?? [];
                                                const hasSymptoms = symptoms.length > 0;
                                                const isDirectSelected = directSelectedIssues.includes(issue.id);
                                                const isIssueExpanded = normalizedQuery ? true : expandedIssues.has(issue.id);
                                                const IssueChevron = isIssueExpanded ? ChevronUp : ChevronDown;

                                                if (!hasSymptoms) {
                                                    return (
                                                        <TouchableOpacity
                                                            key={issue.id}
                                                            onPress={() => toggleDirectIssue(issue.id)}
                                                            className="flex-row items-center px-4 py-3 border-b border-gray-100"
                                                            style={{ backgroundColor: isDirectSelected ? '#F4F8FF' : 'white' }}
                                                        >
                                                            <Checkbox selected={isDirectSelected} />
                                                            <Text className={`ml-3 flex-1 font-outfit-medium text-sm ${isDirectSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                                                                {translatedName(issue, languageId)}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                }

                                                return (
                                                    <View key={issue.id} className="border-b border-gray-100" style={{ backgroundColor: '#FAFBFF' }}>
                                                        <TouchableOpacity
                                                            onPress={() => toggleIssueExpanded(issue.id)}
                                                            className="flex-row items-center px-4 py-3"
                                                        >
                                                            <IssueChevron size={14} color="#0047AB" />
                                                            <Text className="ml-2 flex-1 font-outfit-medium text-gray-800 text-sm">
                                                                {translatedName(issue, languageId)}
                                                            </Text>
                                                        </TouchableOpacity>

                                                        {isIssueExpanded && (
                                                            <View>
                                                                {symptoms.map((symptom) => {
                                                                    const isSymptomSelected = selectedSymptomId === symptom.id;
                                                                    return (
                                                                        <TouchableOpacity
                                                                            key={symptom.id}
                                                                            onPress={() => toggleSymptom(symptom.id)}
                                                                            className="flex-row items-center pl-10 pr-4 py-2.5"
                                                                        >
                                                                            <Checkbox selected={isSymptomSelected} />
                                                                            <Text className={`ml-3 flex-1 font-outfit-regular text-sm ${isSymptomSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                                                                                {translatedName(symptom, languageId)}
                                                                            </Text>
                                                                            {isSymptomSelected && (
                                                                                <View className="px-2 py-0.5 rounded-full ml-2" style={{ backgroundColor: '#E9F1FF' }}>
                                                                                    <Text className="text-blue-600 font-outfit-semibold text-[10px]">
                                                                                        {t('requestAssistance.issueSelection.selected')}
                                                                                    </Text>
                                                                                </View>
                                                                            )}
                                                                        </TouchableOpacity>
                                                                    );
                                                                })}
                                                            </View>
                                                        )}
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    )}
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
