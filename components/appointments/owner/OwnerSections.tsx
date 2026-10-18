import { PulseDot } from '@/components/appointments/MechanicArrivalCard';
import { AO, card, IconName, RequestSummaryRows, Stars, SummaryRow } from '@/components/offer/OfferSections';
import { formatEtaTime } from '@/hooks/useAppointmentEta';
import type { AssistanceOfferSummary } from '@/lib/dao/interfaces';
import type { LatLng } from '@/lib/maps/polyline';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { OwnerRouteMap } from './OwnerRouteMap';

/* Owner's "Assistance accepted" screen (Vehicle Owner — Assistance Accepted design). */

const K = 'appointments.ownerAccepted';

type Mechanic = AssistanceOfferSummary['mechanic'];

export type OwnerTab = 'status' | 'checkin' | 'info' | 'mechanic' | 'budget';

/** `title`/`icon`/`color` override the default "Assistance accepted" (a video call reflects its close-out state). */
export function AcceptedHeader({ id, title, icon = 'checkmark', color = AO.green }: { id: string; title?: string; icon?: IconName; color?: string }) {
    const { t } = useTranslation();
    return (
        <View className="flex-row items-center" style={{ gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color, alignItems: 'center', justifyContent: 'center', shadowColor: color, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 4 }}>
                <Ionicons name={icon} size={20} color="#fff" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text className="font-outfit-bold" style={{ fontSize: 22, color: AO.text, letterSpacing: -0.6 }} testID="owner-accepted-title">{title ?? t(`${K}.title`)}</Text>
                <Text style={{ fontSize: 12, color: AO.mutedLight, marginTop: 2, fontFamily: 'Menlo' }}>ID: #{id.slice(0, 8)}</Text>
            </View>
        </View>
    );
}

/** `onCall` omitted (video calls, which get their own "Join video call" button) hides the call button. */
export function OwnerMechanicCard({ mechanic, onMessage, onCall }: { mechanic: Mechanic | null; onMessage: () => void; onCall?: () => void }) {
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
                <Text className="font-outfit-bold" style={{ fontSize: 10.5, letterSpacing: 0.8, color: AO.muted }}>{t(`${K}.assignedTechnician`)}</Text>
                <View className="flex-row items-center" style={{ gap: 6, marginTop: 1 }}>
                    <Text className="font-outfit-bold" numberOfLines={1} style={{ fontSize: 15, color: AO.text, letterSpacing: -0.2, flexShrink: 1 }}>
                        {mechanic?.displayName ?? t('requestAssistance.mechanicFound.technicianFallback')}
                    </Text>
                    {mechanic?.avgRating != null && <Stars rating={mechanic.avgRating} />}
                </View>
            </View>
            <TouchableOpacity onPress={onMessage} accessibilityLabel={t(`${K}.message`)} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: AO.blueSoft, alignItems: 'center', justifyContent: 'center' }} testID="owner-message-button">
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={AO.blue} />
            </TouchableOpacity>
            {onCall && (
                <TouchableOpacity onPress={onCall} accessibilityLabel={t(`${K}.call`)} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: AO.blue, alignItems: 'center', justifyContent: 'center', shadowColor: AO.blue, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 }} testID="owner-call-button">
                    <Ionicons name="call-outline" size={18} color="#fff" />
                </TouchableOpacity>
            )}
        </View>
    );
}

const TABS: { id: OwnerTab; icon: IconName }[] = [
    { id: 'status', icon: 'time-outline' },
    { id: 'checkin', icon: 'qr-code-outline' },
    { id: 'info', icon: 'document-text-outline' },
    { id: 'mechanic', icon: 'construct-outline' },
    { id: 'budget', icon: 'cash-outline' },
];

/** `hideCheckIn`: video calls are remote and have no check-in. */
export function OwnerTabs({ active, onChange, checkInDot, hideCheckIn = false }: { active: OwnerTab; onChange: (tab: OwnerTab) => void; checkInDot: boolean; hideCheckIn?: boolean }) {
    const { t } = useTranslation();
    return (
        <View className="flex-row" style={{ gap: 4, padding: 4, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: AO.border }}>
            {TABS.filter((tab) => !(hideCheckIn && tab.id === 'checkin')).map((tab) => {
                const on = active === tab.id;
                return (
                    <TouchableOpacity
                        key={tab.id}
                        onPress={() => onChange(tab.id)}
                        testID={`tab-button-${tab.id}`}
                        style={{ flex: 1, alignItems: 'center', gap: 4, paddingTop: 9, paddingBottom: 8, borderRadius: 12, backgroundColor: on ? AO.blue : 'transparent', ...(on ? { shadowColor: AO.blue, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 3 } : null) }}
                    >
                        <Ionicons name={tab.icon} size={17} color={on ? '#fff' : AO.muted} />
                        <Text className="font-outfit-bold" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 10.5, color: on ? '#fff' : AO.muted }}>
                            {t(`${K}.tabs.${tab.id}`)}
                        </Text>
                        {tab.id === 'checkin' && checkInDot && !on && (
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
            <Text className="font-outfit-regular" style={{ flex: 1, fontSize: 12.5, color: AO.text, lineHeight: 17 }}>
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

export function OwnerEtaCard({ status, departed, minutesAway, etaTime, loading, mechanicName, destination, mechanicCoords, polyline }: {
    status: string;
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
    const { t } = useTranslation();
    // The ring fills as the mechanic gets closer: measured against the longest ETA seen on this screen.
    const startRef = React.useRef<number | null>(null);
    if (minutesAway !== null && (startRef.current === null || minutesAway > startRef.current)) startRef.current = minutesAway;
    const start = startRef.current;

    // Accepted but not yet headed out: the mechanic is getting ready.
    const preparing = status === 'accepted' && !departed;
    const enRoute = status === 'accepted' && departed;
    const onSite = status === 'started';
    const progress = preparing ? 0.05 : !enRoute ? 1 : minutesAway === null || !start ? 0.05 : Math.min(1, Math.max(0.05, 1 - minutesAway / start));

    const pill = preparing ? t(`${K}.preparing`) : enRoute ? t(`${K}.enRoute`) : onSite ? t(`${K}.onSite`) : t(`${K}.done`);
    const live = enRoute || preparing;
    const pillColor = live ? AO.blue : AO.greenText;
    const pillBg = live ? AO.blueSoft : AO.greenSoft;

    const headline = preparing
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
                            <Text className="font-outfit-bold" style={{ fontSize: 11, color: AO.muted }}>{t(`${K}.min`)}</Text>
                        </>
                    ) : (
                        <Ionicons name={live ? 'time-outline' : 'checkmark'} size={30} color={live ? AO.blue : AO.greenText} />
                    )}
                </EtaRing>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <View className="flex-row items-center self-start" style={{ gap: 6, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 100, backgroundColor: pillBg }}>
                        {enRoute ? <PulseDot color={AO.blue} size={6} /> : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: pillColor }} />}
                        <Text className="font-outfit-bold" style={{ fontSize: 10, letterSpacing: 1, color: pillColor }}>{pill}</Text>
                    </View>
                    <Text className="font-outfit-bold" style={{ fontSize: 19, color: AO.text, letterSpacing: -0.4, marginTop: 8 }}>{headline}</Text>
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
                <OwnerRouteMap destination={destination} mechanic={preparing ? null : mechanicCoords} polyline={preparing ? null : polyline} />
            </View>
            <View className="flex-row items-center" style={{ gap: 10, marginTop: 10 }}>
                <View className="flex-row items-center" style={{ gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: AO.blue }} />
                    <Text className="font-outfit-regular" style={{ fontSize: 12, color: AO.muted }}>{mechanicName}</Text>
                </View>
                <View style={{ flex: 1, height: 1, backgroundColor: AO.border }} />
                <View className="flex-row items-center" style={{ gap: 4 }}>
                    <Ionicons name="location-outline" size={15} color={AO.red} />
                    <Text className="font-outfit-regular" style={{ fontSize: 12, color: AO.muted }}>{t(`${K}.yourLocation`)}</Text>
                </View>
            </View>
        </View>
    );
}

export function OwnerTechnicianPanel({ mechanic }: { mechanic: Mechanic | null }) {
    const { t, i18n } = useTranslation();
    if (!mechanic) return null;

    const firstName = mechanic.displayName?.split(' ')[0] ?? '';
    const specialties = mechanic.specialties ?? [];
    const aseCodes = mechanic.aseCodes ?? [];
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
                    <Text className="font-outfit-medium" style={{ fontSize: 12.5, color: AO.muted }}>
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
        mechanic.yearsExperience ? { icon: 'construct-outline', label: t(`${K}.rows.experience`), value: t(`${K}.years`, { years: mechanic.yearsExperience }) } : null,
        mechanic.idVerified ? { icon: 'shield-checkmark-outline', label: t(`${K}.rows.verified`), value: t(`${K}.idChecked`), tone: 'green' } : null,
        memberSince ? { icon: 'calendar-outline', label: t(`${K}.rows.memberSince`), value: memberSince } : null,
    ];

    return (
        <View style={{ gap: 12 }} testID="owner-technician-panel">
            {(mechanic.about || specialties.length > 0) && (
                <View style={[card, { borderRadius: 16, padding: 14, paddingBottom: 16 }]}>
                    <Text className="font-outfit-bold" style={{ fontSize: 10.5, letterSpacing: 0.8, color: AO.muted }}>
                        {t(`${K}.about`, { name: firstName.toUpperCase() })}
                    </Text>
                    {!!mechanic.about && (
                        <Text className="font-outfit-regular" style={{ fontSize: 13, color: AO.text, lineHeight: 19, marginTop: 6 }}>{mechanic.about}</Text>
                    )}
                    {specialties.length > 0 && (
                        <View className="flex-row flex-wrap" style={{ gap: 6, marginTop: 12 }}>
                            {specialties.map((s) => (
                                <View key={s} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: AO.blueSoft }}>
                                    <Text className="font-outfit-bold" style={{ fontSize: 11.5, color: AO.blue }}>{s}</Text>
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

/** `payment` is the card row's value (`PaymentCardValue`), resolved by the screen. */
export function OwnerBudgetPanel({ total, payment }: { total: string | null; payment: React.ReactNode }) {
    const { t } = useTranslation();
    return (
        <RequestSummaryRows
            rows={[
                { icon: 'cash-outline', label: t(`${K}.rows.serviceValue`), value: total ? `$${total}` : '—', strong: true },
                { icon: 'card-outline', label: t(`${K}.rows.payment`), value: payment },
                { icon: 'document-text-outline', label: t(`${K}.rows.additionalParts`), value: t(`${K}.partsOnlyWithApproval`) },
            ]}
        />
    );
}
