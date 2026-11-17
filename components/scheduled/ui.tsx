import { FLOATING_FOOTER } from '@/lib/ui/floatingFooter';
import { TYPE } from '@/lib/ui/type';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View, type TextInputProps } from 'react-native';

import { HeaderBackButton } from '@/components/ui/HeaderBackButton';

/** Visual building blocks of the scheduled-assistance request, following the Scheduled Assistance design. */
export const SC = {
    blue: '#1E56E3',
    blueDark: '#0B2A8E',
    blueSoft: '#EAF1FF',
    blueSofter: '#F4F8FF',
    text: '#0B1530',
    muted: '#6B7490',
    mutedLight: '#8C96AE',
    border: '#DCE3F0',
    borderSoft: '#EEF2FA',
    page: '#F4F6FC',
    green: '#10B981',
    greenSoft: '#E7F8F1',
    greenText: '#0E8A5F',
    amberSoft: '#FFF4E0',
    amberText: '#8A5200',
    red: '#E53E3E',
};

export const CARD_STYLE = {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: SC.borderSoft,
    shadowColor: '#0E2F8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
} as const;

/** Same header as the other request wizards: white circle back button and a centred title. */
export function WizardHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: string }) {
    return (
        <View
            className="px-6 pt-20 pb-2 flex-row items-center justify-between"
            style={{ backgroundColor: '#F4F5FA', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 3, borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB' }}
        >
            {onBack ? <HeaderBackButton onPress={onBack} marginLeft={0} /> : <View style={{ width: 40 }} />}
            <Text style={{ fontFamily: 'Outfit_500Medium', fontSize: 18, color: '#1A1A1A', flex: 1, textAlign: 'center' }}>{title}</Text>
            <View style={{ width: 40, alignItems: 'flex-end' }}>
                {right ? <Text className="font-outfit-bold" style={{ fontSize: 13, color: SC.muted }}>{right}</Text> : null}
            </View>
        </View>
    );
}

/** Five segments, filled up to the current step. */
export function ProgressBar({ step, total, label }: { step: number; total: number; label: string }) {
    return (
        <View style={{ gap: 8 }} accessibilityLabel={label}>
            <View className="flex-row" style={{ gap: 6 }}>
                {Array.from({ length: total }, (_, i) => (
                    <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? SC.blue : SC.border }} />
                ))}
            </View>
            <Text className="font-outfit-semibold" style={{ fontSize: 13, color: SC.muted }}>{label}</Text>
        </View>
    );
}

export function StepHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
    return (
        <View>
            <View className="flex-row items-center self-start rounded-full" style={{ gap: 6, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: SC.blueSoft, marginBottom: 12 }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: SC.blue }} />
                <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1.3, color: SC.blue }}>{eyebrow}</Text>
            </View>
            <Text className="font-outfit-bold" style={{ fontSize: 26, lineHeight: 30, letterSpacing: -0.6, color: SC.text }}>{title}</Text>
            {sub ? <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: SC.muted, marginTop: 8 }}>{sub}</Text> : null}
        </View>
    );
}

export function FieldLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
    return (
        <View className="flex-row items-center justify-between" style={{ marginBottom: 8 }}>
            <Text className="font-outfit-bold" style={{ fontSize: 13, letterSpacing: 1, color: SC.muted }}>{children}</Text>
            {right}
        </View>
    );
}

/** The app's standard input: 52 high, Outfit Medium 17. */
export function TextField(props: TextInputProps & { multiline?: boolean }) {
    const { multiline, style, ...rest } = props;
    return (
        <TextInput
            placeholderTextColor="#9CA3AF"
            multiline={multiline}
            textAlignVertical={multiline ? 'top' : 'center'}
            className="font-outfit-medium"
            style={[
                {
                    fontSize: 17,
                    color: SC.text,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1,
                    borderColor: SC.border,
                    ...(multiline ? { minHeight: 104, paddingTop: 12, paddingBottom: 12 } : { height: 52 }),
                },
                style,
            ]}
            {...rest}
        />
    );
}

/** A selectable card: radio-like, with an icon, a title and an optional line below. */
export function ChoiceCard({
    on,
    onPress,
    icon: Icon,
    title,
    sub,
    badge,
    detail,
}: {
    on: boolean;
    onPress: () => void;
    icon?: LucideIcon;
    title: string;
    sub?: string;
    badge?: string;
    /** Extra content under the sub line (e.g. a VIN row). */
    detail?: ReactNode;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            className="flex-row items-center"
            style={{ ...CARD_STYLE, padding: 14, gap: 12, borderWidth: on ? 1.5 : 1, borderColor: on ? SC.blue : SC.borderSoft, backgroundColor: on ? SC.blueSofter : '#FFFFFF' }}
        >
            {Icon ? (
                <View className="items-center justify-center" style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: on ? '#FFFFFF' : SC.blueSoft }}>
                    <Icon size={20} color={SC.blue} />
                </View>
            ) : null}
            <View className="flex-1">
                <View className="flex-row items-center" style={{ gap: 8 }}>
                    {badge ? (
                        <View className="rounded-full" style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: SC.blueSoft }}>
                            <Text className="font-outfit-bold" style={{ ...TYPE.caption, color: SC.blue }}>{badge}</Text>
                        </View>
                    ) : null}
                    <Text className="font-outfit-bold flex-1" style={{ ...TYPE.group, color: SC.text }} numberOfLines={2}>{title}</Text>
                </View>
                {sub ? <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: SC.muted, marginTop: 2 }}>{sub}</Text> : null}
                {detail}
            </View>
            <View className="items-center justify-center" style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: on ? SC.blue : SC.border, backgroundColor: on ? SC.blue : '#FFFFFF' }}>
                {on ? <Check size={13} color="#FFFFFF" strokeWidth={3} /> : null}
            </View>
        </TouchableOpacity>
    );
}

export function Checkbox({ on }: { on: boolean }) {
    return (
        <View className="items-center justify-center" style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: on ? SC.blue : '#CBD5E1', backgroundColor: on ? SC.blue : '#FFFFFF' }}>
            {on ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
        </View>
    );
}

export function Chip({ on, onPress, children, disabled }: { on: boolean; onPress: () => void; children: ReactNode; disabled?: boolean }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled }}
            style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 100,
                backgroundColor: on ? SC.blue : '#FFFFFF',
                borderWidth: 1,
                borderColor: on ? SC.blue : SC.border,
                opacity: disabled ? 0.4 : 1,
            }}
        >
            <Text className="font-outfit-semibold" style={{ ...TYPE.option, color: on ? '#FFFFFF' : SC.text }}>{children}</Text>
        </TouchableOpacity>
    );
}

/** A note with a tone: blue for information, amber for something to watch. */
export function Note({ tone = 'blue', title, children }: { tone?: 'blue' | 'amber' | 'green'; title?: string; children: ReactNode }) {
    const palette = {
        blue: { bg: SC.blueSoft, fg: SC.blueDark },
        amber: { bg: SC.amberSoft, fg: SC.amberText },
        green: { bg: SC.greenSoft, fg: SC.greenText },
    }[tone];
    return (
        <View style={{ padding: 12, borderRadius: 12, backgroundColor: palette.bg }}>
            {title ? <Text className="font-outfit-bold" style={{ ...TYPE.helper, color: palette.fg }}>{title}</Text> : null}
            <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: palette.fg, marginTop: title ? 2 : 0 }}>{children}</Text>
        </View>
    );
}

/** The bottom action: gradient primary button, with an optional hint line above. */
export function Footer({
    label,
    onPress,
    disabled,
    loading,
    hint,
}: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
    hint?: string;
}) {
    const off = disabled || loading;
    return (
        <View
            style={{ ...FLOATING_FOOTER, gap: 10 }}
        >
            {hint ? <Text className="font-outfit-regular text-center" style={{ fontSize: 13, color: SC.muted }}>{hint}</Text> : null}
            <TouchableOpacity onPress={onPress} disabled={off} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ disabled: !!off }} style={{ opacity: off ? 0.55 : 1, borderRadius: 16, shadowColor: '#2B66F8', shadowOffset: { width: 0, height: 6 }, shadowOpacity: off ? 0 : 0.3, shadowRadius: 12, elevation: off ? 0 : 6 }}>
                <LinearGradient colors={['#2B66F8', '#081E72']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 16, paddingVertical: 17, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                    {loading ? <ActivityIndicator color="#FFFFFF" /> : null}
                    <Text className="font-outfit-bold" style={{ ...TYPE.button, color: '#FFFFFF' }}>{label}</Text>
                    {!loading ? <ChevronRight size={20} color="#FFFFFF" /> : null}
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
}
