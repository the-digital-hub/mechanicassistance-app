import { Stack } from 'expo-router';

// Keeps the list under a detail entered from another tab or a notification, so
// back and swipe-back have somewhere to go. Only applies to navigations made with
// `{ withAnchor: true }` and to deep links.
export const unstable_settings = { anchor: 'index' };

export default function AppointmentsLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                headerTitleAlign: 'center',
                headerTintColor: '#0047AB',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTitleStyle: { fontFamily: 'Outfit_700Bold', fontSize: 18 },
                headerShadowVisible: true,
            }}
        >
            <Stack.Screen
                name="index"
                options={{
                    headerShown: false, // Let the parent Tab draw the header for the root page
                }}
            />
        </Stack>
    );
}
