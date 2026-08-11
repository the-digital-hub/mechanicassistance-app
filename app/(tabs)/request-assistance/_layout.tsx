import { Stack } from "expo-router";

export default function RequestAssistanceLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerTitleAlign: "center",
        headerTintColor: "#0047AB",
        headerStyle: { backgroundColor: "#FFFFFF" },
        headerTitleStyle: { fontFamily: "Outfit_700Bold", fontSize: 18 },
        headerShadowVisible: true,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      {/* Sub-screens: keep stack headers hidden to use their manual headers for now */}
      <Stack.Screen name="select-vehicle" options={{ headerShown: false }} />
      <Stack.Screen name="issue-selection" options={{ headerShown: false }} />
      <Stack.Screen name="add-details" options={{ headerShown: false }} />
      <Stack.Screen name="location-map" options={{ headerShown: false }} />
      <Stack.Screen name="location-address" options={{ headerShown: false }} />
      <Stack.Screen name="date-time" options={{ headerShown: false }} />
      <Stack.Screen name="searching" options={{ headerShown: false }} />
      <Stack.Screen name="mechanic-found" options={{ headerShown: false }} />
      <Stack.Screen name="confirmation" options={{ headerShown: false }} />
    </Stack>
  );
}
