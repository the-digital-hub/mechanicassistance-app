import { HelpCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { type Appointment, useAppointments } from '@/context/AppointmentsContext';
import { useUser } from '@/context/UserContext';
import { useAvailableToOffer } from '@/hooks/useAvailableToOffer';
import { useVerifiedAction } from '@/hooks/useVerifiedAction';
import { ApiError } from '@/lib/api/types';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import type { AssistanceRequest } from '@/lib/dao/interfaces';
import { appAlert } from '@/lib/ui/appAlert';

/**
 * Offering on an immediate request straight from its card in the dashboard: the card already shows everything the technician needs
 * (vehicle, price, zone, distance, ETA), so "Send offer" goes through the same checks as the detail screen (verified identity,
 * available, still open) and one short confirmation, and sends. Returns the starter and the confirmation to render.
 */
export function useOfferFromCard() {
    const { t } = useTranslation();
    const router = useRouter();
    const { user } = useUser();
    const { markOffered } = useAppointments();
    const gate = useVerifiedAction();
    const ensureAvailable = useAvailableToOffer();
    const [pending, setPending] = useState<{ request: AssistanceRequest; eta: string | null } | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const warnTaken = () =>
        appAlert(t('requestDetail.takenTitle'), t('requestDetail.takenMessage'), [{ text: t('requestDetail.takenOk') }], { tone: 'warning', icon: 'people-outline' });

    /** False (with the notice) once someone else has the request. A bad connection does not count as taken. */
    const stillOpen = async (id: string): Promise<boolean> => {
        try {
            const current = await assistanceDAO.getById(id);
            if (!current?.status) return true;
            const open = current.status === 'pending' || current.status === 'offered';
            const mine = !!current.mechanicId && current.mechanicId === user?.id;
            if (!open && !mine) {
                warnTaken();
                return false;
            }
            return true;
        } catch (err) {
            if (err instanceof ApiError && [403, 404, 409].includes(err.statusCode)) {
                warnTaken();
                return false;
            }
            return true;
        }
    };

    const startOffer = gate('offer', async (request: AssistanceRequest, eta: string | null) => {
        if (!(await ensureAvailable())) return;
        if (!(await stillOpen(request.id))) return;
        setPending({ request, eta });
    });

    const confirm = async () => {
        if (!pending || submitting || !user?.id) return;
        const { request, eta } = pending;
        setSubmitting(true);
        try {
            await assistanceDAO.updateStatus(request.id, user.id, 'offered', eta ? { eta } : undefined);
            setPending(null);
            // Under Pending at once: Appointments reloads from the server on focus, which takes a few round trips.
            markOffered({
                id: request.id,
                type: (request.type ?? 'immediate') as Appointment['type'],
                assistanceType: request.assistanceType,
                title: request.title ?? '',
                date: String(request.date ?? ''),
                time: eta || 'Pending',
                car: request.car ?? '',
                address: request.address ?? '',
                notes: request.notes,
                budget: request.budget ?? '',
                status: 'offered',
                zip: request.zip,
                mechanicId: user.id,
                eta: eta || undefined,
                locationLat: request.locationLat,
                locationLng: request.locationLng,
            });
            router.push({ pathname: '/(tabs)/appointments', params: { tab: 'pending' } } as never);
        } catch (error) {
            setPending(null);
            if (error instanceof ApiError && [403, 404, 409].includes(error.statusCode) && !(await stillOpen(request.id))) return;
            appAlert(t('requestDetail.acceptFailed', { error: error instanceof Error ? error.message : 'Unknown error' }));
        } finally {
            setSubmitting(false);
        }
    };

    const offerDialog = (
        <ConfirmationModal
            visible={pending !== null}
            onClose={() => setPending(null)}
            onConfirm={confirm}
            icon={HelpCircle}
            iconColor="#1E56E3"
            confirmTone="success"
            title={t('requestDetail.confirmOfferTitle')}
            message={t('requestDetail.confirmOfferPending')}
            highlight={{ label: t('requestDetail.offerHighlight.immediate'), value: String(pending?.request.title ?? ''), icon: 'flash-outline' }}
            confirmText={submitting ? t('requestDetail.sendingOffer') : t('requestDetail.confirmOffer')}
            cancelText={t('requestDetail.cancel')}
        />
    );

    return { startOffer, offerDialog };
}
