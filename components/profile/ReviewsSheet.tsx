import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { AO, Stars } from '@/components/offer/OfferSections';
import { SlideModal } from '@/components/ui/SlideModal';
import { SheetHandle } from '@/components/ui/SheetHandle';
import type { ProfileReview } from '@/hooks/useProfileReviews';
import { SHEET } from '@/lib/ui/sheet';

const K = 'profile.reviews';

/** Ratings behind the profile's stars: when, how many stars and what was written. */
export function ReviewsSheet({ visible, onClose, isTechnician, average, count, items, loading, failed, failedStatus, hasMore, onLoadMore }: {
    visible: boolean;
    onClose: () => void;
    isTechnician: boolean;
    average: number | null;
    count: number;
    items: ProfileReview[];
    loading: boolean;
    failed?: boolean;
    failedStatus?: number | null;
    hasMore?: boolean;
    onLoadMore?: () => void;
}) {
    const { t, i18n } = useTranslation();
    const dateLabel = (iso?: string) => {
        const d = iso ? new Date(iso) : null;
        return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    };
    return (
        <SlideModal visible={visible} onClose={onClose}>
            <View style={{ ...SHEET, maxHeight: '82%', paddingTop: 12 }} testID="reviews-sheet">
                <SheetHandle />
                <View className="flex-row items-center" style={{ paddingHorizontal: 20, gap: 12 }}>
                    <View style={{ flex: 1 }}>
                        <Text className="font-outfit-bold" style={{ fontSize: 20, color: AO.text }}>{t(`${K}.${isTechnician ? 'titleMechanic' : 'titleOwner'}`)}</Text>
                        {average != null ? (
                            <View className="flex-row items-center" style={{ gap: 8, marginTop: 6 }}>
                                <Stars rating={average} size={16} />
                                <Text className="font-outfit-semibold" style={{ fontSize: 15, color: AO.text }}>
                                    {t('appointments.list.card.ratingValue', { rating: average.toFixed(1), count })}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                    <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" testID="reviews-close">
                        <Ionicons name="close" size={26} color={AO.muted} />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 12 }}>
                    {items.length === 0 ? (
                        loading ? (
                            <ActivityIndicator color={AO.blue} style={{ paddingVertical: 24 }} />
                        ) : (
                            <View style={{ paddingVertical: 24, gap: 4 }}>
                                <Text className="font-outfit-medium" style={{ fontSize: 16, color: AO.muted, textAlign: 'center' }}>{t(failed ? `${K}.failed` : `${K}.empty`)}</Text>
                                {failed && failedStatus ? <Text className="font-outfit-regular" style={{ fontSize: 13, color: AO.mutedLight, textAlign: 'center' }}>{t(`${K}.failedCode`, { status: failedStatus })}</Text> : null}
                            </View>
                        )
                    ) : (
                        items.map((r) => (
                            <View key={r.id} style={{ borderRadius: 16, borderWidth: 1, borderColor: AO.borderSoft, backgroundColor: '#FFFFFF', padding: 14, gap: 8 }} testID="review-item">
                                <View className="flex-row items-center justify-between">
                                    <Stars rating={r.rating} size={16} />
                                    <Text className="font-outfit-medium" style={{ fontSize: 14, color: AO.muted }}>{dateLabel(r.date)}</Text>
                                </View>
                                {r.text ? (
                                    <Text className="font-outfit-regular" style={{ fontSize: 16, lineHeight: 22, color: AO.text }}>{r.text}</Text>
                                ) : (
                                    <Text className="font-outfit-regular" style={{ fontSize: 15, color: AO.mutedLight, fontStyle: 'italic' }}>{t(`${K}.noComment`)}</Text>
                                )}
                                {r.tags.length > 0 ? (
                                    <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                                        {r.tags.map((tag) => (
                                            <View key={tag} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: AO.blueSoft }}>
                                                <Text className="font-outfit-bold" style={{ fontSize: 13, color: AO.blue }}>{tag}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : null}
                                {r.title || r.car ? (
                                    <Text className="font-outfit-medium" style={{ fontSize: 13, color: AO.muted }} numberOfLines={1}>{[r.title, r.car].filter(Boolean).join(' · ')}</Text>
                                ) : null}
                            </View>
                        ))
                    )}
                    {items.length > 0 && hasMore ? (
                        <TouchableOpacity onPress={onLoadMore} disabled={loading} activeOpacity={0.85} accessibilityRole="button" className="items-center justify-center" style={{ height: 48, borderRadius: 14, backgroundColor: AO.blueSoft }} testID="reviews-more">
                            {loading ? <ActivityIndicator color={AO.blue} /> : <Text className="font-outfit-bold" style={{ fontSize: 16, color: AO.blue }}>{t(`${K}.more`)}</Text>}
                        </TouchableOpacity>
                    ) : null}
                </ScrollView>
            </View>
        </SlideModal>
    );
}
