import { useTabBarInset } from '@/components/ui/RoundedTabBar';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgePercent, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, Text, View } from 'react-native';

import { InnovaLogo } from '@/components/brand/InnovaLogo';
import { TYPE } from '@/lib/ui/type';

// Two partner promotions, for now only shown: each partner's own logo in colour, that there is a discount (no figures yet) and a call to
// action that is only drawn. The cards stay calm (white and light blue): the colour belongs to the logos, not to the card.

const C = { blue: '#1E56E3', soft: '#EAF1FF', text: '#0B1530', muted: '#6B7490', border: '#E4EAF5' };

/**
 * One partner's offer. The card is not pressable: the button is only drawn, in the soft style of the app's secondary actions.
 */
function PromoCard({ logo, eyebrow, title, body, cta, testID }: {
    logo: React.ReactNode;
    eyebrow: string;
    title: string;
    body: string;
    cta: string;
    testID: string;
}) {
    const { t } = useTranslation();
    return (
        <View
            style={{ borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: C.border, shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 3 }}
            testID={testID}
        >
            <LinearGradient colors={['#FFFFFF', '#F1F7FF']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ padding: 20 }}>
                <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
                    <View style={{ minHeight: 56, justifyContent: 'center' }}>{logo}</View>
                    <View className="flex-row items-center" style={{ gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: C.soft }}>
                        <BadgePercent size={16} color={C.blue} />
                        <Text className="font-outfit-bold" style={{ fontSize: 13, letterSpacing: 0.6, color: C.blue }}>{t('promotions.discountBadge')}</Text>
                    </View>
                </View>

                <Text className="font-outfit-bold" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 1.2, color: C.muted, marginTop: 20 }}>{eyebrow}</Text>
                <Text className="font-outfit-bold" style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.4, color: C.text, marginTop: 4 }}>{title}</Text>
                <Text className="font-outfit-regular" style={{ ...TYPE.body, color: C.muted, marginTop: 8 }}>{body}</Text>

                {/* Drawn like a button, but only drawn. */}
                <View className="flex-row items-center justify-center" style={{ gap: 4, minHeight: 52, borderRadius: 14, backgroundColor: C.soft, marginTop: 18 }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 17, color: C.blue }}>{cta}</Text>
                    <ChevronRight size={20} color={C.blue} />
                </View>
            </LinearGradient>
        </View>
    );
}

/** The profile's Promotions: the ASE offer first, the Innova one second. */
export default function PromotionsScreen() {
    const tabInset = useTabBarInset();
    const { t } = useTranslation();

    return (
        <ScrollView style={{ backgroundColor: '#F6F8FC' }} contentContainerStyle={{ padding: 24, paddingBottom: 40 + tabInset, gap: 20 }}>
            <View>
                {/* Section Badge */}
                <View style={{ marginTop: 8 }}>
                    <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">{t('promotions.badge')}</Text>
                    </View>
                </View>
                <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">{t('promotions.title')}</Text>
                <Text className="text-gray-500 font-outfit-regular text-base">{t('promotions.subtitle')}</Text>
            </View>

            <PromoCard
                testID="promo-ase"
                logo={<Image source={require('@/assets/brands/ase-logo.png')} style={{ width: 56, height: 56 }} resizeMode="contain" accessibilityLabel="ASE" testID="ase-logo" />}
                eyebrow={t('promotions.ase.eyebrow')}
                title={t('promotions.ase.title')}
                body={t('promotions.ase.body')}
                cta={t('promotions.ase.cta')}
            />
            <PromoCard
                testID="promo-innova"
                logo={<InnovaLogo width={132} />}
                eyebrow={t('promotions.innova.eyebrow')}
                title={t('promotions.innova.title')}
                body={t('promotions.innova.body')}
                cta={t('promotions.innova.cta')}
            />
        </ScrollView>
    );
}
