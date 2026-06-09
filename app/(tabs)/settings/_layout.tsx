import { Stack, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';

export default function SettingsLayout() {
    const router = useRouter();

    return (
        <Stack
            screenOptions={{
                headerShown: true,
                headerTitleAlign: 'center',
                headerTintColor: '#0047AB',
                headerStyle: {
                    backgroundColor: '#FFFFFF',
                },
                headerTitleStyle: {
                    fontFamily: 'Outfit_700Bold',
                    fontSize: 18,
                },
                headerLeft: () => (
                    <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 0 }}>
                        <ChevronLeft size={24} color="#0047AB" />
                    </TouchableOpacity>
                ),
                headerShadowVisible: false, // Optional: remove shadow to match design
            }}
        >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="notifications" options={{ headerShown: false }} />
            <Stack.Screen name="password" options={{ headerShown: false }} />
            <Stack.Screen name="delete-account" options={{ headerShown: false }} />
        </Stack>
    );
}
