import { Stack } from 'expo-router';

export default function ChatLayout() {
    return (
        <Stack screenOptions={{ gestureEnabled: false, fullScreenGestureEnabled: false, headerShown: false }} />
    );
}
