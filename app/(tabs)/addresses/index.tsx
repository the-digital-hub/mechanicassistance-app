import { useUser } from '@/context/UserContext';
import { useRouter } from 'expo-router';
import { ChevronRight, MapPin, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';

export default function AddressesScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { user } = useUser();

    return (
        <View className="flex-1 bg-white">
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24, paddingBottom: 40 }}>
                {/* Section Badge */}
                <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                    <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                        {t('addresses.badge')}
                    </Text>
                </View>

                {/* Title */}
                <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">{t('addresses.title')}</Text>

                {/* Subtitle */}
                <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                    {t('addresses.subtitle')}
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
                                            pathname: '/(tabs)/addresses/edit',
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

                        {/* {t('addresses.addNew')} Button */}
                        <TouchableOpacity
                            onPress={() => router.push('/(tabs)/addresses/create')}
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
                                <Text className="text-white font-outfit-semibold text-lg text-center ml-2">{t('addresses.addNew')}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <View className="items-center justify-center py-16">
                            <MapPin size={48} color="#9CA3AF" />
                            <Text className="text-gray-400 font-outfit-medium text-base mt-4">{t('addresses.empty')}</Text>
                            <Text className="text-gray-300 font-outfit-regular text-sm text-center mt-2">
                                {t('addresses.emptyHint')}
                            </Text>
                        </View>

                        {/* {t('addresses.addNew')} Button */}
                        <TouchableOpacity
                            onPress={() => router.push('/(tabs)/addresses/create')}
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
                                <Text className="text-white font-outfit-semibold text-lg text-center ml-2">{t('addresses.addNew')}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>
        </View>
    );
}
