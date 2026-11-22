import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { AO } from '@/components/offer/OfferSections';
import { ConfirmOrDisputeRow, InfoCard } from '@/components/appointments/VideoCallSections';
import { ConfirmCountdown, SubtleCountdown } from '@/components/ui/ConfirmCountdown';
import type { OnSiteVisit } from '@/lib/dao/OnSiteDAO';

/*
 * On-site close-out with owner confirmation. A visit the mechanic closes as
 * resolved is not charged until the vehicle owner confirms it (or the deadline
 * passes). The owner can say the work was not done; support then charges it or
 * releases it (the appointment ends cancelled, nothing charged).
 */

const K = 'appointments.onSiteConfirm';

/**
 * How long is left before the service confirms by itself, in a block of its own: the time left big, ticking every minute, and the
 * date it happens on. Nothing once past or without a deadline.
 */
const URGENT_MS = 3 * 3_600_000;

/**
 * `mode`: the owner can confirm right there, so the automatic confirmation is only a quiet footnote under the buttons until the last 3 hours;
 * then it becomes the orange block above them. The technician, who can only wait, always sees the block.
 */
function AutoConfirmLine({ deadline, who, mode = 'block' }: { deadline: string | null | undefined; who: 'owner' | 'mechanic'; mode?: 'block' | 'quiet' | 'urgent' }) {
    const { t, i18n } = useTranslation();
    const [now, setNow] = React.useState(() => Date.now());
    React.useEffect(() => {
        if (!deadline) return;
        const timer = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(timer);
    }, [deadline]);
    const end = deadline ? new Date(deadline).getTime() : NaN;
    const ms = end - now;
    if (!Number.isFinite(ms) || ms <= 0) return null;
    // A footnote while there is time, the block once it is close: each mode shows in only one of the two moments.
    if (mode === 'quiet' && ms <= URGENT_MS) return null;
    if (mode === 'urgent' && ms > URGENT_MS) return null;
    const when = new Date(end);
    const date = when.toLocaleDateString(i18n.language, { weekday: 'short', month: 'short', day: 'numeric' });
    const time = when.toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' });
    if (mode === 'quiet') {
        return (
            <Text className="font-outfit-regular text-center" style={{ fontSize: 13, lineHeight: 18, color: AO.mutedLight, marginTop: 12 }} testID="on-site-auto-confirm-note">
                {t(`${K}.autoConfirmQuiet`, { date, time })}
            </Text>
        );
    }
    // The technician only waits: a quiet line (what it is, the time left, the date). The owner's last hours keep the panel with blocks.
    if (who === 'mechanic') {
        return <SubtleCountdown deadline={deadline} label={t(`${K}.autoConfirmIn`)} note={(d, tm) => t(`${K}.autoConfirmShort`, { date: d, time: tm })} testID="on-site-auto-confirm" />;
    }
    // The same block as the close-out screen: small blocks for days, hours and minutes.
    return (
        <ConfirmCountdown
            deadline={deadline}
            title={t(`${K}.autoConfirmTitle`)}
            note={(d, tm) => t(`${K}.autoConfirmNote.owner`, { date: d, time: tm })}
            style={{ marginTop: 14 }}
            testID="on-site-auto-confirm"
        />
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
                <AutoConfirmLine deadline={visit?.confirmDeadline} who="owner" mode="urgent" />
                <ConfirmOrDisputeRow
                    busy={busy}
                    confirmLabel={t(`${k}.confirm`)}
                    disputeLabel={t(`${k}.notDone`)}
                    onConfirm={onConfirm}
                    onDispute={onDispute}
                    testIDPrefix="owner-on-site"
                />
                <AutoConfirmLine deadline={visit?.confirmDeadline} who="owner" mode="quiet" />
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
                <AutoConfirmLine deadline={visit?.confirmDeadline} who="mechanic" />
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
