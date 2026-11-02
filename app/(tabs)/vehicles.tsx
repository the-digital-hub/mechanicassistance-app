import { Button } from '@/components/ui/Button';
import { useUser } from '@/context/UserContext';
import { vehicleDAO } from '@/lib/dao/VehicleDAO';
import { Vehicle } from '@/lib/dao/interfaces';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { VehicleForm, VehicleFormPayload } from '@/components/vehicles/VehicleForm';

export default function VehiclesScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { user } = useUser();
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
            return () => {
                // Cleanup on blur: reset to list view
                closeForm();
            };
        }, [])
    );

    // Override header back button based on editing state
    const parentNavigation = useNavigation();
    useEffect(() => {
        parentNavigation.setOptions({
            headerLeft: () => (
                <TouchableOpacity
                    onPress={() => {
                        if (isEditing) {
                            closeForm();
                        } else {
                            router.navigate('/(tabs)');
                        }
                    }}
                    style={{ marginLeft: 16 }}
                >
                    <Ionicons name="chevron-back" size={24} color="#0047AB" />
                </TouchableOpacity>
            ),
        });
    }, [isEditing]);

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

        setIsSaving(true);
        try {
            if (editingVehicle?.id) {
                await vehicleDAO.update(editingVehicle.id, payload);
            } else {
                await vehicleDAO.create({ userId: user.id, ...payload });
            }
            closeForm();
            loadVehicles();
        } catch (error) {
            console.error('Failed to save vehicle', error);
            Alert.alert(t('vehicles.form.saveErrorTitle'), t('vehicles.form.saveErrorMessage'));
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
        Alert.alert(
            t('vehicles.deleteTitle'),
            t('vehicles.deleteMessage', { vehicle: `${vehicle.make} ${vehicle.model}`.trim() }),
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
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <ScrollView
                    className="flex-1"
                    style={{ backgroundColor: '#F6F8FC' }}
                    contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Section Badge */}
                    <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                      <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                      <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                        {t('vehicles.badge')}
                      </Text>
                    </View>

                    {/* Title */}
                    <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">{editingVehicle ? t('vehicles.editVehicleTitle') : t('vehicles.addVehicleTitle')}</Text>

                    {/* Subtitle */}
                    <Text className="text-gray-500 font-outfit-regular text-base mb-6">
                      {t('vehicles.addVehicleSubtitle')}
                    </Text>

                    <VehicleForm
                        key={editingVehicle?.id ?? 'new'}
                        initialValue={editingVehicle ?? undefined}
                        submitLabel={t('vehicles.saveVehicle')}
                        submitting={isSaving}
                        onSubmit={handleSaveVehicle}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        );
    }

    return (
        <View className="flex-1 px-6 pt-4" style={{ backgroundColor: '#F6F8FC' }}>
            {/* Section Badge */}
            <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
              <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
              <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                {t('vehicles.listBadge')}
              </Text>
            </View>

            {/* Title */}
            <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">{t('vehicles.listTitle')}</Text>

            {/* Subtitle */}
            <Text className="text-gray-500 font-outfit-regular text-base mb-6">
              {t('vehicles.listSubtitle')}
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
                                <Text className="text-lg font-outfit-bold text-[#0F172A] uppercase">{v.make} {v.model}</Text>
                                <Text className="text-blue-600 font-outfit-medium text-xs tracking-widest uppercase mt-1">{v.plate || t('vehicles.noPlate')}</Text>
                            </View>
                            <TouchableOpacity onPress={() => handleDeleteVehicle(v)} className="p-2">
                                <Ionicons name="trash-outline" size={20} color="#EF4444" style={{ opacity: 0.6 }} />
                            </TouchableOpacity>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            {/* Add Vehicles Button */}
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
                  borderRadius: 10,
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                }}
              >
                <Text className="text-white font-outfit-bold text-center mr-2">{t('vehicles.addVehicles')}</Text>
                <ChevronRight size={20} color="white" />
              </LinearGradient>
            </TouchableOpacity>
        </View>
    );
}
