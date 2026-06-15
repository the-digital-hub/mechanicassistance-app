import { Input } from '@/components/ui/Input';
import { saveSetupProgress } from '@/lib/storage';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function CredentialsScreen() {
    const router = useRouter();
    const [aseId, setAseId] = useState('');
    const [isValidated, setIsValidated] = useState(false);

    const handleSearch = () => {
        if (aseId.length > 3) {
            setIsValidated(true);
        }
    };

    const handleContinue = async () => {
        await saveSetupProgress('credentials', { aseId, validated: isValidated });
        router.push('/setup/dealer-info');
    };

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
              ASE Certifications
            </Text>

            {/* Subtitle */}
            <Text className="text-gray-500 font-outfit-regular text-base mb-8">
              Validate your ASE Member ID to showcase your certifications
            </Text>

            {/* ASE Logo Area */}
            <View className="mb-6">
                {/* Placeholder for ASE Logo - Text representation for now */}
                <View className="flex-row items-center mb-4">
                    <View className="bg-blue-600 rounded-full w-10 h-10 items-center justify-center mr-2">
                        <Text className="text-white font-bold text-xs">ASE</Text>
                    </View>
                    <View>
                        <Text className="font-bold text-xs text-gray-800">National Institute for</Text>
                        <Text className="font-bold text-xs text-gray-800 uppercase">Automotive Service Excellence</Text>
                    </View>
                </View>

                <Text className="text-[#0F172A] font-outfit-regular text-sm mb-6">
                    Your Member ID is validated against ASE records to verify your certification status and the corresponding expiration dates.
                </Text>
            </View>

            {!isValidated ? (
                <View>
                    <Text className="font-outfit-medium text-[#0F172A] mb-2">ASE Member ID</Text>
                    <Input
                        placeholder="ASE - XXXX-XXXX"
                        value={aseId}
                        onChangeText={setAseId}
                        containerClassName="bg-white border border-gray-300 rounded-2xl mb-8"
                    />
                    <TouchableOpacity
                        onPress={handleSearch}
                        activeOpacity={0.8}
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
                            <Text className="text-white font-outfit-bold text-center mr-2">Search ASE records</Text>
                            <ChevronRight size={20} color="white" />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            ) : (
                <View>
                    <Text className="font-outfit-medium text-[#0F172A] mb-1">ASE Member ID</Text>
                    <Text className="text-[#0047AB] font-outfit-medium text-base mb-6">ASE - {aseId}</Text>

                    {/* Cert List */}
                    <View className="space-y-4 mb-8">
                        {['A1 - Engine Repair', 'A2 - Brakes', 'A3 - Electricity'].map((cert, i) => (
                            <View key={i} className="bg-blue-50/50 p-4 rounded-xl">
                                <Text className="font-outfit-bold text-[#0F172A] mb-1">{cert}</Text>
                                <Text className="text-blue-400 text-xs">Expiration: 06/30/2027</Text>
                            </View>
                        ))}
                    </View>

                    <TouchableOpacity
                        onPress={handleContinue}
                        activeOpacity={0.8}
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
                            <Text className="text-white font-outfit-bold text-center mr-2">Validate Certifications</Text>
                            <ChevronRight size={20} color="white" />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );
}
