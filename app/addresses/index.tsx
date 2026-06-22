import { useUser } from '@/context/UserContext';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, MapPin, Plus } from 'lucide-react-native';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function AddressesScreen() {
    const router = useRouter();
    const { user } = useUser();

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
                        MY ADDRESSES
                    </Text>
                </View>

                {/* Title */}
                <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">My Addresses</Text>

                {/* Subtitle */}
                <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                    Manage your saved addresses and choose your preferred locations
                </Text>

                {/* Addresses List */}
                {user?.addresses && user.addresses.length > 0 ? (
                    <>
                        <View className="bg-white rounded-3xl overflow-hidden mb-6" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 10, elevation: 5 }}>
                            {user.addresses.map((address, index) => (
                                <TouchableOpacity
                                    key={index}
                                    className="flex-row items-center px-6 py-4"
                                    style={{ borderBottomWidth: index < user.addresses.length - 1 ? 1 : 0, borderBottomColor: '#F3F4F6' }}
                                    onPress={() => {
                                        router.push({
                                            pathname: '/addresses/edit',
                                            params: {
                                                index: index.toString(),
                                                street: address.street || '',
                                                apartment: address.apartment || '',
                                                city: address.city || '',
                                                state: address.state || '',
                                                zip: address.zip || ''
                                            }
                                        });
                                    }}
                                >
                                    <View className="w-12 h-12 bg-blue-50 rounded-full justify-center items-center mr-4">
                                        <MapPin size={24} color="#0047AB" />
                                    </View>
                                    <View className="flex-1 justify-center">
                                        <Text className="font-outfit-semibold text-base text-gray-900">
                                            {address.street}
                                        </Text>
                                        <Text className="font-outfit-regular text-sm text-gray-500 mt-1">
                                            {address.city}, {address.state} {address.zip}
                                        </Text>
                                    </View>
                                    <ChevronRight size={24} color="#0047AB" />
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Add New Address Button */}
                        <TouchableOpacity
                            onPress={() => router.push('/addresses/create')}
                            activeOpacity={0.8}
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
                                <Plus size={20} color="white" />
                                <Text className="text-white font-outfit-semibold text-lg text-center ml-2">Add New Address</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <View className="items-center justify-center py-16">
                            <MapPin size={48} color="#9CA3AF" />
                            <Text className="text-gray-400 font-outfit-medium text-base mt-4">No addresses yet</Text>
                            <Text className="text-gray-300 font-outfit-regular text-sm text-center mt-2">
                                Start by adding your first address
                            </Text>
                        </View>

                        {/* Add New Address Button */}
                        <TouchableOpacity
                            onPress={() => router.push('/addresses/create')}
                            activeOpacity={0.8}
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
                                <Plus size={20} color="white" />
                                <Text className="text-white font-outfit-semibold text-lg text-center ml-2">Add New Address</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>
        </View>
    );
}
