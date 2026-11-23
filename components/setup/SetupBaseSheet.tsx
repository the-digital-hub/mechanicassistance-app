import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { OwnerSheet } from '@/components/dashboard/OwnerHomeBlocks';
import { AO } from '@/components/offer/OfferSections';
import { TYPE } from '@/lib/ui/type';

/** An address typed in the registration's address step (home / work / other). */
interface SetupAddress {
    street?: string;
    apartment?: string;
    city?: string;
    state?: string;
    zip?: string;
}

export interface SetupAddressProgress {
    type?: 'home' | 'work' | 'other' | string;
    home?: SetupAddress;
    work?: SetupAddress;
    other?: SetupAddress;
    otherLabel?: string;
}

/**
 * Schedule step → Base location: the addresses loaded in the address step come up from the bottom (the sheet the profile has for its saved
 * ones). Tapping one makes it the base the requests are measured from and closes the sheet; "Edit addresses" goes back to the address step.
 */
export function SetupBaseSheet({ visible, address, onPick, onEdit, onClose }: {
    visible: boolean;
    address: SetupAddressProgress | null;
    onPick: (type: 'home' | 'work' | 'other') => void;
    onEdit: () => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const options = (['home', 'work', 'other'] as const)
        .map((type) => ({ type, data: address?.[type] }))
        .filter((o) => !!o.data?.street?.trim());

    return (
        <OwnerSheet visible={visible} title={t('addresses.pickTitle')} subtitle={t('addresses.pickSubtitle')} onClose={onClose}>
            <View testID="setup-base-sheet">
                <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
                    {options.map(({ type, data }) => {
                        const selected = address?.type === type;
                        const name = type === 'other' ? address?.otherLabel?.trim() || t('addresses.name.other') : t(`addresses.name.${type}`);
                        return (
                            <TouchableOpacity
                                key={type}
                                onPress={() => onPick(type)}
                                activeOpacity={0.85}
                                accessibilityRole="radio"
                                accessibilityState={{ selected }}
                                className="flex-row items-center"
                                style={{ gap: 12, padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: selected ? AO.blue : AO.border, backgroundColor: selected ? AO.blueSoft : '#FFFFFF' }}
                                testID={`setup-base-option-${type}`}
                            >
                                <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: selected ? '#FFFFFF' : AO.blueSoft }}>
                                    <Ionicons name="location" size={22} color={AO.blue} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text className="font-outfit-bold" style={{ ...TYPE.eyebrow, letterSpacing: 0.8, color: AO.blue }} numberOfLines={1}>{name.toUpperCase()}</Text>
                                    <Text className="font-outfit-bold" style={{ ...TYPE.option, color: AO.text }} numberOfLines={1}>{data?.street}</Text>
                                    <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: AO.muted }} numberOfLines={1}>
                                        {[data?.city, [data?.state, data?.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                                    </Text>
                                </View>
                                <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={selected ? AO.blue : '#C3CBDD'} />
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                <TouchableOpacity
                    onPress={() => { onClose(); onEdit(); }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    className="flex-row items-center justify-center"
                    style={{ gap: 8, minHeight: 52, borderRadius: 16, backgroundColor: '#E6EAF2', marginTop: 12 }}
                    testID="setup-base-edit-addresses"
                >
                    <Ionicons name="create-outline" size={20} color="#4A5470" />
                    <Text className="font-outfit-bold" style={{ ...TYPE.body, color: '#4A5470' }}>{t('setup.availability.editAddresses')}</Text>
                </TouchableOpacity>
            </View>
        </OwnerSheet>
    );
}
