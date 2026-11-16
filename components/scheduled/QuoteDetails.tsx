import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { money, splitQuoteDescription } from '@/lib/scheduled/offers';
import { CARD_STYLE, SC } from './ui';

/** A provider's quote description: the readable note, then the quoted services line by line. */
export function QuoteDetails({ description }: { description?: string | null }) {
    const { t } = useTranslation();
    const { text, items } = splitQuoteDescription(description);
    return (
        <>
            {text ? (
                <View style={{ ...CARD_STYLE, padding: 14, gap: 4 }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1.2, color: SC.muted }}>{t('scheduledOffers.detail.description')}</Text>
                    <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: SC.text }}>{text}</Text>
                </View>
            ) : null}
            {items.length ? (
                <View style={{ ...CARD_STYLE, padding: 14, gap: 12 }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1.2, color: SC.muted }}>{t('scheduledOffers.detail.services')}</Text>
                    {items.map((item, i) => (
                        <View key={i} style={{ gap: 2 }}>
                            <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
                                <Text className="font-outfit-semibold flex-1" style={{ fontSize: 14, color: SC.text }}>{item.name}</Text>
                                <Text className="font-outfit-bold" style={{ fontSize: 14, color: item.quoted ? SC.text : SC.mutedLight }}>
                                    {item.quoted && item.total !== null ? money(item.total) : t('scheduledOffers.detail.notQuoted')}
                                </Text>
                            </View>
                            {item.quoted && (item.labor !== null || item.parts !== null) ? (
                                <Text className="font-outfit-regular" style={{ fontSize: 13, color: SC.muted }}>
                                    {[
                                        item.labor !== null ? `${t('scheduledOffers.detail.labor')} ${money(item.labor)}` : null,
                                        item.parts !== null ? `${t('scheduledOffers.detail.partsLine')} ${money(item.parts)}` : null,
                                    ].filter(Boolean).join(' · ')}
                                </Text>
                            ) : null}
                            {item.notes ? <Text className="font-outfit-regular" style={{ fontSize: 13, color: SC.muted }}>{item.notes}</Text> : null}
                        </View>
                    ))}
                </View>
            ) : null}
        </>
    );
}
