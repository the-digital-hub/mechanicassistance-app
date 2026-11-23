import { Stack } from 'expo-router';

export default function VideoCallLayout() {
    return (
        <Stack screenOptions={{ gestureEnabled: false, fullScreenGestureEnabled: false, headerShown: false }} />
    );
}
