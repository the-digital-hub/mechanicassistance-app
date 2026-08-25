import { useUser } from "@/context/UserContext";
import { ApiError } from "@/lib/api/types";
import { userDAO } from "@/lib/dao/UserDAO";
import { clearSetupProgress, getSetupProgress } from "@/lib/storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";

/** Where the caller has to go once the signup token is no longer usable. */
type ExpiredRecovery = "signIn" | "restart";

/**
 * True when the wizard's scoped token is gone — it aged out, or the request went
 * out under some other bearer. Matched on the backend code, never on the message.
 */
function isSignupTokenGone(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.statusCode !== 401) return false;

  const payload =
    error.apiError !== null && typeof error.apiError === "object"
      ? (error.apiError as Record<string, unknown>)
      : null;

  return (
    payload?.code === "SIGNUP_TOKEN_EXPIRED" ||
    payload?.code === "SIGNUP_TOKEN_INVALID"
  );
}

export default function SuccessScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { adoptSession } = useUser();
  const [isCreating, setIsCreating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState<ExpiredRecovery | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const hasRun = useRef(false);
  /** Set once POST /api/users succeeds, so recovery knows the account exists. */
  const accountCreated = useRef(false);

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
        // From here on the account exists, so a later failure must not send the
        // caller back through a wizard that would collide with their own email.
        accountCreated.current = true;

        // The wizard ran on a signup-scoped token; trade it for a real session
        // now that the account exists. No Firebase token is involved any more.
        console.log("🔵 [success.tsx] Starting session from signup token...");
        const newUser = await userDAO.startSessionFromSignup();
        if (newUser) {
          await adoptSession(newUser);
          setIsLoggedIn(true);
        } else {
          console.warn("⚠️ [success.tsx] Session could not be started");
        }

        console.log("🔵 [success.tsx] Clearing setup progress...");
        await clearSetupProgress();
        setIsCreating(false);
        console.log("✅ [success.tsx] Account creation completed successfully");
      } catch (err: any) {
        console.error("❌ [success.tsx] Registration failed:", err);
        console.error("❌ [success.tsx] Error message:", err.message);
        console.error("❌ [success.tsx] Error stack:", err.stack);

        // The scoped token has a 30-minute life and the wizard can outlast it.
        // Backend codes: SIGNUP_TOKEN_EXPIRED (ran out) and
        // SIGNUP_TOKEN_INVALID (some other bearer). Both mean the same thing to
        // the caller — the phone has to be verified again — but where they land
        // depends on whether the account already exists.
        if (isSignupTokenGone(err)) {
          setExpired(accountCreated.current ? "signIn" : "restart");
        } else {
          setError(err.message || t("setup.success.createAccountFailed"));
        }

        setIsCreating(false);
      }
    };

    createAccountAndLogin();
  }, [adoptSession]);

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

  if (expired) {
    const goRecover = async () => {
      // Only clear the wizard's state when the account made it: otherwise the
      // caller restarts from a blank form and re-types everything.
      if (expired === "signIn") await clearSetupProgress();
      router.replace(expired === "signIn" ? "/login" : "/setup");
    };

    return (
      <View className="flex-1 items-center justify-center p-6" style={{ backgroundColor: '#F6F8FC' }}>
        <Text className="text-xl font-outfit-bold text-[#0F172A] mb-4 text-center">
          {t("setup.success.expiredTitle")}
        </Text>
        <Text className="text-base font-outfit-regular text-slate-500 mb-8 text-center">
          {t(
            expired === "signIn"
              ? "setup.success.expiredMessage"
              : "setup.success.expiredRestartMessage",
          )}
        </Text>
        <TouchableOpacity onPress={goRecover} activeOpacity={0.8} className="w-full">
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
            <Text className="text-white font-outfit-bold text-center mr-2">
              {t(
                expired === "signIn"
                  ? "setup.success.signIn"
                  : "setup.success.tryAgain",
              )}
            </Text>
            <ChevronRight size={20} color="white" />
          </LinearGradient>
        </TouchableOpacity>
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
