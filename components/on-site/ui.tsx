import { HeaderBackButton } from '@/components/ui/HeaderBackButton';
import { FLOATING_FOOTER } from '@/lib/ui/floatingFooter';
import { ROUNDED_HEADER } from '@/lib/ui/header';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View, ViewStyle } from 'react-native';
import { TYPE } from '@/lib/ui/type';
import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';

// Shared building blocks for the on-site assistance flow (check-in → execution →
// check-out). Ported from the "Vehicle On-Site Assistance V2" design.

export const OS = {
    blue: '#1E56E3',
    blueDark: '#0B2A8E',
    blueSoft: '#EAF1FF',
    blueSofter: '#F4F8FF',
    blueIce: '#DCE7FA',
    text: '#0B1530',
    muted: '#6B7490',
    mutedLight: '#8C96AE',
    border: '#E4EAF5',
    borderSoft: '#EEF2FA',
    page: '#F6F8FC',
    red: '#E53E3E',
    redSoft: '#FEF0F0',
    orange: '#F08A1C',
    orangeSoft: '#FEF4E2',
    orangeText: '#8A5A12',
    green: '#10B981',
    greenDark: '#0F8A55',
    greenSoft: '#E6F7EF',
};

export type Phase = 'checkin' | 'execution' | 'checkout';

/**
 * The phase the flow is in. `Body` reads it and draws the phase bar as the first thing inside its scroll, so with a
 * fixed bar of buttons below nothing is pinned at the top of the screen and the content keeps all the room.
 */
export const PhaseContext = React.createContext<Phase | null>(null);

export function PhaseBar({ phase }: { phase: Phase }) {
    const { t } = useTranslation();
    const phases: Phase[] = ['checkin', 'execution', 'checkout'];
    const idx = phases.indexOf(phase);
    return (
        <View className="flex-row items-center gap-1.5 mx-4 mt-3.5">
            {phases.map((p, i) => {
                const done = i < idx;
                const active = i === idx;
                return (
                    <View
                        key={p}
                        className="flex-row items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-full"
                        style={{ flex: active ? 1.3 : 1, backgroundColor: active ? OS.blueSoft : done ? OS.greenSoft : 'transparent' }}
                    >
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: active ? OS.blue : done ? OS.green : OS.border }} />
                        <Text className="font-outfit-bold text-[13px]" style={{ color: active ? OS.blue : done ? OS.greenDark : OS.mutedLight }}>
                            {t(`appointments.onSite.phases.${p}`)}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

/**
 * The one header of an on-site screen (receipt, review, check-in): back (or close) on the left and the screen's own name in the middle. These
 * screens hide the tab header above them, so there are never two stacked headers; this one takes the status-bar room itself.
 */
export function FlowHeader({ title, onBack, closeIcon }: { title: string; onBack?: () => void; closeIcon?: boolean }) {
    const insets = useSafeAreaInsets();
    return (
        <View className="flex-row items-center px-4 pb-3" style={[ROUNDED_HEADER, { paddingTop: insets.top - 2 }]}>
            <View style={{ opacity: onBack ? 1 : 0.3 }} pointerEvents={onBack ? 'auto' : 'none'}>
                {closeIcon ? (
                    <TouchableOpacity
                        onPress={onBack}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel="Close"
                        className="items-center justify-center bg-white"
                        style={{ width: 30, height: 30, borderRadius: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}
                        testID="on-site-back"
                    >
                        <Ionicons name="close" size={16} color="#0047AB" />
                    </TouchableOpacity>
                ) : (
                    <HeaderBackButton onPress={onBack ?? (() => undefined)} marginLeft={0} testID="on-site-back" />
                )}
            </View>
            <Text className="flex-1 text-center" style={{ fontFamily: 'Outfit_500Medium', fontSize: 18, color: '#1A1A1A' }}>{title}</Text>
            <View style={{ width: 30 }} />
        </View>
    );
}

/** Screen intro: eyebrow pill, big title and optional subtitle. */
export function Intro({ eyebrow, title, subtitle, tone = 'blue' }: { eyebrow?: string; title: string; subtitle?: string; tone?: 'blue' | 'green' | 'red' }) {
    return (
        <View className="px-5 pt-4 pb-1">
            {eyebrow ? <Eyebrow tone={tone}>{eyebrow}</Eyebrow> : null}
            <Text className="font-outfit-bold text-2xl" style={{ color: OS.text }}>{title}</Text>
            {subtitle ? (
                <Text className="font-outfit-regular text-[14px] mt-1.5 leading-5" style={{ color: OS.muted }}>{subtitle}</Text>
            ) : null}
        </View>
    );
}

const EYEBROW_TONES = {
    blue: { color: OS.blue, bg: OS.blueSoft },
    green: { color: OS.greenDark, bg: OS.greenSoft },
    red: { color: OS.red, bg: OS.redSoft },
};

export function Eyebrow({ children, tone = 'blue' }: { children: React.ReactNode; tone?: keyof typeof EYEBROW_TONES }) {
    const { color, bg } = EYEBROW_TONES[tone];
    return (
        <View className="flex-row items-center gap-1.5 mb-3 px-2.5 py-1 rounded-full" style={{ backgroundColor: bg, alignSelf: 'flex-start' }}>
            <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            <Text className="font-outfit-bold text-[12px] tracking-widest" style={{ color }}>{children}</Text>
        </View>
    );
}

export const cardShadow: ViewStyle = {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: OS.borderSoft,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0E2F8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
};

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
    return <View className="mx-4 mt-3.5" style={[cardShadow, style]}>{children}</View>;
}

export function CardTitle({ title, optional, right }: { title: string; optional?: boolean; right?: React.ReactNode }) {
    const { t } = useTranslation();
    return (
        <View className="flex-row items-center justify-between px-4 pt-3">
            <Text className="font-outfit-bold" style={{ fontSize: 16, lineHeight: 22, color: OS.text }}>
                {title}
                {optional ? <Text className="font-outfit-medium" style={{ fontSize: 13, color: OS.mutedLight }}>  {t('appointments.onSite.common.optional')}</Text> : null}
            </Text>
            {right}
        </View>
    );
}

const TIP_TONES = {
    blue: { color: OS.blueDark, bg: OS.blueSofter },
    orange: { color: OS.orangeText, bg: OS.orangeSoft },
    green: { color: OS.greenDark, bg: OS.greenSoft },
};

export function Tip({ children, tone = 'blue' }: { children: React.ReactNode; tone?: keyof typeof TIP_TONES }) {
    const { color, bg } = TIP_TONES[tone];
    return (
        <View className="mx-4 mt-3 flex-row items-start gap-2 px-3.5 py-3 rounded-2xl" style={{ backgroundColor: bg }}>
            <Ionicons name="information-circle-outline" size={17} color={color} style={{ marginTop: 1.5 }} />
            <Text className="flex-1 font-outfit-medium" style={{ fontSize: 14, lineHeight: 20, color }}>{children}</Text>
        </View>
    );
}

export function Checkbox({ checked, size = 18 }: { checked: boolean; size?: number }) {
    return (
        <View
            className="items-center justify-center"
            style={{ width: size, height: size, borderRadius: 8, borderWidth: 2, borderColor: checked ? OS.blue : OS.border, backgroundColor: checked ? OS.blue : '#FFFFFF' }}
        >
            {checked ? <Ionicons name="checkmark" size={size - 7} color="#FFFFFF" /> : null}
        </View>
    );
}

export function CheckRow({ checked, onToggle, label, sub, last, compact }: {
    checked: boolean; onToggle: () => void; label: string; sub?: string; last?: boolean; compact?: boolean;
}) {
    return (
        <TouchableOpacity
            onPress={onToggle}
            activeOpacity={0.7}
            className="flex-row items-center gap-3 px-4 py-3.5"
            style={last ? undefined : { borderBottomWidth: 1, borderBottomColor: OS.borderSoft }}
        >
            <Checkbox checked={checked} size={24} />
            <View className="flex-1">
                <Text className="font-outfit-bold" style={{ fontSize: 16, lineHeight: 22, color: OS.text }}>{label}</Text>
                {sub && !compact ? <Text className="font-outfit-regular mt-0.5" style={{ fontSize: 14, lineHeight: 20, color: OS.muted }}>{sub}</Text> : null}
            </View>
        </TouchableOpacity>
    );
}

/** Scrollable screen content; pair with an ActionBar below it. */
export function Body({ children }: { children: React.ReactNode }) {
    const phase = React.useContext(PhaseContext);
    return (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {phase ? <PhaseBar phase={phase} /> : null}
            {children}
        </ScrollView>
    );
}

/** Icon tile + uppercase label + value — the on-site summary row. */
export function InfoRow({ icon, label, value, last }: {
    icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: React.ReactNode; last?: boolean;
}) {
    return (
        <View className="flex-row items-center gap-3 px-4 py-3" style={last ? undefined : { borderBottomWidth: 1, borderBottomColor: OS.borderSoft }}>
            <View className="items-center justify-center" style={{ width: 30, height: 30, borderRadius: 11, backgroundColor: OS.blueSoft }}>
                <Ionicons name={icon} size={15} color={OS.blue} />
            </View>
            <View className="flex-1">
                <Text className="font-outfit-bold text-[13px] uppercase" style={{ color: OS.mutedLight }}>{label}</Text>
                {typeof value === 'string' ? (
                    <Text className="font-outfit-bold mt-0.5" style={{ fontSize: 16, lineHeight: 22, color: OS.text }}>{value}</Text>
                ) : value}
            </View>
        </View>
    );
}

/** Fixed bottom bar for the screen's main actions. */
export function ActionBar({ children, stacked }: { children: React.ReactNode; stacked?: boolean }) {
    return (
        <View
            className={`gap-3 ${stacked ? '' : 'flex-row items-center'}`}
            style={FLOATING_FOOTER}
        >
            {children}
        </View>
    );
}

const BUTTON_TONES = { blue: OS.blue, green: OS.green, orange: OS.orange };

export function PrimaryButton({ label, onPress, disabled, tone = 'blue', testID }: {
    label: string; onPress: () => void; disabled?: boolean; tone?: keyof typeof BUTTON_TONES; testID?: string;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.85}
            className="flex-1 items-center justify-center py-4"
            style={{ borderRadius: 14, backgroundColor: disabled ? OS.blueIce : BUTTON_TONES[tone] }}
            testID={testID}
        >
            <Text className="text-white font-outfit-bold text-center" style={{ fontSize: 17, lineHeight: 23 }}>{label}</Text>
        </TouchableOpacity>
    );
}

export function GhostButton({ label, onPress, flex }: { label: string; onPress: () => void; flex?: boolean }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            className="items-center justify-center py-3.5 px-3"
            style={{ minHeight: 54, borderRadius: 14, borderWidth: 1.5, borderColor: OS.border, flex: flex ? 1 : undefined }}
        >
            <Text className="font-outfit-bold text-center" style={{ fontSize: 16, lineHeight: 22, color: OS.text }}>{label}</Text>
        </TouchableOpacity>
    );
}

/** Two-option pill switch (Scan QR / Enter PIN, Record video / Add photos…). */
export function Segmented<K extends string>({ value, onChange, options }: {
    value: K;
    onChange: (k: K) => void;
    options: { key: K; label: string; icon?: React.ComponentProps<typeof Ionicons>['name'] }[];
}) {
    return (
        <View className="mx-4 flex-row gap-1 p-1" style={{ borderRadius: 14, backgroundColor: OS.borderSoft }}>
            {options.map((o) => {
                const active = o.key === value;
                return (
                    <TouchableOpacity
                        key={o.key}
                        onPress={() => onChange(o.key)}
                        className="flex-1 flex-row items-center justify-center gap-1.5 py-3"
                        style={{
                            borderRadius: 12,
                            backgroundColor: active ? '#FFFFFF' : 'transparent',
                            shadowColor: '#0E2F8A', shadowOpacity: active ? 0.1 : 0, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
                            elevation: active ? 2 : 0,
                        }}
                        testID={`segment-${o.key}`}
                    >
                        {o.icon ? <Ionicons name={o.icon} size={14} color={active ? OS.blue : OS.mutedLight} /> : null}
                        <Text className="font-outfit-bold text-[13px]" style={{ color: active ? OS.blue : OS.mutedLight }}>{o.label}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

export function Spinner({ color = OS.blue }: { color?: string }) {
    return <ActivityIndicator size="large" color={color} />;
}

const MAINTENANCE_ITEMS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'];

/**
 * Checklist state. `initial` restores what the visit already saved; `onChange`
 * receives every new state (the flow autosaves it).
 */
export function useMaintenanceItems(
    initial?: Record<string, boolean>,
    onChange?: (checked: Record<string, boolean>) => void,
) {
    const [checked, setChecked] = React.useState<Record<string, boolean>>(initial ?? {});
    const allChecked = MAINTENANCE_ITEMS.every((id) => checked[id]);
    const update = (next: Record<string, boolean>) => {
        setChecked(next);
        onChange?.(next);
    };
    const toggle = (id: string) => update({ ...checked, [id]: !checked[id] });
    const toggleAll = () => update(Object.fromEntries(MAINTENANCE_ITEMS.map((id) => [id, !allChecked])));
    return { checked, allChecked, toggle, toggleAll };
}

/** The 7-point general check every visit includes before closing the service. */
export function MaintenanceChecklist({ state, withHeader = true, compact = true, highlight = false, bare = false }: {
    state: ReturnType<typeof useMaintenanceItems>;
    withHeader?: boolean;
    compact?: boolean;
    /** Outline the card in orange: something still has to be completed here. */
    highlight?: boolean;
    /** No card of its own: for use inside another card. */
    bare?: boolean;
}) {
    const { t } = useTranslation();
    const rows = (
        <>
            {withHeader ? (
                <View className="px-4 pt-3.5 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: OS.borderSoft }}>
                    <View className="flex-row items-center justify-between" style={{ gap: 8 }}>
                        <Text className="flex-1 font-outfit-bold" style={{ ...TYPE.cardTitle, lineHeight: 22, color: OS.text }}>{t('appointments.onSite.maintenance.title')}</Text>
                        {/* Select all is a badge, like the other quick actions. */}
                        <TouchableOpacity
                            onPress={state.toggleAll}
                            hitSlop={6}
                            accessibilityRole="button"
                            className="flex-row items-center"
                            style={{ gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 100, backgroundColor: OS.blueSoft }}
                            testID="maintenance-select-all"
                        >
                            <Ionicons name={state.allChecked ? 'close-circle-outline' : 'checkmark-done-outline'} size={16} color={OS.blue} />
                            <Text className="font-outfit-bold" style={{ fontSize: 14, color: OS.blue }}>
                                {state.allChecked ? t('appointments.onSite.common.unselectAll') : t('appointments.onSite.common.selectAll')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <View className="self-start px-2 py-0.5 rounded-full mt-1.5" style={{ backgroundColor: OS.greenSoft }}>
                        <Text className="font-outfit-bold uppercase" style={{ fontSize: 12, letterSpacing: 1, color: OS.greenDark }}>{t('appointments.onSite.common.included')}</Text>
                    </View>
                    <Text className="font-outfit-regular mt-1.5" style={{ fontSize: 14, lineHeight: 20, color: OS.muted }}>
                        {t('appointments.onSite.maintenance.sub')} · {Object.values(state.checked).filter(Boolean).length}/{MAINTENANCE_ITEMS.length}
                    </Text>
                </View>
            ) : null}
            {MAINTENANCE_ITEMS.map((id, idx) => (
                <CheckRow
                    key={id}
                    checked={!!state.checked[id]}
                    onToggle={() => state.toggle(id)}
                    label={t(`appointments.onSite.maintenance.items.${id}`)}
                    sub={t(`appointments.onSite.maintenance.items.${id}s`)}
                    last={idx === MAINTENANCE_ITEMS.length - 1}
                    compact={compact}
                />
            ))}
        </>
    );
    return bare ? <View>{rows}</View> : <Card style={highlight ? { borderColor: OS.orange, borderWidth: 2 } : undefined}>{rows}</Card>;
}

/** Multiline note box used under photos, videos and work descriptions. */
export function NoteInput({ value, onChangeText, placeholder, rows = 2, white }: {
    value?: string; onChangeText?: (v: string) => void; placeholder: string; rows?: number; white?: boolean;
}) {
    return (
        <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={OS.mutedLight}
            multiline
            textAlignVertical="top"
            className="font-outfit-regular mt-2 px-3 py-3"
            style={{ fontSize: 16, lineHeight: 22, minHeight: rows * 24 + 12, borderRadius: 12, borderWidth: 1.5, borderColor: OS.border, backgroundColor: white ? '#FFFFFF' : OS.page, color: OS.text }}
        />
    );
}


// ─────────── Dialog (replaces the system alert inside the on-site flow) ───────────
const DIALOG_TONES = {
    orange: { color: OS.orange, bg: OS.orangeSoft },
    red: { color: OS.red, bg: OS.redSoft },
    blue: { color: OS.blue, bg: OS.blueSoft },
};

/**
 * A confirmation in the flow's own look: icon tile, title, text and two stacked buttons.
 * `primary` is the safe way on (blue); `secondary` is the quiet way through. Tapping outside
 * or going back is the same as the primary button.
 */
export function OnSiteDialog({ visible, tone = 'orange', icon = 'alert-circle-outline', title, body, details, primaryLabel, onPrimary, secondaryLabel, onSecondary, onDismiss, testID }: {
    visible: boolean;
    tone?: keyof typeof DIALOG_TONES;
    icon?: React.ComponentProps<typeof Ionicons>['name'];
    title: string;
    body: string;
    /** Extra lines under the text (e.g. the two VINs). */
    details?: React.ReactNode;
    primaryLabel: string;
    onPrimary: () => void;
    /** Omit for a message with a single button. */
    secondaryLabel?: string;
    onSecondary?: () => void;
    /** Tap outside / back. Defaults to the primary action; pass it when the primary is not the safe way out. */
    onDismiss?: () => void;
    testID?: string;
}) {
    const { color, bg } = DIALOG_TONES[tone];
    return (
        <Modal supportedOrientations={MODAL_ORIENTATIONS} visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss ?? onPrimary}>
            <View className="flex-1 items-center justify-center px-5" style={{ backgroundColor: 'rgba(11,21,48,0.55)' }} testID={testID}>
                <Pressable style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} onPress={onDismiss ?? onPrimary} accessible={false} />
                <View className="w-full bg-white" style={{ maxWidth: 400, borderRadius: 24, padding: 20, ...cardShadow }}>
                    <View className="items-center justify-center self-center" style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: bg }}>
                        <Ionicons name={icon} size={28} color={color} />
                    </View>
                    <Text className="font-outfit-bold text-center mt-3.5" style={{ fontSize: 20, lineHeight: 26, color: OS.text }}>{title}</Text>
                    <Text className="font-outfit-regular text-center mt-2" style={{ fontSize: 16, lineHeight: 23, color: OS.muted }}>{body}</Text>
                    {details ? <View className="mt-3">{details}</View> : null}
                    <TouchableOpacity
                        onPress={onPrimary}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        className="items-center justify-center mt-5"
                        style={{ minHeight: 52, borderRadius: 14, backgroundColor: OS.blue }}
                        testID="dialog-primary"
                    >
                        <Text className="font-outfit-bold text-white" style={{ fontSize: 17, lineHeight: 23 }}>{primaryLabel}</Text>
                    </TouchableOpacity>
                    {secondaryLabel && onSecondary ? (
                        <TouchableOpacity
                            onPress={onSecondary}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            className="items-center justify-center mt-1.5"
                            style={{ minHeight: 48 }}
                            testID="dialog-secondary"
                        >
                            <Text className="font-outfit-bold" style={{ fontSize: 16, lineHeight: 22, color: OS.muted }}>{secondaryLabel}</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>
        </Modal>
    );
}
