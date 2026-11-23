import { Stack } from 'expo-router';

export default function VideoLobbyLayout() {
    return (
        <Stack screenOptions={{ gestureEnabled: false, fullScreenGestureEnabled: false, headerShown: false }} />
    );
}
