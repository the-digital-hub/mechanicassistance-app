import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { OS } from '@/components/on-site/ui';
import { RatingFields } from '@/components/reviews/RatingFields';
import { CLIENT_REVIEW_TAGS, OWNER_REVIEW_TAGS } from '@/lib/reviews/tags';
import type { Appointment } from '@/context/AppointmentsContext';
import { useAppointmentMechanic } from '@/hooks/useAppointmentMechanic';
import { ApiError } from '@/lib/api/types';
import { onSiteDAO } from '@/lib/dao/OnSiteDAO';
import { reviewDAO } from '@/lib/dao/ReviewDAO';
import { userDAO } from '@/lib/dao/UserDAO';
import { appAlert } from '@/lib/ui/appAlert';
import { TYPE } from '@/lib/ui/type';
import { splitJobTitle } from '@/lib/ui/jobTitle';

const GAP = 12;
const SIDE = 20; // the sheet's side padding

/** Who the rating is about: the technician for the owner, the customer for the technician. */
function useRatedPerson(appointment: Appointment, role: 'user' | 'mechanic'): string | null {
    const mechanic = useAppointmentMechanic(appointment.id, role === 'user' && !!appointment.mechanicId);
    const [customer, setCustomer] = React.useState<string | null>(null);
    React.useEffect(() => {
        if (role !== 'mechanic' || !appointment.userId) return undefined;
        let cancelled = false;
        userDAO.getPublicProfile(appointment.userId)
            .then((p) => { if (!cancelled) setCustomer([p?.name, p?.surname].filter(Boolean).join(' ') || null); })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, [role, appointment.userId]);
    return role === 'user' ? mechanic?.displayName ?? null : customer;
}

function RatingCard({ appointment, role, width, position, total, onSent, onSkip }: {
    appointment: Appointment;
    role: 'user' | 'mechanic';
    width: number;
    position: number;
    total: number;
    onSent: (id: string) => void;
    onSkip: () => void;
}) {
    const { t, i18n } = useTranslation();
    const K = 'dashboard.rating';
    const person = useRatedPerson(appointment, role);
    const [rating, setRating] = React.useState(0);
    const [comment, setComment] = React.useState('');
    const [tags, setTags] = React.useState<string[]>([]);
    const tagOptions = (role === 'user' ? OWNER_REVIEW_TAGS : CLIENT_REVIEW_TAGS).map((tag) => ({
        value: tag,
        label: role === 'user' ? t(`appointments.ownerReview.tags.${tag}`) : t(`reviews.clientTags.${tag}`),
    }));
    const [sending, setSending] = React.useState(false);
    const [done, setDone] = React.useState(false);
    const when = appointment.completedAt ?? appointment.updatedAt;
    const date = when ? new Date(when).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long' }) : '';
    const { main } = splitJobTitle(appointment.title);

    const submit = async () => {
        if (!rating || sending) return;
        setSending(true);
        try {
            if (role === 'user') await reviewDAO.submit(appointment.id, rating, comment.trim() || undefined, tags);
            else await onSiteDAO.reviewClient(appointment.id, rating, comment.trim() || undefined, tags);
            setDone(true);
            // A moment to read "Thanks", then it moves on to the next one.
            setTimeout(() => onSent(appointment.id), 1100);
        } catch (e) {
            // "Already rated" means it is saved.
            if (e instanceof ApiError && e.statusCode === 409 && /already/i.test(e.apiMessage ?? '')) {
                setDone(true);
                setTimeout(() => onSent(appointment.id), 600);
            } else {
                appAlert(t(`${K}.errorTitle`), t(`${K}.errorMessage`));
            }
        } finally {
            setSending(false);
        }
    };

    return (
        <View
            style={{ width, borderRadius: 20, padding: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF2FA', shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 3 }}
            testID={`rating-card-${appointment.id}`}
        >
            <View className="flex-row items-center justify-between">
                <Text className="font-outfit-semibold" style={{ ...TYPE.caption, color: OS.muted }}>{t(`${K}.counter`, { current: position, total })}</Text>
                {date ? <Text className="font-outfit-regular" style={{ ...TYPE.caption, color: OS.muted }}>{date}</Text> : null}
            </View>
            <Text className="font-outfit-bold" style={{ fontSize: 18, lineHeight: 23, letterSpacing: -0.3, color: OS.text, marginTop: 10 }} numberOfLines={2}>
                {person ?? t(`${K}.${role === 'user' ? 'yourTechnician' : 'yourCustomer'}`)}
            </Text>
            <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: OS.muted, marginTop: 2 }} numberOfLines={1}>
                {[main, appointment.car].filter(Boolean).join(' · ')}
            </Text>

            {done ? (
                <View className="flex-row items-center justify-center" style={{ gap: 8, marginTop: 18, paddingVertical: 22, borderRadius: 16, backgroundColor: OS.greenSoft }}>
                    <Ionicons name="checkmark-circle" size={22} color={OS.green} />
                    <Text className="font-outfit-bold" style={{ fontSize: 16, color: OS.green }}>{t(`${K}.thanks`)}</Text>
                </View>
            ) : (
                <>
                    <View style={{ marginTop: 16 }}>
                        <RatingFields
                            rating={rating}
                            onRating={setRating}
                            tags={tags}
                            onTags={setTags}
                            options={tagOptions}
                            tagsTitle={t(`${K}.tagsTitle`)}
                            comment={comment}
                            onComment={setComment}
                            commentPlaceholder={t(`${K}.commentPh`)}
                            starLabel={(n) => t(`${K}.stars`, { count: n })}
                            testIDPrefix="rating"
                        />
                    </View>
                    <TouchableOpacity
                        onPress={() => void submit()}
                        disabled={!rating || sending}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        className="items-center justify-center"
                        style={{ minHeight: 52, borderRadius: 14, marginTop: 14, backgroundColor: rating ? OS.blue : OS.blueIce }}
                        testID="rating-send"
                    >
                        {sending ? <ActivityIndicator color="#FFFFFF" /> : <Text className="font-outfit-bold text-white" style={{ fontSize: 17, lineHeight: 23 }}>{t(`${K}.send`)}</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onSkip} accessibilityRole="button" className="items-center justify-center" style={{ minHeight: 44, marginTop: 4 }} testID="rating-skip">
                        <Text className="font-outfit-bold" style={{ fontSize: 15, color: OS.muted }}>{total > 1 ? t(`${K}.next`) : t(`${K}.later`)}</Text>
                    </TouchableOpacity>
                </>
            )}
        </View>
    );
}

/**
 * The ratings still owed, the content of the sheet the dashboard opens from below: one card per finished job, side by side. Swipe sideways to go through them; each
 * sends its own rating and, once sent, the next one comes up. The list shrinks as they are given; with none left it closes itself.
 */
export function PendingRatings({ appointments, role, onSent, onClose }: {
    appointments: Appointment[];
    role: 'user' | 'mechanic';
    /** One was sent: the caller refreshes the list. */
    onSent: () => void;
    onClose: () => void;
}) {
    const { width: screen } = useWindowDimensions();
    const cardWidth = screen - SIDE * 2;
    const scroller = React.useRef<ScrollView>(null);
    const [sentIds, setSentIds] = React.useState<Set<string>>(new Set());
    const [page, setPage] = React.useState(0);
    const list = appointments.filter((a) => !sentIds.has(a.id));

    React.useEffect(() => {
        if (list.length === 0) onClose();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [list.length]);

    const goTo = (i: number) => {
        const next = Math.min(Math.max(0, i), Math.max(0, list.length - 1));
        scroller.current?.scrollTo({ x: next * (cardWidth + GAP), animated: true });
        setPage(next);
    };
    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / (cardWidth + GAP)));

    if (list.length === 0) return null;
    return (
        <View testID="pending-ratings">
            <ScrollView
                ref={scroller}
                horizontal
                pagingEnabled={false}
                snapToInterval={cardWidth + GAP}
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onMomentumScrollEnd={onScroll}
                contentContainerStyle={{ gap: GAP, paddingHorizontal: 0 }}
            >
                {list.map((a, i) => (
                    <RatingCard
                        key={a.id}
                        appointment={a}
                        role={role}
                        width={cardWidth}
                        position={i + 1}
                        total={list.length}
                        onSent={(id) => { setSentIds((prev) => new Set(prev).add(id)); onSent(); }}
                        onSkip={() => (i < list.length - 1 ? goTo(i + 1) : onClose())}
                    />
                ))}
            </ScrollView>
            {list.length > 1 ? (
                <View className="flex-row items-center justify-center" style={{ gap: 6, marginTop: 12 }}>
                    {list.slice(0, 12).map((a, i) => (
                        <View key={a.id} style={{ width: i === page ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === page ? OS.blue : '#D5DCEB' }} />
                    ))}
                </View>
            ) : null}
        </View>
    );
}
