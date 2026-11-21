import { LinearGradient } from 'expo-linear-gradient';
import { Car, Check, KeyRound, Truck, Wrench, type LucideIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import type { AddableRole } from '@/lib/dao/interfaces';
import { OwnerSheet } from '@/components/dashboard/OwnerHomeBlocks';

const C = {
    blue: '#1E56E3',
    blueDark: '#0B2A8E',
    blueSoft: '#EAF1FF',
    blueSofter: '#F4F8FF',
    text: '#0B1530',
    muted: '#6B7490',
    border: '#E4EAF5',
    page: '#F6F8FC',
    // The system's disabled primary: a pale blue with white text (never grey), as every other main button.
    disabled: '#DCE7FA',
};

/** Every role the sheet lists, in the design's order. */
export const SHEET_ROLES: { id: AddableRole; icon: LucideIcon }[] = [
    { id: 'user', icon: Car },
    { id: 'mechanic', icon: Wrench },
    { id: 'towing_driver', icon: Truck },
    { id: 'locksmith_technician', icon: KeyRound },
];

/** Roles the app can run as. Towing and locksmith are registered, never activated. */
export const isActivatable = (role: AddableRole) => role === 'user' || role === 'mechanic';

/**
 * Bottom sheet of the profile's "Switch role" row. A role the account holds and
 * the app can run as is switched to; one it does not hold opens its sign-up;
 * towing / locksmith already held show "Coming soon" and cannot be picked.
 */
export function SwitchRoleSheet({ visible, current, held, onClose, onPick }: {
    visible: boolean;
    current: AddableRole;
    /** The account's roles (`user.roles`). */
    held: string[];
    onClose: () => void;
    onPick: (role: AddableRole, isHeld: boolean) => void;
}) {
    const { t } = useTranslation();
    const [selected, setSelected] = React.useState<AddableRole>(current);

    React.useEffect(() => {
        if (visible) setSelected(current);
    }, [visible, current]);

    const label = (role: AddableRole) => t(`profile.switchRole.roles.${role}.label`);
    const isHeld = (role: AddableRole) => held.includes(role);
    const comingSoon = (role: AddableRole) => isHeld(role) && !isActivatable(role);
    const canConfirm = selected !== current && !comingSoon(selected);
    const buttonText = !canConfirm
        ? t('profile.switchRole.choose')
        : isHeld(selected)
            ? t('profile.switchRole.switchTo', { role: label(selected) })
            : t('profile.switchRole.setUp', { role: label(selected) });

    // The same sheet as the dashboard's pickers: the dim fades in on its own and the sheet slides up, instead of the dim riding up with it.
    return (
        <OwnerSheet visible={visible} title={t('profile.switchRole.sheetTitle')} subtitle={t('profile.switchRole.sheetSubtitle')} onClose={onClose}>
            <View testID="switch-role-sheet">
                <View style={{ gap: 8, marginTop: 4 }}>
                    {SHEET_ROLES.map(({ id, icon: Icon }) => {
                        const on = selected === id;
                        const disabled = comingSoon(id);
                        return (
                            <TouchableOpacity
                                key={id}
                                onPress={() => setSelected(id)}
                                disabled={disabled}
                                activeOpacity={0.8}
                                className="flex-row items-center"
                                style={{
                                    gap: 14, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 18,
                                    backgroundColor: on ? C.blueSofter : '#fff',
                                    borderWidth: on ? 1.5 : 1, borderColor: on ? C.blue : C.border,
                                    opacity: disabled ? 0.6 : 1,
                                }}
                                testID={`switch-role-${id}`}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: on, disabled }}
                            >
                                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: on ? C.blue : C.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                                    <Icon size={24} color={on ? '#fff' : C.blue} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View className="flex-row flex-wrap items-center" style={{ gap: 6 }}>
                                        <Text className="font-outfit-bold" style={{ fontSize: 18, lineHeight: 24, color: C.text }}>{label(id)}</Text>
                                        {id === current && <Pill text={t('profile.switchRole.current')} bg="#ECFBF3" color="#0E8A5F" />}
                                        {!isHeld(id) && <Pill text={t('profile.switchRole.notSetUp')} bg={C.page} color={C.muted} border />}
                                        {disabled && <Pill text={t('profile.switchRole.comingSoon')} bg="#FFF4E6" color="#C2620A" />}
                                    </View>
                                    <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: C.muted, marginTop: 2 }}>
                                        {t(`profile.switchRole.roles.${id}.desc`)}
                                    </Text>
                                </View>
                                <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.blue : 'transparent', borderWidth: on ? 0 : 1.5, borderColor: C.border }}>
                                    {on && <Check size={12} color="#fff" strokeWidth={3} />}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <TouchableOpacity
                    onPress={() => onPick(selected, isHeld(selected))}
                    disabled={!canConfirm}
                    activeOpacity={0.8}
                    style={{ marginTop: 18, borderRadius: 14, ...(canConfirm ? { shadowColor: C.blue, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 } : null) }}
                    testID="switch-role-confirm"
                    accessibilityRole="button"
                >
                    <LinearGradient
                        colors={canConfirm ? [C.blue, C.blueDark] : [C.disabled, C.disabled]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ borderRadius: 14, minHeight: 60, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Text className="font-outfit-bold text-center" style={{ fontSize: 18, lineHeight: 24, color: '#fff' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{buttonText}</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </OwnerSheet>
    );
}

function Pill({ text, bg, color, border }: { text: string; bg: string; color: string; border?: boolean }) {
    return (
        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100, backgroundColor: bg, borderWidth: border ? 1 : 0, borderColor: C.border }}>
            <Text className="font-outfit-bold" style={{ fontSize: 13, color }}>{text}</Text>
        </View>
    );
}
