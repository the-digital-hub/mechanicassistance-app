import { RequestSteps, stepEyebrow } from '@/components/ui/RequestSteps';
import { ROUNDED_HEADER } from '@/lib/ui/header';
import { categoryIcon } from '@/lib/ui/categoryIcon';
import { PickCard, PickChildren, PickGroup, PickItem, PickList, PickReveal, PickedChips, SearchField } from '@/components/scheduled/picker';
import { CARD_STYLE, Footer, SC, TextField } from '@/components/scheduled/ui';
import { TYPE } from '@/lib/ui/type';
import { pricingDAO } from '@/lib/dao/PricingDAO';
import type { VehicleIssueCategory } from '@/lib/dao/interfaces';
import { getLanguageId, translatedName } from '@/lib/i18n/catalogTranslations';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { HeaderBackButton } from '@/components/ui/HeaderBackButton';
import { HelpCircle } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

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

/** What is inside a category: on the tinted band, except for the issues that belong to no category. */
const Level2 = ({ tinted, children }: { tinted: boolean; children: React.ReactNode }) =>
    tinted ? <PickChildren>{children}</PickChildren> : <>{children}</>;

/** The key the "Other" card opens under, next to the catalog categories (one card at a time). */
const OTHER_KEY = '__other__';

/** How long the open card takes to close (a little over its exit animation) before the next one opens. */
const CLOSE_BEFORE_OPEN_MS = 180;

export default function IssueSelectionScreen() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const params = useLocalSearchParams();
    const { type, vehicleId, vehicleName } = params;

    // Issues with no symptoms are selected directly by tapping their row.
    const [directSelectedIssues, setDirectSelectedIssues] = useState<string[]>([]);
    // Any number of symptoms, from any issue and any category. Picking a symptom
    // implicitly selects its parent issue, so it doesn't need its own direct toggle.
    const [selectedSymptomIds, setSelectedSymptomIds] = useState<string[]>([]);
    const [catalog, setCatalog] = useState<VehicleIssueCategory[]>(FALLBACK_CATALOG);
    // Categories and issues expand/collapse independently — several can be open at once.
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
    const [loadingIssues, setLoadingIssues] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    // "Other": an issue that is not in the catalog, described in the owner's own words.
    const [otherText, setOtherText] = useState('');
    const otherClean = otherText.trim();
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

    // `expandedCategories` is what shows (the subcategories); `outlineKey` is the card itself (its outline and
    // its arrow). A card stays open while things are picked in it: it closes only when it is tapped again or
    // when another card is opened.
    const [outlineKey, setOutlineKey] = useState<string | null>(null);
    const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
    const cancelTimers = () => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
    };
    const later = (fn: () => void, ms: number) => {
        timers.current.push(setTimeout(fn, ms));
    };
    useEffect(() => cancelTimers, []);

    // Opening a category closes the one that was open, and only once it has finished closing the new one
    // opens: one card at a time, each in its turn.
    const toggleCategory = (categoryKey: string) => {
        cancelTimers();
        if (expandedCategories.has(categoryKey)) {
            setExpandedCategories(new Set<string>());
            setOutlineKey(null);
        } else if (expandedCategories.size > 0) {
            setExpandedCategories(new Set<string>());
            setOutlineKey(null);
            later(() => {
                setExpandedCategories(new Set<string>([categoryKey]));
                setOutlineKey(categoryKey);
            }, CLOSE_BEFORE_OPEN_MS);
        } else {
            setExpandedCategories(new Set<string>([categoryKey]));
            setOutlineKey(categoryKey);
        }
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
        setSelectedSymptomIds(prev =>
            prev.includes(symptomId) ? prev.filter(item => item !== symptomId) : [...prev, symptomId]
        );
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

    // The issues that own the selected symptoms — picking a symptom implicitly
    // selects its parent issue.
    const symptomOwnerIssueIds = catalog
        .flatMap(category => category.issues)
        .filter(issue => (issue.symptoms ?? []).some(s => selectedSymptomIds.includes(s.id)))
        .map(issue => issue.id);

    const selectedIssues = Array.from(new Set([
        ...directSelectedIssues,
        ...symptomOwnerIssueIds,
    ]));

    // The picks as badges: a direct issue by its name, a symptom as "issue · symptom".
    const pickedChips: { key: string; label: string; onRemove: () => void }[] = catalog.flatMap(category => category.issues).flatMap((issue) => {
        const issueName = translatedName(issue, languageId);
        const direct = directSelectedIssues.includes(issue.id)
            ? [{ key: `i-${issue.id}`, label: issueName, onRemove: () => toggleDirectIssue(issue.id) }]
            : [];
        const symptoms = (issue.symptoms ?? [])
            .filter(sy => selectedSymptomIds.includes(sy.id))
            .map(sy => ({ key: `s-${sy.id}`, label: `${issueName} · ${translatedName(sy, languageId)}`, onRemove: () => toggleSymptom(sy.id) }));
        return [...direct, ...symptoms];
    });
    if (otherClean) pickedChips.push({ key: 'other', label: `${t('requestAssistance.issueSelection.other')} · ${otherClean}`, onRemove: () => setOtherText('') });

    // Catalog names, untranslated, as the pricing service stores them. Carried
    // as `description` down to confirmation, which makes it the request title —
    // the line mechanics read in the new-request push and in their feed.
    const selectedIssueNames = [
        ...catalog
            .flatMap(category => category.issues)
            .filter(issue => selectedIssues.includes(issue.id))
            .map(issue => issue.name),
        // The owner's own words travel with the names: they become part of the request title.
        ...(otherClean ? [`Other: ${otherClean}`] : []),
    ]
        .filter(Boolean)
        .join(', ');

    const handleContinue = () => {
        router.push({
            pathname: '/request-assistance/vehicle-information',
            params: {
                type,
                vehicleId,
                vehicleName,
                ...(selectedIssueNames ? { description: selectedIssueNames } : {}),
                issues: selectedIssues.join(','),
                // Stored by the pricing service on the confirmation step
                // (assistance_request_symptoms), next to the issues.
                symptomIds: selectedSymptomIds.join(','),
            }
        });
    };

    return (
        // The same tinted page as the scheduled request: white cards stand out over it.
        <View className="flex-1" style={{ backgroundColor: SC.page }}>
            {/* Custom Header */}
            <View className="px-6 pt-20 pb-2 flex-row items-center justify-between" style={[ROUNDED_HEADER, { paddingTop: 63 }]}>
                <HeaderBackButton marginLeft={0} onPress={() => router.back()} />
                <Text style={{ fontFamily: 'Outfit_500Medium', fontSize: 18, color: '#1A1A1A', flex: 1, textAlign: 'center' }}>
                    {getTitle()}
                </Text>
                <View className="w-6" />
            </View>
            <ScrollView className="flex-1 px-6 pt-4" contentContainerStyle={{ paddingBottom: 24 }}>
                    <RequestSteps type={params.type} step="issue" flush />
                <View className="flex-row items-center justify-between" style={{ marginBottom: 16 }}>
                    <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                            {stepEyebrow(t, params.type, 'issue')}
                        </Text>
                    </View>
                </View>

                <Text className="text-gray-900 font-outfit-medium text-3xl mb-1">{t('requestAssistance.issueSelection.title')}</Text>
                <Text className="text-gray-500 font-outfit-regular text-base mb-4">{t('requestAssistance.issueSelection.subtitle')}</Text>

                {/* Always on show: find an issue by any word. */}
                <SearchField
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder={t('requestAssistance.issueSelection.searchPlaceholder')}
                    testID="issue-search"
                />

                {/* What is picked, as badges; tapping one takes it off. */}
                {pickedChips.length > 0 ? (
                    <View style={{ marginTop: 14 }}>
                        <PickedChips chips={pickedChips} />
                    </View>
                ) : null}

                <View style={{ marginTop: 14, marginBottom: 24 }}>
                    {loadingIssues ? (
                        <View style={{ ...CARD_STYLE, padding: 24, alignItems: 'center' }}>
                            <ActivityIndicator size="small" color="#0047AB" />
                        </View>
                    ) : normalizedQuery && filteredCatalog.length === 0 ? (
                        <View style={{ ...CARD_STYLE, padding: 24, alignItems: 'center' }}>
                            <Text className="text-gray-500 font-outfit-regular text-base">{t('requestAssistance.issueSelection.noResults')}</Text>
                        </View>
                    ) : (
                        <PickList>
                            {filteredCatalog.map((category, categoryIndex) => {
                                const categoryKey = category.id ?? `uncategorised-${categoryIndex}`;
                                // The trailing group (id: null) holds issues with no category: no heading row.
                                const heading = category.id
                                    ? translatedName(category, languageId)
                                    : catalog.length > 1
                                        ? t('requestAssistance.issueSelection.otherIssues')
                                        : '';
                                const isCategoryExpanded = normalizedQuery ? true : expandedCategories.has(categoryKey);
                                // Every tick in the category: directly selected issues plus selected symptoms.
                                const categorySelectedCount = category.issues.reduce(
                                    (count, issue) =>
                                        count +
                                        (directSelectedIssues.includes(issue.id) ? 1 : 0) +
                                        (issue.symptoms ?? []).filter(sy => selectedSymptomIds.includes(sy.id)).length,
                                    0
                                );
                                const CategoryIcon = categoryIcon({ icon: category.icon, name: heading || category.issues[0]?.name || '' });

                                return (
                                    <PickCard key={categoryKey} picked={categorySelectedCount > 0} open={normalizedQuery ? true : outlineKey === categoryKey}>
                                        {heading ? (
                                            <PickGroup
                                                icon={CategoryIcon}
                                                title={heading}
                                                count={categorySelectedCount}
                                                open={normalizedQuery ? true : outlineKey === categoryKey}
                                                onPress={() => toggleCategory(categoryKey)}
                                                first
                                            />
                                        ) : null}

                                        {(isCategoryExpanded || !heading) && (
                                            <Level2 tinted={!!heading}>
                                                {category.issues.map((issue, issueIndex) => {
                                                    const symptoms = issue.symptoms ?? [];
                                                    const name = translatedName(issue, languageId);
                                                    const tone = heading ? 'tint' : 'white';

                                                    if (symptoms.length === 0) {
                                                        return (
                                                            <PickItem
                                                                key={issue.id}
                                                                label={name}
                                                                on={directSelectedIssues.includes(issue.id)}
                                                                onPress={() => toggleDirectIssue(issue.id)}
                                                                tone={tone}
                                                                first={issueIndex === 0 && !heading}
                                                            />
                                                        );
                                                    }

                                                    const picked = symptoms.filter(sy => selectedSymptomIds.includes(sy.id)).length;
                                                    const isIssueExpanded = normalizedQuery ? true : expandedIssues.has(issue.id);
                                                    return (
                                                        <View key={issue.id}>
                                                            <PickGroup
                                                                title={name}
                                                                count={picked}
                                                                open={isIssueExpanded}
                                                                onPress={() => toggleIssueExpanded(issue.id)}
                                                                tone={tone}
                                                                first={issueIndex === 0}
                                                            />
                                                            {isIssueExpanded
                                                                ? <PickReveal>{symptoms.map((symptom) => (
                                                                      <PickItem
                                                                          key={symptom.id}
                                                                          label={translatedName(symptom, languageId)}
                                                                          on={selectedSymptomIds.includes(symptom.id)}
                                                                          tone={heading ? 'soft' : 'white'}
                                                                          depth={0}
                                                                          onPress={() => toggleSymptom(symptom.id)}
                                                                      />
                                                                  ))}</PickReveal>
                                                                : null}
                                                        </View>
                                                    );
                                                })}
                                            </Level2>
                                        )}
                                    </PickCard>
                                );
                            })}

                            {/* Not in the list: describe it. */}
                            {!normalizedQuery ? (
                                <PickCard picked={otherClean.length > 0} open={outlineKey === OTHER_KEY}>
                                    <PickGroup
                                        icon={HelpCircle}
                                        title={t('requestAssistance.issueSelection.other')}
                                        count={otherClean ? 1 : 0}
                                        open={outlineKey === OTHER_KEY}
                                        onPress={() => toggleCategory(OTHER_KEY)}
                                        first
                                    />
                                    {expandedCategories.has(OTHER_KEY) ? (
                                        <PickChildren>
                                            <View style={{ padding: 14, gap: 8 }}>
                                                <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: SC.muted }}>
                                                    {t('requestAssistance.issueSelection.otherHint')}
                                                </Text>
                                                <TextField
                                                    multiline
                                                    value={otherText}
                                                    onChangeText={setOtherText}
                                                    placeholder={t('requestAssistance.issueSelection.otherPlaceholder')}
                                                    maxLength={200}
                                                    accessibilityLabel={t('requestAssistance.issueSelection.other')}
                                                    testID="issue-other-input"
                                                />
                                            </View>
                                        </PickChildren>
                                    ) : null}
                                </PickCard>
                            ) : null}
                        </PickList>
                    )}
                </View>

            </ScrollView>

            {/* The same fixed bottom action as the other request steps. */}
            <Footer label={t('requestAssistance.continue')} disabled={selectedIssues.length === 0 && !otherClean} onPress={handleContinue} />
        </View>
    );
}
