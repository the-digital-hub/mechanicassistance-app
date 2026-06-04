import { Stack, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { TouchableOpacity } from "react-native";

export default function DashboardLayout() {
  const router = useRouter();

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
          headerShown: false, // Let the parent Tab draw the header for the root page
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: "Assist",
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.navigate("/dashboard")}
              style={{ marginLeft: 0 }}
            >
              <ChevronLeft size={24} color="#0047AB" />
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="filter"
        options={{
          presentation: "modal",
          title: "Filter results",
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.navigate("/dashboard")}
              style={{ marginLeft: 0 }}
            >
              <ChevronLeft size={24} color="#0047AB" />
            </TouchableOpacity>
          ),
        }}
      />
    </Stack>
  );
}
