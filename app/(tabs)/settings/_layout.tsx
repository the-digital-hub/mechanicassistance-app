import { Stack, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';

export default function SettingsLayout() {
    const router = useRouter();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="password" />
            <Stack.Screen name="delete-account" />
        </Stack>
    );
}
