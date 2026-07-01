import { Stack } from 'expo-router';

export default function AddressesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="create/index" options={{ headerShown: false }} />
      <Stack.Screen name="edit/index" options={{ headerShown: false }} />
    </Stack>
  );
}
