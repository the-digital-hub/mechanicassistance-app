import { Car, ChevronDown, ChevronRight, CreditCard, LayoutGrid, Search, ShieldCheck, Wrench, X, type LucideIcon } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutAnimation, Platform, ScrollView, Text, TextInput, TouchableOpacity, UIManager, View } from 'react-native';
import { useUser } from '@/context/UserContext';
import { HELP_SECTIONS } from '@/lib/help/helpContent';

const SECTION_ICONS: Record<string, LucideIcon> = {
    platform: LayoutGrid,
    accounts: CreditCard,
    safety: ShieldCheck,
    drivers: Car,
    technicians: Wrench,
};

const CARD_SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 } as const;

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

export default function HelpScreen() {
    const { t, i18n } = useTranslation();
    const { user } = useUser();
    const [query, setQuery] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<string[]>([]);
    const [expandedIds, setExpandedIds] = useState<string[]>([]);
    const lang = i18n.language?.startsWith('es') ? 'es' : 'en';

    // General help + the section for the user's role (technicians vs drivers).
    const sections = useMemo(() => {
        const roleGroup = user?.role === 'mechanic' ? 'technicians' : 'drivers';
        const needle = query.trim().toLowerCase();
        return HELP_SECTIONS[lang]
            .filter((s) => s.group === 'general' || s.group === roleGroup)
            .map((s) => ({
                ...s,
                items: needle
                    ? s.items.filter((i) => `${s.title} ${i.q} ${i.a}`.toLowerCase().includes(needle))
                    : s.items,
            }))
            .filter((s) => s.items.length > 0);
    }, [lang, user?.role, query]);


    const toggleSection = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCollapsedSections((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
    };

    const toggleExpand = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (expandedIds.includes(id)) {
            setExpandedIds(expandedIds.filter(i => i !== id));
        } else {
            setExpandedIds([...expandedIds, id]);
        }
    };

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

            {/* Search */}
            <View
                className="flex-row items-center bg-white rounded-2xl px-4 mb-8"
                style={{ ...CARD_SHADOW, borderWidth: 1.5, borderColor: searchFocused ? '#2B66F8' : 'transparent' }}
            >
                <Search size={20} color={searchFocused ? '#2B66F8' : '#6B7280'} />
                <TextInput
                    value={query}
                    onChangeText={setQuery}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    placeholder={t('help.searchPlaceholder')}
                    accessibilityLabel={t('help.searchLabel')}
                    placeholderTextColor="#9CA3AF"
                    autoCorrect={false}
                    returnKeyType="search"
                    className="flex-1 py-4 px-3 font-outfit-regular text-base text-gray-900"
                />
                {query.length > 0 && (
                    <TouchableOpacity onPress={() => setQuery('')} hitSlop={10} className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: '#E5E7EB' }}>
                        <X size={14} color="#4B5563" />
                    </TouchableOpacity>
                )}
            </View>
            {sections.length === 0 && (
                <View className="items-center py-10">
                    <Search size={32} color="#9CA3AF" />
                    <Text className="text-gray-500 font-outfit-regular text-base mt-3 text-center">{t('help.noResults')}</Text>
                </View>
            )}

            {/* Accordion FAQ, grouped by section (content mirrored from the website) */}
            {sections.map((section) => {
                const Icon = SECTION_ICONS[section.id] ?? LayoutGrid;
                // While searching, every match stays visible.
                const collapsed = !query.trim() && collapsedSections.includes(section.id);
                return (
                    <View key={section.id} className="mb-8">
                        <TouchableOpacity
                            onPress={() => toggleSection(section.id)}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityState={{ expanded: !collapsed }}
                            className={`flex-row items-center gap-3 ${collapsed ? '' : 'mb-3'}`}
                        >
                            <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: '#E9F1FF' }}>
                                <Icon size={20} color="#0047AB" />
                            </View>
                            <Text className="flex-1 text-gray-900 font-outfit-medium text-lg">{section.title}</Text>
                            <View className="px-2.5 py-0.5 rounded-full" style={{ backgroundColor: '#E9F1FF' }}>
                                <Text className="text-blue-600 font-outfit-semibold text-[13px]">{section.items.length}</Text>
                            </View>
                            {collapsed ? <ChevronRight size={20} color="#9CA3AF" /> : <ChevronDown size={20} color="#9CA3AF" />}
                        </TouchableOpacity>
                        {!collapsed && (
                        <View className="bg-white rounded-2xl" style={CARD_SHADOW}>
                            <View className="rounded-2xl overflow-hidden bg-white">
                                {section.items.map((faq, idx) => {
                                    const key = `${section.id}-${faq.q}`;
                                    const isExpanded = expandedIds.includes(key);
                                    return (
                                        <View key={key} style={idx > 0 ? { borderTopWidth: 1, borderTopColor: '#F1F3F7' } : undefined}>
                                            <TouchableOpacity
                                                onPress={() => toggleExpand(key)}
                                                activeOpacity={0.7}
                                                className="flex-row items-center px-4 py-4"
                                                style={isExpanded ? { backgroundColor: '#F4F8FF' } : undefined}
                                            >
                                                <Text className={`flex-1 pr-3 font-outfit-semibold text-base ${isExpanded ? 'text-blue-700' : 'text-gray-900'}`}>
                                                    {faq.q}
                                                </Text>
                                                <ChevronDown
                                                    size={20}
                                                    color={isExpanded ? '#0047AB' : '#9CA3AF'}
                                                    style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                                                />
                                            </TouchableOpacity>
                                            {isExpanded && (
                                                <View className="px-4 pb-4 pt-1" style={{ backgroundColor: '#F4F8FF' }}>
                                                    <View className="pl-3" style={{ borderLeftWidth: 3, borderLeftColor: '#2B66F8' }}>
                                                        <Text className="text-gray-600 font-outfit-regular text-[15px] leading-6">
                                                            {faq.a}
                                                        </Text>
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                        )}
                    </View>
                );
            })}
            <View className="h-10" />
        </ScrollView>
        </View>
    );
}
