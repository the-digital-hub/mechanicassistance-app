import { LinearGradient } from 'expo-linear-gradient';
import { Award, ChevronDown, ChevronRight, Star, Wrench, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import type { MechanicStatus } from '@/lib/dao/interfaces';

/** Building blocks of the technician home, following the Mechanic Home design. */
const C = {
    blue: '#1E56E3',
    blueDark: '#0B2A8E',
    blueSoft: '#EAF1FF',
    blueSofter: '#F4F8FF',
    blueIce: '#DCE7FA',
    text: '#0B1530',
    muted: '#6B7490',
    mutedLight: '#8C96AE',
    borderSoft: '#EEF2FA',
    orange: '#F08A1C',
    green: '#10B981',
};

const CARD = {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.borderSoft,
    shadowColor: '#0E2F8A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
} as const;

export function SectionTitle({
    title,
    actionLabel,
    onAction,
    badge,
    collapsed,
    onToggle,
}: {
    title: string;
    actionLabel?: string;
    onAction?: () => void;
    badge?: number;
    /** With `onToggle`, the whole title row collapses/expands the section. */
    collapsed?: boolean;
    onToggle?: () => void;
}) {
    const heading = (
        <View className="flex-row items-center" style={{ gap: 8 }}>
            <Text className="font-outfit-bold" style={{ fontSize: 18, letterSpacing: -0.3, color: C.text }}>{title}</Text>
            {badge != null && badge > 0 && (
                <View className="items-center justify-center rounded-full" style={{ minWidth: 20, height: 20, paddingHorizontal: 6, backgroundColor: C.blueSoft }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 11, color: C.blue }}>{badge}</Text>
                </View>
            )}
            {onToggle ? (collapsed ? <ChevronRight size={18} color={C.mutedLight} /> : <ChevronDown size={18} color={C.mutedLight} />) : null}
        </View>
    );
    return (
        <View className="flex-row items-center justify-between" style={{ marginBottom: collapsed ? 0 : 12 }}>
            {onToggle ? (
                <TouchableOpacity onPress={onToggle} activeOpacity={0.7} hitSlop={8} accessibilityRole="button" accessibilityState={{ expanded: !collapsed }} style={{ flex: 1 }}>
                    {heading}
                </TouchableOpacity>
            ) : heading}
            {actionLabel && onAction && (
                <TouchableOpacity onPress={onAction} hitSlop={8} accessibilityRole="button">
                    <Text className="font-outfit-semibold" style={{ fontSize: 13, color: C.blue }}>{actionLabel}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const STATUS_STYLE: Record<MechanicStatus, { dot: string; bg: string; fg: string }> = {
    available: { dot: C.green, bg: '#E6F7EF', fg: '#0F8A55' },
    busy: { dot: C.orange, bg: '#FEF4E2', fg: '#B7791F' },
    offline: { dot: C.mutedLight, bg: '#EEF1F6', fg: '#5C6680' },
};

export function AvailabilityCard({
    title,
    liveLabel,
    status,
    options,
    description,
    disabled,
    onChange,
}: {
    title: string;
    liveLabel: string;
    status: MechanicStatus;
    options: { id: MechanicStatus; label: string }[];
    description: string;
    disabled?: boolean;
    onChange: (next: MechanicStatus) => void;
}) {
    const active = STATUS_STYLE[status];
    return (
        <View style={{ ...CARD, padding: 16 }}>
            <View className="flex-row items-center justify-between mb-3">
                <Text className="font-outfit-bold flex-1 pr-2" style={{ fontSize: 15, color: C.text }}>{title}</Text>
                <View className="flex-row items-center rounded-full" style={{ gap: 6, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: active.bg }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: active.dot }} />
                    <Text className="font-outfit-bold" style={{ fontSize: 10, letterSpacing: 0.6, color: active.fg }}>{liveLabel}</Text>
                </View>
            </View>
            <View className="flex-row" style={{ gap: 6, padding: 4, borderRadius: 14, backgroundColor: C.blueSofter }}>
                {options.map((o) => {
                    const on = o.id === status;
                    const s = STATUS_STYLE[o.id];
                    return (
                        <TouchableOpacity
                            key={o.id}
                            onPress={() => onChange(o.id)}
                            disabled={disabled}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on }}
                            className="flex-1 flex-row items-center justify-center"
                            style={{
                                gap: 6,
                                paddingVertical: 10,
                                borderRadius: 10,
                                backgroundColor: on ? s.bg : 'transparent',
                                borderWidth: on ? 1.5 : 0,
                                borderColor: on ? `${s.fg}33` : 'transparent',
                            }}
                        >
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.dot }} />
                            <Text className={on ? 'font-outfit-bold' : 'font-outfit-semibold'} style={{ fontSize: 13, color: on ? s.fg : C.muted }}>{o.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
            <Text className="font-outfit-regular" style={{ fontSize: 12.5, lineHeight: 18, color: C.muted, marginTop: 11 }}>{description}</Text>
        </View>
    );
}

function MiniStat({ icon, accent, label, value, sub }: { icon: ReactNode; accent: string; label: string; value: string; sub?: string }) {
    return (
        <View className="flex-1 flex-row" style={{ ...CARD, padding: 14, gap: 10, minWidth: 0 }}>
            <View className="items-center justify-center" style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: `${accent}22` }}>{icon}</View>
            <View className="flex-1" style={{ minWidth: 0 }}>
                <Text className="font-outfit-semibold" style={{ fontSize: 12, color: C.muted }} numberOfLines={1}>{label}</Text>
                <Text className="font-outfit-bold" style={{ fontSize: 24, letterSpacing: -0.6, color: C.text, marginTop: 4 }} numberOfLines={1}>{value}</Text>
                {sub ? <Text className="font-outfit-regular" style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }} numberOfLines={1}>{sub}</Text> : null}
            </View>
        </View>
    );
}

/** Earned today as a hero amount plus two mini stats (jobs done, rating). */
export function TodayBlock({
    earnedLabel,
    earned,
    footer,
    jobsLabel,
    jobs,
    ratingLabel,
    rating,
    ratingSub,
}: {
    earnedLabel: string;
    earned: string;
    footer?: ReactNode;
    jobsLabel: string;
    jobs: string;
    ratingLabel: string;
    rating: string;
    ratingSub?: string;
}) {
    return (
        <View style={{ gap: 12 }}>
            <View style={{ ...CARD, padding: 16 }}>
                <Text className="font-outfit-semibold" style={{ fontSize: 12, color: C.muted }}>{earnedLabel}</Text>
                <Text className="font-outfit-bold" style={{ fontSize: 34, letterSpacing: -1, color: C.text, marginTop: 8 }} numberOfLines={1}>{earned}</Text>
                {footer ? <View style={{ marginTop: 8 }}>{footer}</View> : null}
            </View>
            <View className="flex-row" style={{ gap: 12 }}>
                <MiniStat icon={<Wrench size={16} color={C.blue} />} accent={C.blue} label={jobsLabel} value={jobs} />
                <MiniStat icon={<Star size={16} color={C.orange} />} accent={C.orange} label={ratingLabel} value={rating} sub={ratingSub} />
            </View>
        </View>
    );
}

/** This week's net earnings per day (Monday first). */
export function WeeklyEarnings({
    label,
    total,
    days,
    todayIdx,
    dayLabels,
    footerLabel,
    footerValue,
}: {
    label: string;
    total: string;
    days: number[];
    todayIdx: number;
    dayLabels: string[];
    footerLabel?: string;
    footerValue?: string;
}) {
    const max = Math.max(1, ...days);
    return (
        <View style={{ ...CARD, padding: 16 }}>
            <Text className="font-outfit-semibold" style={{ fontSize: 12, color: C.muted }}>{label}</Text>
            <Text className="font-outfit-bold" style={{ fontSize: 26, letterSpacing: -0.7, color: C.text, marginTop: 4 }} numberOfLines={1}>{total}</Text>
            <View className="flex-row items-end" style={{ gap: 8, height: 84, marginTop: 14 }}>
                {days.map((v, i) => (
                    <View key={i} className="flex-1 items-center justify-end" style={{ height: '100%' }}>
                        <View
                            style={{
                                width: '100%',
                                height: Math.max(4, Math.round((v / max) * 62)),
                                borderRadius: 6,
                                backgroundColor: i === todayIdx ? C.blue : v ? C.blueIce : C.borderSoft,
                            }}
                        />
                        <Text className={i === todayIdx ? 'font-outfit-bold' : 'font-outfit-semibold'} style={{ fontSize: 10.5, marginTop: 6, color: i === todayIdx ? C.blue : C.mutedLight }}>
                            {dayLabels[i]}
                        </Text>
                    </View>
                ))}
            </View>
            {footerLabel && footerValue ? (
                <View className="flex-row justify-between" style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.borderSoft }}>
                    <Text className="font-outfit-regular" style={{ fontSize: 13, color: C.muted }}>{footerLabel}</Text>
                    <Text className="font-outfit-bold" style={{ fontSize: 13, color: C.text }}>{footerValue}</Text>
                </View>
            ) : null}
        </View>
    );
}

/**
 * Immediate / Scheduled / Video segmented control, each with its request count.
 * A tab keeps the width it has when all `slots` are shown, so with fewer tabs the
 * control shrinks instead of stretching them across the screen.
 */
export function RequestTypeTabs<T extends string>({
    tabs,
    selected,
    onSelect,
    slots = 3,
    horizontalInset = 48,
}: {
    /** `alert`: the count stays red while the tab is not selected (it asks for a decision). */
    tabs: { id: T; label: string; count: number; alert?: boolean }[];
    selected: T;
    onSelect: (id: T) => void;
    slots?: number;
    /** Screen width not available to the control (side padding of the screen). */
    horizontalInset?: number;
}) {
    const { width } = useWindowDimensions();
    const PAD = 4;
    const GAP = 4;
    const full = width - horizontalInset;
    const tabWidth = Math.floor((full - PAD * 2 - GAP * (slots - 1)) / slots);
    const containerWidth = tabs.length * tabWidth + (tabs.length - 1) * GAP + PAD * 2;
    return (
        <View className="flex-row" style={{ ...CARD, borderRadius: 16, padding: PAD, gap: GAP, width: containerWidth, maxWidth: '100%' }} accessibilityRole="tablist">
            {tabs.map((tab) => {
                const on = tab.id === selected;
                return (
                    <TouchableOpacity
                        key={tab.id}
                        onPress={() => onSelect(tab.id)}
                        activeOpacity={0.8}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: on }}
                        className="flex-row items-center justify-center"
                        style={{ width: tabWidth, paddingVertical: 9, borderRadius: 12, backgroundColor: on ? C.blue : 'transparent', gap: 6 }}
                    >
                        <Text className="font-outfit-bold" style={{ fontSize: 13, color: on ? '#FFFFFF' : C.muted }} numberOfLines={1}>{tab.label}</Text>
                        <View className="items-center justify-center rounded-full" style={{ minWidth: 18, height: 18, paddingHorizontal: 5, backgroundColor: on ? 'rgba(255,255,255,0.24)' : tab.alert ? '#E53E3E' : C.blueSoft }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 10.5, color: on || tab.alert ? '#FFFFFF' : C.blue }}>{tab.count}</Text>
                        </View>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

export type AttentionItem = {
    id: string;
    tone: 'amber' | 'blue';
    icon: LucideIcon;
    title: string;
    sub: string;
    cta: string;
    /** Changes when the alert is a new one (e.g. another count), so a hidden alert can return. */
    signature?: string;
    onPress: () => void;
};

const TONES = { amber: { bg: '#FFF4E0', fg: '#8A5200' }, blue: { bg: C.blueSoft, fg: C.blue } } as const;

/** "Needs your attention": one tappable row per thing the technician should act on. */
export function AttentionList({ items, hideLabel, onDismiss }: { items: AttentionItem[]; hideLabel?: string; onDismiss?: (item: AttentionItem) => void }) {
    return (
        <View style={{ ...CARD, overflow: 'hidden' }}>
            {items.map((a, i) => {
                const tone = TONES[a.tone];
                const Icon = a.icon;
                return (
                    <TouchableOpacity
                        key={a.id}
                        onPress={a.onPress}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        className="flex-row items-center"
                        style={{ gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: C.borderSoft }}
                    >
                        <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: tone.bg }}>
                            <Icon size={18} color={tone.fg} />
                        </View>
                        <View className="flex-1">
                            <Text className="font-outfit-bold" style={{ fontSize: 14, color: C.text }}>{a.title}</Text>
                            <Text className="font-outfit-regular" style={{ fontSize: 12.5, color: C.muted, marginTop: 2, lineHeight: 17 }}>{a.sub}</Text>
                        </View>
                        <View className="items-end" style={{ gap: 8 }}>
                            <View className="flex-row items-center" style={{ gap: 2 }}>
                                <Text className="font-outfit-bold" style={{ fontSize: 13, color: C.blue }}>{a.cta}</Text>
                                <ChevronRight size={16} color={C.blue} />
                            </View>
                            {onDismiss && hideLabel ? (
                                <TouchableOpacity onPress={() => onDismiss(a)} hitSlop={{ top: 6, bottom: 6, left: 10, right: 6 }} accessibilityRole="button">
                                    <Text className="font-outfit-semibold" style={{ fontSize: 12, color: C.mutedLight }}>{hideLabel}</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

/** Blue card inviting the technician to add an ASE certification. */
export function AseCta({ badge, title, subtitle, onPress }: { badge: string; title: string; subtitle: string; onPress: () => void }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.9}
            accessibilityRole="button"
            style={{ borderRadius: 22, shadowColor: C.blue, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6, backgroundColor: C.blue }}
        >
            <LinearGradient colors={['#2F6BFF', '#1E56E3', '#0B2A8E', '#061A66']} locations={[0, 0.38, 0.8, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View className="items-center justify-center" style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' }}>
                    <Award size={28} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                    <View className="flex-row items-center self-start rounded-full" style={{ gap: 5, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', marginBottom: 6 }}>
                        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#4ADE80' }} />
                        <Text className="font-outfit-bold" style={{ fontSize: 9.5, letterSpacing: 1.1, color: '#FFFFFF' }}>{badge}</Text>
                    </View>
                    <Text className="font-outfit-bold" style={{ fontSize: 16.5, letterSpacing: -0.3, color: '#FFFFFF' }}>{title}</Text>
                    <Text className="font-outfit-regular" style={{ fontSize: 12.5, lineHeight: 17, color: 'rgba(255,255,255,0.88)', marginTop: 4 }}>{subtitle}</Text>
                </View>
                <View className="items-center justify-center" style={{ width: 30, height: 30, borderRadius: 12, backgroundColor: '#FFFFFF' }}>
                    <ChevronRight size={16} color={C.blueDark} />
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
}
