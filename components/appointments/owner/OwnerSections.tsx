import { PulseDot } from '@/components/appointments/MechanicArrivalCard';
import { AO, card, IconName, RequestSummaryRows, Stars, SummaryRow } from '@/components/offer/OfferSections';
import { formatEtaTime } from '@/hooks/useAppointmentEta';
import { type VisitStage } from '@/hooks/useOnSiteProgress';
import { formatLocalDateTime } from '@/lib/video/videoCallTime';
import type { AssistanceClientSummary, AssistanceOfferSummary } from '@/lib/dao/interfaces';
import type { LatLng } from '@/lib/maps/polyline';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, LayoutAnimation, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { OwnerRouteMap } from './OwnerRouteMap';
import { type ChatAvailability } from '@/lib/chat/chatAvailability';

/* Owner's "Assistance accepted" screen (Vehicle Owner — Assistance Accepted design). */

const K = 'appointments.ownerAccepted';

type Mechanic = AssistanceOfferSummary['mechanic'];

export type OwnerTab = 'status' | 'checkin' | 'info' | 'obd' | 'mechanic' | 'budget';

/** `title`/`icon`/`color` override the default "Assistance accepted" (a video call reflects its close-out state). */
export function AcceptedHeader({ title, icon = 'checkmark', color = AO.green }: { title?: string; icon?: IconName; color?: string }) {
    const { t } = useTranslation();
    return (
        <View className="flex-row items-center" style={{ gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color, alignItems: 'center', justifyContent: 'center', shadowColor: color, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 4 }}>
                <Ionicons name={icon} size={20} color="#fff" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text className="font-outfit-bold" style={{ fontSize: 22, color: AO.text, letterSpacing: -0.6 }} testID="owner-accepted-title">{title ?? t(`${K}.title`)}</Text>
            </View>
        </View>
    );
}

/**
 * The chat button of the technician / client cards. Greyed means blocked: when the situation does not call for a
 * chat (the job ended, or nobody accepted yet) the button does nothing and the chat cannot be entered.
 */
function ChatButton({ onPress, availability, label, testID }: { onPress: () => void; availability: ChatAvailability; label: string; testID: string }) {
    const off = availability !== 'open';
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={off}
            accessibilityLabel={label}
            accessibilityState={{ disabled: off }}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: off ? '#F1F3F8' : AO.blueSoft, alignItems: 'center', justifyContent: 'center' }}
            testID={testID}
        >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={off ? '#A8B0C2' : AO.blue} />
        </TouchableOpacity>
    );
}

/** The assigned technician, with a chat button: contact goes through the in-app chat, there is no call button. */
export function OwnerMechanicCard({ mechanic, onMessage, chat = 'open' }: { mechanic: Mechanic | null; onMessage: () => void; chat?: ChatAvailability }) {
    const { t } = useTranslation();
    return (
        <View style={[card, { borderRadius: 16, padding: 10, paddingLeft: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }]} testID="owner-mechanic-card">
            {mechanic?.profileImage ? (
                <Image source={{ uri: mechanic.profileImage }} style={{ width: 40, height: 40, borderRadius: 20 }} />
            ) : (
                <LinearGradient colors={['#4A7BFF', AO.blueDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                    {mechanic?.initials ? (
                        <Text className="font-outfit-bold" style={{ color: '#fff', fontSize: 14 }}>{mechanic.initials}</Text>
                    ) : (
                        <Ionicons name="person" size={18} color="#fff" />
                    )}
                </LinearGradient>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 0.8, color: AO.muted }}>{t(`${K}.assignedTechnician`)}</Text>
                <View className="flex-row items-center" style={{ gap: 6, marginTop: 1 }}>
                    <Text className="font-outfit-bold" numberOfLines={1} style={{ fontSize: 15, color: AO.text, letterSpacing: -0.2, flexShrink: 1 }}>
                        {mechanic?.displayName ?? t('requestAssistance.mechanicFound.technicianFallback')}
                    </Text>
                    {mechanic?.avgRating != null && <Stars rating={mechanic.avgRating} />}
                </View>
            </View>
            <ChatButton onPress={onMessage} availability={chat} label={t(`${K}.message`)} testID="owner-message-button" />
        </View>
    );
}

const TABS: { id: OwnerTab; icon: IconName }[] = [
    { id: 'status', icon: 'time-outline' },
    { id: 'checkin', icon: 'qr-code-outline' },
    { id: 'info', icon: 'document-text-outline' },
    { id: 'obd', icon: 'speedometer-outline' },
    { id: 'mechanic', icon: 'construct-outline' },
    { id: 'budget', icon: 'cash-outline' },
];

/**
 * `hideCheckIn`: video calls are remote and have no check-in. `showObd`: only video calls carry
 * the owner's OBD scanner report; `obdDot` flags codes not seen yet. `labels` renames tabs (the
 * mechanic's "mechanic" tab is the client).
 */
export function OwnerTabs({ active, onChange, checkInDot, hideCheckIn = false, showObd = false, obdDot = false, labels }: { active: OwnerTab; onChange: (tab: OwnerTab) => void; checkInDot: boolean; hideCheckIn?: boolean; showObd?: boolean; obdDot?: boolean; labels?: Partial<Record<OwnerTab, string>> }) {
    const { t } = useTranslation();
    return (
        <View className="flex-row" style={{ gap: 4, padding: 4, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: AO.border }}>
            {TABS.filter((tab) => !(hideCheckIn && tab.id === 'checkin') && (showObd || tab.id !== 'obd')).map((tab) => {
                const on = active === tab.id;
                return (
                    <TouchableOpacity
                        key={tab.id}
                        onPress={() => onChange(tab.id)}
                        testID={`tab-button-${tab.id}`}
                        style={{ flex: 1, alignItems: 'center', gap: 4, paddingTop: 9, paddingBottom: 8, borderRadius: 12, backgroundColor: on ? AO.blue : 'transparent', ...(on ? { shadowColor: AO.blue, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 3 } : null) }}
                    >
                        <Ionicons name={tab.icon} size={17} color={on ? '#fff' : AO.muted} />
                        <Text className="font-outfit-bold" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 13, color: on ? '#fff' : AO.muted }}>
                            {labels?.[tab.id] ?? t(`${K}.tabs.${tab.id}`)}
                        </Text>
                        {((tab.id === 'checkin' && checkInDot) || (tab.id === 'obd' && obdDot)) && !on && (
                            <View style={{ position: 'absolute', top: 6, right: '22%', width: 9, height: 9, borderRadius: 5, backgroundColor: AO.red, borderWidth: 2, borderColor: '#fff' }} />
                        )}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

export function CheckInBanner({ onPress }: { onPress: () => void }) {
    const { t } = useTranslation();
    return (
        <TouchableOpacity onPress={onPress} className="flex-row items-center" style={{ gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: AO.blueSofter, borderWidth: 1, borderColor: AO.blueSoft }} testID="owner-checkin-banner">
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="qr-code-outline" size={18} color={AO.blue} />
            </View>
            <Text className="font-outfit-regular" style={{ flex: 1, fontSize: 13, color: AO.text, lineHeight: 17 }}>
                <Text className="font-outfit-bold">{t(`${K}.checkInBannerBold`)}</Text> {t(`${K}.checkInBannerRest`)}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={AO.blue} />
        </TouchableOpacity>
    );
}

function EtaRing({ progress, children }: { progress: number; children: React.ReactNode }) {
    const r = 46;
    const c = 2 * Math.PI * r;
    return (
        <View style={{ width: 108, height: 108 }}>
            <Svg width={108} height={108} viewBox="0 0 108 108">
                <Circle cx={54} cy={54} r={r} stroke={AO.blueSoft} strokeWidth={9} fill="none" />
                <Circle cx={54} cy={54} r={r} stroke={AO.blue} strokeWidth={9} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} transform="rotate(-90 54 54)" />
            </Svg>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
        </View>
    );
}

export function OwnerEtaCard({ status, departed, scheduledFor, minutesAway, etaTime, loading, mechanicName, destination, mechanicCoords, polyline }: {
    status: string;
    /** A scheduled service still days away (ISO): shown as "scheduled for" instead of "getting ready". */
    scheduledFor?: string | null;
    /** The mechanic tapped "Head out". Before that there is no live position or ETA to show. */
    departed: boolean;
    minutesAway: number | null;
    etaTime: string | null;
    loading: boolean;
    mechanicName: string;
    destination: LatLng | null;
    mechanicCoords: LatLng | null;
    polyline: string | null;
}) {
    const { t, i18n } = useTranslation();
    // The ring fills as the mechanic gets closer: measured against the longest ETA seen on this screen.
    const startRef = React.useRef<number | null>(null);
    if (minutesAway !== null && (startRef.current === null || minutesAway > startRef.current)) startRef.current = minutesAway;
    const start = startRef.current;

    // Accepted but not yet headed out: the mechanic is getting ready.
    const upcoming = status === 'accepted' && !departed && !!scheduledFor;
    const preparing = status === 'accepted' && !departed && !upcoming;
    const enRoute = status === 'accepted' && departed;
    const onSite = status === 'started' || status === 'in_progress';
    const progress = preparing || upcoming ? 0.05 : !enRoute ? 1 : minutesAway === null || !start ? 0.05 : Math.min(1, Math.max(0.05, 1 - minutesAway / start));

    const pill = upcoming ? t(`${K}.upcoming`) : preparing ? t(`${K}.preparing`) : enRoute ? t(`${K}.enRoute`) : onSite ? t(`${K}.onSite`) : t(`${K}.done`);
    const live = enRoute || preparing || upcoming;
    const pillColor = live ? AO.blue : AO.greenText;
    const pillBg = live ? AO.blueSoft : AO.greenSoft;

    const headline = upcoming
        ? t(`${K}.upcomingTitle`, { date: formatLocalDateTime(scheduledFor, i18n.language) })
        : preparing
        ? t(`${K}.preparingTitle`, { name: mechanicName })
        : enRoute
        ? loading
            ? t(`${K}.calculating`)
            : minutesAway !== null
                ? t(`${K}.minAway`, { count: minutesAway })
                : t(`${K}.onTheWay`)
        : onSite
            ? t(`${K}.onSiteTitle`)
            : t(`${K}.doneTitle`);

    return (
        <View style={[card, { padding: 16, paddingBottom: 14 }]} testID="owner-eta-card">
            <View className="flex-row items-center" style={{ gap: 16 }}>
                <EtaRing progress={progress}>
                    {enRoute && minutesAway !== null ? (
                        <>
                            <Text className="font-outfit-bold" style={{ fontSize: 26, color: AO.blueDark, letterSpacing: -0.8, lineHeight: 28 }}>{minutesAway}</Text>
                            <Text className="font-outfit-bold" style={{ fontSize: 13, color: AO.muted }}>{t(`${K}.min`)}</Text>
                        </>
                    ) : (
                        <Ionicons name={upcoming ? 'calendar-outline' : live ? 'time-outline' : 'checkmark'} size={30} color={live ? AO.blue : AO.greenText} />
                    )}
                </EtaRing>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <View className="flex-row items-center self-start" style={{ gap: 6, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 100, backgroundColor: pillBg }}>
                        {enRoute ? <PulseDot color={AO.blue} size={6} /> : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: pillColor }} />}
                        <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1, color: pillColor }}>{pill}</Text>
                    </View>
                    <Text className="font-outfit-bold" style={{ fontSize: 18, color: AO.text, letterSpacing: -0.4, marginTop: 8 }}>{headline}</Text>
                    {upcoming && (
                        <Text className="font-outfit-regular" style={{ fontSize: 13, color: AO.muted, marginTop: 2 }} testID="owner-eta-upcoming">
                            {t(`${K}.upcomingHint`, { name: mechanicName })}
                        </Text>
                    )}
                    {preparing && (
                        <Text className="font-outfit-regular" style={{ fontSize: 13, color: AO.muted, marginTop: 2 }} testID="owner-eta-preparing">
                            {t(`${K}.preparingHint`)}
                        </Text>
                    )}
                    {enRoute && (
                        <Text className="font-outfit-regular" style={{ fontSize: 13, color: AO.muted, marginTop: 2 }}>
                            {t(`${K}.eta`)}{' '}
                            <Text className="font-outfit-bold" style={{ color: AO.blue }}>{etaTime ? formatEtaTime(etaTime) : '--'}</Text>
                        </Text>
                    )}
                </View>
            </View>
            <View style={{ marginTop: 14 }}>
                <OwnerRouteMap destination={destination} mechanic={preparing || upcoming ? null : mechanicCoords} polyline={preparing || upcoming ? null : polyline} />
            </View>
            <View className="flex-row items-center" style={{ gap: 10, marginTop: 10 }}>
                <View className="flex-row items-center" style={{ gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: AO.blue }} />
                    <Text className="font-outfit-regular" style={{ fontSize: 13, color: AO.muted }}>{mechanicName}</Text>
                </View>
                <View style={{ flex: 1, height: 1, backgroundColor: AO.border }} />
                <View className="flex-row items-center" style={{ gap: 4 }}>
                    <Ionicons name="location-outline" size={15} color={AO.red} />
                    <Text className="font-outfit-regular" style={{ fontSize: 13, color: AO.muted }}>{t(`${K}.yourLocation`)}</Text>
                </View>
            </View>
        </View>
    );
}


type TimelineState = 'done' | 'current' | 'pending';

/**
 * The Status tab of an on-site assistance, as a vertical timeline (the same one a video call has): accepted, on the way, check-in,
 * the vehicle being checked, the fix, the close-out. Says what is happening now and what comes next.
 * The server announces head-out, check-in and close; the steps between check-in and close are read from the visit.
 */
export function OwnerVisitTimeline({ status, departed, stage, minutesAway, arrivedAt }: {
    status: string;
    departed: boolean;
    stage: VisitStage;
    minutesAway: number | null;
    arrivedAt?: string | null;
}) {
    const { t, i18n } = useTranslation();
    const P = `${K}.timeline`;
    const onSite = status === 'in_progress' || status === 'started';
    const closing = status === 'awaiting_confirmation' || status === 'disputed';
    const completed = status === 'completed';
    // Index of the step in progress; everything before it is done, everything after is pending. All done once completed.
    const current = completed
        ? 6
        : closing
        ? 5
        : onSite
        ? stage === 'wrapping' ? 5 : stage === 'fixing' ? 4 : 3
        : 1;
    // Once the assistance is over nobody needs the whole path: it stays folded, and opens on tap.
    const [open, setOpen] = React.useState(!completed);
    React.useEffect(() => { setOpen(!completed); }, [completed]);
    const arrivedSub = arrivedAt ? formatLocalDateTime(arrivedAt, i18n.language) : t(`${P}.arrivedSub`);

    const steps: { key: string; title: string; sub: string }[] = [
        { key: 'accepted', title: t(`${P}.accepted`), sub: t(`${P}.acceptedSub`) },
        {
            key: 'route',
            title: t(`${P}.route`),
            sub: current > 1
                ? t(`${P}.routeDone`)
                : departed
                ? minutesAway !== null ? t(`${P}.routeMinAway`, { count: minutesAway }) : t(`${P}.routeOn`)
                : t(`${P}.routeReady`),
        },
        { key: 'arrived', title: t(`${P}.arrived`), sub: current > 2 ? arrivedSub : t(`${P}.arrivedSub`) },
        { key: 'inspecting', title: t(`${P}.inspecting`), sub: current === 3 ? t(`${P}.inspectingNow`) : current > 3 ? t(`${P}.inspectingDone`) : t(`${P}.inspectingLater`) },
        { key: 'fixing', title: t(`${P}.fixing`), sub: current === 4 ? t(`${P}.fixingNow`) : current > 4 ? t(`${P}.fixingDone`) : t(`${P}.fixingLater`) },
        {
            key: 'closing',
            title: t(`${P}.closing`),
            sub: completed ? t(`${P}.closingDone`) : status === 'disputed' ? t(`${P}.closingDisputed`) : closing ? t(`${P}.closingWaiting`) : current === 5 ? t(`${P}.closingNow`) : t(`${P}.closingLater`),
        },
    ];

    return (
        <View style={[card, { padding: 18 }]} testID="owner-visit-timeline">
            <TouchableOpacity
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setOpen((v) => !v); }}
                disabled={!completed}
                activeOpacity={0.7}
                accessibilityRole={completed ? 'button' : 'header'}
                accessibilityState={completed ? { expanded: open } : undefined}
                className="flex-row items-center justify-between"
                style={{ marginBottom: open ? 16 : 0 }}
                testID="owner-visit-timeline-toggle"
            >
                <Text className="font-outfit-bold" style={{ fontSize: 18, lineHeight: 24, color: AO.text }}>{t(`${P}.title`)}</Text>
                {completed ? <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={AO.muted} /> : null}
            </TouchableOpacity>
            {open ? steps.map((step, i) => {
                const last = i === steps.length - 1;
                const state: TimelineState = i < current ? 'done' : i === current ? 'current' : 'pending';
                const done = state === 'done';
                const now = state === 'current';
                return (
                    <View key={step.key} style={{ flexDirection: 'row', gap: 14 }}>
                        <View style={{ alignItems: 'center' }}>
                            <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? '#DDF1E7' : now ? '#DCE6FB' : '#F1F3F8' }}>
                                {done ? (
                                    <Ionicons name="checkmark" size={17} color="#2E9468" />
                                ) : (
                                    <Text className="font-outfit-bold" style={{ fontSize: 14, color: now ? AO.blue : AO.mutedLight }}>{i + 1}</Text>
                                )}
                            </View>
                            {!last ? <View style={{ flex: 1, width: 2, marginVertical: 4, backgroundColor: done ? '#BFE3D0' : '#E6EAF3', minHeight: 20 }} /> : null}
                        </View>
                        <View style={{ flex: 1, paddingBottom: last ? 0 : 18 }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 16, lineHeight: 22, color: state === 'pending' ? AO.mutedLight : AO.text }}>{step.title}</Text>
                            <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: now ? AO.blue : AO.muted }}>{step.sub}</Text>
                        </View>
                    </View>
                );
            }) : null}
        </View>
    );
}

export function OwnerTechnicianPanel({ mechanic }: { mechanic: Mechanic | null }) {
    const { t, i18n } = useTranslation();
    if (!mechanic) return null;

    const firstName = mechanic.displayName?.split(' ')[0] ?? '';
    const specialties = mechanic.specialties ?? [];
    const aseCodes = mechanic.aseCodes ?? [];
    // Other certifications the technician loaded and the Hub verified: "Name · Issuer", one per line.
    const otherCerts = (mechanic.certifications ?? [])
        .map((c) => [c.name?.trim(), c.issuer?.trim()].filter(Boolean).join(' · '))
        .filter(Boolean);
    const memberSince = mechanic.memberSince
        ? new Date(mechanic.memberSince).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })
        : null;

    const rows: (SummaryRow | null)[] = [
        {
            icon: 'star-outline',
            label: t(`${K}.rows.rating`),
            value: (
                <View className="flex-row items-center flex-wrap justify-end" style={{ gap: 6 }}>
                    {mechanic.avgRating != null && <Stars rating={mechanic.avgRating} size={13} />}
                    <Text className="font-outfit-medium" style={{ fontSize: 13, color: AO.muted }}>
                        {mechanic.servicesCount > 0
                            ? t('requestAssistance.mechanicFound.servicesCount', { count: mechanic.servicesCount })
                            : t('requestAssistance.mechanicFound.newOnPlatform')}
                    </Text>
                </View>
            ),
        },
        aseCodes.length > 0 || mechanic.aseCertified
            ? { icon: 'shield-checkmark-outline', label: t(`${K}.rows.certification`), value: aseCodes.length > 0 ? t(`${K}.aseCodes`, { codes: aseCodes.join(', ') }) : t(`${K}.aseCertified`), tone: 'green' }
            : null,
        otherCerts.length > 0 ? { icon: 'ribbon-outline', label: t(`${K}.rows.otherCertifications`), value: otherCerts.join('\n'), tone: 'green' } : null,
        mechanic.yearsExperience ? { icon: 'construct-outline', label: t(`${K}.rows.experience`), value: t(`${K}.years`, { years: mechanic.yearsExperience }) } : null,
        mechanic.idVerified ? { icon: 'shield-checkmark-outline', label: t(`${K}.rows.verified`), value: t(`${K}.idChecked`), tone: 'green' } : null,
        memberSince ? { icon: 'calendar-outline', label: t(`${K}.rows.memberSince`), value: memberSince } : null,
    ];

    return (
        <View style={{ gap: 12 }} testID="owner-technician-panel">
            {(mechanic.about || specialties.length > 0) && (
                <View style={[card, { borderRadius: 16, padding: 14, paddingBottom: 16 }]}>
                    <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 0.8, color: AO.muted }}>
                        {t(`${K}.about`, { name: firstName.toUpperCase() })}
                    </Text>
                    {!!mechanic.about && (
                        <Text className="font-outfit-regular" style={{ fontSize: 13, color: AO.text, lineHeight: 19, marginTop: 6 }}>{mechanic.about}</Text>
                    )}
                    {specialties.length > 0 && (
                        <View className="flex-row flex-wrap" style={{ gap: 6, marginTop: 12 }}>
                            {specialties.map((s) => (
                                <View key={s} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: AO.blueSoft }}>
                                    <Text className="font-outfit-bold" style={{ fontSize: 13, color: AO.blue }}>{s}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            )}
            <RequestSummaryRows rows={rows.filter((r): r is SummaryRow => r !== null)} />
        </View>
    );
}

/** `payment` is the card row's value (`PaymentCardValue`), resolved by the screen; omitted (the mechanic) hides the row. */
export function OwnerBudgetPanel({ total, payment, totalLabel, video, extendedMinutes = 0, extendedAmount, grandTotal, partsNote }: {
    total: string | null;
    payment?: React.ReactNode;
    totalLabel?: string;
    /** A video call has no parts to approve; instead it can carry extra time bought during the call. */
    video?: boolean;
    extendedMinutes?: number;
    /** What the added time is worth, as a 2-decimal string. */
    extendedAmount?: string | null;
    /** The owner's whole bill: the call plus the extra time. Shown last, only when there is extra time to add up. */
    grandTotal?: string | null;
    /** The "Additional parts" row, a rule and not a fact: its text (omitted = the owner's wording) or `null` to leave it out, e.g. once the assistance is over. */
    partsNote?: string | null;
}) {
    const { t } = useTranslation();
    // What adds up (service, extra time) comes first; the total closes it under a line; how it is paid is last.
    const lines: (SummaryRow | null)[] = [
        // With extra time the first row is, by name, the service as it started: the extra time is told apart below it.
        { icon: 'cash-outline', label: totalLabel ?? t(video && extendedMinutes > 0 ? `${K}.rows.initialService` : `${K}.rows.serviceValue`), value: total ? `$${total}` : '—', strong: true },
        video
            ? extendedMinutes > 0
                ? {
                      icon: 'time-outline',
                      // The minutes sit next to the name; the value is what they cost.
                      label: t(`${K}.rows.extendedTimeMinutes`, { minutes: extendedMinutes }),
                      value: extendedAmount ? `$${extendedAmount}` : t(`${K}.extendedTimeValue`, { minutes: extendedMinutes }),
                  }
                : null
            : partsNote === null
                ? null
                : { icon: 'document-text-outline', label: t(`${K}.rows.additionalParts`), value: partsNote ?? t(`${K}.partsOnlyWithApproval`) },
    ];
    const paymentRow: SummaryRow | null = payment !== undefined ? { icon: 'card-outline', label: t(`${K}.rows.payment`), value: payment } : null;
    const shown = lines.filter((r): r is SummaryRow => r !== null);
    if (!grandTotal) {
        return <RequestSummaryRows rows={paymentRow ? [...shown, paymentRow] : shown} />;
    }
    return (
        <View style={[card, { overflow: 'hidden' }]} testID="owner-budget-total-card">
            {shown.map((r) => (
                <View key={r.label} className="flex-row items-center" style={{ gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: AO.borderSoft }}>
                    <Ionicons name={r.icon} size={18} color={AO.muted} />
                    <Text className="font-outfit-medium flex-1" style={{ fontSize: 15, color: AO.muted }}>{r.label}</Text>
                    <Text className="font-outfit-bold" style={{ fontSize: 15, color: AO.text }}>{r.value}</Text>
                </View>
            ))}
            {/* The total: set apart by a line and a tinted band, bigger than the rows above it. */}
            <View
                className="flex-row items-center"
                style={{ gap: 12, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: AO.blueSoft, borderTopWidth: 2, borderTopColor: AO.blue }}
            >
                <Text className="font-outfit-bold flex-1" style={{ fontSize: 17, color: AO.text }}>{t(`${K}.rows.total`)}</Text>
                <Text className="font-outfit-bold" style={{ fontSize: 22, color: AO.blue, letterSpacing: -0.4 }}>{`$${grandTotal}`}</Text>
            </View>
            {paymentRow ? (
                <View className="flex-row items-center" style={{ gap: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
                    <Ionicons name={paymentRow.icon} size={18} color={AO.muted} />
                    <Text className="font-outfit-medium" style={{ fontSize: 15, color: AO.muted }}>{paymentRow.label}</Text>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>{paymentRow.value}</View>
                </View>
            ) : null}
        </View>
    );
}

type Client = AssistanceClientSummary['client'];

type ClientLike = (Partial<Client> & Pick<Client, 'displayName'>) | null;

/**
 * The mechanic's header card for the vehicle owner — the counterpart of `OwnerMechanicCard`,
 * shown above the sub-navbar. Chat only: no call button.
 */
export function MechanicClientCard({ client, onMessage, chat = 'open' }: { client: ClientLike; onMessage: () => void; chat?: ChatAvailability }) {
    const { t } = useTranslation();
    if (!client) return null;
    return (
        <View style={[card, { borderRadius: 16, padding: 10, paddingLeft: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }]} testID="mechanic-client-card">
            {client.profileImage ? (
                <Image source={{ uri: client.profileImage }} style={{ width: 40, height: 40, borderRadius: 20 }} />
            ) : (
                <LinearGradient colors={['#4A7BFF', AO.blueDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                    {client.initials ? (
                        <Text className="font-outfit-bold" style={{ color: '#fff', fontSize: 14 }}>{client.initials}</Text>
                    ) : (
                        <Ionicons name="person" size={18} color="#fff" />
                    )}
                </LinearGradient>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 0.8, color: AO.muted }}>{t('appointments.videoCall.mechanic.clientLabel')}</Text>
                <View className="flex-row items-center" style={{ gap: 6, marginTop: 1 }}>
                    <Text className="font-outfit-bold" numberOfLines={1} style={{ fontSize: 15, color: AO.text, letterSpacing: -0.2, flexShrink: 1 }}>
                        {client.displayName ?? t('appointments.videoCall.mechanic.clientFallback')}
                    </Text>
                    {client.avgRating != null && <Stars rating={client.avgRating} />}
                </View>
            </View>
            <ChatButton onPress={onMessage} availability={chat} label={t(`${K}.message`)} testID="mechanic-client-message" />
        </View>
    );
}

/**
 * The mechanic's view of the vehicle owner — the counterpart of `OwnerTechnicianPanel`.
 * `client` may hold only name/photo (public-profile fallback): the stat rows then stay hidden.
 */
export function ClientInfoPanel({ client }: { client: ClientLike }) {
    const { t, i18n } = useTranslation();
    if (!client) return null;

    const memberSince = client.memberSince
        ? new Date(client.memberSince).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })
        : null;
    const hasStats = client.servicesCount !== undefined;
    const ratingCount = client.ratingCount ?? 0;
    // A client mechanics have rated well, more than once, is a safe job; none yet is simply new.
    const highlyRated = client.avgRating != null && client.avgRating >= 4.5 && ratingCount >= 3;

    const rows: (SummaryRow | null)[] = [
        hasStats
            ? {
                  icon: 'star-outline',
                  label: t(`${K}.rows.rating`),
                  value:
                      client.avgRating != null ? (
                          <View className="flex-row items-center justify-end" style={{ gap: 6 }}>
                              <Text className="font-outfit-bold" style={{ fontSize: 15, color: AO.text }}>{client.avgRating.toFixed(1)}</Text>
                              <Stars rating={client.avgRating} size={13} />
                              <Text className="font-outfit-medium" style={{ fontSize: 13, color: AO.muted }}>({ratingCount})</Text>
                          </View>
                      ) : (
                          t(`${K}.notRatedYet`)
                      ),
              }
            : null,
        hasStats
            ? {
                  icon: 'clipboard-outline',
                  label: t(`${K}.rows.requests`),
                  value: client.servicesCount! > 0 ? t(`${K}.requestsMade`, { count: client.servicesCount }) : t('requestAssistance.mechanicFound.newOnPlatform'),
              }
            : null,
        hasStats && (highlyRated || client.servicesCount === 0)
            ? {
                  icon: highlyRated ? 'ribbon-outline' : 'sparkles-outline',
                  label: t(`${K}.rows.reputation`),
                  value: highlyRated ? t(`${K}.highlyRated`) : t(`${K}.firstRequest`),
                  tone: highlyRated ? 'green' : undefined,
              }
            : null,
        client.idVerified ? { icon: 'shield-checkmark-outline', label: t(`${K}.rows.verified`), value: t(`${K}.idChecked`), tone: 'green' } : null,
        memberSince ? { icon: 'calendar-outline', label: t(`${K}.rows.memberSince`), value: memberSince } : null,
    ];
    const visible = rows.filter((r): r is SummaryRow => r !== null);
    if (visible.length === 0) return null;

    return (
        <View testID="mechanic-client-panel">
            <RequestSummaryRows rows={visible} />
        </View>
    );
}
