import { Button } from '@/components/ui/Button';
import { HeaderBackButton } from '@/components/ui/HeaderBackButton';
import { useUser } from '@/context/UserContext';
import { vehicleDAO } from '@/lib/dao/VehicleDAO';
import { MEMBERSHIP_FREE_AT_LAUNCH } from '@/lib/membership/launch';
import { ownerVehiclePrice } from '@/lib/membership/plan';
import { hasVin } from '@/lib/vehicles/duplicateVin';
import { Vehicle } from '@/lib/dao/interfaces';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from "expo-router/react-navigation";
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { VehicleIdsRow } from '@/components/scheduled/ui';
import { VehicleForm, VehicleFormPayload } from '@/components/vehicles/VehicleForm';
import { VehicleFormHeader } from '@/components/vehicles/vehicleFormDesign';
import { appAlert } from '@/lib/ui/appAlert';
import { VehicleTitle, vehicleLine } from '@/components/ui/VehicleTitle';

export default function VehiclesScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { user } = useUser();
    // Opened from "Add vehicle" (a request, the plan): it lands straight on the form and goes back to where it came from when done.
    const { add } = useLocalSearchParams<{ add?: string }>();
    const openedToAdd = add === '1';
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (user?.id) {
            loadVehicles();
        }
    }, [user?.id]);

    // Reset editing state when screen loses/regains focus
    useFocusEffect(
        useCallback(() => {
            if (openedToAdd) {
                setEditingVehicle(null);
                setIsEditing(true);
            }
            return () => {
                // Cleanup on blur: reset to list view
                closeForm();
            };
        }, [openedToAdd])
    );

    // Override header back button based on editing state
    const parentNavigation = useNavigation();
    useEffect(() => {
        parentNavigation.setOptions({
            headerLeft: () => (
                <HeaderBackButton
                    onPress={() => {
                        if (isEditing && !openedToAdd) {
                            closeForm();
                        } else if (router.canGoBack()) {
                            // Back to wherever it was opened from (a request, the profile…).
                            router.back();
                        } else {
                            router.navigate('/(tabs)');
                        }
                    }}
                />
            ),
        });
    }, [isEditing, openedToAdd]);

    const loadVehicles = async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const data = await vehicleDAO.getByUser(user.id);
            setVehicles(data);
        } catch (error) {
            console.error('Failed to load vehicles', error);
        } finally {
            setIsLoading(false);
        }
    };

    const closeForm = () => {
        setIsEditing(false);
        setEditingVehicle(null);
    };

    const handleSaveVehicle = async (payload: VehicleFormPayload) => {
        if (!user?.id) return;
        // A VIN is one vehicle: it is not added twice (the one being edited does not count against itself).
        if (hasVin(vehicles, payload.vin, editingVehicle?.id)) {
            appAlert(t('vehicles.form.duplicateVinTitle'), t('vehicles.form.duplicateVinMessage'));
            return;
        }

        setIsSaving(true);
        try {
            let addedPrice: number | null = null;
            if (editingVehicle?.id) {
                await vehicleDAO.update(editingVehicle.id, payload);
            } else {
                await vehicleDAO.create({ userId: user.id, ...payload });
                // The owner's plan is per vehicle with a VIN: say what this one adds, bonus included.
                if (!MEMBERSHIP_FREE_AT_LAUNCH && user.role !== 'mechanic' && payload.vin?.trim()) addedPrice = ownerVehiclePrice(vehicles.filter((v) => v.vin?.trim()).length);
            }
            closeForm();
            loadVehicles();
            // Came to add one: back to the request (or the plan), which picks the new vehicle up when it is in view again.
            if (openedToAdd && !editingVehicle?.id && router.canGoBack()) router.back();
            if (addedPrice !== null) {
                appAlert(
                    t('membership.fleet.addedTitle'),
                    t('membership.fleet.addedBody', { price: `$${addedPrice.toFixed(2)}` }),
                    [
                        { text: t('membership.fleet.addedSee'), onPress: () => router.push('/(tabs)/membership') },
                        { text: t('membership.fleet.addedLater'), style: 'cancel' },
                    ],
                    { tone: 'info', icon: 'car-outline' },
                );
            }
        } catch (error) {
            console.error('Failed to save vehicle', error);
            appAlert(t('vehicles.form.saveErrorTitle'), t('vehicles.form.saveErrorMessage'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditVehicle = (vehicle: Vehicle) => {
        setEditingVehicle(vehicle);
        setIsEditing(true);
    };

    const handleDeleteVehicle = (vehicle: Vehicle) => {
        if (!vehicle.id) return;
        const id = vehicle.id;
        appAlert(
            t('vehicles.deleteTitle'),
            t('vehicles.deleteMessage', { vehicle: vehicleLine(vehicle) }),
            [
                { text: t('vehicles.cancel'), style: 'cancel' },
                {
                    text: t('vehicles.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await vehicleDAO.delete(id);
                            loadVehicles();
                        } catch (error) {
                            console.error('Failed to delete vehicle', error);
                        }
                    },
                },
            ]
        );
    };

    if (isLoading) {
        return (
            <View className="flex-1 bg-white justify-center items-center">
                <ActivityIndicator size="large" color="#0047AB" />
            </View>
        );
    }

    if (isEditing) {
        return (
            <VehicleForm
                topInset={32}
                key={editingVehicle?.id ?? 'new'}
                initialValue={editingVehicle ?? undefined}
                submitLabel={t('vehicles.saveVehicle')}
                submitting={isSaving}
                onSubmit={handleSaveVehicle}
                header={
                    <VehicleFormHeader
                        badge={t('vehicles.badge')}
                        title={editingVehicle ? t('vehicles.editVehicleTitle') : t('vehicles.addVehicleTitle')}
                        subtitle={t('vehicles.addVehicleSubtitle')}
                    />
                }
            />
        );
    }

    return (
        <View className="flex-1 px-6 pt-4" style={{ backgroundColor: '#F6F8FC' }}>
            {/* Section Badge */}
            <View style={{ marginTop: 18 }}>
              <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
              <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
              <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                {t('vehicles.listBadge')}
              </Text>
            </View>
            </View>

            {/* Title */}
            <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">{t('vehicles.listTitle', { count: vehicles.length })}</Text>

            {/* Subtitle */}
            <Text className="text-gray-500 font-outfit-regular text-base mb-6">
              {t('vehicles.listSubtitle', { count: vehicles.length })}
            </Text>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {vehicles.length === 0 ? (
                    <View className="items-center justify-center pt-20">
                        <Text className="text-slate-400 font-outfit-medium text-lg mb-4">{t('vehicles.noVehicles')}</Text>
                        <Button onPress={() => setIsEditing(true)} className="bg-blue-700 rounded-2xl px-12">{t('vehicles.addFirstVehicle')}</Button>
                    </View>
                ) : (
                    vehicles.map((v) => (
                        <TouchableOpacity
                            key={v.id}
                            onPress={() => handleEditVehicle(v)}
                            className="bg-white rounded-2xl p-5 mb-4 border border-gray-300 flex-row items-center"
                        >
                            <View className="flex-1">
                                <Text className="text-lg font-outfit-bold text-[#0F172A] uppercase"><VehicleTitle vehicle={v} /></Text>
                                <VehicleIdsRow plate={v.plate} vin={v.vin} plateLabel={t('requestAssistance.selectVehicle.plate')} />
                            </View>
                            <TouchableOpacity onPress={() => handleDeleteVehicle(v)} className="p-2">
                                <Ionicons name="trash-outline" size={20} color="#EF4444" style={{ opacity: 0.6 }} />
                            </TouchableOpacity>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            {/* Add Vehicle Button */}
            <TouchableOpacity
              onPress={() => setIsEditing(true)}
              activeOpacity={0.8}
              className="mb-8"
            >
              <LinearGradient
                colors={['#2B66F8', '#081E72']}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={{
                  borderRadius: 14,
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                }}
              >
                <Text className="text-white font-outfit-bold text-center mr-2" style={{ fontSize: 18 }}>{t('vehicles.addVehicles')}</Text>
                <ChevronRight size={20} color="white" />
              </LinearGradient>
            </TouchableOpacity>
        </View>
    );
}
