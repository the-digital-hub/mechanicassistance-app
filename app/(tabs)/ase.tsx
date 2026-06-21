import { Input } from '@/components/ui/Input';
import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function ASEScreen() {
    const [memberId, setMemberId] = useState('ASE - XXXX-XXXX');

    const certifications = [
        { code: 'A1', name: 'Engine Repair', expiration: '06/30/2027' },
        { code: 'A2', name: 'Brakes', expiration: '06/30/2027' },
        { code: 'A3', name: 'Electricity', expiration: '06/30/2027' },
    ];

    return (
        <ScrollView style={{ backgroundColor: '#F6F8FC' }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
            {/* Section Badge */}
            <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
              <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
              <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                ASE CERTIFICATIONS
              </Text>
            </View>

            {/* Title */}
            <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
              Manage your ASE certifications
            </Text>

            {/* Subtitle */}
            <Text className="text-gray-500 font-outfit-regular text-base mb-8">
              Your Member ID is validated against ASE records to verify your certification status and the corresponding expiration dates.
            </Text>

            <View className="mb-8">
                <View className="w-full mb-6">
                    <Text className="font-outfit-medium mb-2 text-gray-900">ASE Member ID</Text>
                    <Input
                        value={memberId}
                        onChangeText={setMemberId}
                        containerClassName="bg-white border border-gray-300 rounded-2xl"
                    />
                </View>

                <TouchableOpacity activeOpacity={0.8}>
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
                        <Text className="text-white font-outfit-bold text-center mr-2">Search ASE records</Text>
                        <ChevronRight size={20} color="white" />
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* Certifications List */}
            <View className="mb-8">
                <Text className="font-outfit-medium mb-4 text-gray-900">ASE Member ID</Text>
                <Text className="text-blue-600 font-outfit-regular mb-6">ASE - XXXX-XXXX</Text>

                <View className="gap-3 mb-6">
                    {certifications.map((cert, index) => (
                        <View key={index} className="bg-white border border-gray-300 rounded-2xl p-4 flex-row justify-between items-center">
                            <View>
                                <Text className="font-outfit-bold text-gray-900">{cert.code} - {cert.name}</Text>
                                <Text className="text-gray-500 text-xs">Expiration: {cert.expiration}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            </View>

            <TouchableOpacity activeOpacity={0.8}>
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
                    <Text className="text-white font-outfit-bold text-center mr-2">Update Certifications</Text>
                    <ChevronRight size={20} color="white" />
                </LinearGradient>
            </TouchableOpacity>
        </ScrollView>
    );
}
