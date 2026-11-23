import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from 'react-i18next';
import { getSetupProgress } from '@/lib/storage';
import { Timeline } from '@/components/ui/RequestSteps';
import { setupFlow, type SetupScreen } from '@/lib/setup-steps';
import { HeaderBackButton } from '@/components/ui/HeaderBackButton';
import { FONT } from '@/lib/ui/fonts';
import { ROUNDED_HEADER } from '@/lib/ui/header';
import { BUTTON_RADIUS, FLOATING_CTA, FLOATING_FOOTER } from '@/lib/ui/floatingFooter';
import { TYPE } from '@/lib/ui/type';

/**
 * The pieces every step of the account set-up shares, so the whole registration looks like the rest of the app: the same heading, and the
 * same fixed bottom bar (white sheet, primary button above, a soft slate one below when there is a way out). Screens put their form in a
 * scroll above `SetupFooter` and nothing else.
 */
export const SETUP_BG = '#F6F8FC';
export const SETUP_GRADIENT = ['#2B66F8', '#081E72'] as const;

/** The role chosen on the role step, once there is one (it decides how many steps the registration has). */
function useSetupRole(): 'user' | 'mechanic' | null {
    const [role, setRole] = React.useState<'user' | 'mechanic' | null>(null);
    React.useEffect(() => {
        let cancelled = false;
        getSetupProgress().then((progress) => {
            const chosen = progress?.role?.role;
            if (!cancelled && (chosen === 'user' || chosen === 'mechanic')) setRole(chosen);
        });
        return () => { cancelled = true; };
    }, []);
    return role;
}

/**
 * The top of a step: the timeline of the whole registration (the same dots-and-lines one the request wizards use: done steps a check, the
 * current one ringed) and, under it, the pill "STEP 4 · BASIC INFO". Screens that are not numbered just show their own label.
 */
export function SetupBadge({ screen, label }: { screen?: SetupScreen; label?: string }) {
    const { t } = useTranslation();
    const role = useSetupRole();
    const flow = setupFlow(role);
    const index = screen ? flow.indexOf(screen) : -1;
    const text = index >= 0 ? t('requestSteps.eyebrow', { n: index + 1, name: t(`setup.stepNames.${screen}`) }) : label;
    if (!text) return null;
    return (
        <View testID="setup-badge">
            {/* The screens leave 18 under the header, the timeline brings 18 of its own and the rounded header runs 14 over the page: this trims the rest so it sits as it does in the request wizards. */}
            {index >= 0 ? (
                <View style={{ marginTop: -4 }}>
                    <Timeline steps={flow.map((key) => ({ key, label: t(`setup.stepNames.${key}`) }))} current={index} flush />
                </View>
            ) : null}
            <View className="flex-row items-center self-start" style={{ gap: 6, marginBottom: 14, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#E9F1FF' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#0047AB' }} />
                <Text className="font-outfit-semibold" style={{ ...TYPE.eyebrow, color: '#1E56E3' }}>{text.toUpperCase()}</Text>
            </View>
        </View>
    );
}

/** The step's badge (with "Step n of N"), title and subtitle. */
export function SetupHeading({ badge, screen, title, subtitle, children }: { badge?: string; screen?: SetupScreen; title: string; subtitle?: string; children?: React.ReactNode }) {
    return (
        <View style={{ marginBottom: 20 }}>
            <SetupBadge screen={screen} label={badge} />
            <Text className="font-outfit-bold" style={{ fontSize: 26, lineHeight: 32, letterSpacing: -0.5, color: '#0B1530' }}>{title}</Text>
            {subtitle ? <Text className="font-outfit-regular" style={{ ...TYPE.body, color: '#6B7490', marginTop: 8 }}>{subtitle}</Text> : null}
            {children}
        </View>
    );
}

/**
 * The fixed bottom bar of a step: the primary action (blue gradient, 56 high, radius 14) and, under it, the secondary one (skip, later…)
 * as a soft slate button. Never side by side.
 */
export function SetupFooter({
    label, onPress, disabled, loading, chevron = true, gradient = SETUP_GRADIENT, secondaryLabel, onSecondary, secondaryDisabled, testID, note,
}: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
    /** The arrow after the label (a step that goes on). Off for the last one. */
    chevron?: boolean;
    gradient?: readonly [string, string];
    secondaryLabel?: string;
    onSecondary?: () => void;
    secondaryDisabled?: boolean;
    testID?: string;
    /** A small line above the buttons (a hint or an error). */
    note?: React.ReactNode;
}) {
    const insets = useSafeAreaInsets();
    const off = !!disabled || !!loading;
    return (
        <View style={{ ...FLOATING_FOOTER, paddingBottom: Math.max(insets.bottom, 18), gap: 10 }}>
            {note}
            <TouchableOpacity onPress={onPress} disabled={off} activeOpacity={0.85} accessibilityRole="button" style={{ ...FLOATING_CTA, borderRadius: BUTTON_RADIUS, opacity: disabled && !loading ? 0.5 : 1 }} testID={testID}>
                <LinearGradient
                    colors={[...gradient]}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 1, y: 0 }}
                    style={{ minHeight: 56, borderRadius: BUTTON_RADIUS, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 }}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Text className="font-outfit-bold text-white text-center" style={TYPE.button}>{label}</Text>
                            {chevron ? <ChevronRight size={20} color="white" /> : null}
                        </>
                    )}
                </LinearGradient>
            </TouchableOpacity>
            {secondaryLabel && onSecondary ? (
                <TouchableOpacity onPress={onSecondary} disabled={secondaryDisabled} activeOpacity={0.85} accessibilityRole="button" className="items-center justify-center" style={{ minHeight: 56, borderRadius: BUTTON_RADIUS, backgroundColor: '#E6EAF2', opacity: secondaryDisabled ? 0.5 : 1 }}>
                    <Text className="font-outfit-bold" style={{ ...TYPE.button, color: '#4A5470' }}>{secondaryLabel}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

/**
 * The header of every step: the same rounded, lifted surface and the same small white back arrow as the wizards (a native header would wrap
 * the arrow in a bigger capsule). The page runs a little under its rounded edge, like everywhere else.
 */
export function SetupHeader({ title, onBack }: { title: string; onBack?: () => void }) {
    const insets = useSafeAreaInsets();
    return (
        <View className="flex-row items-center px-4 pb-3" style={[ROUNDED_HEADER, { paddingTop: insets.top - 2 }]} testID="setup-header">
            <View style={{ opacity: onBack ? 1 : 0.3 }} pointerEvents={onBack ? 'auto' : 'none'}>
                <HeaderBackButton onPress={onBack ?? (() => undefined)} marginLeft={0} testID="setup-back" />
            </View>
            <Text className="flex-1 text-center" style={{ fontFamily: FONT.medium, fontSize: 18, color: '#1A1A1A' }}>{title}</Text>
            <View style={{ width: 30 }} />
        </View>
    );
}
