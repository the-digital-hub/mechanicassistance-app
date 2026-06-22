import { Input } from '@/components/ui/Input';
import { useUser } from '@/context/UserContext';
import { US_STATES } from '@/lib/address';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function EditAddressScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user, updateUser } = useUser();
    const [isLoading, setIsLoading] = useState(false);
    const [showStateModal, setShowStateModal] = useState(false);

    const addressIndex = parseInt(params.index as string) || 0;

    const [formData, setFormData] = useState({
        street: params.street as string || '',
        apartment: params.apartment as string || '',
        city: params.city as string || '',
        state: params.state as string || 'FL',
        zip: params.zip as string || ''
    });

    const handleUpdate = async () => {
        if (!user?.addresses) return;

        setIsLoading(true);
        try {
            const updatedAddresses = [...user.addresses];
            updatedAddresses[addressIndex] = {
                ...updatedAddresses[addressIndex],
                street: formData.street,
                apartment: formData.apartment,
                city: formData.city,
                state: formData.state,
                zip: formData.zip
            };

            await updateUser({ addresses: updatedAddresses });
            router.back();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
            {/* Custom Header */}
            <View className="px-6 pt-20 pb-2 flex-row items-center justify-between" style={{ backgroundColor: '#F4F5FA', borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB' }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <View className="w-10 h-10 rounded-full justify-center items-center" style={{ backgroundColor: '#FFFFFF' }}>
                        <ChevronLeft size={20} color="#0047AB" />
                    </View>
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Outfit_500Medium', fontSize: 18, color: '#1A1A1A', flex: 1, textAlign: 'center' }}>
                    Profile
                </Text>
                <View className="w-6" />
            </View>

            <ScrollView className="flex-1 px-6 pt-6">
                {/* Section Badge */}
                <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                    <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                        EDIT ADDRESS
                    </Text>
                </View>

                {/* Title */}
                <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">Edit Address</Text>

                {/* Subtitle */}
                <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                    Update your address information
                </Text>

                {/* Form Fields */}
                <View className="gap-4 mb-8">
                    <View>
                        <Text className="font-outfit-medium mb-2 text-gray-900">Street</Text>
                        <Input
                            value={formData.street}
                            onChangeText={(t) => setFormData({ ...formData, street: t })}
                            containerClassName="bg-white border border-gray-300 rounded-2xl"
                            placeholder="Enter street address"
                        />
                    </View>

                    <View>
                        <Text className="font-outfit-medium mb-2 text-gray-900">Apartment / Suite</Text>
                        <Input
                            value={formData.apartment}
                            onChangeText={(t) => setFormData({ ...formData, apartment: t })}
                            containerClassName="bg-white border border-gray-300 rounded-2xl"
                            placeholder="Optional"
                        />
                    </View>

                    <View className="flex-row gap-4">
                        <View className="flex-1">
                            <Text className="font-outfit-medium mb-2 text-gray-900">City</Text>
                            <Input
                                value={formData.city}
                                onChangeText={(t) => setFormData({ ...formData, city: t })}
                                containerClassName="bg-white border border-gray-300 rounded-2xl"
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="font-outfit-medium mb-2 text-gray-900">State</Text>
                            <TouchableOpacity
                                onPress={() => setShowStateModal(true)}
                                className="bg-white border border-gray-300 rounded-2xl h-[52px] justify-center px-4"
                            >
                                <Text className={`font-outfit-medium ${formData.state ? 'text-gray-900' : 'text-gray-400'}`}>
                                    {formData.state || 'FL'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View>
                        <Text className="font-outfit-medium mb-2 text-gray-900">Zip Code</Text>
                        <Input
                            value={formData.zip}
                            onChangeText={(t) => {
                                const cleaned = t.replace(/\D/g, '').slice(0, 5);
                                setFormData({ ...formData, zip: cleaned });
                            }}
                            containerClassName="bg-white border border-gray-300 rounded-2xl"
                            keyboardType="number-pad"
                            maxLength={5}
                            placeholder="33139"
                        />
                    </View>
                </View>

                {/* Save Button */}
                <TouchableOpacity
                    onPress={handleUpdate}
                    activeOpacity={0.8}
                    disabled={isLoading}
                    className="mb-10"
                >
                    <LinearGradient
                        colors={['#2B66F8', '#081E72']}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                            borderRadius: 10,
                            paddingVertical: 16,
                            paddingHorizontal: 16,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Text className="text-white font-outfit-semibold text-lg text-center">Save Address</Text>
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </ScrollView>

            {/* State Modal */}
            {showStateModal && (
                <View className="absolute inset-0 bg-black/40 justify-end">
                    <View className="bg-white rounded-t-3xl max-h-[60%]">
                        <View className="p-4 border-b border-gray-200 flex-row justify-between items-center">
                            <Text className="text-xl font-outfit-bold text-gray-900">Select State</Text>
                            <TouchableOpacity onPress={() => setShowStateModal(false)}>
                                <Text className="text-blue-600 font-outfit-bold">Done</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView className="flex-1">
                            {US_STATES.map((state) => (
                                <TouchableOpacity
                                    key={state.code}
                                    className="px-6 py-4 border-b border-gray-100 flex-row items-center justify-between"
                                    onPress={() => {
                                        setFormData({ ...formData, state: state.code });
                                        setShowStateModal(false);
                                    }}
                                >
                                    <Text className={`font-outfit-medium ${formData.state === state.code ? 'text-blue-600' : 'text-gray-900'}`}>
                                        {state.name}
                                    </Text>
                                    {formData.state === state.code && (
                                        <View className="w-5 h-5 rounded-full bg-blue-600" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            )}
        </View>
    );
}
