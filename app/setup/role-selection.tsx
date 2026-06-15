import { saveSetupProgress } from '@/lib/storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function RoleSelectionScreen() {
    const router = useRouter();
    // const router = { push: (path: string) => console.log('Mock push:', path) };
    const [selectedRole, setSelectedRole] = useState<'mechanic' | 'user' | null>(null);

    const handleContinue = async () => {
        if (!selectedRole) return;
        try {
            await saveSetupProgress('role', { role: selectedRole });
            router.push('/setup/basic-info');
        } catch (error) {
            console.error('RoleSelection: Error in handleContinue:', error);
        }
    };

    return (
        <View className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
            <ScrollView className="flex-1 px-6 pt-4">
                {/* Section Badge */}
                <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                    <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                        CHOOSE YOUR ROLE
                    </Text>
                </View>

                {/* Title */}
                <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
                    Choose Your Path
                </Text>

                {/* Subtitle */}
                <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                    Tell us how you'll be using the app
                </Text>

                <View className="gap-6">
                {/* Mechanic Option */}
                <Pressable
                    onPress={() => setSelectedRole('mechanic')}
                    className="p-8 rounded-3xl border-2 items-center justify-center"
                    style={{
                        backgroundColor: selectedRole === 'mechanic' ? '#EFF6FF' : '#F8FAFC', // blue-50 : slate-50
                        borderColor: selectedRole === 'mechanic' ? '#2563EB' : '#F1F5F9', // blue-600 : slate-100
                        opacity: selectedRole === 'mechanic' ? 1 : 0.6
                    }}
                >
                    <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${selectedRole === 'mechanic' ? 'bg-blue-600' : 'bg-slate-200'}`}>
                        <Ionicons name="construct" size={32} color={selectedRole === 'mechanic' ? 'white' : '#64748B'} />
                    </View>
                    <Text className={`text-xl font-outfit-bold ${selectedRole === 'mechanic' ? 'text-blue-900' : 'text-slate-500'}`}>
                        I'm a Mechanic
                    </Text>
                    <Text className={`text-sm font-outfit-regular text-center mt-2 ${selectedRole === 'mechanic' ? 'text-blue-700' : 'text-slate-400'}`}>
                        I want to offer my services and help people with their cars
                    </Text>
                </Pressable>

                {/* User Option */}
                <Pressable
                    onPress={() => setSelectedRole('user')}
                    className="p-8 rounded-3xl border-2 items-center justify-center"
                    style={{
                        backgroundColor: selectedRole === 'user' ? '#EFF6FF' : '#F8FAFC',
                        borderColor: selectedRole === 'user' ? '#2563EB' : '#F1F5F9',
                        opacity: selectedRole === 'user' ? 1 : 0.6
                    }}
                >
                    <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${selectedRole === 'user' ? 'bg-blue-600' : 'bg-slate-200'}`}>
                        <Ionicons name="person" size={32} color={selectedRole === 'user' ? 'white' : '#64748B'} />
                    </View>
                    <Text className={`text-xl font-outfit-bold ${selectedRole === 'user' ? 'text-blue-900' : 'text-slate-500'}`}>
                        I'm a User
                    </Text>
                    <Text className={`text-sm font-outfit-regular text-center mt-2 ${selectedRole === 'user' ? 'text-blue-700' : 'text-slate-400'}`}>
                        I need mechanical assistance for my vehicle
                    </Text>
                </Pressable>
                </View>

                {/* Continue button */}
                <TouchableOpacity
                    onPress={handleContinue}
                    activeOpacity={0.8}
                    disabled={!selectedRole}
                    className="mt-8 mb-8"
                >
                    <LinearGradient
                        colors={selectedRole ? ['#2B66F8', '#081E72'] : ['#B0C4FF', '#B0C4FF']}
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
                        <Text className="text-white font-outfit-bold text-center mr-2">Continue</Text>
                        <ChevronRight size={20} color="white" />
                    </LinearGradient>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
