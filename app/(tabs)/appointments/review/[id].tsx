import { Ionicons } from '@expo/vector-icons';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Image, Text, TouchableOpacity, View } from 'react-native';
import { ActionBar, Body, FlowHeader, NoteInput, OS, PrimaryButton, cardShadow } from '@/components/on-site/ui';
import { useAppointments } from '@/context/AppointmentsContext';
import { ApiError } from '@/lib/api/types';
import { reviewDAO } from '@/lib/dao/ReviewDAO';
import { userDAO } from '@/lib/dao/UserDAO';

// The vehicle owner rates the mechanic after the job. Reached from the
// "Rate your mechanic" push the mechanic sends from their close-out screen, or
// from the card on a completed appointment. One review per appointment.

const TAGS = ['on_time', 'professional', 'fair_price', 'clear_explanation', 'friendly'] as const;

export default function OwnerReviewScreen() {
    const { id: rawId } = useGlobalSearchParams();
    const id = Array.isArray(rawId) ? rawId[0] : rawId || '';
    const router = useRouter();
    const { t } = useTranslation();
    const k = 'appointments.ownerReview';
    const { getAppointmentById } = useAppointments();
    const appointment = getAppointmentById(id);

    const [loading, setLoading] = React.useState(true);
    const [alreadyReviewed, setAlreadyReviewed] = React.useState(false);
    const [mechanic, setMechanic] = React.useState<{ name: string; photo?: string } | null>(null);
    const [rating, setRating] = React.useState(0);
    const [tags, setTags] = React.useState<string[]>([]);
    const [comment, setComment] = React.useState('');
    const [sending, setSending] = React.useState(false);
    const [done, setDone] = React.useState(false);

    React.useEffect(() => {
        if (!id) return;
        let cancelled = false;
        reviewDAO
            .get(id)
            .then((r) => !cancelled && setAlreadyReviewed(!!r))
            .catch(() => { /* show the form; submitting will tell */ })
            .finally(() => !cancelled && setLoading(false));
        return () => { cancelled = true; };
    }, [id]);

    React.useEffect(() => {
        if (!appointment?.mechanicId) return;
        let cancelled = false;
        userDAO.getPublicProfile(appointment.mechanicId)
            .then((p) => {
                if (cancelled || !p) return;
                const name = [p.name, p.surname].filter(Boolean).join(' ');
                setMechanic({ name: name || t(`${k}.mechanic`), photo: p.profileImage });
            })
            .catch(() => { /* keep the placeholder */ });
        return () => { cancelled = true; };
    }, [appointment?.mechanicId, t]);

    const toggleTag = (tag: string) => setTags((list) => (list.includes(tag) ? list.filter((x) => x !== tag) : [...list, tag]));

    const submit = async () => {
        setSending(true);
        try {
            await reviewDAO.submit(id, rating, comment.trim() || undefined, tags);
            setDone(true);
        } catch (e) {
            if (e instanceof ApiError && e.statusCode === 409) setAlreadyReviewed(true);
            else Alert.alert(t(`${k}.error`));
        } finally {
            setSending(false);
        }
    };

    const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/appointments'));
    const finished = done || alreadyReviewed;

    return (
        <View className="flex-1" style={{ backgroundColor: OS.page }}>
            <FlowHeader title={t(`${k}.title`)} onBack={close} closeIcon />
            {loading ? (
                <View className="flex-1 items-center justify-center"><ActivityIndicator color={OS.blue} /></View>
            ) : finished ? (
                <>
                    <View className="flex-1 items-center justify-center px-8">
                        <View className="items-center justify-center mb-4" style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: OS.greenSoft }}>
                            <Ionicons name="checkmark" size={30} color={OS.green} />
                        </View>
                        <Text className="font-outfit-bold text-xl text-center" style={{ color: OS.text }}>
                            {done ? t(`${k}.thanks`) : t(`${k}.already`)}
                        </Text>
                    </View>
                    <ActionBar>
                        <PrimaryButton label={t('appointments.detail.goBack')} onPress={close} />
                    </ActionBar>
                </>
            ) : (
                <>
                    <Body>
                        <View className="mx-4 mt-4 items-center px-5 py-6" style={cardShadow}>
                            {mechanic?.photo ? (
                                <Image source={{ uri: mechanic.photo }} style={{ width: 64, height: 64, borderRadius: 32 }} />
                            ) : (
                                <View className="items-center justify-center" style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: OS.blueSoft }}>
                                    <Ionicons name="person" size={28} color={OS.blue} />
                                </View>
                            )}
                            <Text className="font-outfit-bold text-[17px] mt-2.5" style={{ color: OS.text }}>{mechanic?.name ?? t(`${k}.mechanic`)}</Text>
                            <Text className="font-outfit-regular text-[13px] mt-1" style={{ color: OS.muted }}>{t(`${k}.subtitle`)}</Text>
                            <View className="flex-row justify-center gap-2 mt-4">
                                {[1, 2, 3, 4, 5].map((n) => (
                                    <TouchableOpacity key={n} onPress={() => setRating(n)} testID={`owner-review-star-${n}`} className="p-0.5">
                                        <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={36} color={n <= rating ? OS.orange : OS.border} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View className="mx-4 mt-3.5 px-4 py-4" style={cardShadow}>
                            <Text className="font-outfit-bold text-[13px]" style={{ color: OS.text }}>{t(`${k}.tagsTitle`)}</Text>
                            <View className="flex-row flex-wrap gap-2 mt-3">
                                {TAGS.map((tag) => {
                                    const active = tags.includes(tag);
                                    return (
                                        <TouchableOpacity
                                            key={tag}
                                            onPress={() => toggleTag(tag)}
                                            className="px-3 py-2 rounded-full"
                                            style={{ borderWidth: 1.5, borderColor: active ? OS.blue : OS.border, backgroundColor: active ? OS.blueSoft : '#FFFFFF' }}
                                        >
                                            <Text className="font-outfit-bold text-xs" style={{ color: active ? OS.blue : OS.muted }}>{t(`${k}.tags.${tag}`)}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            <NoteInput value={comment} onChangeText={setComment} placeholder={t(`${k}.commentPh`)} rows={3} white />
                        </View>
                    </Body>
                    <ActionBar>
                        <PrimaryButton
                            label={sending ? '…' : t(`${k}.submit`)}
                            onPress={() => void submit()}
                            disabled={!rating || sending}
                            testID="owner-review-submit"
                        />
                    </ActionBar>
                </>
            )}
        </View>
    );
}
