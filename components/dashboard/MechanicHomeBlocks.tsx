import { AttentionCards, type AttentionCardData } from '@/components/dashboard/AttentionCard';
import { LinearGradient } from 'expo-linear-gradient';
import { Award, ChevronDown, ChevronRight, Star, Wallet, Wrench, X, type LucideIcon } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

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
                    <Text className="font-outfit-bold" style={{ fontSize: 13, color: C.blue }}>{badge}</Text>
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
                <TouchableOpacity
                    onPress={onAction}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    accessibilityRole="button"
                    activeOpacity={0.7}
                    className="flex-row items-center"
                    style={{ gap: 2, minHeight: 36, paddingLeft: 14, paddingRight: 8, borderRadius: 100, backgroundColor: C.blueSoft }}
                >
                    <Text className="font-outfit-bold" style={{ fontSize: 14, color: C.blue }}>{actionLabel}</Text>
                    <ChevronRight size={18} color={C.blue} />
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
                    <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 0.6, color: active.fg }}>{liveLabel}</Text>
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
            <Text className="font-outfit-regular" style={{ fontSize: 13, lineHeight: 18, color: C.muted, marginTop: 11 }}>{description}</Text>
        </View>
    );
}

/** A stat tile: icon chip, big number, label; `children` sits under the number (the rating stars). */
function MiniStat({ icon, accent, label, value, sub, children, onPress }: { icon: ReactNode; accent: string; label: string; value: string; sub?: string; children?: ReactNode; onPress?: () => void }) {
    const Wrapper = onPress ? TouchableOpacity : View;
    return (
        <Wrapper
            {...(onPress ? { onPress, activeOpacity: 0.8, accessibilityRole: 'button' as const } : {})}
            className="flex-1 flex-row"
            style={{ ...CARD, padding: 14, gap: 10, minWidth: 0 }}
        >
            <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: `${accent}1F` }}>{icon}</View>
            {/* Label and number share one column, so the number lines up with the label, not with the icon. */}
            <View className="flex-1" style={{ minWidth: 0 }}>
                <Text className="font-outfit-semibold" style={{ fontSize: 14, lineHeight: 20, color: C.muted, marginTop: 7 }} numberOfLines={1}>{label}</Text>
                <View className="flex-row items-baseline" style={{ gap: 6, marginTop: 6 }}>
                    <Text className="font-outfit-bold" style={{ fontSize: value.length > 6 ? 18 : 30, letterSpacing: -0.9, lineHeight: 34, color: value.length > 6 ? C.muted : C.text }} numberOfLines={1}>{value}</Text>
                    {sub ? <Text className="font-outfit-regular" style={{ fontSize: 13, color: C.muted }} numberOfLines={1}>({sub})</Text> : null}
                </View>
                {children}
            </View>
            {onPress ? <ChevronRight size={18} color={C.mutedLight} style={{ alignSelf: 'center' }} /> : null}
        </Wrapper>
    );
}

/** What to say (and do) while nothing has been earned today: a nudge to be ready for the next request. */
export type EarnNudge = {
    /** The status line (first page). Omitted: the strip is only tips. */
    text?: string;
    /** Green and pulsing: the technician is listening for requests right now. */
    live?: boolean;
    /** A one-tap way to get going (e.g. go Available); the pill then reads as a button. */
    cta?: string;
    onPress?: () => void;
    /** Short tips that follow the status line, swiped (or moving on by themselves) inside the same strip. */
    tips?: { key: string; icon: LucideIcon; label: string; text: string; onPress?: () => void; /** "Not now": hides this tip for a few days. */ onDismiss?: () => void }[];
};

/** A pulsing dot: someone is on the lookout. */
function LiveDot() {
    const pulse = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }));
        loop.start();
        return () => loop.stop();
    }, [pulse]);
    return (
        <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={{ position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#4ADE80', opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.6] }) }] }} />
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' }} />
        </View>
    );
}

/**
 * While nothing has been earned today: the status line (go online, or on the lookout) and, after it, a few tips for getting the first
 * job. Same format as the tips of the work screen: one page at a time, swiped or moving on by itself, with dots.
 */
/**
 * A tap, and only a tap, inside a page that swipes. On the first or last page a left/right drag has nowhere to scroll to, so the scroll view
 * lets go of it and the touch ended up as a press on the tip (a swipe opened its link). A finger that moved is not a tap.
 */
function TapPage({ onTap, style, children, testID, className }: { onTap: () => void; style?: object; children: ReactNode; testID?: string; className?: string }) {
    const start = useRef<{ x: number; y: number } | null>(null);
    return (
        <Pressable
            testID={testID}
            className={className}
            accessibilityRole="button"
            onPressIn={(e) => { start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }; }}
            onPress={(e) => {
                const from = start.current;
                if (from && (Math.abs(e.nativeEvent.pageX - from.x) > 8 || Math.abs(e.nativeEvent.pageY - from.y) > 8)) return;
                onTap();
            }}
            style={({ pressed }) => [style, { opacity: pressed ? 0.8 : 1 }]}
        >
            {children}
        </Pressable>
    );
}

export function EarnNudgeStrip({ nudge }: { nudge: EarnNudge }) {
    const tips = nudge.tips ?? [];
    const hasStatus = !!nudge.text;
    const pages = (hasStatus ? 1 : 0) + tips.length;
    const [index, setIndex] = useState(0);
    const [width, setWidth] = useState(0);
    const scroller = useRef<ScrollView>(null);
    const goTo = useCallback((i: number) => scroller.current?.scrollTo({ x: i * width, animated: true }), [width]);
    useEffect(() => {
        if (pages < 2 || width <= 0) return undefined;
        const timer = setInterval(() => {
            const next = (index + 1) % pages;
            goTo(next);
            setIndex(next);
        }, 6000);
        return () => clearInterval(timer);
    }, [index, width, goTo, pages]);
    const onSwipeEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (width > 0) setIndex(Math.max(0, Math.min(pages - 1, Math.round(e.nativeEvent.contentOffset.x / width))));
    };
    const statusRow = (
        <View className="flex-row items-center" style={{ gap: 10, paddingHorizontal: 14, minHeight: 48 }}>
            {nudge.live ? <LiveDot /> : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' }} />}
            <Text className="font-outfit-bold flex-1" style={{ fontSize: 15, lineHeight: 21, color: C.text }}>{nudge.text}</Text>
            {nudge.cta ? (
                <View className="flex-row items-center" style={{ gap: 2 }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 14, color: C.blue }}>{nudge.cta}</Text>
                    <ChevronRight size={16} color={C.blue} />
                </View>
            ) : null}
        </View>
    );
    // After every hook (an early return above them changes the hook count between renders).
    if (pages === 0) return null;
    return (
        <View style={{ paddingTop: 14, paddingBottom: pages > 1 ? 12 : 14, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.borderSoft }} testID="earn-nudge">
            <View onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
                <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onSwipeEnd} scrollEventThrottle={16} bounces={false} scrollEnabled={pages > 1}>
                    {hasStatus ? (
                        <View style={{ width: width || undefined, justifyContent: 'center' }}>
                            {nudge.onPress ? (
                                <TapPage onTap={nudge.onPress} testID="earn-nudge-action">{statusRow}</TapPage>
                            ) : statusRow}
                        </View>
                    ) : null}
                    {tips.map(({ key, icon: Icon, label, text, onPress, onDismiss }) => {
                        const pageStyle = { width: width || undefined, paddingHorizontal: 14, gap: 12, minHeight: 48 };
                        const body = (
                            <>
                                <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: C.blueSoft }}>
                                    <Icon size={20} color={C.blue} />
                                </View>
                                <View className="flex-1" style={{ minWidth: 0 }}>
                                    <Text className="font-outfit-bold uppercase" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 0.8, color: C.blue }}>{label}</Text>
                                    <Text className="font-outfit-semibold" style={{ fontSize: 15, lineHeight: 21, color: C.text }}>{text}</Text>
                                </View>
                                {onPress ? <ChevronRight size={18} color={C.mutedLight} /> : null}
                                {onDismiss ? (
                                    <TouchableOpacity onPress={onDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Not now" testID={`tip-dismiss-${key}`} style={{ position: 'absolute', top: -4, right: 8 }}>
                                        <X size={16} color={C.mutedLight} />
                                    </TouchableOpacity>
                                ) : null}
                            </>
                        );
                        // A tip with a link opens it on a tap only (a swipe never does); one without is just a page.
                        return onPress ? (
                            <TapPage key={key} onTap={onPress} className="flex-row items-center" style={pageStyle}>{body}</TapPage>
                        ) : (
                            <View key={key} className="flex-row items-center" style={pageStyle}>{body}</View>
                        );
                    })}
                </ScrollView>
            </View>
            {pages > 1 ? (
                <View className="flex-row self-center" style={{ gap: 5, marginTop: 10 }}>
                    {Array.from({ length: pages }, (_, i) => (
                        <TouchableOpacity key={i} onPress={() => { setIndex(i); goTo(i); }} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${i + 1} / ${pages}`}>
                            <View style={{ width: i === index ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? C.blue : '#D5DCEB' }} />
                        </TouchableOpacity>
                    ))}
                </View>
            ) : null}
        </View>
    );
}

/** Earned today as a hero amount plus two stat tiles (jobs done, rating). */
export function TodayBlock({
    earnedLabel,
    earned,
    footer,
    jobsLabel,
    jobs,
    ratingLabel,
    rating,
    ratingSub,
    onRatingPress,
}: {
    earnedLabel: string;
    earned: string;
    footer?: ReactNode;
    jobsLabel: string;
    jobs: string;
    ratingLabel: string;
    rating: string;
    ratingSub?: string;
    /** Tapping the rating tile: open the ratings behind it. */
    onRatingPress?: () => void;
}) {
    const stars = Number.parseFloat(rating);
    const hasStars = Number.isFinite(stars);
    return (
        <View style={{ gap: 12 }}>
            <LinearGradient
                colors={['#2F6BFF', '#1E56E3', '#0B2A8E']}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={{ borderRadius: 22, padding: 18, shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 4 }}
            >
                <View className="flex-row" style={{ gap: 12 }}>
                    <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.18)' }}>
                        <Wallet size={20} color="#FFFFFF" />
                    </View>
                    {/* The amount and the payout note sit in the label's column, under it, not under the icon. */}
                    <View className="flex-1" style={{ minWidth: 0 }}>
                        <Text className="font-outfit-semibold" style={{ fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.88)', marginTop: 9 }}>{earnedLabel}</Text>
                        <Text className="font-outfit-bold" style={{ fontSize: 42, letterSpacing: -1.4, lineHeight: 48, color: '#FFFFFF', marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{earned}</Text>
                        {footer ? (
                            <View className="self-start" style={{ marginTop: 10, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)' }}>
                                {footer}
                            </View>
                        ) : null}
                    </View>
                </View>
            </LinearGradient>
            <View className="flex-row" style={{ gap: 12 }}>
                <MiniStat icon={<Wrench size={18} color={C.blue} />} accent={C.blue} label={jobsLabel} value={jobs} />
                <MiniStat icon={<Star size={18} color={C.orange} fill={C.orange} />} accent={C.orange} label={ratingLabel} value={rating} sub={ratingSub} onPress={onRatingPress}>
                    {hasStars ? (
                        <View className="flex-row" style={{ gap: 2, marginTop: 8 }}>
                            {[1, 2, 3, 4, 5].map((n) => (
                                <Star key={n} size={14} color={n <= Math.round(stars) ? C.orange : C.blueIce} fill={n <= Math.round(stars) ? C.orange : 'transparent'} />
                            ))}
                        </View>
                    ) : null}
                </MiniStat>
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
            <Text className="font-outfit-semibold" style={{ fontSize: 13, color: C.muted }}>{label}</Text>
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
                        <Text className={i === todayIdx ? 'font-outfit-bold' : 'font-outfit-semibold'} style={{ fontSize: 13, marginTop: 6, color: i === todayIdx ? C.blue : C.mutedLight }}>
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
        <View className="flex-row" style={{ padding: PAD, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.borderSoft, gap: GAP, width: containerWidth, maxWidth: '100%' }} accessibilityRole="tablist">
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
                        style={{ width: tabWidth, minHeight: 48, borderRadius: 12, backgroundColor: on ? C.blue : 'transparent', gap: 8 }}
                    >
                        <Text className="font-outfit-bold" style={{ fontSize: 15, color: on ? '#FFFFFF' : C.muted }} numberOfLines={1}>{tab.label}</Text>
                        <View className="items-center justify-center rounded-full" style={{ minWidth: 24, height: 24, paddingHorizontal: 7, backgroundColor: on ? 'rgba(255,255,255,0.24)' : tab.alert ? '#E53E3E' : C.blueSoft }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 13, color: on || tab.alert ? '#FFFFFF' : C.blue }}>{tab.count}</Text>
                        </View>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

export type AttentionItem = AttentionCardData & {
    /** A setting to take care of (payouts), not something about the jobs: shown only while nothing about the jobs is waiting. */
    setup?: boolean;
    /** Changes when the alert is a new one (e.g. another count), so a hidden alert can return. */
    signature?: string;
};

/** "Needs your attention": one card per thing the technician should act on; several jobs slide inside their card. */
export function AttentionList({ items, hideLabel, onDismiss, restore }: { items: AttentionItem[]; hideLabel?: string; onDismiss?: (item: AttentionItem) => void; restore?: boolean }) {
    return <AttentionCards items={items} hideLabel={hideLabel} onDismiss={onDismiss ? (a) => onDismiss(a as AttentionItem) : undefined} restore={restore} />;
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
                        <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1.1, color: '#FFFFFF' }}>{badge}</Text>
                    </View>
                    <Text className="font-outfit-bold" style={{ fontSize: 16.5, letterSpacing: -0.3, color: '#FFFFFF' }}>{title}</Text>
                    <Text className="font-outfit-regular" style={{ fontSize: 13, lineHeight: 17, color: 'rgba(255,255,255,0.88)', marginTop: 4 }}>{subtitle}</Text>
                </View>
                <View className="items-center justify-center" style={{ width: 30, height: 30, borderRadius: 12, backgroundColor: '#FFFFFF' }}>
                    <ChevronRight size={16} color={C.blueDark} />
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
}
