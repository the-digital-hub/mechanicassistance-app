import { Input } from '@/components/ui/Input';
import { Building2, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function PaymentsScreen() {
    const router = useRouter();
    const [method, setMethod] = useState<'bank' | 'paypal' | 'gpay' | 'apple'>('bank');

    return (
        <ScrollView style={{ backgroundColor: '#F6F8FC' }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
            {/* Section Badge */}
            <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
              <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
              <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                BANK ACCOUNT
              </Text>
            </View>

            {/* Title */}
            <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
              Bank account
            </Text>

            {/* Subtitle */}
            <Text className="text-gray-500 font-outfit-regular text-base mb-8">
              Add your bank account to receive payments
            </Text>

            <Text className="font-outfit-medium mb-3 text-gray-900">Collection method</Text>

            <View className="flex-row flex-wrap gap-3 mb-6">
                <TouchableOpacity
                    onPress={() => setMethod('bank')}
                    className={`flex-1 min-w-[45%] h-12 flex-row items-center justify-center rounded-lg border ${method === 'bank' ? 'border-gray-800 bg-white' : 'border-gray-200 bg-gray-50'}`}
                >
                    <Building2 size={20} color="black" style={{ marginRight: 8 }} />
                    <Text className="font-outfit-medium">Bank Account</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setMethod('paypal')}
                    className={`flex-1 min-w-[45%] h-12 flex-row items-center justify-center rounded-lg border ${method === 'paypal' ? 'border-gray-800 bg-white' : 'border-gray-200 bg-gray-50'}`}
                >
                    {/* Placeholder for logos */}
                    <Text className="font-outfit-bold text-blue-800 italic">PayPal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setMethod('gpay')}
                    className={`flex-1 min-w-[45%] h-12 flex-row items-center justify-center rounded-lg border ${method === 'gpay' ? 'border-gray-800 bg-white' : 'border-gray-200 bg-gray-50'}`}
                >
                    <Text className="font-outfit-medium text-gray-600">G Pay</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setMethod('apple')}
                    className={`flex-1 min-w-[45%] h-12 flex-row items-center justify-center rounded-lg border ${method === 'apple' ? 'border-gray-800 bg-white' : 'border-gray-200 bg-gray-50'}`}
                >
                    <Text className="font-outfit-medium text-black"> Pay</Text>
                </TouchableOpacity>
            </View>

            <View className="gap-4 mb-8">
                <View>
                    <Text className="font-outfit-medium mb-2 text-gray-900">Account name</Text>
                    <Input
                        containerClassName="bg-white border border-gray-300 rounded-2xl"
                    />
                </View>

                <View>
                    <Text className="font-outfit-medium mb-2 text-gray-900">Account number</Text>
                    <Input
                        containerClassName="bg-white border border-gray-300 rounded-2xl"
                        keyboardType="numeric"
                    />
                </View>

                <View>
                    <Text className="font-outfit-medium mb-2 text-gray-900">Routing #</Text>
                    <Input
                        containerClassName="bg-white border border-gray-300 rounded-2xl"
                        keyboardType="numeric"
                    />
                </View>

                <View>
                    <Text className="font-outfit-medium mb-2 text-gray-900">Checking acc.</Text>
                    <Input
                        containerClassName="bg-white border border-gray-300 rounded-2xl"
                    />
                </View>
            </View>

            {/* Buttons Row */}
            <View className="flex-row gap-3">
                {/* Back Button - 30% width */}
                <TouchableOpacity
                    onPress={() => router.navigate('/(tabs)')}
                    activeOpacity={0.8}
                    style={{ flex: 0.3 }}
                    className="py-4 rounded-lg border border-gray-300 items-center"
                >
                    <Text className="text-gray-900 font-outfit-semibold text-base">Back</Text>
                </TouchableOpacity>

                {/* Save Button - 70% width */}
                <TouchableOpacity
                    onPress={() => {}}
                    activeOpacity={0.8}
                    style={{ flex: 0.7 }}
                >
                    <LinearGradient
                        colors={['#2B66F8', '#081E72']}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                            borderRadius: 8,
                            paddingVertical: 16,
                            paddingHorizontal: 16,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Text className="text-white font-outfit-semibold text-base text-center">Save</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}
