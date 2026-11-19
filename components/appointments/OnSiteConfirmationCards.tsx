import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { AO } from '@/components/offer/OfferSections';
import { ConfirmOrDisputeRow, InfoCard } from '@/components/appointments/VideoCallSections';
import type { OnSiteVisit } from '@/lib/dao/OnSiteDAO';

/*
 * On-site close-out with owner confirmation. A visit the mechanic closes as
 * resolved is not charged until the vehicle owner confirms it (or the deadline
 * passes). The owner can say the work was not done; support then charges it or
 * releases it (the appointment ends cancelled, nothing charged).
 */

const K = 'appointments.onSiteConfirm';

/** "Confirms automatically in N h", ticking every minute. Nothing once past or without a deadline. */
function AutoConfirmLine({ deadline }: { deadline: string | null | undefined }) {
    const { t } = useTranslation();
    const [now, setNow] = React.useState(() => Date.now());
    React.useEffect(() => {
        if (!deadline) return;
        const timer = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(timer);
    }, [deadline]);
    const ms = deadline ? new Date(deadline).getTime() - now : NaN;
    if (!Number.isFinite(ms) || ms <= 0) return null;
    const hours = Math.floor(ms / 3_600_000);
    const label = hours >= 1 ? t(`${K}.autoConfirmIn`, { hours }) : t(`${K}.autoConfirmSoon`);
    return (
        <View className="flex-row items-center" style={{ gap: 6, marginTop: 12 }} testID="on-site-auto-confirm">
            <Ionicons name="time-outline" size={14} color={AO.muted} />
            <Text className="font-outfit-medium" style={{ flex: 1, fontSize: 13, color: AO.muted }}>{label}</Text>
        </View>
    );
}

const isCancelled = (status: string | undefined) => status === 'cancelled' || status === 'canceled';

/**
 * Owner of an on-site (not video call) job: confirm or dispute while it awaits
 * confirmation, then the review / no-charge outcome. Renders nothing otherwise.
 */
export function OwnerOnSiteConfirmCard({ status, visit, busy, onConfirm, onDispute }: {
    status: string | undefined;
    visit: OnSiteVisit | null;
    busy: boolean;
    onConfirm: () => void;
    onDispute: () => void;
}) {
    const { t } = useTranslation();
    const k = `${K}.owner`;
    if (status === 'awaiting_confirmation') {
        return (
            <InfoCard icon="help-circle-outline" tone="blue" title={t(`${k}.awaitingTitle`)} body={t(`${k}.awaitingBody`)} testID="owner-on-site-confirm-card">
                <AutoConfirmLine deadline={visit?.confirmDeadline} />
                <ConfirmOrDisputeRow
                    busy={busy}
                    confirmLabel={t(`${k}.confirm`)}
                    disputeLabel={t(`${k}.notDone`)}
                    onConfirm={onConfirm}
                    onDispute={onDispute}
                    testIDPrefix="owner-on-site"
                />
            </InfoCard>
        );
    }
    if (status === 'disputed') {
        return <InfoCard icon="shield-checkmark-outline" tone="orange" title={t(`${k}.disputedTitle`)} body={t(`${k}.disputedBody`)} testID="owner-on-site-disputed" />;
    }
    if (isCancelled(status) && visit?.resolution === 'release') {
        return <InfoCard icon="card-outline" tone="gray" title={t(`${k}.releasedTitle`)} body={t(`${k}.releasedBody`)} testID="owner-on-site-released" />;
    }
    return null;
}

/** Mechanic of an on-site job closed as resolved: waiting for the owner, disputed, or released by support. */
export function MechanicOnSiteConfirmCard({ status, visit }: { status: string | undefined; visit: OnSiteVisit | null }) {
    const { t } = useTranslation();
    const k = `${K}.mechanic`;
    if (status === 'awaiting_confirmation') {
        return (
            <InfoCard icon="hourglass-outline" tone="blue" title={t(`${k}.awaitingTitle`)} body={t(`${k}.awaitingBody`)} testID="mechanic-on-site-awaiting">
                <AutoConfirmLine deadline={visit?.confirmDeadline} />
            </InfoCard>
        );
    }
    if (status === 'disputed') {
        return <InfoCard icon="alert-circle-outline" tone="orange" title={t(`${k}.disputedTitle`)} body={t(`${k}.disputedBody`)} testID="mechanic-on-site-disputed" />;
    }
    if (isCancelled(status) && visit?.resolution === 'release') {
        return <InfoCard icon="card-outline" tone="gray" title={t(`${k}.releasedTitle`)} body={t(`${k}.releasedBody`)} testID="mechanic-on-site-released" />;
    }
    return null;
}
