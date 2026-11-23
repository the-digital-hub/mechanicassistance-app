import { Stack, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';

export default function SettingsLayout() {
    const router = useRouter();

    return (
        <Stack
            screenOptions={{ gestureEnabled: false, fullScreenGestureEnabled: false,
                headerShown: false,
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="language" />
            <Stack.Screen name="password" />
            <Stack.Screen name="delete-account" />
        </Stack>
    );
}
