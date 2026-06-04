import { useRouter } from 'expo-router';
import { ChevronDown, SlidersHorizontal } from 'lucide-react-native';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function FilterScreen() {
    const router = useRouter();

    const FilterSection = ({ title }: { title: string }) => (
        <View className="mb-6">
            <Text className="font-outfit-bold text-gray-900 mb-2">{title}</Text>
            <TouchableOpacity className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 flex-row justify-between items-center">
                <Text className="text-gray-500 font-outfit-regular">Select</Text>
                <ChevronDown size={20} color="#9CA3AF" />
            </TouchableOpacity>
        </View>
    );

    return (
        <View className="flex-1 bg-white">
            <ScrollView className="flex-1 px-6 pt-4">
                <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-lg font-outfit-bold text-gray-900">Filter results</Text>
                    <SlidersHorizontal size={20} color="#000" />
                </View>

                <FilterSection title="Type of assistance" />
                <FilterSection title="Scheduled time" />
                <FilterSection title="Car brand / model" />
                <FilterSection title="Zip code" />
                <FilterSection title="Type of issue" />

            </ScrollView>

            <View className="p-6 border-t border-gray-100">
                <TouchableOpacity
                    className="bg-blue-700 w-full py-4 rounded-xl items-center"
                    onPress={() => router.back()}
                >
                    <Text className="text-white font-outfit-bold text-lg">Apply Filter</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
