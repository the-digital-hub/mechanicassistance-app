import { AO, card } from '@/components/offer/OfferSections';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { RatingFields } from '@/components/reviews/RatingFields';
import { CLIENT_REVIEW_TAGS } from '@/lib/reviews/tags';
import { TYPE } from '@/lib/ui/type';

const K = 'appointments.clientReview';

interface ClientReviewCardProps {
    rating: number;
    setRating: (rating: number) => void;
    tags: string[];
    setTags: (tags: string[]) => void;
    reviewText: string;
    setReviewText: (text: string) => void;
    isSubmitted: boolean;
    onSubmit: () => void;
    /** Shown above the form, e.g. "you can rate once the assistance is confirmed". */
    hint?: string;
}

/** The mechanic's rating of the vehicle owner. */
export function ClientReviewCard({ rating, setRating, tags, setTags, reviewText, setReviewText, isSubmitted, onSubmit, hint }: ClientReviewCardProps) {
    const { t } = useTranslation();

    // Once the rating is sent there is nothing left to do here: opened already sent, the card is not shown at
    // all; sent just now, it says so for a moment and then closes (same as the owner's review).
    const openedSent = useRef(isSubmitted);
    const [closed, setClosed] = useState(isSubmitted);
    useEffect(() => {
        if (!isSubmitted) { openedSent.current = false; setClosed(false); return; }
        if (openedSent.current) { setClosed(true); return; }
        const timer = setTimeout(() => setClosed(true), 2200);
        return () => clearTimeout(timer);
    }, [isSubmitted]);
    if (closed) return null;

    return (
        <View style={[card, { padding: 16, gap: 16 }]} testID="client-review-card">
            {hint && !isSubmitted && (
                <View className="flex-row items-center" style={{ gap: 8, padding: 10, borderRadius: 12, backgroundColor: AO.blueSofter }}>
                    <Ionicons name="information-circle-outline" size={16} color={AO.blue} />
                    <Text className="font-outfit-regular" style={{ flex: 1, fontSize: 13, color: AO.muted, lineHeight: 17 }}>{hint}</Text>
                </View>
            )}

            <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, color: AO.text }}>{t(`${K}.title`)}</Text>
            <RatingFields
                rating={rating}
                onRating={(n) => !isSubmitted && setRating(n)}
                tags={tags}
                onTags={(next) => !isSubmitted && setTags(next)}
                options={CLIENT_REVIEW_TAGS.map((tag) => ({ value: tag, label: t('reviews.clientTags.' + tag) }))}
                tagsTitle={t(`${K}.experience`)}
                comment={reviewText}
                onComment={(v) => !isSubmitted && setReviewText(v)}
                commentPlaceholder={t(`${K}.placeholder`)}
                starLabel={(n) => t(`${K}.star`, { count: n })}
                starSize={32}
                testIDPrefix="client-review"
            />

            {isSubmitted ? (
                <View className="flex-row items-center justify-center" style={{ gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: AO.greenSoft }} testID="client-review-sent">
                    <Ionicons name="checkmark-circle" size={18} color={AO.greenText} />
                    <Text className="font-outfit-bold" style={{ fontSize: 14, color: AO.greenText }}>{t(`${K}.sent`)}</Text>
                </View>
            ) : (
                <TouchableOpacity onPress={onSubmit} className="items-center justify-center" style={{ paddingVertical: 14, borderRadius: 14, backgroundColor: AO.blue }} testID="client-review-send">
                    <Text className="font-outfit-bold" style={{ fontSize: 15, color: '#fff' }}>{t(`${K}.send`)}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
