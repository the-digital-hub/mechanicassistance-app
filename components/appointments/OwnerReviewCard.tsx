import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { OwnerReviewInline } from '@/components/appointments/OwnerReviewInline';
import { SlideModal } from '@/components/ui/SlideModal';
import { reviewDAO } from '@/lib/dao/ReviewDAO';
import { SHEET } from '@/lib/ui/sheet';

/**
 * "Rate your mechanic" on a completed appointment the customer has not reviewed
 * yet. Opens the review screen; renders nothing otherwise. Re-checks when the
 * screen regains focus, so it disappears right after the review is sent.
 */
export function OwnerReviewCard({ appointmentId, status, enabled = true, onSent, onDismissed }: {
    appointmentId: string;
    status?: string;
    /** False while there is nothing to rate (a call that was not resolved was not charged). */
    enabled?: boolean;
    /** The review was saved. */
    onSent?: () => void;
    /** A moment after "Thanks": the card is gone. */
    onDismissed?: () => void;
}) {
    const { t } = useTranslation();
    const k = 'appointments.ownerReview';
    const [show, setShow] = React.useState(false);
    const [sheet, setSheet] = React.useState(false);

    useFocusEffect(
        React.useCallback(() => {
            if (status !== 'completed' || !enabled) {
                setShow(false);
                return;
            }
            let cancelled = false;
            reviewDAO
                .get(appointmentId)
                .then((r) => !cancelled && setShow(!r))
                .catch(() => !cancelled && setShow(false));
            return () => {
                cancelled = true;
            };
        }, [appointmentId, status, enabled]),
    );

    if (!show) return null;

    return (
        <View
            className="bg-white px-4 py-4"
            style={{
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#EEF2FA',
                shadowColor: '#0E2F8A',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.06,
                shadowRadius: 14,
                elevation: 2,
            }}
            testID="owner-review-card"
        >
            <View className="flex-row items-center gap-2.5">
                <View className="items-center justify-center" style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#FEF4E2' }}>
                    <Ionicons name="star-outline" size={19} color="#F08A1C" />
                </View>
                <View className="flex-1">
                    <Text className="font-outfit-bold text-[15px]" style={{ color: '#0B1530' }}>{t(`${k}.cardTitle`)}</Text>
                    <Text className="font-outfit-regular text-[13px] mt-0.5" style={{ color: '#6B7490' }}>{t(`${k}.cardBody`)}</Text>
                </View>
            </View>
            <TouchableOpacity
                onPress={() => setSheet(true)}
                activeOpacity={0.85}
                className="items-center py-3 mt-3.5"
                style={{ borderRadius: 13, backgroundColor: '#1E56E3' }}
            >
                <Text className="text-white font-outfit-bold text-sm">{t(`${k}.cardButton`)}</Text>
            </TouchableOpacity>

            {/* The review opens from below, over the appointment, and the card goes away once it is sent. */}
            <SlideModal visible={sheet} onClose={() => setSheet(false)} avoidKeyboard>
                <View style={{ ...SHEET, maxHeight: '90%', paddingTop: 16 }} testID="owner-review-sheet">
                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
                        <OwnerReviewInline
                            appointmentId={appointmentId}
                            onSent={() => onSent?.()}
                            onDismissed={() => { setSheet(false); setShow(false); onDismissed?.(); }}
                        />
                    </ScrollView>
                </View>
            </SlideModal>
        </View>
    );
}
