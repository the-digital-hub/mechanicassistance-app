import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, Car, Check, ChevronDown, ChevronRight, FileText, Wrench, X, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';

/** Building blocks of the vehicle owner home, following the Vehicle Owner Dashboard V2 design. */
const C = {
    blue: '#1E56E3',
    blueDark: '#0B2A8E',
    blueSoft: '#EAF1FF',
    blueSofter: '#F4F8FF',
    text: '#0B1530',
    muted: '#6B7490',
    mutedLight: '#8C96AE',
    borderSoft: '#EEF2FA',
    green: '#10B981',
    greenSoft: '#E7F8F1',
    greenText: '#0E8A5F',
    amberSoft: '#FFF4E0',
    amberText: '#8A5200',
    red: '#E53E3E',
};

const CARD = {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.borderSoft,
    shadowColor: '#0E2F8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
} as const;

export function OwnerSectionTitle({
    title,
    badge,
    actionLabel,
    onAction,
    collapsed,
    onToggle,
}: {
    title: string;
    badge?: number;
    actionLabel?: string;
    onAction?: () => void;
    /** With `onToggle`, the whole title row collapses/expands the section. */
    collapsed?: boolean;
    onToggle?: () => void;
}) {
    const heading = (
        <View className="flex-row items-center" style={{ gap: 8 }}>
            <Text className="font-outfit-bold" style={{ fontSize: 18, letterSpacing: -0.3, color: C.text }}>{title}</Text>
            {badge != null && badge > 0 && (
                <View className="items-center justify-center rounded-full" style={{ minWidth: 22, height: 22, paddingHorizontal: 7, backgroundColor: C.red }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 12, color: '#FFFFFF' }}>{badge}</Text>
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
            {actionLabel && onAction ? (
                <TouchableOpacity onPress={onAction} hitSlop={8} accessibilityRole="button">
                    <Text className="font-outfit-bold" style={{ fontSize: 13, color: C.blue }}>{actionLabel}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

/** The one big action: opens the service picker. */
export function RequestAssistanceCta({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.9}
            accessibilityRole="button"
            style={{ borderRadius: 24, backgroundColor: C.blue, shadowColor: C.blue, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.32, shadowRadius: 14, elevation: 6 }}
        >
            <LinearGradient colors={['#2F6BFF', '#1E56E3', '#0B2A8E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, minHeight: 112, paddingHorizontal: 20, paddingVertical: 26, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <View className="items-center justify-center" style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)' }}>
                    <Wrench size={28} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                    <Text className="font-outfit-bold" style={{ fontSize: 20, letterSpacing: -0.4, color: '#FFFFFF' }}>{title}</Text>
                    <Text className="font-outfit-regular" style={{ fontSize: 12.5, lineHeight: 17, color: 'rgba(255,255,255,0.88)', marginTop: 2 }}>{subtitle}</Text>
                </View>
                <View className="items-center justify-center" style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: '#FFFFFF' }}>
                    <ChevronRight size={18} color={C.blueDark} />
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
}

export type EmergencyItem = { id: string; label: string; icon: LucideIcon; onPress?: () => void };

/**
 * The catalog's other services, three to a row. Any number of types fits: they wrap into
 * more rows, and every tile keeps the same width (the last row never stretches).
 */
export function EmergencyRow({ label, items, horizontalInset = 40 }: { label: string; items: EmergencyItem[]; horizontalInset?: number }) {
    const { width } = useWindowDimensions();
    const GAP = 10;
    const COLUMNS = 3;
    const tileWidth = Math.floor((width - horizontalInset - GAP * (COLUMNS - 1)) / COLUMNS);
    if (items.length === 0) return null;
    return (
        <View>
            <Text className="font-outfit-bold" style={{ fontSize: 11, letterSpacing: 1.2, color: C.muted, marginTop: 16, marginBottom: 8 }}>{label}</Text>
            <View className="flex-row flex-wrap" style={{ gap: GAP }}>
                {items.map((e) => {
                    const Icon = e.icon;
                    return (
                        <TouchableOpacity
                            key={e.id}
                            onPress={e.onPress}
                            disabled={!e.onPress}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            className="items-center"
                            style={{ ...CARD, borderRadius: 16, width: tileWidth, paddingVertical: 12, paddingHorizontal: 6, gap: 8, opacity: e.onPress ? 1 : 0.5 }}
                        >
                            <View className="items-center justify-center" style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: C.blueSoft }}>
                                <Icon size={20} color={C.blue} />
                            </View>
                            <Text className="font-outfit-bold text-center" style={{ fontSize: 13.5, lineHeight: 17, color: C.text }} numberOfLines={2}>{e.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

export type OwnerAttentionItem = {
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

/** What needs the owner's action: one tappable card per alert, each one can be hidden. */
export function OwnerAttentionList({ items, hideLabel, onDismiss }: { items: OwnerAttentionItem[]; hideLabel?: string; onDismiss?: (item: OwnerAttentionItem) => void }) {
    return (
        <View style={{ gap: 10 }}>
            {items.map((a) => {
                const Icon = a.icon;
                const amber = a.tone === 'amber';
                return (
                    <TouchableOpacity
                        key={a.id}
                        onPress={a.onPress}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        className="flex-row items-center"
                        style={{ ...CARD, padding: 14, gap: 12 }}
                    >
                        <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: amber ? C.amberSoft : C.blueSoft }}>
                            <Icon size={20} color={amber ? C.amberText : C.blue} />
                        </View>
                        <View className="flex-1">
                            <Text className="font-outfit-bold" style={{ fontSize: 14.5, letterSpacing: -0.2, color: C.text }}>{a.title}</Text>
                            <Text className="font-outfit-regular" style={{ fontSize: 12.5, lineHeight: 17, color: C.muted, marginTop: 2 }}>{a.sub}</Text>
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

export function UpcomingCard({ title, sub, statusLabel, onPress }: { title: string; sub: string; statusLabel: string; onPress: () => void }) {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" className="flex-row items-center" style={{ ...CARD, padding: 14, gap: 12 }}>
            <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: C.blueSoft }}>
                <Calendar size={22} color={C.blue} />
            </View>
            <View className="flex-1">
                <Text className="font-outfit-bold" style={{ fontSize: 14.5, color: C.text }} numberOfLines={1}>{title}</Text>
                <Text className="font-outfit-regular" style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }} numberOfLines={1}>{sub}</Text>
            </View>
            <View className="rounded-full" style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.greenSoft }}>
                <Text className="font-outfit-bold" style={{ fontSize: 11, color: C.greenText }}>{statusLabel}</Text>
            </View>
        </TouchableOpacity>
    );
}

/** The selected vehicle with its mileage strip. */
export function VehicleCareCard({
    name,
    detail,
    canSwitch,
    onSwitch,
    mileageText,
    mileageCta,
    onMileage,
}: {
    name: string;
    detail?: string;
    canSwitch: boolean;
    onSwitch: () => void;
    mileageText: string;
    mileageCta: string;
    onMileage: () => void;
}) {
    return (
        <View style={{ ...CARD, borderWidth: 1.5, borderColor: '#CFDDFB', overflow: 'hidden' }}>
            <TouchableOpacity onPress={onSwitch} disabled={!canSwitch} activeOpacity={0.8} accessibilityRole="button" className="flex-row items-center" style={{ padding: 14, gap: 12 }}>
                <View className="items-center justify-center" style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: C.blueSoft }}>
                    <Car size={20} color={C.blue} />
                </View>
                <View className="flex-1">
                    <Text className="font-outfit-bold" style={{ fontSize: 15.5, letterSpacing: -0.3, color: C.text }} numberOfLines={1}>{name}</Text>
                    {detail ? <Text className="font-outfit-regular" style={{ fontSize: 12, color: C.muted, marginTop: 3 }} numberOfLines={1}>{detail}</Text> : null}
                </View>
                {canSwitch && (
                    <View className="items-center justify-center" style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: C.blueSoft }}>
                        <ChevronDown size={16} color={C.blue} />
                    </View>
                )}
            </TouchableOpacity>
            <View className="flex-row items-center" style={{ paddingHorizontal: 12, paddingVertical: 9, gap: 10, backgroundColor: '#F7FAFF', borderTopWidth: 1, borderTopColor: C.borderSoft }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />
                <Text className="font-outfit-semibold flex-1" style={{ fontSize: 12.5, color: C.muted }} numberOfLines={1}>{mileageText}</Text>
                <TouchableOpacity onPress={onMileage} hitSlop={8} accessibilityRole="button">
                    <Text className="font-outfit-bold" style={{ fontSize: 12.5, color: C.blue }}>{mileageCta}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

export type ActivityItem = { id: string; title: string; sub: string; amount?: string; onPress?: () => void };

export function RecentActivityList({ items }: { items: ActivityItem[] }) {
    return (
        <View style={{ ...CARD, overflow: 'hidden' }}>
            {items.map((h, i) => (
                <TouchableOpacity
                    key={h.id}
                    onPress={h.onPress}
                    disabled={!h.onPress}
                    activeOpacity={0.7}
                    className="flex-row items-center"
                    style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 12, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: C.borderSoft }}
                >
                    <View className="items-center justify-center" style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.blueSoft }}>
                        <FileText size={17} color={C.blue} />
                    </View>
                    <View className="flex-1">
                        <Text className="font-outfit-bold" style={{ fontSize: 13.5, color: C.text }} numberOfLines={1}>{h.title}</Text>
                        <Text className="font-outfit-regular" style={{ fontSize: 12, color: C.muted, marginTop: 1 }} numberOfLines={1}>{h.sub}</Text>
                    </View>
                    {h.amount ? <Text className="font-outfit-bold" style={{ fontSize: 13, color: C.text }}>{h.amount}</Text> : null}
                </TouchableOpacity>
            ))}
        </View>
    );
}

/** Bottom sheet used by the service picker, the vehicle switcher and the mileage editor. */
export function OwnerSheet({ visible, title, subtitle, onClose, children }: { visible: boolean; title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
    // The backdrop fades in and the sheet slides up on their own: with the Modal's own "slide" the dark
    // backdrop rides up with the sheet, which looks abrupt.
    const [mounted, setMounted] = useState(visible);
    const progress = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (visible) {
            setMounted(true);
            Animated.timing(progress, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        } else {
            Animated.timing(progress, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
                if (finished) setMounted(false);
            });
        }
    }, [visible, progress]);

    return (
        <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
                <Animated.View pointerEvents="box-none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(11,21,48,0.32)', opacity: progress }}>
                    <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={title} />
                </Animated.View>
                <Animated.View
                    style={{
                        backgroundColor: '#FFFFFF',
                        borderTopLeftRadius: 26,
                        borderTopRightRadius: 26,
                        paddingHorizontal: 20,
                        paddingTop: 10,
                        paddingBottom: 34,
                        opacity: progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
                        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [360, 0] }) }],
                    }}
                >
                    <View className="self-center" style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#DCE3F0', marginBottom: 14 }} />
                    <View className="flex-row items-start justify-between" style={{ marginBottom: subtitle ? 4 : 16 }}>
                        <Text className="font-outfit-bold" style={{ fontSize: 20, letterSpacing: -0.4, color: C.text }}>{title}</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" className="items-center justify-center rounded-full" style={{ width: 28, height: 28, backgroundColor: '#EEF1F6' }}>
                            <X size={15} color="#4B5563" />
                        </TouchableOpacity>
                    </View>
                    {subtitle ? <Text className="font-outfit-regular" style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>{subtitle}</Text> : null}
                    {children}
                </Animated.View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

/** One tappable option of a sheet (service type or vehicle). `gradient` is the blue service card. */
export function SheetOption({ icon: Icon, title, subtitle, selected, gradient, onPress }: { icon: LucideIcon; title: string; subtitle?: string | null; selected?: boolean; gradient?: boolean; onPress: () => void }) {
    if (gradient) {
        return (
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.9}
                accessibilityRole="button"
                style={{ borderRadius: 18, backgroundColor: C.blue, shadowColor: C.blue, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 5 }}
            >
                <LinearGradient colors={['#2F6BFF', '#1E56E3', '#0B2A8E', '#061A66']} locations={[0, 0.38, 0.82, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.18)' }}>
                        <Icon size={22} color="#FFFFFF" />
                    </View>
                    <View className="flex-1">
                        <Text className="font-outfit-bold" style={{ fontSize: 15, letterSpacing: -0.2, color: '#FFFFFF' }} numberOfLines={1}>{title}</Text>
                        {subtitle ? <Text className="font-outfit-regular" style={{ fontSize: 12.5, lineHeight: 17, color: 'rgba(255,255,255,0.88)', marginTop: 2 }}>{subtitle}</Text> : null}
                    </View>
                    <View className="items-center justify-center" style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: '#FFFFFF' }}>
                        <ChevronRight size={16} color={C.blueDark} />
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    }
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            className="flex-row items-center"
            style={{ padding: 14, gap: 14, borderRadius: 18, backgroundColor: selected ? C.blueSoft : '#FFFFFF', borderWidth: 1, borderColor: selected ? '#CFDDFB' : C.borderSoft }}
        >
            <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: selected ? '#FFFFFF' : C.blueSoft }}>
                <Icon size={22} color={C.blue} />
            </View>
            <View className="flex-1">
                <Text className="font-outfit-bold" style={{ fontSize: 15, color: C.text }} numberOfLines={1}>{title}</Text>
                {subtitle ? <Text className="font-outfit-regular" style={{ fontSize: 12.5, lineHeight: 17, color: C.muted, marginTop: 2 }}>{subtitle}</Text> : null}
            </View>
            {selected ? <Check size={18} color={C.blue} /> : <ChevronRight size={18} color={C.mutedLight} />}
        </TouchableOpacity>
    );
}

/** Mileage editor: the number the owner types is saved on the vehicle. */
export function MileageField({
    value,
    onChange,
    placeholder,
    saveLabel,
    saving,
    error,
    onSave,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    saveLabel: string;
    saving?: boolean;
    error?: string | null;
    onSave: () => void;
}) {
    return (
        <View style={{ gap: 12 }}>
            <TextInput
                value={value}
                onChangeText={(v) => onChange(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder={placeholder}
                placeholderTextColor="#9CA3AF"
                autoFocus
                maxLength={7}
                className="font-outfit-medium"
                style={{ height: 52, fontSize: 17, color: C.text, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5, borderColor: '#CFDDFB', backgroundColor: C.blueSofter }}
            />
            {error ? <Text className="font-outfit-regular" style={{ fontSize: 12.5, color: C.red }}>{error}</Text> : null}
            <TouchableOpacity onPress={onSave} disabled={saving || value.length === 0} activeOpacity={0.85} accessibilityRole="button" style={{ opacity: saving || value.length === 0 ? 0.6 : 1 }}>
                <LinearGradient colors={['#2B66F8', '#081E72']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 15, color: '#FFFFFF' }}>{saveLabel}</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
}
