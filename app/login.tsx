import { EnvSelector } from "@/components/EnvSelector";
import { SmsConsent } from "@/components/SmsConsent";
import { Button } from "@/components/ui/Button";
import { GradientLayout } from "@/components/ui/GradientLayout";
import { Input } from "@/components/ui/Input";
import { NumericKeypad } from "@/components/ui/Keypad";
import { useUser } from "@/context/UserContext";
import { ApiError } from "@/lib/api/types";
import { describeAuthError } from "@/lib/auth/describe";
import { toAuthError } from "@/lib/auth/errors";
import {
  requestOtp,
  resendOtp,
  toE164,
  verifyOtp,
  type OtpChallenge,
} from "@/lib/auth/otp";
import { formatCountdown, useCountdown } from "@/hooks/useCountdown";
import {
  getIdToken,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
} from "@/lib/firebase/auth";
import { getLastPhone, saveLastPhone } from "@/lib/storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { login, adoptSession } = useUser();
  const [step, setStep] = useState<Step>("phone");
  const [method, setMethod] = useState<"email" | "mobile">("mobile");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showKeypad, setShowKeypad] = useState(true);

  // Challenge state. The deadlines are absolute epoch ms rather than durations
  // so they stay correct across time spent in the background.
  const [requestId, setRequestId] = useState<string | null>(null);
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [resendAtMs, setResendAtMs] = useState<number | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const expiresIn = useCountdown(expiresAtMs);
  const resendIn = useCountdown(resendAtMs);

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

  // Step 1: ask our own backend for a code
  const handleSendOTP = async () => {
    const cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.length < 10) {
      showError(
        t("login.invalidNumberTitle"),
        t("login.invalidNumberMessage"),
      );
      return;
    }

    const e164 = toE164(cleaned);
    fullPhoneRef.current = e164;
    setIsLoading(true);
    try {
      // No pre-check any more: it was an account-enumeration oracle, and this
      // endpoint deliberately answers the same for known and unknown numbers.
      // A resolved promise means the request was accepted, not that an SMS is
      // on its way — an unregistered number gets an identical response and no
      // message. The "account not found" case surfaces at verify instead.
      const challenge = await requestOtp(e164, "login");
      applyChallenge(challenge);
      setOtpCode(challenge.devCode ?? "");
      setStep("otp");
    } catch (err: unknown) {
      showError(t("login.errorTitle"), describeAuthError(err, t));
    } finally {
      setIsLoading(false);
    }
  };

  /** Stores the challenge and turns its durations into absolute deadlines. */
  const applyChallenge = (challenge: OtpChallenge) => {
    setRequestId(challenge.requestId);
    setAttemptsLeft(null);
    // Absolute instants, so backgrounding the app does not freeze the timers.
    setExpiresAtMs(Date.now() + challenge.expiresIn * 1000);
    setResendAtMs(Date.now() + challenge.resendAfter * 1000);
  };

  const handleResendOTP = async () => {
    if (!requestId || resendIn > 0) return;

    setIsLoading(true);
    try {
      const challenge = await resendOtp(requestId, fullPhoneRef.current);
      applyChallenge(challenge);
      setOtpCode(challenge.devCode ?? "");
    } catch (err: unknown) {
      showError(t("login.errorTitle"), describeAuthError(err, t));
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: check the code with our backend
  const handleVerifyOTP = async (codeToVerify?: string) => {
    const currentCode =
      typeof codeToVerify === "string" ? codeToVerify : otpCode;
    if (currentCode.length < 6 || !requestId) return;

    setIsLoading(true);
    try {
      const result = await verifyOtp(
        requestId,
        fullPhoneRef.current,
        currentCode,
      );

      if (result.kind === "signup") {
        // The number verified but has no account. The signup token is already
        // stored, so the wizard can skip straight past its own OTP step.
        showError(
          t("login.accountNotFoundTitle"),
          t("login.accountNotFoundPhoneMessage"),
          { label: t("login.signUp"), onPress: () => router.push("/setup") },
        );
        return;
      }

      await adoptSession(result.user);
      await saveLastPhone(fullPhoneRef.current.replace(/\D/g, "").slice(-10));
      router.replace("/(tabs)/dashboard");
    } catch (err: unknown) {
      const authError = toAuthError(err);

      // Remaining attempts drive the hint under the code boxes.
      setAttemptsLeft(authError.attemptsRemaining ?? null);
      if (
        authError.code === "too_many_attempts" ||
        authError.code === "code_expired"
      ) {
        setOtpCode("");
      }

      showError(
        t("login.verificationFailedTitle"),
        describeAuthError(err, t),
      );
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
          t("login.accountNotFoundTitle"),
          t("login.accountNotFoundProviderMessage", { providerName }),
          { label: t("login.signUp"), onPress: () => router.push("/setup") },
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
        t("login.loginFailedTitle"),
        message || t("login.loginFailedProviderMessage", { providerName }),
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
      showError(t("login.missingFieldsTitle"), t("login.missingFieldsMessage"));
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
                {t("login.enterVerificationCode")}
              </Text>
              <Text className="text-base font-outfit-medium text-[#0047AB] mb-12">
                {t("login.sentTo", { phone: fullPhoneRef.current })}
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

              {/* Status line: what the user needs to know before acting. */}
              <View className="mb-6 min-h-[20px]">
                {attemptsLeft !== null && attemptsLeft > 0 ? (
                  <Text className="text-center font-outfit-medium text-red-600">
                    {t("login.attemptsRemaining", { count: attemptsLeft })}
                  </Text>
                ) : expiresIn > 0 ? (
                  <Text className="text-center font-outfit-medium text-slate-500">
                    {t("login.codeExpiresIn", {
                      time: formatCountdown(expiresIn),
                    })}
                  </Text>
                ) : (
                  <Text className="text-center font-outfit-medium text-red-600">
                    {t("login.codeExpiredMessage")}
                  </Text>
                )}
              </View>

              <View className="mb-4">
                <Button
                  className="bg-blue-700 rounded-xl mb-6"
                  size="lg"
                  onPress={() => {
                    Keyboard.dismiss();
                    handleVerifyOTP();
                  }}
                  isLoading={isLoading}
                  // An expired code cannot succeed; resending is the way out.
                  disabled={expiresIn === 0}
                >
                  {t("login.verify")}
                </Button>
                <TouchableOpacity
                  onPress={handleResendOTP}
                  className="mb-6"
                  disabled={isLoading || resendIn > 0}
                >
                  <Text
                    className={`text-center font-outfit-medium ${
                      resendIn > 0 ? "text-slate-400" : "text-[#0047AB]"
                    }`}
                  >
                    {resendIn > 0
                      ? t("login.resendIn", { seconds: resendIn })
                      : t("login.resendCode")}
                  </Text>
                </TouchableOpacity>

                {/*
                  Always visible, never conditional.

                  Requesting a code for a number with no account returns the same
                  response as for one with an account, and sends nothing. That is
                  deliberate — it stops the endpoint being used to discover which
                  numbers are registered. The cost is that such a user would
                  otherwise wait here forever for an SMS that is never coming, with
                  no way forward.

                  Showing this only when the account is missing would leak exactly
                  what the identical response protects, so it is shown to everyone
                  and worded as a possibility rather than a fact.
                */}
                <View className="border-t border-slate-200 pt-5">
                  <Text className="text-center font-outfit-semibold text-[#0F172A] mb-1">
                    {t("login.noCodeHint")}
                  </Text>
                  <Text className="text-center font-outfit-regular text-sm text-slate-500 mb-3">
                    {t("login.noCodeHintDetail")}
                  </Text>
                  <TouchableOpacity onPress={() => router.push("/setup")}>
                    <Text className="text-center font-outfit-semibold text-[#0047AB]">
                      {t("login.signUp")}
                    </Text>
                  </TouchableOpacity>
                </View>
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
                  {t("login.getStarted")}
                </Text>

                <View className="w-full">
                  {method === "email" ? (
                    <View className="gap-4">
                      <Input
                        placeholder={t("login.email")}
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
                        placeholder={t("login.password")}
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

                {method === "mobile" && <SmsConsent variant="dark" />}

                <Button
                  onPress={
                    method === "email" ? handleEmailLogin : handleSendOTP
                  }
                  size="lg"
                  className="border-white/40 border bg-blue-600/20 backdrop-blur-sm"
                  isLoading={isLoading}
                >
                  {t("login.loginButton")}
                </Button>

                <Text className="text-white/80 text-center font-outfit-regular">
                  {t("login.or")}
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
                        style={{ width: 16, height: 16 }}
                        resizeMode="contain"
                      />
                    }
                    accessibilityLabel={t("login.signInWithGoogle")}
                  >
                    {t("login.signInWithGoogle")}
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
                    accessibilityLabel={t("login.signInWithApple")}
                  >
                    {t("login.signInWithApple")}
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
                      ? t("login.signInWithMobile")
                      : t("login.signInWithEmail")}
                  </Button>
                </View>

                <View className="flex-row justify-center pt-2">
                  <Text className="text-white/80 font-outfit-regular">
                    {t("login.noAccount")}{" "}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push("/setup")}
                  >
                    <Text className="text-white font-outfit-bold underline">
                      {t("login.signUp")}
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
                {errorModal.onAction ? t("login.cancel") : t("login.gotIt")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
