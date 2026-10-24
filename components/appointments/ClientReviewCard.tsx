import { AO, card } from '@/components/offer/OfferSections';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

const K = 'appointments.clientReview';

/** Stored as `experienceTags` as-is, so the values stay in English; only the labels are translated. */
const OPTIONS = [
    { value: 'Issue was fully resolved', key: 'resolved' },
    { value: 'Saved me time', key: 'savedTime' },
    { value: 'Client was professional', key: 'professional' },
] as const;

interface ClientReviewCardProps {
    rating: number;
    setRating: (rating: number) => void;
    selectedOption: string;
    setSelectedOption: (option: string) => void;
    reviewText: string;
    setReviewText: (text: string) => void;
    isSubmitted: boolean;
    onSubmit: () => void;
    /** Shown above the form, e.g. "you can rate once the assistance is confirmed". */
    hint?: string;
}

/** The mechanic's rating of the vehicle owner. */
export function ClientReviewCard({ rating, setRating, selectedOption, setSelectedOption, reviewText, setReviewText, isSubmitted, onSubmit, hint }: ClientReviewCardProps) {
    const { t } = useTranslation();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const selectedLabel = OPTIONS.find((o) => o.value === selectedOption);

    return (
        <View style={[card, { padding: 16, gap: 16 }]} testID="client-review-card">
            {hint && !isSubmitted && (
                <View className="flex-row items-center" style={{ gap: 8, padding: 10, borderRadius: 12, backgroundColor: AO.blueSofter }}>
                    <Ionicons name="information-circle-outline" size={16} color={AO.blue} />
                    <Text className="font-outfit-regular" style={{ flex: 1, fontSize: 12, color: AO.muted, lineHeight: 17 }}>{hint}</Text>
                </View>
            )}

            <View style={{ gap: 10 }}>
                <Text className="font-outfit-bold" style={{ fontSize: 15, color: AO.text }}>{t(`${K}.title`)}</Text>
                <View className="flex-row justify-center" style={{ gap: 8 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity key={star} onPress={() => !isSubmitted && setRating(star)} disabled={isSubmitted} accessibilityLabel={t(`${K}.star`, { count: star })}>
                            <Ionicons name={star <= rating ? 'star' : 'star-outline'} size={32} color={AO.star} />
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={{ zIndex: 50 }}>
                <Text className="font-outfit-bold" style={{ fontSize: 13, color: AO.text, marginBottom: 8 }}>{t(`${K}.experience`)}</Text>
                <TouchableOpacity
                    onPress={() => !isSubmitted && setIsDropdownOpen(!isDropdownOpen)}
                    disabled={isSubmitted}
                    className="flex-row justify-between items-center"
                    style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: AO.border, backgroundColor: '#fff' }}
                >
                    <Text className={selectedLabel ? 'font-outfit-medium' : 'font-outfit-regular'} style={{ fontSize: 13.5, color: selectedLabel ? AO.text : AO.mutedLight }}>
                        {selectedLabel ? t(`${K}.options.${selectedLabel.key}`) : selectedOption || t(`${K}.selectOption`)}
                    </Text>
                    <Ionicons name={isDropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color={AO.muted} />
                </TouchableOpacity>
                {isDropdownOpen && (
                    <View style={[card, { position: 'absolute', top: 84, left: 0, right: 0, borderRadius: 12, zIndex: 50 }]}>
                        {OPTIONS.map((option, index) => {
                            const on = selectedOption === option.value;
                            return (
                                <TouchableOpacity
                                    key={option.value}
                                    onPress={() => {
                                        setSelectedOption(option.value);
                                        setIsDropdownOpen(false);
                                    }}
                                    className="flex-row items-center justify-between"
                                    style={{ padding: 14, borderBottomWidth: index < OPTIONS.length - 1 ? 1 : 0, borderBottomColor: AO.borderSoft }}
                                >
                                    <Text className={on ? 'font-outfit-bold' : 'font-outfit-regular'} style={{ fontSize: 13.5, color: on ? AO.blue : AO.text }}>
                                        {t(`${K}.options.${option.key}`)}
                                    </Text>
                                    {on && <Ionicons name="checkmark" size={18} color={AO.blue} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </View>

            <View>
                <Text className="font-outfit-bold" style={{ fontSize: 13, color: AO.text, marginBottom: 8 }}>{t(`${K}.review`)}</Text>
                <TextInput
                    className="font-outfit-regular"
                    style={{ minHeight: 96, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: AO.border, backgroundColor: '#fff', fontSize: 13.5, color: AO.text }}
                    placeholder={t(`${K}.placeholder`)}
                    placeholderTextColor={AO.mutedLight}
                    multiline
                    textAlignVertical="top"
                    value={reviewText}
                    onChangeText={setReviewText}
                    editable={!isSubmitted}
                />
            </View>

            {isSubmitted ? (
                <View className="flex-row items-center justify-center" style={{ gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: AO.greenSoft }} testID="client-review-sent">
                    <Ionicons name="checkmark-circle" size={18} color={AO.greenText} />
                    <Text className="font-outfit-bold" style={{ fontSize: 14, color: AO.greenText }}>{t(`${K}.sent`)}</Text>
                </View>
            ) : (
                <TouchableOpacity onPress={onSubmit} className="items-center justify-center" style={{ paddingVertical: 14, borderRadius: 12, backgroundColor: AO.blue }} testID="client-review-send">
                    <Text className="font-outfit-bold" style={{ fontSize: 15, color: '#fff' }}>{t(`${K}.send`)}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
