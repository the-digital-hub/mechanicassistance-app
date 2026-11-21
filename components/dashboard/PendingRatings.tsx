import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { Stars } from '@/components/offer/OfferSections';
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
function useRatedPerson(appointment: Appointment, role: 'user' | 'mechanic'): { name: string | null; photo: string | null; initials: string; rating: number | null; ratingCount: number; aseCertified: boolean; idVerified: boolean } {
    const mechanic = useAppointmentMechanic(appointment.id, role === 'user' && !!appointment.mechanicId);
    const [customer, setCustomer] = React.useState<{ name: string | null; photo: string | null }>({ name: null, photo: null });
    React.useEffect(() => {
        if (role !== 'mechanic' || !appointment.userId) return undefined;
        let cancelled = false;
        userDAO.getPublicProfile(appointment.userId)
            .then((p) => { if (!cancelled) setCustomer({ name: [p?.name, p?.surname].filter(Boolean).join(' ') || null, photo: p?.profileImage ?? null }); })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, [role, appointment.userId]);
    const name = role === 'user' ? mechanic?.displayName ?? null : customer.name;
    const photo = role === 'user' ? mechanic?.profileImage ?? null : customer.photo;
    const initials = (role === 'user' ? mechanic?.initials : null) ?? (name ? name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() : '');
    // Rating and badges are the technician's: a customer's public profile carries neither.
    const m = role === 'user' ? mechanic : null;
    const rating = m?.avgRating != null && Number.isFinite(Number(m.avgRating)) ? Number(m.avgRating) : null;
    return { name, photo, initials, rating, ratingCount: m?.ratingCount ?? 0, aseCertified: !!m?.aseCertified, idVerified: !!m?.idVerified };
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
    const { main, topic } = splitJobTitle(appointment.title);
    // The issue: the service in the title, else the issues the owner ticked; and which kind of assistance it was.
    const issue = [main || appointment.vehicleIssues?.map((v) => v.name).filter(Boolean).join(', '), topic].filter(Boolean).join(' · ');
    const kind = appointment.assistanceType ?? appointment.type;
    const kindKey = kind === 'immediate' ? 'immediate' : kind === 'videocall' ? 'videocall' : kind === 'scheduled' ? 'scheduled' : null;

    const submit = async () => {
        if (!rating || sending) return;
        setSending(true);
        try {
            if (role === 'user') await reviewDAO.submit(appointment.id, rating, comment.trim() || undefined, tags);
            else await onSiteDAO.reviewClient(appointment.id, rating, comment.trim() || undefined, tags);
            setDone(true);
            // A moment to read "Thanks", then it moves on to the next one.
            setTimeout(() => onSent(appointment.id), 700);
        } catch (e) {
            // "Already rated" means it is saved.
            if (e instanceof ApiError && e.statusCode === 409 && /already/i.test(e.apiMessage ?? '')) {
                setDone(true);
                setTimeout(() => onSent(appointment.id), 500);
            } else {
                appAlert(t(`${K}.errorTitle`), t(`${K}.errorMessage`));
            }
        } finally {
            setSending(false);
        }
    };

    const pill = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 100, maxWidth: '100%' as const };
    return (
        <View
            style={{ width, borderRadius: 20, padding: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF2FA', shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 3 }}
            testID={`rating-card-${appointment.id}`}
        >
            <View className="flex-row items-center" style={{ gap: 10 }}>
                <View className="items-center justify-center overflow-hidden" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: OS.blueSoft }}>
                    {person.photo ? (
                        <Image source={{ uri: person.photo }} style={{ width: 44, height: 44 }} />
                    ) : person.initials ? (
                        <Text className="font-outfit-bold" style={{ fontSize: 16, color: OS.blue }}>{person.initials}</Text>
                    ) : (
                        <Ionicons name="person" size={20} color={OS.blue} />
                    )}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                    <View className="flex-row items-center" style={{ gap: 5 }}>
                        <Text className="font-outfit-bold" style={{ fontSize: 17, lineHeight: 22, letterSpacing: -0.3, color: OS.text, flexShrink: 1 }} numberOfLines={1}>
                            {person.name ?? t(`${K}.${role === 'user' ? 'yourTechnician' : 'yourCustomer'}`)}
                        </Text>
                        {person.idVerified ? <Ionicons name="checkmark-circle" size={16} color={OS.greenDark} accessibilityLabel={t('requestAssistance.mechanicFound.badgeIdVerified')} /> : null}
                        {person.aseCertified ? <Ionicons name="ribbon" size={16} color={OS.blue} accessibilityLabel={t('requestAssistance.mechanicFound.badgeAse')} /> : null}
                    </View>
                    {person.rating != null ? (
                        <View className="flex-row items-center" style={{ gap: 5 }}>
                            <Stars rating={person.rating} size={12} />
                            <Text className="font-outfit-semibold" style={{ fontSize: 12.5, color: OS.muted }}>
                                {t('appointments.list.card.ratingValue', { rating: person.rating.toFixed(1), count: person.ratingCount })}
                            </Text>
                        </View>
                    ) : null}
                </View>
                {date ? (
                    <View style={{ ...pill, backgroundColor: OS.blueSoft, alignSelf: 'flex-start' }}>
                        <Ionicons name="calendar-outline" size={13} color={OS.blue} />
                        <Text className="font-outfit-bold" style={{ fontSize: 12, color: OS.blue }}>{date}</Text>
                    </View>
                ) : null}
            </View>
            {/* What it was about: the kind of assistance, the vehicle and the issue. */}
            <View className="flex-row flex-wrap" style={{ gap: 6, marginTop: 10 }}>
                {kindKey ? (
                    <View style={{ ...pill, backgroundColor: OS.blueSoft }}>
                        <Ionicons name={kindKey === 'videocall' ? 'videocam-outline' : kindKey === 'scheduled' ? 'calendar-outline' : 'flash-outline'} size={13} color={OS.blue} />
                        <Text className="font-outfit-semibold" style={{ fontSize: 12, color: OS.blue, flexShrink: 1 }} numberOfLines={1}>{t(`appointments.detail.types.${kindKey}`)}</Text>
                    </View>
                ) : null}
                {appointment.car ? (
                    <View style={{ ...pill, backgroundColor: '#E9EEF8' }}>
                        <Ionicons name="car-outline" size={13} color={OS.muted} />
                        <Text className="font-outfit-semibold" style={{ fontSize: 12, color: OS.text, flexShrink: 1 }} numberOfLines={1}>{appointment.car}</Text>
                    </View>
                ) : null}
                {issue ? (
                    <View style={{ ...pill, backgroundColor: OS.orangeSoft }}>
                        <Ionicons name="construct-outline" size={13} color={OS.orangeText} />
                        <Text className="font-outfit-semibold" style={{ fontSize: 12, color: OS.orangeText, flexShrink: 1 }} numberOfLines={1}>{issue}</Text>
                    </View>
                ) : null}
            </View>

            {done ? (
                <View className="flex-row items-center justify-center" style={{ gap: 8, marginTop: 14, paddingVertical: 20, borderRadius: 16, backgroundColor: OS.greenSoft }}>
                    <Ionicons name="checkmark-circle" size={22} color={OS.green} />
                    <Text className="font-outfit-bold" style={{ fontSize: 16, color: OS.green }}>{t(`${K}.thanks`)}</Text>
                </View>
            ) : (
                <>
                    <View style={{ marginTop: 12 }}>
                        <RatingFields
                            compact
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
                    <View style={{ gap: 8, marginTop: 14 }}>
                        <TouchableOpacity
                            onPress={() => void submit()}
                            disabled={!rating || sending}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            className="items-center justify-center"
                            style={{ minHeight: 50, borderRadius: 14, backgroundColor: rating ? OS.blue : OS.blueIce }}
                            testID="rating-send"
                        >
                            {sending ? <ActivityIndicator color="#FFFFFF" /> : <Text className="font-outfit-bold text-white" style={{ fontSize: 17, lineHeight: 23 }}>{t(`${K}.send`)}</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={onSkip}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            className="items-center justify-center"
                            style={{ minHeight: 48, borderRadius: 14, backgroundColor: '#E6EAF2' }}
                            testID="rating-skip"
                        >
                            <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#4A5470' }}>{total > 1 ? t(`${K}.next`) : t(`${K}.later`)}</Text>
                        </TouchableOpacity>
                    </View>
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
    const { t } = useTranslation();
    const { width: screen } = useWindowDimensions();
    // The card is exactly as wide as the room the sheet gives it (measured), so the next one never peeks in at the edge: the dots say there are more.
    const [measured, setMeasured] = React.useState(0);
    const cardWidth = measured || screen - SIDE * 2;
    const scroller = React.useRef<ScrollView>(null);
    const [sentIds, setSentIds] = React.useState<Set<string>>(new Set());
    const [page, setPage] = React.useState(0);
    // The cards of this session stay where they are: a rated one shows its "Thanks" and the sheet slides on to the next, instead of the
    // list refreshing under the user's hands (the caller still refreshes its own data).
    const [list] = React.useState(appointments);

    const goTo = (i: number) => {
        const next = Math.min(Math.max(0, i), Math.max(0, list.length - 1));
        scroller.current?.scrollTo({ x: next * (cardWidth + GAP), animated: true });
        setPage(next);
    };
    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / (cardWidth + GAP)));

    if (list.length === 0) return null;
    return (
        <View testID="pending-ratings" onLayout={(e) => setMeasured(Math.floor(e.nativeEvent.layout.width))}>
            <ScrollView
                ref={scroller}
                horizontal
                pagingEnabled={false}
                snapToInterval={cardWidth + GAP}
                snapToAlignment="start"
                disableIntervalMomentum
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
                        onSent={(id) => {
                            const sent = new Set(sentIds).add(id);
                            setSentIds(sent);
                            onSent();
                            // On to the next card still owed (after this one, else from the start); none left closes the sheet.
                            const next = [...list.keys()].find((n) => n > i && !sent.has(list[n].id)) ?? [...list.keys()].find((n) => !sent.has(list[n].id));
                            if (next === undefined) setTimeout(onClose, 300);
                            else goTo(next);
                        }}
                        onSkip={() => (i < list.length - 1 ? goTo(i + 1) : onClose())}
                    />
                ))}
            </ScrollView>
            {list.length > 1 ? (
                <View className="flex-row items-center justify-center" style={{ gap: 6, marginTop: 12 }}>
                    <Text className="font-outfit-semibold" style={{ ...TYPE.caption, color: OS.muted, marginRight: 4 }}>{t('dashboard.rating.counter', { current: page + 1, total: list.length })}</Text>
                    {list.slice(0, 12).map((a, i) => (
                        <View key={a.id} style={{ width: i === page ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: sentIds.has(a.id) ? OS.green : i === page ? OS.blue : '#D5DCEB' }} />
                    ))}
                </View>
            ) : null}
        </View>
    );
}
