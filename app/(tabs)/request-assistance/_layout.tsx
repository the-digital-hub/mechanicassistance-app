import { FONT } from '@/lib/ui/fonts';
import { RequestDraftProvider } from "@/context/RequestDraftContext";
import { Stack } from "expo-router";

export default function RequestAssistanceLayout() {
  return (
    // Scoped to this segment: the draft only has to survive the wizard's screens,
    // and mounting it here resets it when the user leaves the flow entirely.
    <RequestDraftProvider>
      <Stack
        screenOptions={{ gestureEnabled: false, fullScreenGestureEnabled: false,
          headerShown: false,
          headerTitleAlign: "center",
          headerTintColor: "#0047AB",
          headerStyle: { backgroundColor: "#FFFFFF" },
          headerTitleStyle: { fontFamily: FONT.bold, fontSize: 18 },
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
        <Stack.Screen name="vehicle-information" options={{ headerShown: false }} />
        <Stack.Screen name="vehicle-documentation" options={{ headerShown: false }} />
        <Stack.Screen name="location-map" options={{ headerShown: false }} />
        <Stack.Screen name="date-time" options={{ headerShown: false }} />
        <Stack.Screen name="obd-scanner" options={{ headerShown: false }} />
        <Stack.Screen name="when" options={{ headerShown: false }} />
        {/* The wizard has the radius slider and a map-like preview: a sideways drag there must not carry the whole screen back
            (the header has the back arrow). */}
        <Stack.Screen name="scheduled" options={{ headerShown: false, gestureEnabled: false, fullScreenGestureEnabled: false }} />
        <Stack.Screen name="scheduled-offers" options={{ headerShown: false }} />
        <Stack.Screen name="searching"options={{ headerShown: false }} />
        <Stack.Screen name="mechanic-found" options={{ headerShown: false }} />
        <Stack.Screen name="confirmation" options={{ headerShown: false }} />
      </Stack>
    </RequestDraftProvider>
  );
}
