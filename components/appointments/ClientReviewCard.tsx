import { AO, card } from '@/components/offer/OfferSections';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SlideModal } from '@/components/ui/SlideModal';
import { SHEET } from '@/lib/ui/sheet';
import { RatingFields } from '@/components/reviews/RatingFields';
import { CLIENT_REVIEW_TAGS } from '@/lib/reviews/tags';
import { TYPE } from '@/lib/ui/type';
import { OwnerSheet } from '@/components/dashboard/OwnerHomeBlocks';
import { PendingRatings } from '@/components/dashboard/PendingRatings';
import type { Appointment } from '@/context/AppointmentsContext';

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
    /** The appointment itself: with it the sheet is the same one the dashboard opens (who the customer is, then the stars, what stood out and the comment), and it sends the rating itself. */
    appointment?: Appointment;
    /** With `appointment`: the rating was saved. */
    onSent?: () => void;
}

/**
 * The mechanic's rating of the vehicle owner: a card with one button, and the form (stars, what stood out, a comment, Send) opens from below.
 * Once sent the sheet closes and the card says so for a moment, then goes.
 */
export function ClientReviewCard({ rating, setRating, tags, setTags, reviewText, setReviewText, isSubmitted, onSubmit, hint, appointment, onSent }: ClientReviewCardProps) {
    const { t } = useTranslation();
    const [sheet, setSheet] = useState(false);

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
        <View style={[card, { padding: 16, gap: 14 }]} testID="client-review-card">
            {hint && !isSubmitted && (
                <View className="flex-row items-center" style={{ gap: 8, padding: 10, borderRadius: 12, backgroundColor: AO.blueSofter }}>
                    <Ionicons name="information-circle-outline" size={16} color={AO.blue} />
                    <Text className="font-outfit-regular" style={{ flex: 1, fontSize: 13, color: AO.muted, lineHeight: 17 }}>{hint}</Text>
                </View>
            )}

            <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: AO.blueSoft }}>
                    <Ionicons name="star-outline" size={20} color={AO.blue} />
                </View>
                <Text className="font-outfit-bold" style={{ flex: 1, ...TYPE.cardTitle, color: AO.text }}>{t(`${K}.title`)}</Text>
            </View>

            {isSubmitted ? (
                <View className="flex-row items-center justify-center" style={{ gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: AO.greenSoft }} testID="client-review-sent">
                    <Ionicons name="checkmark-circle" size={18} color={AO.greenText} />
                    <Text className="font-outfit-bold" style={{ fontSize: 14, color: AO.greenText }}>{t(`${K}.sent`)}</Text>
                </View>
            ) : (
                <TouchableOpacity onPress={() => setSheet(true)} activeOpacity={0.85} accessibilityRole="button" className="items-center justify-center" style={{ minHeight: 52, borderRadius: 14, backgroundColor: AO.blue }} testID="client-review-open">
                    <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#fff' }}>{t('appointments.closeout.rateButton')}</Text>
                </TouchableOpacity>
            )}

            {appointment ? (
                // The same sheet as the dashboard: it fits above the keyboard and its body scrolls, so nothing is cut off.
                <OwnerSheet visible={sheet && !isSubmitted} title={t(`${K}.title`)} onClose={() => setSheet(false)} scrollBody>
                    <PendingRatings appointments={[appointment]} role="mechanic" onSent={() => onSent?.()} onClose={() => setSheet(false)} />
                </OwnerSheet>
            ) : (
                <SlideModal visible={sheet && !isSubmitted} onClose={() => setSheet(false)} avoidKeyboard>
                    <View style={{ ...SHEET, maxHeight: '90%', paddingTop: 16 }} testID="client-review-sheet">
                        <View className="flex-row items-center justify-between px-5 pb-2">
                            <Text className="font-outfit-bold flex-1" style={{ fontSize: 22, letterSpacing: -0.4, color: AO.text, paddingRight: 12 }}>{t(`${K}.title`)}</Text>
                            <TouchableOpacity onPress={() => setSheet(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" className="items-center justify-center" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#EEF1F6' }}>
                                <Ionicons name="close" size={16} color="#4B5563" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 34, gap: 16 }} showsVerticalScrollIndicator={false}>
                            <RatingFields
                                rating={rating}
                                onRating={setRating}
                                tags={tags}
                                onTags={setTags}
                                options={CLIENT_REVIEW_TAGS.map((tag) => ({ value: tag, label: t('reviews.clientTags.' + tag) }))}
                                tagsTitle={t(`${K}.experience`)}
                                comment={reviewText}
                                onComment={setReviewText}
                                commentPlaceholder={t(`${K}.placeholder`)}
                                starLabel={(n) => t(`${K}.star`, { count: n })}
                                starSize={32}
                                testIDPrefix="client-review"
                            />
                            <TouchableOpacity
                                onPress={onSubmit}
                                disabled={!rating}
                                className="items-center justify-center"
                                style={{ minHeight: 52, borderRadius: 14, backgroundColor: rating ? AO.blue : '#DCE7FA' }}
                                testID="client-review-send"
                            >
                                <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#fff' }}>{t(`${K}.send`)}</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </SlideModal>
            )}
        </View>
    );
}
