import { ReactNode, useState } from 'react';
import { Platform, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Look of the add/edit vehicle form, taken from the Claude Design mock
 * ("Add Vehicle"). Colors, icons and the small building blocks every
 * section of the form shares.
 */
export const AV = {
    blue: '#1E56E3',
    blueDark: '#0B2A8E',
    blueSoft: '#EAF1FF',
    blueSofter: '#F4F8FF',
    text: '#0B1530',
    muted: '#6B7490',
    mutedLight: '#8C96AE',
    borderSoft: '#EEF2FA',
    border: '#DCE3F0',
    page: '#F6F8FC',
    greenSoft: '#ECFBF3',
    greenText: '#0E8A5F',
    disabled: '#B7BECD',
    error: '#EF4444',
} as const;

export const MONO_FONT = Platform.select({ ios: 'Menlo', default: 'monospace' });

export type AVIconName = 'sparkle' | 'search' | 'car' | 'gear' | 'tire' | 'shield' | 'note' | 'check' | 'chevron';

interface AVIconProps {
    name: AVIconName;
    color: string;
    size?: number;
    /** Chevron only: points up when open. */
    open?: boolean;
}

/** The mock's line icons, drawn with the same paths. */
export function AVIcon({ name, color, size, open }: AVIconProps) {
    switch (name) {
        case 'sparkle':
            return (
                <Svg width={size ?? 18} height={size ?? 18} viewBox="0 0 24 24" fill="none">
                    <Path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
                    <Path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" fill={color} />
                </Svg>
            );
        case 'search':
            return (
                <Svg width={size ?? 18} height={size ?? 18} viewBox="0 0 24 24" fill="none">
                    <Circle cx={11} cy={11} r={6.5} stroke={color} strokeWidth={2} />
                    <Path d="M16 16l4 4" stroke={color} strokeWidth={2} strokeLinecap="round" />
                </Svg>
            );
        case 'car':
            return (
                <Svg width={size ?? 18} height={size ?? 18} viewBox="0 0 24 24" fill="none">
                    <Path
                        d="M5 14l1.2-3.4A2 2 0 018.1 9.3h7.8a2 2 0 011.9 1.3L19 14M4 14h16v3.5a1 1 0 01-1 1h-1.5a1 1 0 01-1-1V17H7.5v.5a1 1 0 01-1 1H5a1 1 0 01-1-1V14z"
                        stroke={color}
                        strokeWidth={1.7}
                        strokeLinejoin="round"
                    />
                </Svg>
            );
        case 'gear':
            return (
                <Svg width={size ?? 18} height={size ?? 18} viewBox="0 0 24 24" fill="none">
                    <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.7} />
                    <Path
                        d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"
                        stroke={color}
                        strokeWidth={1.7}
                        strokeLinecap="round"
                    />
                </Svg>
            );
        case 'tire':
            return (
                <Svg width={size ?? 18} height={size ?? 18} viewBox="0 0 24 24" fill="none">
                    <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={1.7} />
                    <Circle cx={12} cy={12} r={3.5} stroke={color} strokeWidth={1.7} />
                    <Path d="M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5" stroke={color} strokeWidth={1.4} />
                </Svg>
            );
        case 'shield':
            return (
                <Svg width={size ?? 18} height={size ?? 18} viewBox="0 0 24 24" fill="none">
                    <Path d="M12 3l7 3v5.5c0 4.3-3 7.8-7 9.5-4-1.7-7-5.2-7-9.5V6l7-3z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
                </Svg>
            );
        case 'note':
            return (
                <Svg width={size ?? 18} height={size ?? 18} viewBox="0 0 24 24" fill="none">
                    <Rect x={5} y={3.5} width={14} height={17} rx={2.5} stroke={color} strokeWidth={1.7} />
                    <Path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
                </Svg>
            );
        case 'check':
            return (
                <Svg width={size ?? 11} height={size ?? 11} viewBox="0 0 24 24" fill="none">
                    <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
            );
        case 'chevron':
            return (
                <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
                    <Svg width={size ?? 14} height={size ?? 14} viewBox="0 0 12 12">
                        <Path d="M2.5 4.5L6 8l3.5-3.5" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                </View>
            );
    }
}

interface AVFieldProps {
    label?: string | null;
    required?: boolean;
    error?: string | null;
    children: ReactNode;
}

/** Bold label over a control, with the field's error under it. */
export function AVField({ label, required, error, children }: AVFieldProps) {
    return (
        <View style={{ gap: 6, minWidth: 0 }}>
            {label ? (
                <Text className="font-outfit-bold" style={{ fontSize: 13, color: AV.text }} numberOfLines={1}>
                    {label}
                    {required ? <Text style={{ color: AV.blue }}> *</Text> : null}
                </Text>
            ) : null}
            {children}
            {error ? (
                <Text className="font-outfit-regular" style={{ fontSize: 11.5, color: AV.error, lineHeight: 15 }}>
                    {error}
                </Text>
            ) : null}
        </View>
    );
}

interface AVTextInputProps extends TextInputProps {
    hasError?: boolean;
    mono?: boolean;
}

/** The mock's text box: 48 high, rounded 12, blue border and halo on focus. */
export function AVTextInput({ hasError, mono, style, multiline, onFocus, onBlur, ...props }: AVTextInputProps) {
    const [focused, setFocused] = useState(false);
    return (
        <TextInput
            {...props}
            multiline={multiline}
            placeholderTextColor={AV.mutedLight}
            onFocus={e => {
                setFocused(true);
                onFocus?.(e);
            }}
            onBlur={e => {
                setFocused(false);
                onBlur?.(e);
            }}
            className={mono ? undefined : 'font-outfit-regular'}
            style={[
                {
                    height: multiline ? undefined : 48,
                    minHeight: multiline ? 88 : undefined,
                    paddingHorizontal: 14,
                    paddingVertical: multiline ? 12 : 0,
                    borderRadius: 12,
                    backgroundColor: '#fff',
                    borderWidth: 1,
                    borderColor: hasError ? '#FCA5A5' : focused ? AV.blue : AV.border,
                    fontSize: 14.5,
                    color: AV.text,
                    textAlignVertical: multiline ? 'top' : 'center',
                    fontFamily: mono ? MONO_FONT : undefined,
                    letterSpacing: mono ? 0.5 : 0,
                    shadowColor: AV.blue,
                    shadowOpacity: focused ? 0.18 : 0,
                    shadowRadius: 3,
                    shadowOffset: { width: 0, height: 0 },
                },
                style,
            ]}
        />
    );
}

/** Square check used by "Rear tires are the same size". */
export function AVCheckbox({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' }}
        >
            <View
                style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: checked ? AV.blue : '#fff',
                    borderWidth: checked ? 0 : 1.5,
                    borderColor: AV.border,
                }}
            >
                {checked ? <AVIcon name="check" color="#fff" /> : null}
            </View>
            <Text className="font-outfit-semibold" style={{ fontSize: 13, color: AV.text }}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

/** Badge, title and subtitle that open the vehicle form screen. */
export function VehicleFormHeader({ badge, title, subtitle }: { badge: string; title: string; subtitle: string }) {
    return (
        <View>
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    alignSelf: 'flex-start',
                    gap: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 100,
                    backgroundColor: AV.blueSoft,
                }}
            >
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: AV.blue }} />
                <Text className="font-outfit-bold" style={{ fontSize: 10.5, letterSpacing: 1.3, color: AV.blue }}>
                    {badge}
                </Text>
            </View>
            <Text className="font-outfit-bold" style={{ fontSize: 28, letterSpacing: -0.7, color: AV.text, marginTop: 12 }}>
                {title}
            </Text>
            <Text className="font-outfit-regular" style={{ fontSize: 14, color: AV.muted, marginTop: 6, lineHeight: 20 }}>
                {subtitle}
            </Text>
        </View>
    );
}

/** Lays fields side by side; `flex` gives each column its share (all equal by default). */
export function AVRow({ children, flex, gap = 12 }: { children: ReactNode[]; flex?: number[]; gap?: number }) {
    return (
        <View style={{ flexDirection: 'row', gap }}>
            {children.map((child, i) => (
                <View key={i} style={{ flex: flex?.[i] ?? 1, minWidth: 0 }}>
                    {child}
                </View>
            ))}
        </View>
    );
}
