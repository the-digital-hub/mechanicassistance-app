import { RequestSteps } from '@/components/ui/RequestSteps';
import { CARD_STYLE, Chip, ChoiceCard, FieldLabel, Footer, StepHead, TextField, VehicleIdsRow, WizardHeader, SC } from '@/components/scheduled/ui';
import { useRequestDraft } from '@/context/RequestDraftContext';
import { useUser } from '@/context/UserContext';
import { vehicleDAO } from '@/lib/dao/VehicleDAO';
import { Vehicle } from '@/lib/dao/interfaces';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Car, Plus } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';

/** Strips the grouping separators the placeholder suggests ("45,230") before parsing. */
const parseMileage = (raw: string): number | undefined => {
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits === '') return undefined;
    const value = Number(digits);
    return Number.isFinite(value) ? value : undefined;
};

export default function SelectVehicleScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { type, entry } = params; // type: 'immediate', 'scheduled', 'videocall'
    const { user } = useUser();
    const { setVehicleDetails } = useRequestDraft();

    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selected, setSelected] = useState<Vehicle | null>(null);
    const [mileage, setMileage] = useState('');
    const [isOwner, setIsOwner] = useState(true);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');

    // The tab stack keeps this screen mounted after the flow leaves it, so a new attempt
    // can land on the previous one's details step. A new `entry` means a new attempt;
    // coming back from the next step keeps the same one.
    useEffect(() => {
        setSelected(null);
        setMileage('');
        setIsOwner(true);
        setFirstName('');
        setLastName('');
        setPhone('');
    }, [entry]);

    // On focus, not mount: picks up a vehicle added through "Add vehicle".
    useFocusEffect(
        useCallback(() => {
            if (!user?.id) return;
            const userId = user.id;
            let active = true;
            (async () => {
                try {
                    const data = await vehicleDAO.getByUser(userId);
                    if (active) setVehicles(data);
                } catch (error) {
                    console.error('Failed to load vehicles', error);
                } finally {
                    if (active) setIsLoading(false);
                }
            })();
            return () => {
                active = false;
            };
        }, [user?.id])
    );

    const handleSelectVehicle = (vehicle: Vehicle) => {
        setSelected(vehicle);
        // Pre-fill with the last known reading so the driver only edits it when it changed.
        setMileage(vehicle.mileage != null ? String(vehicle.mileage) : '');
    };

    const handleBack = () => router.back();

    // When the account holder is the one in the vehicle their account details apply, so
    // the name/phone fields stay empty and must not gate the button.
    const canContinue = !!selected && (isOwner || (!!firstName.trim() && !!lastName.trim() && !!phone.trim()));

    const handleContinue = () => {
        if (!selected || !canContinue) return;

        const parsedMileage = parseMileage(mileage);

        setVehicleDetails({
            mileage: parsedMileage,
            driverIsOwner: isOwner,
            driverFirstName: isOwner ? '' : firstName.trim(),
            driverLastName: isOwner ? '' : lastName.trim(),
            driverPhone: isOwner ? '' : phone.trim(),
        });

        // Keep the vehicle's last known reading current. Fire-and-forget: the request
        // itself carries the snapshot, so a failed PATCH must not block the flow.
        if (selected.id && parsedMileage !== undefined && parsedMileage !== selected.mileage) {
            vehicleDAO
                .update(selected.id, { mileage: parsedMileage })
                .catch(error => console.error('Failed to update vehicle mileage', error));
        }

        router.push({
            pathname: '/request-assistance/issue-selection',
            params: {
                type,
                vehicleId: selected.id,
                vehicleName: `${selected.make} ${selected.model}`,
            },
        });
    };

    const getTitle = () => {
        switch (type) {
            case 'immediate': return t('requestAssistance.header.immediate');
            case 'scheduled': return t('requestAssistance.header.scheduled');
            case 'videocall': return t('requestAssistance.header.videoCall');
            case 'witness': return t('requestAssistance.header.accident');
            default: return t('requestAssistance.header.default');
        }
    };

    const vehicleName = (v: Vehicle) => [v.year, v.make, v.model].filter(Boolean).join(' ');

    return (
        <View className="flex-1" style={{ backgroundColor: '#F4F6FC' }}>
            <WizardHeader title={getTitle()} onBack={handleBack} />
            <RequestSteps type={params.type} step="vehicle" />

            <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    className="flex-1"
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 28, gap: 20 }}
                >
                    <StepHead
                        eyebrow={t('requestAssistance.selectVehicle.badge')}
                        title={t('requestAssistance.selectVehicle.title')}
                        sub={t('requestAssistance.selectVehicle.subtitle')}
                    />

                    {isLoading ? (
                        <ActivityIndicator color={SC.blue} style={{ marginTop: 24 }} />
                    ) : vehicles.length === 0 ? (
                        <View style={{ ...CARD_STYLE, padding: 20, alignItems: 'center', gap: 10 }}>
                            <Car size={28} color={SC.blue} />
                            <Text className="font-outfit-bold text-center" style={{ fontSize: 15, color: SC.text }}>{t('requestAssistance.selectVehicle.noVehicles')}</Text>
                        </View>
                    ) : (
                        <View style={{ gap: 10 }}>
                            {vehicles.map((v) => {
                                return (
                                    <ChoiceCard
                                        key={v.id}
                                        on={selected?.id === v.id}
                                        onPress={() => handleSelectVehicle(v)}
                                        title={vehicleName(v)}
                                        detail={<VehicleIdsRow plate={v.plate} vin={v.vin} plateLabel={t('requestAssistance.selectVehicle.plate')} />}
                                    />
                                );
                            })}
                        </View>
                    )}

                    {/* Outside the loading branch: the user can add a vehicle before the list resolves. */}
                    {!isLoading ? (
                        <TouchableOpacity
                            onPress={() => router.push('/(tabs)/vehicles')}
                            accessibilityRole="button"
                            activeOpacity={0.85}
                            className="flex-row items-center self-start rounded-full"
                            style={{ gap: 8, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: SC.blueSoft }}
                            testID="select-vehicle-add"
                        >
                            <Plus size={18} color={SC.blue} />
                            <Text className="font-outfit-bold" style={{ fontSize: 16, lineHeight: 22, color: SC.blue }}>{t('requestAssistance.selectVehicle.addVehicle')}</Text>
                        </TouchableOpacity>
                    ) : null}

                    {selected ? (
                        <>
                            <View>
                                <FieldLabel>{t('requestAssistance.vehicleDetails.mileageLabel')}</FieldLabel>
                                <TextField
                                    value={mileage}
                                    onChangeText={(v) => setMileage(v.replace(/[^0-9,]/g, ''))}
                                    keyboardType="number-pad"
                                    placeholder={t('requestAssistance.vehicleDetails.mileagePlaceholder')}
                                    maxLength={9}
                                />
                                <Text className="font-outfit-regular" style={{ fontSize: 13, color: SC.muted, marginTop: 6 }}>{t('scheduled.vehicle.mileageHint')}</Text>
                            </View>

                            <View>
                                <Text className="font-outfit-bold" style={{ fontSize: 17, lineHeight: 22, color: SC.text, marginBottom: 10 }}>{t(type === 'videocall' ? 'requestAssistance.vehicleDetails.whoJoinsCall' : 'requestAssistance.vehicleDetails.whoIsInVehicle')}</Text>
                                <View className="flex-row" style={{ gap: 8, marginBottom: isOwner ? 0 : 12 }}>
                                    <Chip on={isOwner} onPress={() => setIsOwner(true)}>{t(type === 'videocall' ? 'requestAssistance.vehicleDetails.iAmVideo' : 'requestAssistance.vehicleDetails.iAm')}</Chip>
                                    <Chip on={!isOwner} onPress={() => setIsOwner(false)}>{t('requestAssistance.vehicleDetails.someoneElse')}</Chip>
                                </View>
                                {!isOwner ? (
                                    <View style={{ gap: 12 }}>
                                        <View className="flex-row" style={{ gap: 10 }}>
                                            <View style={{ flex: 1 }}>
                                                <FieldLabel>{t('requestAssistance.vehicleDetails.firstName')}</FieldLabel>
                                                <TextField value={firstName} onChangeText={setFirstName} autoCapitalize="words" placeholder={t('requestAssistance.vehicleDetails.firstNamePlaceholder')} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <FieldLabel>{t('requestAssistance.vehicleDetails.lastName')}</FieldLabel>
                                                <TextField value={lastName} onChangeText={setLastName} autoCapitalize="words" placeholder={t('requestAssistance.vehicleDetails.lastNamePlaceholder')} />
                                            </View>
                                        </View>
                                        <View>
                                            <FieldLabel>{t('requestAssistance.vehicleDetails.phone')}</FieldLabel>
                                            <TextField value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder={t('requestAssistance.vehicleDetails.phonePlaceholder')} />
                                        </View>
                                    </View>
                                ) : (
                                    <Text className="font-outfit-regular" style={{ fontSize: 13, color: SC.muted, marginTop: 6 }}>{t('requestAssistance.vehicleDetails.hintOwner')}</Text>
                                )}
                            </View>
                        </>
                    ) : null}
                </ScrollView>
            </KeyboardAvoidingView>

            <Footer label={t('requestAssistance.continue')} disabled={!canContinue} onPress={handleContinue} />
        </View>
    );
}
