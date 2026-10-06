import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View, ViewStyle } from 'react-native';

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
                        <Text className="font-outfit-bold text-[11px]" style={{ color: active ? OS.blue : done ? OS.greenDark : OS.mutedLight }}>
                            {t(`appointments.onSite.phases.${p}`)}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

export function FlowHeader({ title, onBack, closeIcon }: { title: string; onBack?: () => void; closeIcon?: boolean }) {
    return (
        <View className="flex-row items-center gap-3 px-4 pt-2 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(14,47,138,0.05)' }}>
            <TouchableOpacity
                onPress={onBack}
                disabled={!onBack}
                className="items-center justify-center bg-white"
                style={{
                    width: 38, height: 38, borderRadius: 19, opacity: onBack ? 1 : 0.3,
                    shadowColor: '#0E2F8A', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1,
                }}
                testID="on-site-back"
            >
                <Ionicons name={closeIcon ? 'close' : 'chevron-back'} size={18} color="#111111" />
            </TouchableOpacity>
            <Text className="flex-1 text-center font-outfit-medium text-[15px]" style={{ color: '#1A1A1A' }}>{title}</Text>
            <View style={{ width: 38 }} />
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
                <Text className="font-outfit-regular text-[13.5px] mt-1.5 leading-5" style={{ color: OS.muted }}>{subtitle}</Text>
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
            <Text className="font-outfit-bold text-[10.5px] tracking-widest" style={{ color }}>{children}</Text>
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
            <Text className="font-outfit-bold text-xs" style={{ color: OS.text }}>
                {title}
                {optional ? <Text className="font-outfit-medium text-[10.5px]" style={{ color: OS.mutedLight }}>  {t('appointments.onSite.common.optional')}</Text> : null}
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
            <Ionicons name="information-circle-outline" size={15} color={color} style={{ marginTop: 1 }} />
            <Text className="flex-1 font-outfit-medium text-[11.5px] leading-4" style={{ color }}>{children}</Text>
        </View>
    );
}

export function Checkbox({ checked, size = 18 }: { checked: boolean; size?: number }) {
    return (
        <View
            className="items-center justify-center"
            style={{ width: size, height: size, borderRadius: 6, borderWidth: 2, borderColor: checked ? OS.blue : OS.border, backgroundColor: checked ? OS.blue : '#FFFFFF' }}
        >
            {checked ? <Ionicons name="checkmark" size={size - 6} color="#FFFFFF" /> : null}
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
            className={`flex-row items-center gap-3 px-4 ${compact ? 'py-2.5' : 'py-3'}`}
            style={last ? undefined : { borderBottomWidth: 1, borderBottomColor: OS.borderSoft }}
        >
            <Checkbox checked={checked} />
            <View className="flex-1">
                <Text className={`font-outfit-bold ${compact ? 'text-[12.5px]' : 'text-[13.5px]'}`} style={{ color: OS.text }}>{label}</Text>
                {sub && !compact ? <Text className="font-outfit-regular text-[11.5px] mt-0.5" style={{ color: OS.muted }}>{sub}</Text> : null}
            </View>
        </TouchableOpacity>
    );
}

/** Scrollable screen content; pair with an ActionBar below it. */
export function Body({ children }: { children: React.ReactNode }) {
    return (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
            <View className="items-center justify-center" style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: OS.blueSoft }}>
                <Ionicons name={icon} size={15} color={OS.blue} />
            </View>
            <View className="flex-1">
                <Text className="font-outfit-bold text-[10.5px] uppercase" style={{ color: OS.mutedLight }}>{label}</Text>
                {typeof value === 'string' ? (
                    <Text className="font-outfit-bold text-sm mt-0.5" style={{ color: OS.text }}>{value}</Text>
                ) : value}
            </View>
        </View>
    );
}

/** Fixed bottom bar for the screen's main actions. */
export function ActionBar({ children, stacked }: { children: React.ReactNode; stacked?: boolean }) {
    return (
        <View
            className={`px-4 pt-3.5 pb-6 bg-white gap-3 ${stacked ? '' : 'flex-row items-center'}`}
            style={{ borderTopWidth: 1, borderTopColor: OS.borderSoft }}
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
            <Text className="text-white font-outfit-bold text-[15px] text-center">{label}</Text>
        </TouchableOpacity>
    );
}

export function GhostButton({ label, onPress, flex }: { label: string; onPress: () => void; flex?: boolean }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            className="items-center justify-center py-4 px-1.5"
            style={{ borderRadius: 14, borderWidth: 1.5, borderColor: OS.border, flex: flex ? 1 : undefined }}
        >
            <Text className="font-outfit-bold text-sm text-center" style={{ color: OS.mutedLight }}>{label}</Text>
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
export function MaintenanceChecklist({ state, withHeader = true, compact = true }: {
    state: ReturnType<typeof useMaintenanceItems>;
    withHeader?: boolean;
    compact?: boolean;
}) {
    const { t } = useTranslation();
    return (
        <Card>
            {withHeader ? (
                <View className="flex-row items-center justify-between px-4 py-3" style={{ borderBottomWidth: 1, borderBottomColor: OS.borderSoft }}>
                    <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                            <Text className="font-outfit-bold text-[13px]" style={{ color: OS.text }}>{t('appointments.onSite.maintenance.title')}</Text>
                            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: OS.greenSoft }}>
                                <Text className="font-outfit-bold text-[9.5px] uppercase" style={{ color: OS.greenDark }}>{t('appointments.onSite.common.included')}</Text>
                            </View>
                        </View>
                        <Text className="font-outfit-medium text-[11px] mt-0.5" style={{ color: OS.mutedLight }}>{t('appointments.onSite.maintenance.sub')}</Text>
                    </View>
                    <TouchableOpacity onPress={state.toggleAll}>
                        <Text className="font-outfit-bold text-[11.5px]" style={{ color: OS.blue }}>
                            {state.allChecked ? t('appointments.onSite.common.unselectAll') : t('appointments.onSite.common.selectAll')}
                        </Text>
                    </TouchableOpacity>
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
        </Card>
    );
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
            className="font-outfit-regular text-[12.5px] mt-2 px-3 py-2.5"
            style={{ minHeight: rows * 22, borderRadius: 12, borderWidth: 1.5, borderColor: OS.border, backgroundColor: white ? '#FFFFFF' : OS.page, color: OS.text }}
        />
    );
}
