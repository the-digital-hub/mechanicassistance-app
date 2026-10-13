import { useLocalSearchParams, useRouter } from 'expo-router';
import { goBackOr } from '@/lib/navigation/goBackOr';
import { Bluetooth, MicOff, Pause, PhoneOff, UserPlus, Video, Volume2, X } from 'lucide-react-native';
import { Image, Text, TouchableOpacity, View } from 'react-native';

export default function CallScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    return (
        <View className="flex-1 bg-white">
            {/* Header */}
            <View className="px-6 pt-12 pb-4 flex-row items-center justify-between">
                <TouchableOpacity onPress={() => goBackOr(router, { pathname: '/appointments/[id]', params: { id: String(id) } })}>
                    <X size={24} color="#0047AB" />
                </TouchableOpacity>
                <Text className="text-blue-900 font-outfit-bold text-lg">Notifications</Text>
                <TouchableOpacity>
                    <UserPlus size={24} color="#0047AB" />
                </TouchableOpacity>
            </View>

            <View className="flex-1 items-center justify-center -mt-20">
                {/* Profile Avatar with Glowing Ring */}
                <View className="relative items-center justify-center">
                    {/* Ring Animations (Mocked with static circles) */}
                    <View className="absolute w-64 h-64 rounded-full bg-blue-50" />
                    <View className="absolute w-56 h-56 rounded-full bg-blue-100/50" />
                    <View className="absolute w-48 h-48 rounded-full border-2 border-blue-400" />

                    <View className="w-40 h-40 rounded-full border-4 border-white overflow-hidden shadow-xl">
                        <Image
                            source={{ uri: 'https://i.pravatar.cc/150?u=savannah' }}
                            className="w-full h-full"
                        />
                    </View>
                </View>

                <Text className="text-2xl font-outfit-bold text-blue-900 mt-8">Savannah Nguyen</Text>
                <Text className="text-gray-400 font-outfit-regular text-sm mt-1">
                    3891 Ranchview Dr. Richardson, California 62639
                </Text>

                <View className="mt-10">
                    <Text className="text-emerald-500 font-outfit-medium text-lg">Ringing...</Text>
                </View>
            </View>

            {/* Controls Grid */}
            <View className="px-10 pb-20">
                <View className="flex-row justify-between mb-12">
                    <View className="items-center w-1/4">
                        <TouchableOpacity className="w-14 h-14 rounded-full items-center justify-center bg-gray-50 mb-2">
                            <MicOff size={24} color="#1F2937" />
                        </TouchableOpacity>
                        <Text className="text-gray-500 font-outfit-medium text-xs">Mute</Text>
                    </View>
                    <View className="items-center w-1/4">
                        <TouchableOpacity className="w-14 h-14 rounded-full items-center justify-center bg-gray-50 mb-2">
                            <Bluetooth size={24} color="#1F2937" />
                        </TouchableOpacity>
                        <Text className="text-gray-500 font-outfit-medium text-xs">Bluetooth</Text>
                    </View>
                    <View className="items-center w-1/4">
                        <TouchableOpacity className="w-14 h-14 rounded-full items-center justify-center bg-gray-50 mb-2">
                            <Pause size={24} color="#1F2937" />
                        </TouchableOpacity>
                        <Text className="text-gray-500 font-outfit-medium text-xs">Hold</Text>
                    </View>
                    <View className="items-center w-1/4">
                        <TouchableOpacity className="w-14 h-14 rounded-full items-center justify-center bg-gray-50 mb-2">
                            <Video size={24} color="#1F2937" />
                        </TouchableOpacity>
                        <Text className="text-gray-500 font-outfit-medium text-xs">Video</Text>
                    </View>
                </View>

                {/* Accept/Reject row */}
                <View className="flex-row items-center justify-center gap-12">
                    <TouchableOpacity className="w-12 h-12 rounded-lg items-center justify-center bg-gray-50">
                        <View className="relative">
                            <View className="w-4 h-4 bg-gray-300 rounded-sm mb-0.5" />
                            <View className="w-4 h-4 bg-gray-300 rounded-sm" />
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="w-20 h-20 rounded-full bg-red-500 items-center justify-center shadow-lg shadow-red-200"
                        onPress={() => goBackOr(router, { pathname: '/appointments/[id]', params: { id: String(id) } })}
                    >
                        <PhoneOff size={32} color="white" />
                    </TouchableOpacity>

                    <TouchableOpacity className="w-12 h-12 rounded-lg items-center justify-center bg-gray-50">
                        <Volume2 size={24} color="#1F2937" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
