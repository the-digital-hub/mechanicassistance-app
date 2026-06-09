import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUser } from '@/context/UserContext';
import { vehicleDAO } from '@/lib/dao/VehicleDAO';
import { Vehicle } from '@/lib/dao/interfaces';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { MakeType, VEHICLE_COLORS, VEHICLE_DATA, decodeVin } from '@/lib/vehicle';

export default function VehiclesScreen() {
    const router = useRouter();
    const { user } = useUser();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
    const [activeModal, setActiveModal] = useState<'make' | 'model' | null>(null);
    const [isVinSearching, setIsVinSearching] = useState(false);

    const scrollViewRef = useRef<ScrollView>(null);
    const detailsContainerRef = useRef<View>(null);

    const scrollToField = (fieldRef: React.RefObject<View | null>) => {
        if (!fieldRef.current || !scrollViewRef.current) return;

        fieldRef.current.measureLayout(
            scrollViewRef.current as any,
            (_x, y) => scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 100), animated: true }),
            () => { }
        );
    };

    // Form state
    const [formData, setFormData] = useState({
        make: 'Select',
        model: 'Select',
        color: '',
        plate: '',
        vin: '',
        details: ''
    });

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
                setIsEditing(false);
                setEditingVehicleId(null);
                setActiveModal(null);
                resetForm();
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
                            setIsEditing(false);
                            setEditingVehicleId(null);
                            resetForm();
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

    const handleSelectMake = (make: string) => {
        setFormData(prev => ({ ...prev, make, model: 'Select' }));
        setActiveModal(null);
    };

    const handleSelectModel = (model: string) => {
        setFormData(prev => ({ ...prev, model }));
        setActiveModal(null);
    };

    const handleSaveVehicle = async () => {
        if (!user?.id) return;

        try {
            if (editingVehicleId) {
                await vehicleDAO.update(editingVehicleId, formData);
            } else {
                await vehicleDAO.create({
                    userId: user.id,
                    ...formData
                });
            }
            setIsEditing(false);
            setEditingVehicleId(null);
            resetForm();
            loadVehicles();
        } catch (error) {
            console.error('Failed to save vehicle', error);
        }
    };

    const handleEditVehicle = (vehicle: Vehicle) => {
        setFormData({
            make: vehicle.make,
            model: vehicle.model,
            color: vehicle.color,
            plate: vehicle.plate,
            vin: vehicle.vin,
            details: vehicle.details
        });
        setEditingVehicleId(vehicle.id ?? null);
        setIsEditing(true);
    };

    const handleDeleteVehicle = async (id: string) => {
        try {
            await vehicleDAO.delete(id);
            loadVehicles();
        } catch (error) {
            console.error('Failed to delete vehicle', error);
        }
    };

    const resetForm = () => {
        setFormData({
            make: 'Select',
            model: 'Select',
            color: '',
            plate: '',
            vin: '',
            details: ''
        });
    };

    const handleVinLookup = async () => {
        const vin = formData.vin.trim();
        if (vin.length !== 17) {
            Alert.alert('Invalid VIN', 'A VIN must be exactly 17 characters.');
            return;
        }

        setIsVinSearching(true);
        try {
            await decodeVin(
                vin,
                (make, model) => {
                    setFormData(prev => ({
                        ...prev,
                        make,
                        model,
                    }));
                    Alert.alert(
                        'VIN Decoded',
                        `Found: ${make} ${model}`,
                        [{ text: 'OK' }]
                    );
                },
                (errorMsg) => {
                    Alert.alert('VIN Not Found', errorMsg);
                }
            );
        } finally {
            setIsVinSearching(false);
        }
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
                    ref={scrollViewRef}
                    className="flex-1"
                    style={{ backgroundColor: '#F6F8FC' }}
                    contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Section Badge */}
                    <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                      <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                      <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                        YOUR INFORMATION
                      </Text>
                    </View>

                    {/* Title */}
                    <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">Add vehicle</Text>

                    {/* Subtitle */}
                    <Text className="text-gray-500 font-outfit-regular text-base mb-6">
                      Register your vehicle to request assistance
                    </Text>

                    <View className="gap-4 mb-8">
                        <View>
                            <Text className="font-outfit-medium text-[#0F172A] mb-2">Vehicle make</Text>
                            <TouchableOpacity
                                onPress={() => setActiveModal('make')}
                                className="bg-white border border-gray-300 h-12 flex-row items-center justify-between px-4 rounded-[10px]"
                            >
                                <Text className="text-[#0F172A] font-outfit-regular">{formData.make}</Text>
                                <Ionicons name="chevron-down" size={20} color="#0047AB" />
                            </TouchableOpacity>
                        </View>

                        <View>
                            <Text className="font-outfit-medium text-[#0F172A] mb-2">Vehicle model</Text>
                            <TouchableOpacity
                                onPress={() => formData.make !== 'Select' && setActiveModal('model')}
                                className={`bg-white border border-gray-300 h-12 flex-row items-center justify-between px-4 rounded-[10px] ${formData.make === 'Select' ? 'opacity-50' : ''}`}
                            >
                                <Text className="text-[#0F172A] font-outfit-regular">{formData.model}</Text>
                                <Ionicons name="chevron-down" size={20} color="#0047AB" />
                            </TouchableOpacity>
                        </View>

                        <View>
                            <Text className="font-outfit-medium text-[#0F172A] mb-2">Color</Text>
                            <View className="flex-row gap-3">
                                {VEHICLE_COLORS.map((c) => {
                                    const isSelected = formData.color === c.name;
                                    return (
                                        <TouchableOpacity
                                            key={c.name}
                                            onPress={() => setFormData(p => ({ ...p, color: c.name }))}
                                            style={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: 12,
                                                backgroundColor: c.hex,
                                                borderWidth: isSelected ? 3 : 1,
                                                borderColor: isSelected ? '#0047AB' : c.border,
                                            }}
                                        >
                                            {isSelected && (
                                                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                                    <Ionicons name="checkmark" size={24} color={c.name === 'White' ? '#0047AB' : '#FFFFFF'} />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            {formData.color ? (
                                <Text className="text-xs font-outfit-medium text-blue-600 mt-2">{formData.color}</Text>
                            ) : null}
                        </View>

                        <View>
                            <Text className="font-outfit-medium text-[#0F172A] mb-2">License plate #</Text>
                            <Input
                                value={formData.plate}
                                onChangeText={(text) => setFormData(p => ({ ...p, plate: text }))}
                                containerClassName="bg-white border border-gray-300 h-12 rounded-[10px]"
                            />
                        </View>

                        <View>
                            <Text className="font-outfit-medium text-[#0F172A] mb-2">VIN #</Text>
                            <View className="flex-row items-center gap-2">
                                <View className="flex-1">
                                    <Input
                                        value={formData.vin}
                                        onChangeText={(text) => {
                                            if (text.includes('.')) {
                                                setFormData(p => ({ ...p, vin: '5YJ3E1EB9NF000001' }));
                                            } else {
                                                setFormData(p => ({ ...p, vin: text.toUpperCase() }));
                                            }
                                        }}
                                        containerClassName="bg-white border border-gray-300 h-12 rounded-[10px]"
                                        maxLength={17}
                                        autoCapitalize="characters"
                                        placeholder="Enter 17-character VIN"
                                    />
                                </View>
                                <TouchableOpacity
                                    onPress={handleVinLookup}
                                    disabled={isVinSearching || formData.vin.trim().length !== 17}
                                    style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 12,
                                        backgroundColor: formData.vin.trim().length === 17 ? '#0047AB' : '#CBD5E1',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    {isVinSearching ? (
                                        <ActivityIndicator size="small" color="white" />
                                    ) : (
                                        <Ionicons name="search" size={22} color="white" />
                                    )}
                                </TouchableOpacity>
                            </View>
                            <Text className="text-xs font-outfit-regular text-slate-400 mt-1">
                                Enter VIN and tap search to auto-fill Make & Model
                            </Text>
                        </View>

                        <View ref={detailsContainerRef}>
                            <Text className="font-outfit-medium text-[#0F172A] mb-2">Further details</Text>
                            <TextInput
                                multiline
                                numberOfLines={3}
                                value={formData.details}
                                onChangeText={(text) => setFormData(p => ({ ...p, details: text }))}
                                onFocus={() => scrollToField(detailsContainerRef)}
                                className="bg-white border border-gray-300 rounded-[10px] p-4 font-outfit-regular text-[#0F172A] text-base h-24"
                                style={{ textAlignVertical: 'top' }}
                            />
                        </View>

                        <TouchableOpacity
                            onPress={handleSaveVehicle}
                            disabled={formData.make === 'Select' || formData.model === 'Select'}
                            activeOpacity={0.8}
                        >
                            {formData.make !== 'Select' && formData.model !== 'Select' ? (
                                <LinearGradient
                                    colors={['#2B66F8', '#081E72']}
                                    start={{ x: 0, y: 1 }}
                                    end={{ x: 1, y: 0 }}
                                    style={{
                                        borderRadius: 10,
                                        paddingVertical: 16,
                                        paddingHorizontal: 16,
                                        marginTop: 16,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Text className="text-white font-outfit-bold text-center mr-2">Save Vehicle</Text>
                                    <ChevronRight size={20} color="white" />
                                </LinearGradient>
                            ) : (
                                <View
                                    style={{
                                        borderRadius: 10,
                                        paddingVertical: 16,
                                        paddingHorizontal: 16,
                                        marginTop: 16,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: '#E5E7EB'
                                    }}
                                >
                                    <Text className="text-gray-400 font-outfit-bold text-center mr-2">Save Vehicle</Text>
                                    <ChevronRight size={20} color="#9CA3AF" />
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Selection Modal */}
                    <Modal visible={!!activeModal} transparent animationType="slide">
                        <View className="flex-1 bg-black/40 justify-end">
                            <View className="bg-white rounded-t-3xl min-h-[50%] max-h-[80%] p-6">
                                <View className="flex-row justify-between items-center mb-6">
                                    <Text className="text-xl font-outfit-bold text-[#0F172A]">Select {activeModal === 'make' ? 'Make' : 'Model'}</Text>
                                    <TouchableOpacity onPress={() => setActiveModal(null)}><Text className="text-blue-600 font-outfit-bold">Done</Text></TouchableOpacity>
                                </View>
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    {activeModal === 'make' ? (
                                        Object.keys(VEHICLE_DATA).map(make => (
                                            <TouchableOpacity key={make} className="py-4 border-b border-slate-50" onPress={() => handleSelectMake(make)}>
                                                <Text className={`text-lg font-outfit-medium ${formData.make === make ? 'text-blue-600' : 'text-[#0F172A]'}`}>{make}</Text>
                                            </TouchableOpacity>
                                        ))
                                    ) : (
                                        formData.make !== 'Select' && (VEHICLE_DATA[formData.make as MakeType] || []).map(model => (
                                            <TouchableOpacity key={model} className="py-4 border-b border-slate-50" onPress={() => handleSelectModel(model)}>
                                                <Text className={`text-lg font-outfit-medium ${formData.model === model ? 'text-blue-600' : 'text-[#0F172A]'}`}>{model}</Text>
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </ScrollView>
                            </View>
                        </View>
                    </Modal>
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
                VEHICLE MANAGEMENT
              </Text>
            </View>

            {/* Title */}
            <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">My vehicles</Text>

            {/* Subtitle */}
            <Text className="text-gray-500 font-outfit-regular text-base mb-6">
              Register and manage your vehicles for faster assistance requests
            </Text>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {vehicles.length === 0 ? (
                    <View className="items-center justify-center pt-20">
                        <Text className="text-slate-400 font-outfit-medium text-lg mb-4">No vehicles registered</Text>
                        <Button onPress={() => setIsEditing(true)} className="bg-blue-700 rounded-2xl px-12">Add First Vehicle</Button>
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
                                <Text className="text-blue-600 font-outfit-medium text-xs tracking-widest uppercase mt-1">{v.plate || 'No Plate'}</Text>
                            </View>
                            <TouchableOpacity onPress={() => v.id && handleDeleteVehicle(v.id)} className="p-2">
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
                <Text className="text-white font-outfit-bold text-center mr-2">Add Vehicles</Text>
                <ChevronRight size={20} color="white" />
              </LinearGradient>
            </TouchableOpacity>
        </View>
    );
}
