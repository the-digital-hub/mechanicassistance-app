import { useUser } from "@/context/UserContext";
import { userDAO } from "@/lib/dao/UserDAO";
import { getIdToken } from "@/lib/firebase/auth";
import { clearSetupProgress, getSetupProgress } from "@/lib/storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";

export default function SuccessScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { login } = useUser();
  const [isCreating, setIsCreating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const hasRun = useRef(false);

  useEffect(() => {
    // Prevent double execution in React strict mode
    if (hasRun.current) return;
    hasRun.current = true;

    const createAccountAndLogin = async () => {
      try {
        console.log("🔵 [success.tsx] Starting account creation...");

        const progress = await getSetupProgress();
        console.log("🔵 [success.tsx] Setup progress loaded:", progress);

        console.log("🔵 [success.tsx] Registering user with DAO...");
        const registerResult = await userDAO.register(progress);
        console.log("🔵 [success.tsx] Registration successful:", registerResult);

        // Auto-login: use the Firebase token from the OTP step
        console.log("🔵 [success.tsx] Getting Firebase ID token...");
        const idToken = await getIdToken();
        console.log("🔵 [success.tsx] ID Token obtained:", idToken ? "✓" : "✗");

        const phone = (progress.phone as Record<string, unknown>)
          ?.phoneNumber as string | undefined;
        console.log("🔵 [success.tsx] Phone number from progress:", phone);

        if (idToken) {
          console.log("🔵 [success.tsx] Logging in user...");
          const success = await login(idToken, phone);
          console.log("🔵 [success.tsx] Login result:", success);
          if (success) {
            setIsLoggedIn(true);
          }
        } else {
          console.warn("⚠️ [success.tsx] No ID token available for login");
        }

        console.log("🔵 [success.tsx] Clearing setup progress...");
        await clearSetupProgress();
        setIsCreating(false);
        console.log("✅ [success.tsx] Account creation completed successfully");
      } catch (err: any) {
        console.error("❌ [success.tsx] Registration failed:", err);
        console.error("❌ [success.tsx] Error message:", err.message);
        console.error("❌ [success.tsx] Error stack:", err.stack);
        setError(err.message || t("setup.success.createAccountFailed"));
        setIsCreating(false);
      }
    };

    createAccountAndLogin();
  }, [login]);

  const handleGetStarted = () => {
    if (isLoggedIn) {
      // User is authenticated — go directly to the app
      router.replace("/(tabs)" as any);
    } else {
      // Fallback: manual login
      router.replace("/login");
    }
  };

  if (isCreating) {
    return (
      <View className="flex-1 items-center justify-center p-6" style={{ backgroundColor: '#F6F8FC' }}>
        <ActivityIndicator size="large" color="#0047AB" />
        <Text className="text-lg font-outfit-medium text-[#0047AB] text-center mt-4">
          {t("setup.success.finalizing")}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center p-6" style={{ backgroundColor: '#F6F8FC' }}>
        <Text className="text-xl font-outfit-bold text-red-600 mb-4 text-center">
          {t("setup.success.errorTitle")}
        </Text>
        <Text className="text-base font-outfit-regular text-slate-500 mb-8 text-center">
          {error}
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/setup")}
          activeOpacity={0.8}
          className="w-full"
        >
          <LinearGradient
            colors={['#2B66F8', '#081E72']}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderRadius: 10,
              paddingVertical: 16,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text className="text-white font-outfit-bold text-center mr-2">{t("setup.success.tryAgain")}</Text>
            <ChevronRight size={20} color="white" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center p-6" style={{ backgroundColor: '#F6F8FC' }}>
      {/* Success Icon */}
      <View className="w-32 h-32 rounded-full border-4 border-blue-400 items-center justify-center mb-8">
        <Ionicons
          name="checkmark"
          size={64}
          color="#60A5FA"
          style={{ fontWeight: "bold" }}
        />
      </View>

      <Text className="text-3xl font-outfit-medium text-gray-900 mb-3 text-center">
        {t("setup.success.congratulations")}
      </Text>
      <Text className="text-base font-outfit-regular text-gray-500 mb-12 text-center">
        {t("setup.success.setupComplete")}
      </Text>

      <TouchableOpacity
        onPress={handleGetStarted}
        activeOpacity={0.8}
        className="w-full"
      >
        <LinearGradient
          colors={['#2B66F8', '#081E72']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={{
            borderRadius: 10,
            paddingVertical: 16,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text className="text-white font-outfit-bold text-center mr-2">{t("setup.success.getStarted")}</Text>
          <ChevronRight size={20} color="white" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}
