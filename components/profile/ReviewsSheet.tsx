import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';

import { AO, Stars } from '@/components/offer/OfferSections';
import { OwnerSheet } from '@/components/dashboard/OwnerHomeBlocks';
import { useUser } from '@/context/UserContext';
import type { ProfileReview } from '@/hooks/useProfileReviews';

const K = 'profile.reviews';

/** Ratings behind the profile's stars: when, how many stars and what was written. */
export function ReviewsSheet({ visible, onClose, isTechnician, average, count, items, loading, failed, failedStatus, partial, hasMore, onLoadMore }: {
    visible: boolean;
    onClose: () => void;
    isTechnician: boolean;
    average: number | null;
    count: number;
    items: ProfileReview[];
    loading: boolean;
    failed?: boolean;
    failedStatus?: number | null;
    /** The full list could not be loaded: these are only the stars read off the recent jobs, with no comments. */
    partial?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
}) {
    const { t, i18n } = useTranslation();
    const { user } = useUser();
    const initials = user?.name && user?.surname ? (user.name[0] + user.surname[0]).toUpperCase() : 'U';
    const dateLabel = (iso?: string) => {
        const d = iso ? new Date(iso) : null;
        return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    };
    return (
        // The same sheet as the dashboard's, anchored at the bottom and no taller than about 60% of the screen; the list scrolls inside.
        <OwnerSheet visible={visible} title={t(`${K}.${isTechnician ? 'titleMechanic' : 'titleOwner'}`)} onClose={onClose} scrollBody maxHeightFraction={0.62} fixedHeight
            fixed={average != null ? (
                <View className="flex-row items-center" style={{ gap: 12, marginBottom: 12 }} testID="reviews-summary">
                    <View className="items-center justify-center overflow-hidden" style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: AO.blue }} testID="reviews-avatar">
                        {user?.profileImage ? (
                            <Image source={{ uri: user.profileImage }} style={{ width: 48, height: 48 }} />
                        ) : (
                            <Text className="font-outfit-bold" style={{ fontSize: 18, color: '#FFFFFF' }}>{initials}</Text>
                        )}
                    </View>
                    <View style={{ gap: 3 }}>
                        <Stars rating={average} size={16} />
                        <Text className="font-outfit-semibold" style={{ fontSize: 15, color: AO.text }}>
                            {t('appointments.list.card.ratingValue', { rating: average.toFixed(1), count })}
                        </Text>
                    </View>
                </View>
            ) : null}
        >
            <View style={{ gap: 12, paddingBottom: 4 }} testID="reviews-sheet">
                {partial ? (
                    <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: AO.muted }} testID="reviews-partial">{t(`${K}.partial`)}</Text>
                ) : null}
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
                            ) : partial ? null : (
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
            </View>
        </OwnerSheet>
    );
}
