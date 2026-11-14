import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

interface CancellationModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
    /** When the mechanic tapped "Head out" (ISO); null/undefined = not on the way yet. */
    departedAt?: string | null;
    /** Free-cancel deadline (ISO) the backend computes as `departedAt` + grace. */
    freeCancelUntil?: string | null;
}

/**
 * Which warning the owner gets:
 * - `notDeparted`: the mechanic has not headed out — a plain cancel.
 * - `free`: they have, but the grace window is still open — free, with the time left.
 * - `review`: past the grace window — the hold is kept and the charge goes to review.
 * - `departed`: headed out but the server sent no deadline (older backend) — the old text.
 */
type CancelStage = 'notDeparted' | 'free' | 'review' | 'departed';

function cancelStage(departedAt: string | null | undefined, freeCancelUntil: string | null | undefined, now: number): CancelStage {
    if (!departedAt) return 'notDeparted';
    const deadline = freeCancelUntil ? new Date(freeCancelUntil).getTime() : NaN;
    if (Number.isNaN(deadline)) return 'departed';
    return now < deadline ? 'free' : 'review';
}

/** "2:05" — minutes and seconds left. */
function formatRemaining(ms: number): string {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function CancellationModal({ visible, onClose, onConfirm, departedAt, freeCancelUntil }: CancellationModalProps) {
    const { t } = useTranslation();
    const [now, setNow] = React.useState(() => Date.now());

    // Tick while the free window is counting down, so the time left (and the
    // switch to the review warning) stays current while the modal is open.
    const counting = visible && !!departedAt && !!freeCancelUntil;
    React.useEffect(() => {
        if (!counting) return;
        setNow(Date.now());
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [counting]);

    const stage = cancelStage(departedAt, freeCancelUntil, now);
    const message =
        stage === 'notDeparted'
            ? t('appointments.cancellationModal.notDeparted')
            : stage === 'free'
                ? t('appointments.cancellationModal.freeWindow', {
                    time: formatRemaining(new Date(freeCancelUntil as string).getTime() - now),
                })
                : stage === 'review'
                    ? t('appointments.cancellationModal.chargeReview')
                    : t('appointments.cancellationModal.message');

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/50 justify-center items-center px-6">
                <View className="bg-white w-full rounded-2xl p-6 items-center">
                    {/* Header with Red X (a warning sign once the charge would go to review) */}
                    <View className="w-16 h-16 rounded-full border-2 border-red-100 items-center justify-center mb-4">
                        <Ionicons name={stage === 'review' ? 'warning-outline' : 'close-outline'} size={32} color="#EF4444" />
                    </View>

                    <Text className="font-outfit-bold text-xl text-gray-900 mb-2">{t('appointments.list.cancelModalTitle')}</Text>
                    <Text
                        className={`text-center font-outfit-regular text-sm mb-6 ${stage === 'review' ? 'text-red-600' : 'text-gray-500'}`}
                        testID={`cancel-modal-${stage}`}
                    >
                        {message}
                    </Text>

                    <View className="flex-row gap-4 w-full">
                        <TouchableOpacity
                            onPress={onClose}
                            className="flex-1 bg-white border border-gray-200 py-3 rounded-lg items-center"
                        >
                            <Text className="font-outfit-bold text-gray-700">{t('appointments.list.no')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={onConfirm}
                            className="flex-1 bg-blue-600 py-3 rounded-lg items-center"
                        >
                            <Text className="font-outfit-bold text-white">{t('appointments.list.yesCancel')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
