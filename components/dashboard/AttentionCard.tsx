import { ChevronRight, X, type LucideIcon } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { AttentionQuickButton, AttentionTimer, attentionCardStyle, type AttentionQuick, type AttentionTimerSpec } from '@/components/dashboard/AttentionExtras';

/**
 * The card of one "Needs your attention" alert, the same for both roles: a header (icon, what it is, how many, and a small way to hide it),
 * the body, and one action. Several jobs live in a slider inside the card (one page per job, with dots), instead of "the first one, and
 * +N more". Nothing else: no kind badge, no icon in front of every line, no second button beside the main one.
 */

/** One job inside an alert: what it is (bold), the vehicle under it, and the time left for that job if it has one. */
export type AttentionSlide = {
    id: string;
    title: string;
    sub?: string;
    timer?: AttentionTimerSpec;
    /** Opens this job; without it the card's own action runs. */
    onPress?: () => void;
};

export type AttentionCardData = {
    id: string;
    tone: 'amber' | 'blue';
    icon: LucideIcon;
    title: string;
    /** A number next to the title (how many there are). */
    count?: number;
    /** The body when there are no jobs to slide through. */
    sub?: string;
    cta: string;
    slides?: AttentionSlide[];
    /** The time left, when the alert is not about separate jobs. */
    timer?: AttentionTimerSpec;
    quick?: AttentionQuick;
    onPress: () => void;
};

const TONES = { amber: { bg: '#FCE8BD', fg: '#8A5200', soft: '#FFFAF0' }, blue: { bg: '#DCE7FA', fg: '#1E56E3', soft: '#F5F8FE' } } as const;
const INK = { text: '#0B1530', muted: '#6B7490' };
/** How much text still fits beside the action pill (characters); beyond it the pill goes under the text. */
const STACK_TITLE = 30;
const STACK_SUB = 32;
const STACK_BODY = 36;

/** The one action of an alert, small, at the end of the line of what it is about: the line itself is the button, the pill says what it does. */
function ActionPill({ label, tone, stacked }: { label: string; tone: { bg: string; fg: string; soft: string }; /** Under the text, at its end, instead of beside it. */ stacked?: boolean }) {
    return (
        // Almost the white of the row it sits in, with a thin line of the tone: it still reads as a button without a third block of colour.
        <View className="flex-row items-center" style={{ gap: 1, minHeight: 34, paddingLeft: 12, paddingRight: 6, borderRadius: 100, backgroundColor: tone.soft, borderWidth: 1, borderColor: tone.bg, ...(stacked ? { alignSelf: 'flex-end' } : null) }} testID="attention-cta">
            <Text className="font-outfit-bold" style={{ fontSize: 14, color: tone.fg }}>{label}</Text>
            <ChevronRight size={16} color={tone.fg} />
        </View>
    );
}

export function AttentionCard({ item, dismissLabel, onDismiss, restore }: {
    item: AttentionCardData;
    /** What hiding (or bringing back) is called, for the screen reader and, when bringing back, the pill. */
    dismissLabel?: string;
    onDismiss?: () => void;
    /** In the list of hidden alerts: a "Show again" pill instead of the X. */
    restore?: boolean;
}) {
    const tone = TONES[item.tone];
    const Icon = item.icon;
    const slides = item.slides ?? [];
    // Short text leaves room for the action beside it; long text gets the whole width and the action goes under it, at the end. Decided for the
    // whole card, so its pages (and their dots) keep one look while you swipe.
    const stacked = slides.length > 0
        ? slides.some((s) => s.title.length > STACK_TITLE || (s.sub?.length ?? 0) > STACK_SUB)
        : (item.sub?.length ?? 0) > STACK_BODY;
    const lines = stacked ? { title: 3, sub: 2 } : { title: 2, sub: 1 };
    const rowStyle = stacked
        ? { gap: 10, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 14, paddingVertical: 11, paddingHorizontal: 12 } as const
        : { gap: 10, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 14, paddingVertical: 11, paddingLeft: 12, paddingRight: 8 } as const;
    const [width, setWidth] = React.useState(0);
    const [page, setPage] = React.useState(0);
    const onLayout = (e: LayoutChangeEvent) => setWidth(Math.floor(e.nativeEvent.layout.width));
    const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (width > 0) setPage(Math.round(e.nativeEvent.contentOffset.x / width));
    };

    return (
        <View style={{ ...attentionCardStyle(item.tone), padding: 14, gap: 12 }} testID={`attention-card-${item.id}`}>
            <View className="flex-row items-center" style={{ gap: 10 }}>
                <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: tone.bg }}>
                    <Icon size={19} color={tone.fg} />
                </View>
                <Text className="font-outfit-bold flex-1" style={{ fontSize: 16, lineHeight: 21, color: INK.text }}>{item.title}</Text>
                {item.count !== undefined ? (
                    <View className="items-center justify-center" style={{ minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, backgroundColor: tone.fg }} testID="attention-count">
                        <Text className="font-outfit-bold" style={{ fontSize: 13, lineHeight: 16, color: '#FFFFFF' }}>{item.count}</Text>
                    </View>
                ) : null}
                {onDismiss ? (
                    restore ? (
                        <TouchableOpacity onPress={onDismiss} hitSlop={10} activeOpacity={0.8} accessibilityRole="button" className="items-center justify-center" style={{ minHeight: 28, paddingHorizontal: 11, borderRadius: 100, backgroundColor: '#EBEEF4' }} testID="attention-hide">
                            <Text className="font-outfit-medium" style={{ fontSize: 13, lineHeight: 17, color: INK.muted }}>{dismissLabel}</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={onDismiss} hitSlop={10} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={dismissLabel} className="items-center justify-center" style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(11,21,48,0.07)' }} testID="attention-hide">
                            <X size={15} color={INK.muted} />
                        </TouchableOpacity>
                    )
                ) : null}
            </View>

            {slides.length > 0 ? (
                <View onLayout={onLayout} testID="attention-slides">
                    {width > 0 ? (
                        <ScrollView
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onMomentumScrollEnd={onScrollEnd}
                            scrollEnabled={slides.length > 1}
                            nestedScrollEnabled
                        >
                            {slides.map((s) => (
                                <View key={s.id} style={{ width }}>
                                    <TouchableOpacity onPress={() => (s.onPress ?? item.onPress)()} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`${s.title}. ${item.cta}`} className={stacked ? '' : 'flex-row items-center'} style={rowStyle}>
                                        <View style={stacked ? undefined : { flex: 1, minWidth: 0 }}>
                                            <Text className="font-outfit-bold" style={{ fontSize: 15, lineHeight: 21, color: INK.text }} numberOfLines={lines.title}>{s.title}</Text>
                                            {s.sub ? <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: INK.muted }} numberOfLines={lines.sub}>{s.sub}</Text> : null}
                                            {s.timer ? <AttentionTimer spec={s.timer} inline /> : null}
                                        </View>
                                        <ActionPill label={item.cta} tone={tone} stacked={stacked} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    ) : null}
                    {slides.length > 1 ? (
                        <View className="flex-row items-center justify-center" style={{ gap: 5, marginTop: 10 }} testID="attention-dots">
                            {slides.map((s, i) => (
                                <View key={s.id} style={{ width: i === page ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === page ? tone.fg : 'rgba(11,21,48,0.16)' }} />
                            ))}
                        </View>
                    ) : null}
                </View>
            ) : (
                <TouchableOpacity onPress={item.onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`${item.sub ?? item.title}. ${item.cta}`} className={stacked ? '' : 'flex-row items-center'} style={rowStyle}>
                    <View style={stacked ? undefined : { flex: 1, minWidth: 0 }}>
                        {item.sub ? <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: INK.text }}>{item.sub}</Text> : null}
                        {item.timer ? <AttentionTimer spec={item.timer} inline /> : null}
                    </View>
                    <ActionPill label={item.cta} tone={tone} stacked={stacked} />
                </TouchableOpacity>
            )}

            {item.quick ? <AttentionQuickButton quick={item.quick} /> : null}
        </View>
    );
}

/** A list of alerts, one card each. */
export function AttentionCards({ items, hideLabel, onDismiss, restore }: {
    items: AttentionCardData[];
    hideLabel?: string;
    onDismiss?: (item: AttentionCardData) => void;
    restore?: boolean;
}) {
    return (
        <View style={{ gap: 10 }}>
            {items.map((a) => (
                <AttentionCard key={a.id} item={a} dismissLabel={hideLabel} onDismiss={onDismiss ? () => onDismiss(a) : undefined} restore={restore} />
            ))}
        </View>
    );
}
