import { useUser } from '@/context/UserContext';
import { vehicleDAO } from '@/lib/dao/VehicleDAO';
import { Vehicle } from '@/lib/dao/interfaces';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Car, ChevronLeft, Plus } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

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
            <View className="px-6 pt-14 pb-4 border-b border-gray-100 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <ChevronLeft size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text className="text-xl font-outfit-bold text-[#0F172A] flex-1 text-center">
                    {getTitle()}
                </Text>
                <TouchableOpacity onPress={() => router.replace('/(tabs)/assist')} className="ml-4">
                    <Text className="text-red-500 font-outfit-medium text-xs">Cancel</Text>
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-6 pt-6">
                <Text className="text-blue-600 font-outfit-bold text-lg mb-1">Select your vehicle</Text>

                <View className="mb-6">
                    <Text className="font-outfit-bold text-[#0F172A] text-base mb-1">Vehicle</Text>
                    <Text className="text-gray-500 font-outfit-regular text-sm">Which vehicle has the issue?</Text>
                </View>

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
                            className="flex-row items-center justify-center py-4 mt-2"
                        >
                            <Plus size={20} color="#0047AB" />
                            <Text className="font-outfit-bold text-[#0047AB] ml-2">Add a vehicle</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
