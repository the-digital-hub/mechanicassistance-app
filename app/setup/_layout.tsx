import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { Text, TouchableOpacity } from "react-native";

export default function SetupLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#F3F4F6", // bg-gray-100
        },
        headerShadowVisible: false,
        headerTitle: "Account Set-up",
        headerTitleStyle: {
          fontFamily: "Outfit_500Medium",
          fontSize: 18,
          color: "#1F2937", // text-gray-800
        },
        headerTitleAlign: "center",
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "#FFFFFF",
              justifyContent: "center",
              alignItems: "center",
              marginLeft: 0,
              overflow: "hidden",
            }}
          >
            <Ionicons name="arrow-back" size={18} color="#1F2937" />
          </TouchableOpacity>
        ),
      }}
    >
      <Stack.Screen name="index" options={{ title: "Account Set-up" }} />
      <Stack.Screen name="otp" options={{ title: "Account Set-up" }} />
      <Stack.Screen
        name="role-selection"
        options={{ title: "Account Set-up" }}
      />
      <Stack.Screen name="basic-info" options={{ title: "Account Set-up" }} />
      <Stack.Screen
        name="address"
        options={{ title: "Account Set-up" }}
      />
      <Stack.Screen name="credentials" options={{ title: "Account Set-up" }} />
      <Stack.Screen
        name="dealer-info"
        options={{
          title: "Account Set-up",
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push("/setup/expertise")}
              style={{ backgroundColor: "transparent" }}
            >
              <Text className="text-[#0047AB] font-outfit-medium">Skip</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="expertise"
        options={{
          title: "Availability",
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push("/setup/availability")}
              style={{ backgroundColor: "transparent" }}
            >
              <Text className="text-[#0047AB] font-outfit-medium">Skip</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="availability"
        options={{
          title: "Account Set-up",
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push("/setup/success")}
              style={{ backgroundColor: "transparent" }}
            >
              <Text className="text-[#0047AB] font-outfit-medium">Skip</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen name="identity" options={{ title: "Account Set-up" }} />
      <Stack.Screen name="vehicle-info" options={{ title: "Account Set-up" }} />
      <Stack.Screen name="success" options={{ headerShown: false }} />
    </Stack>
  );
}
