import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { NoteInput, OS } from '@/components/on-site/ui';
import { TYPE } from '@/lib/ui/type';

export interface RatingTagOption { value: string; label: string }

/**
 * The one rating form: stars first, then the preset options (several can be picked), then the free text. Controlled;
 * the caller owns the state and the Send button.
 */
export function RatingFields({ rating, onRating, tags, onTags, options, tagsTitle, comment, onComment, commentPlaceholder, starLabel, starSize, testIDPrefix = 'rating', compact, question, hint, revealAfterRating }: {
    rating: number;
    onRating: (n: number) => void;
    tags: string[];
    onTags: (next: string[]) => void;
    options: RatingTagOption[];
    tagsTitle: string;
    comment: string;
    onComment: (v: string) => void;
    commentPlaceholder: string;
    starLabel?: (n: number) => string;
    starSize?: number;
    testIDPrefix?: string;
    /** Smaller stars and options, for a card that has to stay short. */
    compact?: boolean;
    /** A question above the stars ("How was your service?"), so it is clear what the stars are for. */
    question?: string;
    /** A line under the question while nothing is picked ("Tap a star to rate"). */
    hint?: string;
    /** Show the options and the comment only once a star is picked: until then the stars are the only thing to do. */
    revealAfterRating?: boolean;
}) {
    const stars = starSize ?? (compact ? 40 : 44);
    const showRest = !revealAfterRating || rating > 0;
    const toggle = (v: string) => onTags(tags.includes(v) ? tags.filter((x) => x !== v) : [...tags, v]);
    return (
        <View>
            {question ? (
                <View style={{ alignItems: 'center', marginBottom: 8 }}>
                    <Text className="font-outfit-bold text-center" style={{ fontSize: 18, lineHeight: 24, color: OS.text }}>{question}</Text>
                    {hint && rating === 0 ? <Text className="font-outfit-medium text-center" style={{ fontSize: 14, lineHeight: 20, color: OS.blue, marginTop: 2 }}>{hint}</Text> : null}
                </View>
            ) : null}
            <View className="flex-row justify-center" style={{ gap: 8 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity key={n} onPress={() => onRating(n)} hitSlop={4} accessibilityRole="button" accessibilityLabel={starLabel?.(n)} testID={`${testIDPrefix}-star-${n}`} style={{ padding: 2 }}>
                        <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={stars} color={n <= rating ? OS.orange : '#9AA7C2'} />
                    </TouchableOpacity>
                ))}
            </View>
            {revealAfterRating && rating > 0 && starLabel ? (
                <Text className="font-outfit-bold text-center" style={{ fontSize: 15, color: OS.orange, marginTop: 4 }}>{starLabel(rating)}</Text>
            ) : null}
            {showRest ? (
            <>
            <Text className="font-outfit-bold" style={{ ...(compact ? { fontSize: 14, lineHeight: 19 } : TYPE.cardTitle), color: OS.text, marginTop: compact ? 12 : 18 }}>{tagsTitle}</Text>
            <View className="flex-row flex-wrap" style={{ gap: compact ? 6 : 8, marginTop: compact ? 8 : 10 }}>
                {options.map((o) => {
                    const active = tags.includes(o.value);
                    return (
                        <TouchableOpacity
                            key={o.value}
                            onPress={() => toggle(o.value)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            testID={`${testIDPrefix}-tag-${o.value}`}
                            style={{ paddingHorizontal: compact ? 10 : 12, paddingVertical: compact ? 5 : 8, borderRadius: 999, borderWidth: 1.5, borderColor: active ? OS.blue : OS.border, backgroundColor: active ? OS.blueSoft : '#FFFFFF' }}
                        >
                            <Text className="font-outfit-bold" style={{ fontSize: compact ? 12 : 13, color: active ? OS.blue : OS.muted }}>{o.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
            {/* Air between the options and the comment box: they are two different questions. */}
            <View style={{ marginTop: compact ? 14 : 10 }}>
                <NoteInput value={comment} onChangeText={onComment} placeholder={commentPlaceholder} rows={compact ? 1 : 2} white />
            </View>
            </>
            ) : null}
        </View>
    );
}
