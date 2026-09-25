import {
    assistanceTypeRoute,
    i18nKeyFor,
    iconFor,
    useAssistanceTypeCatalog,
} from '@/lib/assistance-types';
import type { AssistanceTypeCatalogItem } from '@/lib/dao/interfaces';
import { translatedDescription, translatedName } from '@/lib/i18n/catalogTranslations';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Clock } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

type CardProps = {
    item: AssistanceTypeCatalogItem;
    title: string;
    description: string | null;
    badge: string | null;
    onPress?: () => void;
};

/** The first `normal` type: same gradient as the others, larger and with more room. */
function FeaturedTypeCard({ item, title, description, badge, onPress }: CardProps) {
    const Icon = iconFor(item);

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={!onPress}
            className="rounded-2xl"
            style={{ opacity: onPress ? 1 : 0.5 }}
            activeOpacity={0.8}
        >
            <LinearGradient
                colors={['#2B66F8', '#081E72']}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={{ borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center' }}
            >
                <View
                    className="w-14 h-14 rounded-2xl justify-center items-center mr-3"
                    style={{ backgroundColor: '#4D77EF', borderWidth: 1, borderColor: '#6789F1' }}
                >
                    <Icon size={28} color="white" strokeWidth={2.5} />
                </View>

                <View className="flex-1">
                    {badge ? (
                        <View className="flex-row items-center gap-2 mb-1">
                            <View
                                className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
                                style={{ backgroundColor: 'transparent', borderWidth: 1, borderColor: '#6789F1' }}
                            >
                                <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#49DE7F' }} />
                                <Text className="font-outfit-bold text-[9px] tracking-widest" style={{ color: '#FFFFFF' }}>
                                    {badge}
                                </Text>
                            </View>
                        </View>
                    ) : null}
                    <Text className="text-white font-outfit-bold text-xl">{title}</Text>
                    {description ? (
                        <Text className="text-blue-100 font-outfit-regular text-base mt-1">{description}</Text>
                    ) : null}
                </View>

                <View className="w-10 h-10 bg-white rounded-full justify-center items-center ml-3">
                    <ChevronRight size={20} color="#1D4ED8" strokeWidth={3} />
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
}

/**
 * Every other type. `gradient` is the rest of the `normal` group, `plain` the
 * `additional` one — same layout, different skin.
 */
function TypeCard({
    item,
    title,
    description,
    badge,
    onPress,
    variant,
}: CardProps & { variant: 'gradient' | 'plain' }) {
    const Icon = iconFor(item);
    const isGradient = variant === 'gradient';

    const body = (
        <>
            <View
                className="w-14 h-14 rounded-2xl justify-center items-center mr-1"
                style={
                    isGradient
                        ? { backgroundColor: '#4D77EF', borderWidth: 1, borderColor: '#6789F1' }
                        : { backgroundColor: '#E9F1FF' }
                }
            >
                <Icon size={26} color={isGradient ? 'white' : '#1E56E3'} strokeWidth={isGradient ? 2.5 : 2} />
            </View>
            <View className="flex-1 ml-2">
                <Text className={`font-outfit-bold text-lg ${isGradient ? 'text-white' : 'text-gray-900'}`}>
                    {title}
                </Text>
                {description ? (
                    <Text
                        className={`font-outfit-regular text-base mt-0.5 ${isGradient ? 'text-blue-100' : 'text-gray-600'}`}
                    >
                        {description}
                    </Text>
                ) : null}
                {badge ? (
                    <View
                        className="flex-row items-center gap-1 mt-2 px-2.5 py-1 rounded-full"
                        style={
                            isGradient
                                ? {
                                      backgroundColor: 'transparent',
                                      borderWidth: 1,
                                      borderColor: '#6789F1',
                                      alignSelf: 'flex-start',
                                  }
                                : {
                                      backgroundColor: '#F4F8FF',
                                      borderWidth: 1,
                                      borderColor: '#DBE7FA',
                                      alignSelf: 'flex-start',
                                  }
                        }
                    >
                        <Clock size={10} color={isGradient ? '#FFFFFF' : '#0047AB'} />
                        <Text
                            className="font-outfit-bold text-[9px] tracking-widest"
                            style={{ color: isGradient ? '#FFFFFF' : '#0047AB' }}
                        >
                            {badge}
                        </Text>
                    </View>
                ) : null}
            </View>
            <View
                className="w-10 h-10 rounded-full justify-center items-center"
                style={{ backgroundColor: isGradient ? '#FFFFFF' : '#F4F8FF' }}
            >
                <ChevronRight size={20} color={isGradient ? '#1D4ED8' : '#6B7280'} strokeWidth={isGradient ? 3 : 2} />
            </View>
        </>
    );

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={!onPress}
            className={isGradient ? 'rounded-2xl' : 'bg-white rounded-2xl px-4 py-4 flex-row items-center'}
            style={
                isGradient
                    ? { opacity: onPress ? 1 : 0.5 }
                    : { borderWidth: 1.5, borderColor: '#EEF2FA', opacity: onPress ? 1 : 0.5 }
            }
            activeOpacity={0.7}
        >
            {isGradient ? (
                <LinearGradient
                    colors={['#2B66F8', '#081E72']}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                        borderRadius: 16,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                    }}
                >
                    {body}
                </LinearGradient>
            ) : (
                body
            )}
        </TouchableOpacity>
    );
}

export default function RequestAssistanceTypeScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { types, loading, languageId } = useAssistanceTypeCatalog();

    // Catalog first, bundled copy second — the display columns are still empty in
    // production, and a type the app does not know about simply renders less chrome.
    const titleFor = (item: AssistanceTypeCatalogItem) => {
        const hasTranslation = item.translations?.some(tr => tr.languageId === languageId);
        const key = i18nKeyFor(item);
        if (!hasTranslation && key) return t(`requestAssistance.type.${key}.title`);
        return translatedName(item, languageId);
    };

    const descriptionFor = (item: AssistanceTypeCatalogItem) => {
        const fromCatalog = translatedDescription(item, languageId);
        if (fromCatalog) return fromCatalog;
        const key = i18nKeyFor(item);
        return key ? t(`requestAssistance.type.${key}.description`) : null;
    };

    // No badge column in the catalog, so an unknown type gets none.
    const badgeFor = (item: AssistanceTypeCatalogItem) => {
        const key = i18nKeyFor(item);
        return key ? t(`requestAssistance.type.${key}.badge`) : null;
    };

    // A type with no resolvable code cannot be navigated — render it disabled rather
    // than half-broken. That only happens for a type the app has never heard of.
    const pressHandler = (item: AssistanceTypeCatalogItem) => {
        const route = assistanceTypeRoute(item);
        return route ? () => router.push(route) : undefined;
    };

    // Rows already come ordered by sortOrder — keep that order. Types with no `type`
    // yet count as 'normal', which is what keeps the screen looking right today.
    const additional = types.filter(item => item.type === 'additional');
    const normal = types.filter(item => item.type !== 'additional');
    const [featured, ...restNormal] = normal;

    const cardProps = (item: AssistanceTypeCatalogItem) => {
        const handler = pressHandler(item);
        return {
            item,
            title: titleFor(item),
            description: descriptionFor(item),
            badge: badgeFor(item),
            // No identity gate: verification is optional for users, so an
            // unverified account requests assistance like any other.
            onPress: handler,
        };
    };

    return (
        <View className="flex-1 bg-white">
            <ScrollView className="flex-1 px-6 pt-6">
                {/* Section Badge */}
                <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                    <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">{t('requestAssistance.type.badge')}</Text>
                </View>

                {/* Title */}
                <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">{t('requestAssistance.type.title')}</Text>

                {/* Subtitle */}
                <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                    {t('requestAssistance.type.subtitle')}
                </Text>

                {loading ? (
                    <View className="rounded-xl border border-gray-100 p-6 items-center mb-2">
                        <ActivityIndicator size="small" color="#0047AB" />
                    </View>
                ) : null}

                <View className="gap-2">
                    {featured ? <FeaturedTypeCard key={featured.id} {...cardProps(featured)} /> : null}
                    {restNormal.map(item => (
                        <TypeCard key={item.id} {...cardProps(item)} variant="gradient" />
                    ))}
                </View>

                {additional.length > 0 ? (
                    <View className="mt-6">
                        <Text className="font-outfit-bold text-[11px] tracking-widest mb-3" style={{ color: '#8C96AE' }}>
                            {t('requestAssistance.type.additionalServices')}
                        </Text>
                        <View className="gap-2">
                            {additional.map(item => (
                                <TypeCard key={item.id} {...cardProps(item)} variant="plain" />
                            ))}
                        </View>
                    </View>
                ) : null}

                <View className="h-8" />
            </ScrollView>
        </View>
    );
}
