import { useRouter } from 'expo-router';
import { Bell, ChevronLeft, ChevronRight, Key, UserX } from 'lucide-react-native';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
    const router = useRouter();

    const menuItems = [
        {
            icon: Bell,
            label: 'Notifications',
            route: '/settings/notifications',
            description: 'Set up your preferences'
        },
        {
            icon: Key,
            label: 'Account password',
            route: '/settings/password',
            description: 'Change your password'
        },
        {
            icon: UserX,
            label: 'Delete Account',
            route: '/settings/delete-account',
            description: 'Danger zone'
        },
    ];

    return (
        <ScrollView style={{ backgroundColor: '#F6F8FC' }} contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24, paddingBottom: 40 }}>
            {/* Section Badge */}
            <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
              <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
              <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                ACCOUNT SETTINGS
              </Text>
            </View>

            {/* Title */}
            <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">Settings</Text>

            {/* Subtitle */}
            <Text className="text-gray-500 font-outfit-regular text-base mb-8">
              Manage your account preferences and security
            </Text>

            <View className="bg-white rounded-3xl overflow-hidden" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 10, elevation: 5 }}>
                {menuItems.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        className="flex-row items-center px-6 py-4"
                        style={{ borderBottomWidth: index < menuItems.length - 1 ? 1 : 0, borderBottomColor: '#F3F4F6' }}
                        onPress={() => router.push(item.route)}
                    >
                        <View className="w-12 h-12 bg-blue-50 rounded-full justify-center items-center mr-4">
                            <item.icon size={24} color="#0047AB" />
                        </View>
                        <View className="flex-1 justify-center">
                            <Text className="font-outfit-semibold text-base text-gray-900">{item.label}</Text>
                        </View>
                        <ChevronRight size={24} color="#0047AB" />
                    </TouchableOpacity>
                ))}
            </View>
        </ScrollView>
    );
}
