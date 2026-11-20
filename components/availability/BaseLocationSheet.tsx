import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { AO } from '@/components/offer/OfferSections';
import { SheetDim } from '@/components/ui/SheetDim';
import { SheetHandle } from '@/components/ui/SheetHandle';
import { useUser } from '@/context/UserContext';
import { addressDisplayName, addressesForRole } from '@/lib/address';
import { ApiError } from '@/lib/api/types';
import { addressDAO } from '@/lib/dao/AddressDAO';
import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';
import { SHEET } from '@/lib/ui/sheet';
import { appAlert } from '@/lib/ui/appAlert';
import { TYPE } from '@/lib/ui/type';

/**
 * Working hours → Base location: the work addresses come up from the bottom; tapping one makes it the base the
 * requests are measured from (the server keeps one per account) and closes the sheet.
 */
export function BaseLocationSheet({ visible, onClose, onPicked }: { visible: boolean; onClose: () => void; onPicked?: () => void }) {
    const { t } = useTranslation();
    const router = useRouter();
    const { user, refreshAddresses } = useUser();
    const [savingId, setSavingId] = useState<string | null>(null);

    // The session keeps the addresses it read at sign-in: read them again each time this opens, so the roles and the
    // current base are the server's.
    useEffect(() => {
        if (visible) void refreshAddresses().catch(() => undefined);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    // A work address, or one shared between roles: the home of the vehicle owner cannot be a base.
    const options = addressesForRole(user?.addresses, user?.role).filter((a) => a.id);

    const pick = async (id: string) => {
        if (savingId) return;
        setSavingId(id);
        try {
            await addressDAO.setServiceBase(id);
            await refreshAddresses().catch(() => undefined);
            onPicked?.();
            onClose();
        } catch (error) {
            const code = error instanceof ApiError && error.apiError && typeof error.apiError === 'object' ? (error.apiError as { code?: unknown }).code : undefined;
            const message =
                code === 'address_not_for_service'
                    ? t('addresses.setBaseNotForService')
                    : code === 'address_without_location'
                        ? t('addresses.setBaseWithoutLocation')
                        : t('addresses.setBaseFailedMessage');
            appAlert(t('addresses.setBaseFailedTitle'), message);
        } finally {
            setSavingId(null);
        }
    };

    return (
        <Modal supportedOrientations={MODAL_ORIENTATIONS} transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <SheetDim />
            <Pressable style={{ flex: 1 }} onPress={onClose} />
            <View style={{ ...SHEET, paddingTop: 12, paddingBottom: 28, maxHeight: '75%' }} testID="base-location-sheet">
                <SheetHandle />
                <View style={{ paddingHorizontal: 20 }}>
                    <Text className="font-outfit-bold" style={{ ...TYPE.section, color: AO.text }}>{t('addresses.pickTitle')}</Text>
                    <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: AO.muted, marginTop: 4 }}>{t('addresses.pickSubtitle')}</Text>
                </View>

                <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, gap: 10 }} showsVerticalScrollIndicator={false}>
                    {options.map((a) => {
                        const selected = !!a.isServiceBase;
                        const name = addressDisplayName(a, t);
                        return (
                            <TouchableOpacity
                                key={a.id}
                                onPress={() => a.id && void pick(a.id)}
                                disabled={savingId !== null}
                                activeOpacity={0.85}
                                accessibilityRole="radio"
                                accessibilityState={{ selected }}
                                className="flex-row items-center"
                                style={{ gap: 12, padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: selected ? AO.blue : AO.border, backgroundColor: selected ? AO.blueSoft : '#FFFFFF' }}
                                testID={`base-option-${a.id}`}
                            >
                                <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: selected ? '#FFFFFF' : AO.blueSoft }}>
                                    <Ionicons name="location" size={22} color={AO.blue} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    {name ? <Text className="font-outfit-bold" style={{ ...TYPE.eyebrow, letterSpacing: 0.8, color: AO.blue }} numberOfLines={1}>{name.toUpperCase()}</Text> : null}
                                    <Text className="font-outfit-bold" style={{ ...TYPE.option, color: AO.text }} numberOfLines={1}>{a.street}</Text>
                                    <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: AO.muted }} numberOfLines={1}>{[a.city, [a.state, a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</Text>
                                </View>
                                {savingId === a.id ? (
                                    <ActivityIndicator color={AO.blue} />
                                ) : (
                                    <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={selected ? AO.blue : '#C3CBDD'} />
                                )}
                            </TouchableOpacity>
                        );
                    })}

                    <TouchableOpacity
                        onPress={() => { onClose(); router.push('/(tabs)/addresses/create'); }}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        className="flex-row items-center justify-center"
                        style={{ gap: 8, minHeight: 52, borderRadius: 16, backgroundColor: '#E6EAF2', marginTop: 4 }}
                        testID="base-add-address"
                    >
                        <Ionicons name="add" size={22} color="#4A5470" />
                        <Text className="font-outfit-bold" style={{ ...TYPE.body, color: '#4A5470' }}>{t('addresses.addNew')}</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </Modal>
    );
}
