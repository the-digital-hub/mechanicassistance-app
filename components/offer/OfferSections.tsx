import type { AssistanceOfferSummary } from '@/lib/dao/interfaces';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Text, TouchableOpacity, View } from 'react-native';

/** Palette of the owner's offer screen (Vehicle Owner — Accept Offer design). */
export const AO = {
    blue: '#1E56E3',
    blueDark: '#0B2A8E',
    blueSoft: '#EAF1FF',
    blueSofter: '#F4F8FF',
    text: '#0B1530',
    muted: '#6B7490',
    mutedLight: '#8C96AE',
    borderSoft: '#EEF2FA',
    border: '#E4EAF5',
    page: '#F6F8FC',
    red: '#E53E3E',
    orange: '#C26A0A',
    orangeSoft: '#FFF4E5',
    green: '#10B981',
    greenSoft: '#ECFBF3',
    greenBorder: '#C9F0DB',
    greenText: '#0E8A5F',
    star: '#F5A524',
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const card = {
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: AO.borderSoft,
    shadowColor: '#0E2F8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
} as const;

function IconTile({ name, size = 17 }: { name: IconName; size?: number }) {
    return (
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: AO.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={name} size={size} color={AO.blue} />
        </View>
    );
}

/** "Offer held for m:ss" — hidden by the screen when there is no running hold. */
export function OfferHoldPill({ secondsLeft }: { secondsLeft: number }) {
    const { t } = useTranslation();
    const mm = Math.floor(secondsLeft / 60);
    const ss = String(secondsLeft % 60).padStart(2, '0');
    return (
        <View className="flex-row items-center self-start rounded-full" style={{ gap: 6, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: AO.orangeSoft }}>
            <Ionicons name="time-outline" size={13} color={AO.orange} />
            <Text className="font-outfit-bold" style={{ fontSize: 11, color: AO.orange }}>
                {t('requestAssistance.mechanicFound.heldFor', { time: `${mm}:${ss}` })}
            </Text>
        </View>
    );
}

function Stars({ rating, size = 11 }: { rating: number; size?: number }) {
    return (
        <View className="flex-row" style={{ gap: 1.5 }}>
            {[0, 1, 2, 3, 4].map((i) => {
                const name: IconName = rating >= i + 0.75 ? 'star' : rating >= i + 0.25 ? 'star-half' : 'star-outline';
                return <Ionicons key={i} name={name} size={size} color={AO.star} />;
            })}
        </View>
    );
}

function Stat({ icon, label, value, caption, valueColor }: { icon: IconName; label: string; value: string; caption?: string; valueColor: string }) {
    return (
        <View style={{ flex: 1, padding: 12, borderRadius: 14, backgroundColor: AO.blueSofter, borderWidth: 1, borderColor: AO.blueSoft }}>
            <View className="flex-row items-center" style={{ gap: 6 }}>
                <Ionicons name={icon} size={14} color={AO.blue} />
                <Text className="font-outfit-semibold" style={{ fontSize: 11.5, color: AO.muted }}>{label}</Text>
            </View>
            <Text className="font-outfit-bold" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 24, color: valueColor, letterSpacing: -0.6, marginTop: 4 }}>
                {value}
            </Text>
            {!!caption && <Text className="font-outfit-regular" style={{ fontSize: 11.5, color: AO.muted }}>{caption}</Text>}
        </View>
    );
}

export function TechnicianCard({ mechanic, eta, etaCaption, price }: {
    mechanic: AssistanceOfferSummary['mechanic'] | null;
    eta: string;
    etaCaption?: string;
    price: string;
}) {
    const { t } = useTranslation();
    const k = 'requestAssistance.mechanicFound';
    const badges = [
        mechanic?.aseCertified ? t(`${k}.badgeAse`) : null,
        mechanic?.idVerified ? t(`${k}.badgeIdVerified`) : null,
    ].filter(Boolean) as string[];

    return (
        <View style={[card, { padding: 16 }]}>
            <View className="flex-row items-center" style={{ gap: 12 }}>
                <View>
                    {mechanic?.profileImage ? (
                        <Image source={{ uri: mechanic.profileImage }} style={{ width: 52, height: 52, borderRadius: 26 }} />
                    ) : (
                        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: AO.blueDark, alignItems: 'center', justifyContent: 'center' }}>
                            {mechanic?.initials ? (
                                <Text className="font-outfit-bold" style={{ color: '#fff', fontSize: 17 }}>{mechanic.initials}</Text>
                            ) : (
                                <Ionicons name="person" size={22} color="#fff" />
                            )}
                        </View>
                    )}
                    {mechanic?.idVerified && (
                        <View style={{ position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: AO.green, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="checkmark" size={10} color="#fff" />
                        </View>
                    )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 10.5, letterSpacing: 1, color: AO.muted }}>{t(`${k}.yourTechnician`)}</Text>
                    <Text className="font-outfit-bold" numberOfLines={1} style={{ fontSize: 17, color: AO.text, letterSpacing: -0.3, marginTop: 1 }}>
                        {mechanic?.displayName ?? t(`${k}.technicianFallback`)}
                    </Text>
                    <View className="flex-row items-center" style={{ gap: 6, marginTop: 2 }}>
                        {mechanic?.avgRating != null && <Stars rating={mechanic.avgRating} />}
                        <Text className="font-outfit-regular" style={{ fontSize: 11.5, color: AO.muted }}>
                            {mechanic && mechanic.servicesCount > 0
                                ? t(`${k}.servicesCount`, { count: mechanic.servicesCount })
                                : t(`${k}.newOnPlatform`)}
                        </Text>
                    </View>
                </View>
            </View>

            {badges.length > 0 && (
                <View className="flex-row flex-wrap" style={{ gap: 6, marginTop: 12 }}>
                    {badges.map((b) => (
                        <View key={b} className="rounded-full" style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: AO.blueSoft }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 11, color: AO.blue }}>{b}</Text>
                        </View>
                    ))}
                </View>
            )}

            <View className="flex-row" style={{ gap: 10, marginTop: 14 }}>
                <Stat icon="time-outline" label={t(`${k}.estimatedArrival`)} value={eta} caption={etaCaption} valueColor={AO.text} />
                <Stat icon="card-outline" label={t(`${k}.serviceCost`)} value={price} caption={t(`${k}.fixedPrice`)} valueColor={AO.blue} />
            </View>
        </View>
    );
}

export function OfferBreakdown({ included, lines, total }: {
    included: string[];
    lines: { label: string; amount: string }[];
    total: string | null;
}) {
    const { t } = useTranslation();
    const k = 'requestAssistance.mechanicFound';
    const [open, setOpen] = useState(false);
    return (
        <View style={[card, { overflow: 'hidden' }]}>
            <TouchableOpacity onPress={() => setOpen((o) => !o)} className="flex-row items-center" style={{ gap: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
                <IconTile name="document-text-outline" />
                <Text className="font-outfit-bold" style={{ flex: 1, fontSize: 13.5, color: AO.text }}>{t(`${k}.whatsIncluded`)}</Text>
                <Text className="font-outfit-bold" style={{ fontSize: 12, color: AO.blue }}>{open ? t(`${k}.hide`) : t(`${k}.seeBreakdown`)}</Text>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={AO.blue} />
            </TouchableOpacity>
            {open && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: AO.borderSoft }}>
                    <View style={{ gap: 8, paddingTop: 12 }}>
                        {included.map((item) => (
                            <View key={item} className="flex-row items-center" style={{ gap: 8 }}>
                                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: AO.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="checkmark" size={10} color={AO.greenText} />
                                </View>
                                <Text className="font-outfit-regular" style={{ flex: 1, fontSize: 12.5, color: AO.text }}>{item}</Text>
                            </View>
                        ))}
                    </View>
                    {total !== null && (
                        <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: AO.border, gap: 6 }}>
                            {lines.map((l) => (
                                <View key={l.label} className="flex-row justify-between">
                                    <Text className="font-outfit-regular" style={{ fontSize: 12.5, color: AO.muted }}>{l.label}</Text>
                                    <Text className="font-outfit-semibold" style={{ fontSize: 12.5, color: AO.text }}>{l.amount}</Text>
                                </View>
                            ))}
                            <View className="flex-row justify-between" style={{ marginTop: 4 }}>
                                <Text className="font-outfit-bold" style={{ fontSize: 14, color: AO.text }}>{t(`${k}.lineTotal`)}</Text>
                                <Text className="font-outfit-bold" style={{ fontSize: 14, color: AO.text }}>{total}</Text>
                            </View>
                        </View>
                    )}
                    <Text className="font-outfit-regular" style={{ marginTop: 10, fontSize: 11.5, color: AO.muted, lineHeight: 16 }}>
                        {t(`${k}.partsNotIncluded`)}
                    </Text>
                </View>
            )}
        </View>
    );
}

export interface SummaryRow {
    icon: IconName;
    label: string;
    value: React.ReactNode;
}

export function RequestSummaryRows({ rows }: { rows: SummaryRow[] }) {
    return (
        <View style={[card, { overflow: 'hidden' }]}>
            {rows.map((r, i) => (
                <View
                    key={r.label}
                    className="flex-row items-center"
                    style={{ gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: AO.borderSoft }}
                >
                    <IconTile name={r.icon} />
                    <Text className="font-outfit-medium" style={{ width: 80, fontSize: 12, color: AO.muted }}>{r.label}</Text>
                    <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
                        {typeof r.value === 'string' ? (
                            <Text className="font-outfit-bold" style={{ fontSize: 13, color: AO.text, textAlign: 'right', lineHeight: 18 }}>{r.value}</Text>
                        ) : (
                            r.value
                        )}
                    </View>
                </View>
            ))}
        </View>
    );
}

/** PayPal is the only method today; "Change" is shown as in the design but does nothing yet. */
export function PaymentValue() {
    const { t } = useTranslation();
    return (
        <View className="flex-row items-center" style={{ gap: 8 }}>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#003087' }}>
                <Text className="font-outfit-bold" style={{ color: '#fff', fontSize: 11.5 }}>PayPal</Text>
            </View>
            <TouchableOpacity disabled>
                <Text className="font-outfit-bold" style={{ color: AO.blue, fontSize: 12.5 }}>{t('requestAssistance.mechanicFound.change')}</Text>
            </TouchableOpacity>
        </View>
    );
}

export function ProtectionBox() {
    const { t } = useTranslation();
    const k = 'requestAssistance.mechanicFound';
    const items = t(`${k}.protected`, { returnObjects: true }) as string[];
    return (
        <View style={{ borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: AO.greenSoft, borderWidth: 1, borderColor: AO.greenBorder }}>
            <View className="flex-row items-center" style={{ gap: 8 }}>
                <Ionicons name="shield-checkmark-outline" size={17} color={AO.greenText} />
                <Text className="font-outfit-bold" style={{ fontSize: 13, color: AO.greenText }}>{t(`${k}.protectedTitle`)}</Text>
            </View>
            <View style={{ gap: 6, marginTop: 8 }}>
                {items.map((item) => (
                    <View key={item} className="flex-row items-start" style={{ gap: 8 }}>
                        <Ionicons name="checkmark" size={11} color={AO.greenText} style={{ marginTop: 3 }} />
                        <Text className="font-outfit-regular" style={{ flex: 1, fontSize: 12, color: AO.greenText, lineHeight: 17 }}>{item}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}
