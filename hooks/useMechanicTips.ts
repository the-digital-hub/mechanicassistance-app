import type { LucideIcon } from 'lucide-react-native';
import { CalendarClock, Camera, Car, Clock, CreditCard, Crown, FileText, MapPin, Medal, Radar, ScanSearch, Send, ShieldCheck, Star, Video, Wrench, Zap } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useVerification } from '@/context/VerificationContext';
import { useMembershipDue } from '@/hooks/useMembershipDue';
import { certificationsDAO } from '@/lib/dao/CertificationsDAO';
import type { UserData } from '@/lib/dao/interfaces';
import { mechanicDocumentsDAO } from '@/lib/dao/MechanicDocumentsDAO';
import { paymentMethodDAO } from '@/lib/dao/PaymentMethodDAO';
import { EMPTY_TIPS_STATE, isHidden, loadTipsState, saveTipsState, withDismissed, withTap, type TipsState } from '@/lib/tips/tipsState';

export type MechanicTip = {
    key: string;
    icon: LucideIcon;
    /** i18n key under the tips of its role (`dashboard.mechanic.nudge.tips` or `dashboard.user.tips`); it holds `label` and `text`. */
    i18n: string;
    /** Where the tip leads when tapped; none for general advice. */
    route?: string;
    /** Values for the text (`count`, or `day`: 0 = Sunday … 6 = Saturday). */
    params?: { count?: number; day?: number; amount?: string };
};

/** The days without a job after which a technician who did work counts as in a lull. */
export const LULL_DAYS = 7;
/** The same for an owner: requests are rarer, so the wait is longer. */
export const OWNER_LULL_DAYS = 30;

/** Never more than this many at once: a few pages, not a manual. */
const MAX_TIPS = 5;

/**
 * Pure part: the tips that apply to THIS technician, in the order that matters most. What they already have is left out (a verified
 * technician is not told to verify), so every tip is something they can still do. General advice only comes when there is no job yet.
 */
export function buildMechanicTips(input: {
    identityApproved: boolean;
    aseVerified: boolean;
    hasHours: boolean;
    hasDocuments: boolean | null;
    hasPhoto: boolean;
    hasCertifications: boolean | null;
    noJobsYet: boolean;
    /** Behaviour (all optional: absent = unknown, nothing is claimed). */
    openRequests?: number;
    hasAnyActivity?: boolean;
    daysSinceLastJob?: number | null;
    /** Weekday (0 = Sunday) on which most of their finished jobs happened. */
    busiestDay?: number | null;
    radiusMiles?: number | null;
    /** The plan's amount while its sign-up is not finished (unpaid); absent or null: nothing to finish. */
    membershipDue?: string | null;
}): MechanicTip[] {
    const tips: MechanicTip[] = [];
    // First: finishing the plan is what completes the sign-up.
    if (input.membershipDue) tips.push({ key: 'membership', icon: Crown, i18n: 'membership', route: '/membership', params: { amount: input.membershipDue } });
    if (!input.identityApproved) tips.push({ key: 'identity', icon: ShieldCheck, i18n: 'identity', route: '/verify-identity' });
    // (Payouts are not here: "Needs your attention" already raises that one as an alert.)
    if (!input.aseVerified) tips.push({ key: 'ase', icon: Medal, i18n: 'ase', route: '/(tabs)/ase' });
    if (!input.hasHours) tips.push({ key: 'hours', icon: Clock, i18n: 'hours', route: '/(tabs)/availability' });
    if (input.hasDocuments === false) tips.push({ key: 'documents', icon: FileText, i18n: 'documents', route: '/(tabs)/legal-documents' });
    if (!input.hasPhoto) tips.push({ key: 'photo', icon: Camera, i18n: 'photo', route: '/(tabs)/personal-info' });
    if (input.hasCertifications === false) tips.push({ key: 'certs', icon: ScanSearch, i18n: 'certs', route: '/(tabs)/other-certifications' });
    // Stage "ready, no jobs yet": the profile is in order and the work has not started — point at the work itself.
    if (input.noJobsYet && !input.hasAnyActivity && (input.openRequests ?? 0) > 0) {
        tips.push({ key: 'first_offer', icon: Send, i18n: 'firstOffer', route: '/(tabs)/assist', params: { count: input.openRequests } });
    }
    // Stage "lull": they did work, but not lately — what brought jobs before, and how to be found by more.
    const inLull = !input.noJobsYet && input.daysSinceLastJob != null && input.daysSinceLastJob >= LULL_DAYS;
    if (inLull) {
        if (input.busiestDay != null) tips.push({ key: 'comeback_day', icon: CalendarClock, i18n: 'comebackDay', params: { day: input.busiestDay } });
        if (input.radiusMiles != null && input.radiusMiles <= 15) tips.push({ key: 'comeback_radius', icon: Radar, i18n: 'comebackRadius', route: '/(tabs)/availability' });
    }
    if (input.noJobsYet) {
        tips.push({ key: 'fast', icon: Zap, i18n: 'fast' });
        tips.push({ key: 'rating', icon: Star, i18n: 'rating' });
    }
    return tips.slice(0, MAX_TIPS);
}

const DAY_MS = 86_400_000;

/** Pure: the weekday (0 = Sunday) on which most of the finished jobs fell; null unless there is a real pattern (3+ jobs, 2+ on that day). */
export function busiestWeekday(completedAt: readonly string[]): number | null {
    if (completedAt.length < 3) return null;
    const counts = new Array<number>(7).fill(0);
    for (const iso of completedAt) {
        const t = Date.parse(iso);
        if (Number.isFinite(t)) counts[new Date(t).getDay()] += 1;
    }
    const best = Math.max(...counts);
    return best >= 2 ? counts.indexOf(best) : null;
}

/** Pure: whole days between `iso` and `now`; null when the date is missing or unreadable. */
export function daysSince(iso: string | null | undefined, now = Date.now()): number | null {
    const t = iso ? Date.parse(iso) : NaN;
    return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / DAY_MS)) : null;
}

/**
 * What the app remembers about this account's tips (dismissed ones stay away a few days) and the two things the strip reports back:
 * a tap on a tip and a dismissal. Counts are kept per tip for later ranking.
 */
function useTipsMemory(userId: string | undefined) {
    const [memory, setMemory] = useState<TipsState>(EMPTY_TIPS_STATE);
    useEffect(() => {
        if (!userId) return undefined;
        let active = true;
        loadTipsState(userId).then((m) => { if (active) setMemory(m); });
        return () => { active = false; };
    }, [userId]);
    const update = useCallback((change: (m: TipsState) => TipsState) => {
        setMemory((m) => {
            const next = change(m);
            if (userId) void saveTipsState(userId, next);
            return next;
        });
    }, [userId]);
    const dismiss = useCallback((key: string) => update((m) => withDismissed(m, key)), [update]);
    const track = useCallback((key: string) => update((m) => withTap(m, key)), [update]);
    return { memory, dismiss, track };
}

type AppointmentLike = { status: string; completedAt?: string; updatedAt?: string; createdAt?: string };

/** The signed-in technician's own tips: what the profile still lacks, then what their stage calls for (see buildMechanicTips). */
export function useMechanicTips(
    user: UserData | null | undefined,
    enabled: boolean,
    behavior: { appointments: readonly AppointmentLike[]; openRequests: number; completedCount: number | null },
) {
    const { isApproved, hasLoaded } = useVerification();
    const { memory, dismiss, track } = useTipsMemory(user?.id);
    const membershipDue = useMembershipDue(user?.id, 'mechanic', enabled);
    const [documents, setDocuments] = useState<boolean | null>(null);
    const [certifications, setCertifications] = useState<boolean | null>(null);
    useFocusEffect(
        useCallback(() => {
            if (!enabled) return undefined;
            let active = true;
            mechanicDocumentsDAO.list().then((l) => { if (active) setDocuments(l.length > 0); }).catch(() => undefined);
            certificationsDAO.list().then((l) => { if (active) setCertifications(l.length > 0); }).catch(() => undefined);
            return () => { active = false; };
        }, [enabled]),
    );
    const { appointments, openRequests, completedCount } = behavior;
    const tips = useMemo(() => {
        if (!enabled || !user || !hasLoaded || completedCount === null) return [];
        const finished = appointments.filter((a) => a.status === 'completed' && (a.completedAt || a.updatedAt));
        const finishedAt = finished.map((a) => (a.completedAt ?? a.updatedAt) as string).sort();
        return buildMechanicTips({
            identityApproved: isApproved,
            aseVerified: user.mechanicDetails?.aseStatus === 'verified',
            hasHours: (user.mechanicAvailabilities?.length ?? 0) > 0,
            hasDocuments: documents,
            hasPhoto: !!user.profileImage,
            hasCertifications: certifications,
            noJobsYet: completedCount === 0,
            openRequests,
            hasAnyActivity: appointments.length > 0,
            daysSinceLastJob: daysSince(finishedAt[finishedAt.length - 1]),
            busiestDay: busiestWeekday(finishedAt),
            radiusMiles: user.mechanicDetails?.serviceRadiusMiles ?? null,
            membershipDue,
        }).filter((t) => !isHidden(memory, t.key));
    }, [enabled, user, hasLoaded, isApproved, documents, certifications, completedCount, appointments, openRequests, memory, membershipDue]);
    return { tips, dismiss, track };
}

/**
 * The owner's equivalent: what is still missing for asking for help without a hitch (a card, a vehicle, an address). Identity is not
 * here: an owner can request assistance without being verified. General advice follows until the first request. `null` = not read yet, nothing is claimed.
 */
export function buildOwnerTips(input: {
    hasCard: boolean | null;
    hasVehicle: boolean | null;
    hasAddress: boolean;
    hasPhoto: boolean;
    noRequestsYet: boolean;
    /** Days since their last finished request (null: none). */
    daysSinceLastRequest?: number | null;
    /** The plan's amount while its sign-up is not finished (unpaid); absent or null: nothing to finish. */
    membershipDue?: string | null;
}): MechanicTip[] {
    const tips: MechanicTip[] = [];
    if (input.membershipDue) tips.push({ key: 'membership', icon: Crown, i18n: 'membership', route: '/membership', params: { amount: input.membershipDue } });
    if (input.hasCard === false) tips.push({ key: 'card', icon: CreditCard, i18n: 'card', route: '/payment-cards' });
    if (input.hasVehicle === false) tips.push({ key: 'vehicle', icon: Car, i18n: 'vehicle', route: '/(tabs)/vehicles' });
    if (!input.hasAddress) tips.push({ key: 'address', icon: MapPin, i18n: 'address', route: '/addresses' });
    if (!input.hasPhoto) tips.push({ key: 'photo', icon: Camera, i18n: 'photo', route: '/(tabs)/personal-info' });
    if (input.noRequestsYet) {
        tips.push({ key: 'describe', icon: FileText, i18n: 'describe' });
        tips.push({ key: 'video', icon: Video, i18n: 'video' });
    }
    // Used it before, not lately: a gentle reminder that a check-up is cheaper than an emergency.
    if (!input.noRequestsYet && input.daysSinceLastRequest != null && input.daysSinceLastRequest >= OWNER_LULL_DAYS) {
        tips.push({ key: 'checkup', icon: Wrench, i18n: 'checkup' });
    }
    return tips.slice(0, MAX_TIPS);
}

/** The signed-in owner's own tips (cards from the server, refreshed on focus; vehicles and requests are passed in, the dashboard has them). */
export function useOwnerTips(
    user: UserData | null | undefined,
    enabled: boolean,
    vehicleCount: number | null,
    appointments: readonly AppointmentLike[],
) {
    const { hasLoaded } = useVerification();
    const { memory, dismiss, track } = useTipsMemory(user?.id);
    const membershipDue = useMembershipDue(user?.id, 'user', enabled);
    const [cards, setCards] = useState<boolean | null>(null);
    useFocusEffect(
        useCallback(() => {
            if (!enabled) return undefined;
            let active = true;
            paymentMethodDAO.list().then((l) => { if (active) setCards(l.length > 0); }).catch(() => undefined);
            return () => { active = false; };
        }, [enabled]),
    );
    const tips = useMemo(() => {
        if (!enabled || !user || !hasLoaded) return [];
        const when = appointments.map((a) => a.completedAt ?? a.updatedAt ?? a.createdAt).filter((x): x is string => !!x).sort();
        return buildOwnerTips({
            hasCard: cards,
            hasVehicle: vehicleCount === null ? null : vehicleCount > 0,
            hasAddress: (user.addresses?.length ?? 0) > 0,
            hasPhoto: !!user.profileImage,
            noRequestsYet: appointments.length === 0,
            daysSinceLastRequest: daysSince(when[when.length - 1]),
            membershipDue,
        }).filter((t) => !isHidden(memory, t.key));
    }, [enabled, user, hasLoaded, cards, vehicleCount, appointments, memory, membershipDue]);
    return { tips, dismiss, track };
}
