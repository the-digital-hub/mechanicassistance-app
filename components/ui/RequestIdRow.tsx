import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Text, TouchableOpacity, View } from 'react-native';

import { CancelRequestLink } from '@/components/appointments/CancelRequestLink';
import { refLabel } from '@/lib/refCode';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

/**
 * The foot of every request card and detail: the request's code on the left, in soft grey, and "Cancel request"
 * on the right, in red. One rule everywhere, so the code is always in the same place for support and the cancel
 * never moves. The row shows only what applies: no code yet, no code; not cancellable, no cancel.
 *
 * Cancel either calls `onCancel` (the caller confirms) or, with `cancelAppointmentId`, runs the standard
 * confirmation and cancel-reason flow itself.
 */
export function RequestIdRow({ id, refCode, onCancel, cancelAppointmentId, scheduled, style }: {
    id: string;
    refCode?: string | null;
    onCancel?: () => void;
    cancelAppointmentId?: string;
    scheduled?: boolean;
    style?: React.ComponentProps<typeof View>['style'];
}) {
    const { t } = useTranslation();
    const [confirming, setConfirming] = useState(false);
    const canCancel = !!onCancel || !!cancelAppointmentId;
    return (
        <View className="flex-row items-center justify-between" style={style} testID="request-id-row">
            <Text style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 0.4, color: '#8C96AE' }} selectable>{refLabel(refCode, id)}</Text>
            {canCancel ? (
                <TouchableOpacity
                    onPress={() => (cancelAppointmentId ? setConfirming(true) : onCancel?.())}
                    hitSlop={10}
                    accessibilityRole="button"
                    testID="request-cancel"
                >
                    <Text className="font-outfit-bold" style={{ fontSize: 13, color: '#E53E3E' }}>{t('appointments.list.card.cancelRequest')}</Text>
                </TouchableOpacity>
            ) : null}
            {cancelAppointmentId ? (
                <CancelRequestLink appointmentId={cancelAppointmentId} scheduled={scheduled} open={confirming} onClose={() => setConfirming(false)} />
            ) : null}
        </View>
    );
}
