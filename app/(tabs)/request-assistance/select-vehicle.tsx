import { useUser } from '@/context/UserContext';
import { vehicleDAO } from '@/lib/dao/VehicleDAO';
import { Vehicle } from '@/lib/dao/interfaces';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Car, ChevronLeft, Plus } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function SelectVehicleScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { type } = params; // 'immediate', 'scheduled', 'videocall'
    const { user } = useUser();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (user?.id) {
            loadVehicles();
        }
    }, [user?.id]);

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

    const handleSelectVehicle = (vehicle: Vehicle) => {
        router.push({
            pathname: '/request-assistance/issue-selection',
            params: {
                type,
                vehicleId: vehicle.id,
                vehicleName: `${vehicle.make} ${vehicle.model}`
            }
        });
    };

    const getTitle = () => {
        switch (type) {
            case 'immediate': return 'Immediate Assistance';
            case 'scheduled': return 'Scheduled Assistance';
            case 'videocall': return 'Video Call Assistance';
            case 'witness': return 'Accident Assistance';
            default: return 'Assistance';
        }
    };

    return (
        <View className="flex-1 bg-white">
            {/* Custom Header */}
            <View className="px-6 pt-20 pb-2 flex-row items-center justify-between" style={{ backgroundColor: '#F4F5FA', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 3, borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB' }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <View className="w-10 h-10 rounded-full justify-center items-center" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
                        <ChevronLeft size={20} color="#0047AB" />
                    </View>
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Outfit_500Medium', fontSize: 18, color: '#1A1A1A', flex: 1, textAlign: 'center' }}>
                    {getTitle()}
                </Text>
                <View className="w-6" />
            </View>

            <ScrollView className="flex-1 px-6 pt-6">
                <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                    <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">SELECT YOUR VEHICLE</Text>
                </View>

                <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">Vehicles</Text>

                <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                    Which vehicle has the issue?
                </Text>

                {isLoading ? (
                    <ActivityIndicator size="large" color="#0047AB" className="mt-8" />
                ) : (
                    <View>
                        {vehicles.length === 0 ? (
                            <Text className="text-center text-gray-500 font-outfit-regular my-4">No vehicles found. Please add one.</Text>
                        ) : (
                            vehicles.map((vehicle) => (
                                <TouchableOpacity
                                    key={vehicle.id}
                                    onPress={() => handleSelectVehicle(vehicle)}
                                    className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex-row items-center shadow-sm active:bg-blue-50"
                                >
                                    <View className="w-10 h-10 bg-blue-50 rounded-full justify-center items-center mr-4">
                                        <Car size={20} color="#0047AB" />
                                    </View>
                                    <View>
                                        <Text className="font-outfit-bold text-[#0F172A] text-base uppercase">
                                            {vehicle.make} {vehicle.model}
                                        </Text>
                                        <Text className="font-outfit-medium text-blue-500 text-xs tracking-widest uppercase">
                                            {vehicle.plate || 'NO PLATE'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}

                        <TouchableOpacity
                            onPress={() => router.push('/(tabs)/vehicles')}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#2B66F8', '#081E72']}
                                start={{ x: 0, y: 1 }}
                                end={{ x: 1, y: 0 }}
                                style={{
                                    borderRadius: 24,
                                    paddingVertical: 16,
                                    paddingHorizontal: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginTop: 32
                                }}
                            >
                                <Plus size={20} color="#FFFFFF" />
                                <Text className="font-outfit-bold text-white ml-2">Add a vehicle</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
