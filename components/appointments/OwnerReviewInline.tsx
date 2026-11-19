import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { NoteInput, OS, PrimaryButton, cardShadow } from '@/components/on-site/ui';
import { useMessageDialog } from '@/components/ui/useMessageDialog';
import { ApiError } from '@/lib/api/types';
import { reviewDAO } from '@/lib/dao/ReviewDAO';
import { TYPE } from '@/lib/ui/type';

const K = 'appointments.ownerReview';
const TAGS = ['on_time', 'professional', 'fair_price', 'clear_explanation', 'friendly'] as const;

/**
 * Whether the owner still has to rate the technician of this appointment. Off (`enabled` false)
 * while the job is not closed; `markDone` flips it once the review was sent.
 */
export function useOwnerReviewPending(appointmentId: string | undefined, enabled: boolean) {
    const [pending, setPending] = React.useState(false);
    // True once the lookup answered: before that, "not pending" does not mean "already rated".
    const [loaded, setLoaded] = React.useState(false);
    // Once the owner has sent the review here, a later lookup that still answers "none" (a slow read after the
    // write) must not bring the rating block back.
    const rated = React.useRef(false);
    React.useEffect(() => {
        if (!enabled || !appointmentId) {
            setPending(false);
            setLoaded(false);
            return;
        }
        let cancelled = false;
        reviewDAO
            .get(appointmentId)
            .then((r) => { if (!cancelled) { setPending(!r && !rated.current); setLoaded(true); } })
            .catch(() => !cancelled && setPending(false));
        return () => {
            cancelled = true;
        };
    }, [appointmentId, enabled]);
    return { pending, loaded, markDone: () => { rated.current = true; setPending(false); } };
}

/** The reminder over the sub-navbar: the review is completed in the Status tab. */
export function OwnerReviewPrompt({ onPress }: { onPress: () => void }) {
    const { t } = useTranslation();
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.85}
            className="flex-row items-center"
            style={{ gap: 12, padding: 14, borderRadius: 18, backgroundColor: '#FEF4E2', borderWidth: 1, borderColor: '#F7DDB0' }}
            accessibilityRole="button"
            testID="owner-review-prompt"
        >
            <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
                <Ionicons name="star" size={20} color="#F08A1C" />
            </View>
            <View style={{ flex: 1 }}>
                <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, lineHeight: 22, color: OS.text }}>{t(`${K}.promptTitle`)}</Text>
                <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: OS.muted }}>{t(`${K}.promptBody`)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={OS.muted} />
        </TouchableOpacity>
    );
}

/** The owner's rating of the technician, open in the Status tab: stars, what stood out, a comment and Send. */
export function OwnerReviewInline({ appointmentId, onSent, onDismissed }: {
    appointmentId: string;
    /** The review is saved (or already was): the status steps can show it as done. */
    onSent: () => void;
    /** A moment after "Thanks": the whole block can go away. */
    onDismissed?: () => void;
}) {
    const { t } = useTranslation();
    const { notify, dialog } = useMessageDialog();
    const [rating, setRating] = React.useState(0);
    const [tags, setTags] = React.useState<string[]>([]);
    const [comment, setComment] = React.useState('');
    const [sending, setSending] = React.useState(false);
    const [done, setDone] = React.useState(false);

    // "Thanks" is a confirmation, not a place to stay: a moment later the block leaves the screen.
    React.useEffect(() => {
        if (!done) return undefined;
        const timer = setTimeout(() => onDismissed?.(), 2200);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [done]);

    const toggleTag = (tag: string) => setTags((list) => (list.includes(tag) ? list.filter((x) => x !== tag) : [...list, tag]));

    const submit = async () => {
        setSending(true);
        try {
            await reviewDAO.submit(appointmentId, rating, comment.trim() || undefined, tags);
            setDone(true);
            onSent();
        } catch (e) {
            if (e instanceof ApiError && e.statusCode === 409) {
                setDone(true);
                onSent();
            } else {
                void notify(t(`${K}.title`), t(`${K}.error`));
            }
        } finally {
            setSending(false);
        }
    };

    if (done) {
        return (
            <View className="flex-row items-center justify-center" style={{ gap: 8, padding: 18, borderRadius: 20, backgroundColor: OS.greenSoft }} testID="owner-review-sent">
                <Ionicons name="checkmark-circle" size={22} color={OS.green} />
                <Text className="font-outfit-bold" style={{ fontSize: 16, color: OS.green }}>{t(`${K}.thanks`)}</Text>
            </View>
        );
    }

    return (
        <View style={{ gap: 14 }} testID="owner-review-inline">
            {dialog}
            <View style={[cardShadow, { padding: 18, alignItems: 'center' }]}>
                <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, color: OS.text }}>{t(`${K}.title`)}</Text>
                <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: OS.muted, marginTop: 2 }}>{t(`${K}.subtitle`)}</Text>
                <View className="flex-row justify-center" style={{ gap: 8, marginTop: 14 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                        <TouchableOpacity key={n} onPress={() => setRating(n)} testID={`owner-review-star-${n}`} style={{ padding: 2 }}>
                            <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={36} color={n <= rating ? OS.orange : OS.border} />
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={[cardShadow, { padding: 16 }]}>
                <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, color: OS.text }}>{t(`${K}.tagsTitle`)}</Text>
                <View className="flex-row flex-wrap" style={{ gap: 8, marginTop: 12 }}>
                    {TAGS.map((tag) => {
                        const active = tags.includes(tag);
                        return (
                            <TouchableOpacity
                                key={tag}
                                onPress={() => toggleTag(tag)}
                                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: active ? OS.blue : OS.border, backgroundColor: active ? OS.blueSoft : '#FFFFFF' }}
                            >
                                <Text className="font-outfit-bold" style={{ fontSize: 13, color: active ? OS.blue : OS.muted }}>{t(`${K}.tags.${tag}`)}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <NoteInput value={comment} onChangeText={setComment} placeholder={t(`${K}.commentPh`)} rows={3} white />
            </View>

            <View className="flex-row">
                <PrimaryButton label={t(`${K}.submit`)} onPress={() => void submit()} disabled={!rating || sending} testID="owner-review-submit" />
            </View>
            {sending ? <ActivityIndicator color={OS.blue} /> : null}
        </View>
    );
}
