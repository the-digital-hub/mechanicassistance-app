import { LinearGradient } from 'expo-linear-gradient';
import { Car, Check, KeyRound, Truck, Wrench, type LucideIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';

import type { AddableRole } from '@/lib/dao/interfaces';

const C = {
    blue: '#1E56E3',
    blueDark: '#0B2A8E',
    blueSoft: '#EAF1FF',
    blueSofter: '#F4F8FF',
    text: '#0B1530',
    muted: '#6B7490',
    border: '#E4EAF5',
    page: '#F6F8FC',
    disabled: '#B7BECD',
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

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <Pressable style={{ flex: 1, backgroundColor: 'rgba(11,21,48,0.45)' }} onPress={onClose} />
            <View
                style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 34 }}
                testID="switch-role-sheet"
            >
                <View style={{ width: 40, height: 5, borderRadius: 4, backgroundColor: C.border, alignSelf: 'center', marginBottom: 16 }} />
                <View style={{ paddingHorizontal: 4 }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 20, color: C.text }}>{t('profile.switchRole.sheetTitle')}</Text>
                    <Text className="font-outfit-regular" style={{ fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 19 }}>
                        {t('profile.switchRole.sheetSubtitle')}
                    </Text>
                </View>

                <View style={{ gap: 8, marginTop: 16 }}>
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
                                    gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16,
                                    backgroundColor: on ? C.blueSofter : '#fff',
                                    borderWidth: on ? 1.5 : 1, borderColor: on ? C.blue : C.border,
                                    opacity: disabled ? 0.6 : 1,
                                }}
                                testID={`switch-role-${id}`}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: on, disabled }}
                            >
                                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: on ? C.blue : C.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                                    <Icon size={20} color={on ? '#fff' : C.blue} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View className="flex-row flex-wrap items-center" style={{ gap: 6 }}>
                                        <Text className="font-outfit-bold" style={{ fontSize: 15, color: C.text }}>{label(id)}</Text>
                                        {id === current && <Pill text={t('profile.switchRole.current')} bg="#ECFBF3" color="#0E8A5F" />}
                                        {!isHeld(id) && <Pill text={t('profile.switchRole.notSetUp')} bg={C.page} color={C.muted} border />}
                                        {disabled && <Pill text={t('profile.switchRole.comingSoon')} bg="#FFF4E6" color="#C2620A" />}
                                    </View>
                                    <Text className="font-outfit-regular" style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
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
                    style={{ marginTop: 18 }}
                    testID="switch-role-confirm"
                    accessibilityRole="button"
                >
                    <LinearGradient
                        colors={canConfirm ? [C.blue, C.blueDark] : [C.disabled, C.disabled]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}
                    >
                        <Text className="font-outfit-bold" style={{ fontSize: 15.5, color: '#fff' }}>{buttonText}</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </Modal>
    );
}

function Pill({ text, bg, color, border }: { text: string; bg: string; color: string; border?: boolean }) {
    return (
        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100, backgroundColor: bg, borderWidth: border ? 1 : 0, borderColor: C.border }}>
            <Text className="font-outfit-bold" style={{ fontSize: 10.5, color }}>{text}</Text>
        </View>
    );
}
