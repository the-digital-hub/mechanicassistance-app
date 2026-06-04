import { EnvSelector } from "@/components/EnvSelector";
import { Button } from "@/components/ui/Button";
import { GradientLayout } from "@/components/ui/GradientLayout";
import { Input } from "@/components/ui/Input";
import { NumericKeypad } from "@/components/ui/Keypad";
import { useUser } from "@/context/UserContext";
import { ApiError } from "@/lib/api/types";
import { userDAO } from "@/lib/dao/UserDAO";
import {
  getIdToken,
  sendOTP,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  verifyOTP,
} from "@/lib/firebase/auth";
import { getLastPhone, saveLastPhone } from "@/lib/storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Image,
  Keyboard,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

type Step = "phone" | "otp";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useUser();
  const [step, setStep] = useState<Step>("phone");
  const [method, setMethod] = useState<"email" | "mobile">("mobile");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showKeypad, setShowKeypad] = useState(true);
  const fullPhoneRef = useRef("");
  const otpInputRef = useRef<TextInput>(null);
  const [errorModal, setErrorModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  }>({ visible: false, title: "", message: "" });

  const showError = (
    title: string,
    message: string,
    action?: { label: string; onPress: () => void },
  ) => {
    setErrorModal({
      visible: true,
      title,
      message,
      actionLabel: action?.label,
      onAction: action?.onPress,
    });
  };
  const hideError = () =>
    setErrorModal((prev) => ({ ...prev, visible: false }));

  useEffect(() => {
    const loadLastPhone = async () => {
      const savedPhone = await getLastPhone();
      if (savedPhone) {
        setPhoneNumber(formatPhoneNumber(savedPhone));
      }
    };
    loadLastPhone();
  }, []);

  const formatPhoneNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (!match) return cleaned;
    const [, area, prefix, line] = match;
    if (cleaned.length <= 3) return area ? `(${area}` : "";
    if (cleaned.length <= 6) return `(${area}) ${prefix}`;
    return `(${area}) ${prefix}-${line}`;
  };

  const handlePhoneChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length <= 10) {
      setPhoneNumber(formatPhoneNumber(cleaned));
    }
  };

  // Step 1: send OTP via Firebase
  const handleSendOTP = async () => {
    const cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.length < 10) {
      showError(
        "Invalid Number",
        "Please enter a valid 10-digit mobile number.",
      );
      return;
    }

    const e164 = `+1${cleaned}`;
    fullPhoneRef.current = e164;
    setIsLoading(true);
    try {
      // Pre-check is a non-critical gate — if the endpoint is not deployed (404),
      // we gracefully skip it and proceed to send the OTP.
      try {
        const preCheck = await userDAO.preCheckPhone(e164);
        if (!preCheck.allowed) {
          showError(
            "Verification Unavailable",
            preCheck.message ||
              "Unable to send verification code. Please try again or contact support.",
          );
          return;
        }
      } catch (preCheckErr) {
        if (preCheckErr instanceof ApiError && preCheckErr.statusCode === 404) {
          console.warn(
            "[Login] pre-check endpoint not available, skipping gate",
          );
        } else {
          throw preCheckErr;
        }
      }

      await sendOTP(e164);
      setOtpCode("");
      setStep("otp");
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.apiMessage
          : err instanceof Error
            ? err.message
            : "";

      const displayMessage = message.includes("auth/too-many-requests")
        ? "Too many login attempts. Please wait a few minutes before trying again."
        : message || "Failed to send verification code. Please try again.";

      showError("Error", displayMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: verify OTP, get Firebase ID token, login with backend
  const handleVerifyOTP = async (codeToVerify?: string) => {
    const currentCode =
      typeof codeToVerify === "string" ? codeToVerify : otpCode;
    if (currentCode.length < 6) return;

    setIsLoading(true);
    try {
      await verifyOTP(currentCode);
      const idToken = await getIdToken();
      if (!idToken) throw new Error("Failed to get authentication token.");

      const success = await login(idToken, fullPhoneRef.current);
      if (success) {
        const cleaned = fullPhoneRef.current.replace(/\D/g, "").slice(-10);
        await saveLastPhone(cleaned);
        router.replace("/(tabs)/dashboard");
      } else {
        showError(
          "Account Not Found",
          "No account is registered with this phone number. Please sign up first.",
          { label: "Sign Up", onPress: () => router.push("/setup") },
        );
      }
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.apiMessage
          : err instanceof Error
            ? err.message
            : "";

      const displayMessage = message.includes("auth/too-many-requests")
        ? "Accounts are locked temporarily after too many attempts. Please try again later."
        : message || "Invalid code. Please try again.";

      showError("Verification Failed", displayMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Social / Email login handlers ──────────────────────────────────────────

  /**
   * Authenticates with a social/email Firebase provider, gets the ID token,
   * and calls the backend login. Handles both existing and new users.
   */
  const handleProviderLogin = async (
    providerFn: () => Promise<unknown>,
    providerName: string,
  ) => {
    setIsLoading(true);
    try {
      await providerFn();
      const idToken = await getIdToken();
      if (!idToken) throw new Error("Failed to get authentication token.");

      const success = await login(idToken);
      if (success) {
        router.replace("/(tabs)/dashboard");
      } else {
        showError(
          "Account Not Found",
          `No account is registered with this ${providerName} account. Please sign up first.`,
          { label: "Sign Up", onPress: () => router.push("/setup") },
        );
      }
    } catch (err: unknown) {
      // User cancelled the prompt — not an error
      if (
        err instanceof Error &&
        (err.message.includes("cancelled") ||
          err.message.includes("canceled") ||
          err.message.includes("SIGN_IN_CANCELLED"))
      ) {
        return;
      }

      const message =
        err instanceof ApiError
          ? err.apiMessage
          : err instanceof Error
            ? err.message
            : "";

      showError(
        "Login Failed",
        message || `Failed to sign in with ${providerName}. Please try again.`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () =>
    handleProviderLogin(() => signInWithGoogle(), "Google");

  const handleAppleLogin = () =>
    handleProviderLogin(() => signInWithApple(), "Apple");

  const handleEmailLogin = () => {
    if (!emailAddress.trim() || !password.trim()) {
      showError("Missing Fields", "Please enter both email and password.");
      return;
    }
    handleProviderLogin(
      () => signInWithEmail(emailAddress.trim(), password),
      "Email",
    );
  };

  // ─── OTP helpers ────────────────────────────────────────────────────────────

  const handleOtpKeyPress = (key: string) => {
    if (otpCode.length < 6) setOtpCode((prev) => prev + key);
  };

  const handleOtpDelete = () => {
    setOtpCode((prev) => prev.slice(0, -1));
  };

  // Auto-focus hidden input so the OS can attach SMS autofill
  useEffect(() => {
    if (step === "otp") {
      setTimeout(() => otpInputRef.current?.focus(), 100);
    }
  }, [step]);

  const handleOtpAutofill = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 6);
    setOtpCode(digits);
    if (digits.length === 6) {
      Keyboard.dismiss();
      handleVerifyOTP(digits);
    }
  };

  return (
    <>
      {/* --- OTP Step UI --- */}
      {step === "otp" ? (
        <TouchableWithoutFeedback
          onPress={() => {
            Keyboard.dismiss();
            setShowKeypad(false);
          }}
          accessible={false}
        >
          <View className="flex-1 bg-white justify-between">
            <View className="px-8 pt-16 flex-1">
              <TouchableOpacity
                onPress={() => setStep("phone")}
                className="mb-8"
              >
                <Ionicons name="arrow-back" size={24} color="#0F172A" />
              </TouchableOpacity>

              <Text className="text-xl font-outfit-bold text-[#0F172A] mb-2">
                Enter verification code
              </Text>
              <Text className="text-base font-outfit-medium text-[#0047AB] mb-12">
                Sent to {fullPhoneRef.current}
              </Text>

              {/* 6-digit display */}
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => {
                  setShowKeypad(true);
                  otpInputRef.current?.focus();
                }}
                className="flex-row justify-between mb-12 px-4 relative"
              >
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <View
                    key={index}
                    className={`w-10 border-b-2 items-center pb-2 ${otpCode.length === index ? "border-[#0047AB]" : "border-slate-300"}`}
                  >
                    <Text className="text-3xl font-outfit-bold text-[#0F172A]">
                      {otpCode[index] || ""}
                    </Text>
                  </View>
                ))}

                {/* Hidden input — enables OS SMS autofill suggestion above keyboard */}
                <TextInput
                  ref={otpInputRef}
                  value={otpCode}
                  onChangeText={handleOtpAutofill}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete={
                    Platform.OS === "android" ? "sms-otp" : "one-time-code"
                  }
                  maxLength={6}
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                  }}
                  caretHidden={true}
                />
              </TouchableOpacity>

              <View className="mb-4">
                <Button
                  className="bg-blue-700 rounded-xl mb-6"
                  size="lg"
                  onPress={() => {
                    Keyboard.dismiss();
                    handleVerifyOTP();
                  }}
                  isLoading={isLoading}
                >
                  Verify
                </Button>
                <TouchableOpacity
                  onPress={handleSendOTP}
                  className="mb-6"
                  disabled={isLoading}
                >
                  <Text className="text-[#0047AB] text-center font-outfit-medium">
                    Resend code
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {showKeypad && (
              <NumericKeypad
                onKeyPress={handleOtpKeyPress}
                onDelete={handleOtpDelete}
              />
            )}
          </View>
        </TouchableWithoutFeedback>
      ) : (
        /* --- Phone Step UI --- */
        <View className="flex-1">
          <EnvSelector />
          <TouchableWithoutFeedback
            onPress={Keyboard.dismiss}
            accessible={false}
          >
            <GradientLayout className="flex-1" resizeMode="cover">
              <View className="flex-1 justify-end px-6 pb-[108px] gap-4">
                <View className="flex-1" />

                <Text className="text-white text-3xl font-outfit-bold text-center">
                  Get Started
                </Text>

                <View className="w-full">
                  {method === "email" ? (
                    <View className="gap-4">
                      <Input
                        placeholder="Email"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        value={emailAddress}
                        onChangeText={setEmailAddress}
                        leftIcon={
                          <Ionicons
                            name="mail-outline"
                            size={20}
                            color="#9CA3AF"
                          />
                        }
                      />
                      <Input
                        placeholder="Password"
                        isPassword
                        value={password}
                        onChangeText={setPassword}
                        leftIcon={
                          <Ionicons
                            name="lock-closed-outline"
                            size={20}
                            color="#9CA3AF"
                          />
                        }
                      />
                    </View>
                  ) : (
                    <View className="flex-row gap-3">
                      <View className="bg-white rounded-xl px-4 justify-center items-center h-[52px]">
                        <Text className="font-outfit-medium text-black text-base">
                          🇺🇸 + 1
                        </Text>
                      </View>
                      <Input
                        placeholder="(000) 000-0000"
                        containerClassName="flex-1"
                        keyboardType="phone-pad"
                        value={phoneNumber}
                        onChangeText={handlePhoneChange}
                        maxLength={14}
                      />
                    </View>
                  )}
                </View>

                <Button
                  onPress={
                    method === "email" ? handleEmailLogin : handleSendOTP
                  }
                  size="lg"
                  className="border-white/40 border bg-blue-600/20 backdrop-blur-sm"
                  isLoading={isLoading}
                >
                  Login
                </Button>

                <Text className="text-white/80 text-center font-outfit-regular">
                  Or
                </Text>

                <View className="gap-4">
                  <Button
                    variant="google"
                    className="h-[52px]"
                    onPress={handleGoogleLogin}
                    isLoading={isLoading}
                    leftIcon={
                      <Image
                        source={require("@/assets/brands/google.png")}
                        style={{ width: 32, height: 32 }}
                        resizeMode="contain"
                      />
                    }
                    accessibilityLabel="Sign in with Google"
                  >
                    Sign in with Google
                  </Button>
                  <Button
                    variant="apple"
                    className="h-[52px]"
                    onPress={handleAppleLogin}
                    isLoading={isLoading}
                    leftIcon={
                      <Image
                        source={require("@/assets/brands/apple.png")}
                        style={{ width: 32, height: 32 }}
                        resizeMode="contain"
                      />
                    }
                    accessibilityLabel="Sign in with Apple"
                  >
                    Sign in with Apple
                  </Button>
                  <Button
                    variant="social"
                    onPress={() =>
                      setMethod(method === "email" ? "mobile" : "email")
                    }
                    leftIcon={
                      <Ionicons name="mail-outline" size={20} color="black" />
                    }
                    className="h-[52px]"
                  >
                    {method === "email"
                      ? "Sign in with Mobile"
                      : "Sign in with Email"}
                  </Button>
                </View>

                <View className="flex-row justify-center pt-2">
                  <Text className="text-white/80 font-outfit-regular">
                    Don't have an account?{" "}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push("/setup")}
                  >
                    <Text className="text-white font-outfit-bold underline">
                      Sign Up
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </GradientLayout>
          </TouchableWithoutFeedback>
        </View>
      )}

      {/* Error Modal */}
      <Modal
        visible={errorModal.visible}
        transparent
        animationType="fade"
        onRequestClose={hideError}
      >
        <View className="flex-1 bg-black/40 justify-center items-center px-6">
          <View className="bg-white rounded-3xl w-full p-8 items-center shadow-xl">
            <View className="w-16 h-16 bg-red-50 rounded-full justify-center items-center mb-6">
              <Ionicons name="alert-circle" size={32} color="#EF4444" />
            </View>

            <Text className="text-xl font-outfit-bold text-[#0F172A] mb-2 text-center">
              {errorModal.title}
            </Text>

            <Text className="text-base font-outfit-regular text-slate-500 text-center mb-8">
              {errorModal.message}
            </Text>

            {errorModal.onAction && (
              <TouchableOpacity
                className="bg-blue-700 w-full py-4 rounded-xl shadow-sm active:opacity-90 mb-3"
                onPress={() => {
                  hideError();
                  errorModal.onAction?.();
                }}
              >
                <Text className="text-white text-center font-outfit-bold text-lg">
                  {errorModal.actionLabel}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              className="bg-slate-100 w-full py-4 rounded-xl active:opacity-90"
              onPress={hideError}
            >
              <Text className="text-slate-700 text-center font-outfit-bold text-lg">
                {errorModal.onAction ? "Cancel" : "Got it"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
