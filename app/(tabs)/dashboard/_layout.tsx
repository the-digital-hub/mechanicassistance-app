import { FONT } from '@/lib/ui/fonts';
import { Stack, useRouter } from "expo-router";
import { HeaderBackButton } from "@/components/ui/HeaderBackButton";

// See app/(tabs)/appointments/_layout.tsx.
export const unstable_settings = { anchor: "index" };

export default function DashboardLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
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
          headerShown: false, // Let the parent Tab draw the header for the root page
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: "Assist",
          headerLeft: () => <HeaderBackButton onPress={() => router.navigate("/dashboard")} />,
        }}
      />
      <Stack.Screen
        name="filter"
        options={{
          presentation: "modal",
          title: "Filter results",
          headerLeft: () => <HeaderBackButton onPress={() => router.navigate("/dashboard")} />,
        }}
      />
    </Stack>
  );
}
