import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, TouchableOpacity } from "react-native";

export default function SetupLayout() {
  const router = useRouter();
  const { t } = useTranslation();
  const setupTitle = t("setup.accountSetupTitle");

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#F3F4F6", // bg-gray-100
        },
        headerShadowVisible: false,
        headerTitle: setupTitle,
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
      <Stack.Screen name="index" options={{ title: setupTitle }} />
      <Stack.Screen name="otp" options={{ title: setupTitle }} />
      <Stack.Screen
        name="role-selection"
        options={{ title: setupTitle }}
      />
      <Stack.Screen name="basic-info" options={{ title: setupTitle }} />
      <Stack.Screen
        name="address"
        options={{ title: setupTitle }}
      />
      <Stack.Screen name="credentials" options={{ title: setupTitle }} />
      <Stack.Screen
        name="dealer-info"
        options={{
          title: setupTitle,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push("/setup/expertise")}
              style={{ backgroundColor: "transparent" }}
            >
              <Text className="text-[#0047AB] font-outfit-medium">{t("setup.skip")}</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="expertise"
        options={{
          title: t("setup.availabilityTitle"),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push("/setup/availability")}
              style={{ backgroundColor: "transparent" }}
            >
              <Text className="text-[#0047AB] font-outfit-medium">{t("setup.skip")}</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="availability"
        options={{
          title: setupTitle,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push("/setup/success")}
              style={{ backgroundColor: "transparent" }}
            >
              <Text className="text-[#0047AB] font-outfit-medium">{t("setup.skip")}</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen name="identity" options={{ title: setupTitle }} />
      <Stack.Screen name="vehicle-info" options={{ title: setupTitle }} />
      <Stack.Screen name="success" options={{ headerShown: false }} />
    </Stack>
  );
}
