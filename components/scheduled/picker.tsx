import { Check, ChevronRight, Search, X, type LucideIcon } from 'lucide-react-native';
import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CARD_STYLE, SC } from '@/components/scheduled/ui';
import { TYPE } from '@/lib/ui/type';

/**
 * One look for every "pick what is wrong / what you need" list: immediate and video call (issues) and
 * scheduled (services). A search on top, the picks as badges, one card per category, and inside it plain
 * rows on three backgrounds. Picking something closes its group; the badges say what is chosen.
 */

/** The accordion's motion: soft and short. What opens fades in while the cards around it glide to their place. */
const GLIDE = LinearTransition.duration(220);
const IN = FadeIn.duration(220);
const OUT = FadeOut.duration(120);

/** Content that appears and disappears with its group: it fades in and out, and what is around it glides. */
export function PickReveal({ children }: { children: React.ReactNode }) {
    return (
        <Animated.View entering={IN} exiting={OUT} layout={GLIDE}>
            {children}
        </Animated.View>
    );
}

/** Three levels, told apart by background: white (category) > soft tint (what is inside it) > a white inset card (the options). */
const TINT = '#E9F0FC';
/** `soft` is the lightest blue: the options inside a subcategory, a step apart from the band of the subcategories. */
export type PickTone = 'white' | 'tint' | 'soft';
/** The separators: hairlines, very light, a little darker than the background they are on. */
const TINT_LINE = 'rgba(150,178,228,0.22)';
const SOFT_LINE = 'rgba(150,178,228,0.2)';
/** A picked row on the band: a deeper blue than the band itself, never white. */
const SOFT = '#F4F8FE';

/** The tinted band that holds what is inside an open category. */
export function PickChildren({ children }: { children: React.ReactNode }) {
    return (
        <Animated.View entering={IN} exiting={OUT} layout={GLIDE} style={{ backgroundColor: TINT, borderTopWidth: 1, borderTopColor: TINT_LINE }}>
            {children}
        </Animated.View>
    );
}

/** The white inset card with the options of one item (its last level). */
export function PickOptions({ children }: { children: React.ReactNode }) {
    // The shadow lives on the outer view: on iOS a view that clips (overflow) cannot also cast one.
    return (
        <View
            style={{
                marginHorizontal: 14,
                marginTop: 2,
                marginBottom: 14,
                borderRadius: 16,
                backgroundColor: '#FFFFFF',
                shadowColor: '#0E2F8A',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.1,
                shadowRadius: 6,
                elevation: 2,
            }}
        >
            <View style={{ borderRadius: 16, borderWidth: 1.5, borderColor: '#B5C8EC', overflow: 'hidden' }}>{children}</View>
        </View>
    );
}

/** A round check: empty ring, or a soft light-blue disc with a muted blue tick. */
export function PickCheck({ on }: { on: boolean }) {
    return (
        <View
            className="items-center justify-center"
            style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: on ? '#B7C9F2' : '#C9D2E3', backgroundColor: on ? '#DCE6FB' : '#FFFFFF' }}
        >
            {on ? <Check size={15} color="#3F6FD8" strokeWidth={3.5} /> : null}
        </View>
    );
}

/** The search field, always on show. */
export function SearchField({ value, onChangeText, placeholder, testID }: { value: string; onChangeText: (v: string) => void; placeholder: string; testID?: string }) {
    return (
        <View className="flex-row items-center" style={{ ...CARD_STYLE, borderRadius: 16, height: 52, paddingHorizontal: 14, gap: 10 }}>
            <Search size={19} color={SC.mutedLight} />
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={SC.mutedLight}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                accessibilityLabel={placeholder}
                style={{ flex: 1, ...TYPE.body, color: SC.text, fontFamily: 'Outfit_400Regular', paddingVertical: 0 }}
                testID={testID}
            />
            {value.length > 0 ? (
                <TouchableOpacity onPress={() => onChangeText('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear">
                    <X size={18} color={SC.mutedLight} />
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

/** What is picked, as removable badges. */
export function PickedChips({ chips }: { chips: { key: string; label: string; onRemove: () => void }[] }) {
    if (chips.length === 0) return null;
    return (
        <View className="flex-row flex-wrap" style={{ gap: 8 }} testID="picked-chips">
            {chips.map((c) => (
                <TouchableOpacity
                    key={c.key}
                    onPress={c.onRemove}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={c.label}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    className="flex-row items-center"
                    style={{ gap: 8, paddingLeft: 14, paddingRight: 6, paddingVertical: 6, borderRadius: 100, backgroundColor: SC.blueSoft, maxWidth: '100%' }}
                >
                    <Text className="font-outfit-semibold" style={{ ...TYPE.helper, color: SC.blue, flexShrink: 1 }} numberOfLines={1}>{c.label}</Text>
                    {/* A light round button to take it off: clear without shouting. */}
                    <View className="items-center justify-center" style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(30,86,227,0.14)' }}>
                        <X size={12} color={SC.blue} strokeWidth={2.5} />
                    </View>
                </TouchableOpacity>
            ))}
        </View>
    );
}

/** The list of category cards, apart from each other. */
export function PickList({ children }: { children: React.ReactNode }) {
    return <Animated.View layout={GLIDE} style={{ gap: 10 }}>{children}</Animated.View>;
}

/**
 * One category: its own white card. Open, it gets a soft blue outline; with something picked in it, a
 * strong blue one.
 */
export function PickCard({ picked, open, children }: { picked?: boolean; open?: boolean; children: React.ReactNode }) {
    return (
        <Animated.View
            layout={GLIDE}
            style={{ ...CARD_STYLE, overflow: 'hidden', borderWidth: picked || open ? 1.5 : 1, borderColor: picked ? SC.blue : open ? '#B9CCF0' : SC.borderSoft }}
        >
            {children}
        </Animated.View>
    );
}

/** The arrow of a group: it points right when closed and turns down, smoothly, when it opens. */
function GroupArrow({ open }: { open: boolean }) {
    const turn = useSharedValue(open ? 1 : 0);
    React.useEffect(() => {
        turn.value = withTiming(open ? 1 : 0, { duration: 220 });
    }, [open, turn]);
    const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 90}deg` }] }));
    return (
        <Animated.View style={style}>
            <ChevronRight size={20} color={SC.mutedLight} />
        </Animated.View>
    );
}

/** A group (a category, or an issue with options): title, how many are picked, and an arrow. */
export function PickGroup({ icon: Icon, title, count, open, onPress, first, depth = 0, tone = 'white' }: {
    icon?: LucideIcon;
    title: string;
    count: number;
    open: boolean;
    onPress: () => void;
    first?: boolean;
    depth?: number;
    tone?: PickTone;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            className="flex-row items-center"
            style={{ paddingVertical: 15, paddingRight: 14, paddingLeft: 14 + depth * 20, gap: 12, borderTopWidth: first ? 0 : 1, borderTopColor: tone === 'tint' ? TINT_LINE : SC.borderSoft }}
        >
            {Icon ? (
                <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: SC.blueSoft }}>
                    <Icon size={20} color={SC.blue} />
                </View>
            ) : null}
            <Text className="font-outfit-bold flex-1" style={{ ...(Icon ? TYPE.group : TYPE.option), color: SC.text }}>{title}</Text>
            {count > 0 ? (
                // The category's count is solid; a subcategory's is a light one, so the two do not compete.
                <View
                    className="rounded-full items-center justify-center"
                    style={Icon
                        ? { minWidth: 24, height: 24, paddingHorizontal: 7, backgroundColor: SC.blue }
                        : { minWidth: 22, height: 22, paddingHorizontal: 6, backgroundColor: 'rgba(30,86,227,0.12)' }}
                >
                    <Text className="font-outfit-bold" style={{ ...TYPE.caption, color: Icon ? '#FFFFFF' : SC.blue }}>{count}</Text>
                </View>
            ) : null}
            <GroupArrow open={open} />
        </TouchableOpacity>
    );
}

/** One thing to pick: a round check and its name. Picked: the name turns blue and the check fills; the row's background stays. */
export function PickItem({ label, details, on, onPress, depth = 0, first, tone = 'white', icon: Icon }: {
    label: string;
    /** An icon for the row: it goes in a tile before the name, and the check moves to the right. */
    icon?: LucideIcon;
    details?: string | null;
    on: boolean;
    onPress: () => void;
    depth?: number;
    first?: boolean;
    tone?: PickTone;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            className="flex-row items-center"
            style={{ paddingVertical: 14, paddingRight: 14, paddingLeft: 14 + depth * 20, gap: 12, backgroundColor: tone === 'soft' ? SOFT : 'transparent', borderTopWidth: first ? 0 : 1, borderTopColor: tone === 'tint' ? TINT_LINE : tone === 'soft' ? SOFT_LINE : SC.borderSoft }}
        >
            {Icon ? (
                <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: SC.blueSoft }}>
                    <Icon size={20} color={SC.blue} />
                </View>
            ) : (
                <PickCheck on={on} />
            )}
            <View className="flex-1">
                <Text className="font-outfit-semibold" style={{ ...TYPE.option, color: on ? SC.blue : SC.text }}>{label}</Text>
                {details ? <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: SC.muted, marginTop: 2 }} numberOfLines={3}>{details}</Text> : null}
            </View>
            {Icon ? <PickCheck on={on} /> : null}
        </TouchableOpacity>
    );
}
