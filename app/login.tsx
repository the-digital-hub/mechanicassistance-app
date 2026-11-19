import { HeaderBackButton } from '@/components/ui/HeaderBackButton';
import { SmsConsent } from "@/components/SmsConsent";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { FLOATING_CTA } from "@/lib/ui/floatingFooter";
import { TYPE } from "@/lib/ui/type";
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
  signInWithGoogle,
} from "@/lib/firebase/auth";
import { userDAO } from "@/lib/dao/UserDAO";
import { getLastPhone, saveLastPhone } from "@/lib/storage";
import { clearSavedLogin, getSavedLogin, saveLogin } from "@/lib/auth/savedLogin";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

type Step = "phone" | "otp";

/** The app's primary button: brand gradient, radius 16, 56px (same as the Footer in the request flows). */
function PrimaryButton({ label, onPress, loading, disabled }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean }) {
  const off = loading || disabled;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={off}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      style={[FLOATING_CTA, { opacity: off ? 0.6 : 1 }]}
    >
      <LinearGradient
        colors={["#2B66F8", "#081E72"]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={{ height: 56, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        {loading ? <ActivityIndicator color="#FFFFFF" /> : null}
        <Text className="font-outfit-bold" style={{ ...TYPE.button, color: "#FFFFFF" }}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

/** Secondary option (Google, e-mail): white, 1.5px border, same height as the primary. */
function SocialButton({ label, onPress, icon, disabled }: { label: string; onPress: () => void; icon: React.ReactNode; disabled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ height: 56, borderRadius: 16, borderWidth: 1.5, borderColor: "#E4EAF5", backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, opacity: disabled ? 0.6 : 1 }}
    >
      {icon}
      <Text className="font-outfit-bold" style={{ ...TYPE.body, color: "#0B1530" }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { login, adoptSession } = useUser();
  const [step, setStep] = useState<Step>("phone");
  const [method, setMethod] = useState<"email" | "mobile">("mobile");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [rememberLogin, setRememberLogin] = useState(true);
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
  const sendInFlightRef = useRef(false);
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

  // Forgot password — same flow as the fleet portal: one email field, the
  // backend emails a reset link and answers 200 whether or not the account exists.
  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const openForgot = () => {
    setForgotEmail(emailAddress);
    setForgotMsg(null);
    setForgotVisible(true);
  };
  const closeForgot = () => {
    if (forgotLoading) return;
    setForgotVisible(false);
  };

  const handleForgotSubmit = async () => {
    const email = forgotEmail.trim();
    if (!email || !email.includes("@")) {
      setForgotMsg({ type: "error", text: t("login.forgotInvalidEmail") });
      return;
    }
    setForgotLoading(true);
    setForgotMsg(null);
    try {
      await userDAO.requestPasswordReset(email);
      setForgotMsg({ type: "success", text: t("login.resetSuccessNotice") });
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.apiMessage : "";
      setForgotMsg({ type: "error", text: message || t("login.forgotFailed") });
    } finally {
      setForgotLoading(false);
    }
  };

  useEffect(() => {
    const loadLastPhone = async () => {
      const savedPhone = await getLastPhone();
      if (savedPhone) {
        // Older builds saved the number with its country code (11 digits);
        // the input only holds the 10-digit national number.
        setPhoneNumber(
          formatPhoneNumber(savedPhone.replace(/\D/g, "").slice(-10)),
        );
      }
    };
    loadLastPhone();
    // Email + password remembered on this device from a previous sign-in.
    getSavedLogin().then((saved) => {
      if (saved) {
        setEmailAddress(saved.email);
        setPassword(saved.password);
        setRememberLogin(true);
      }
    });
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
    // isLoading only disables the button on the next render; a fast double tap
    // would otherwise send two requests and burn the per-phone rate limit.
    if (sendInFlightRef.current) return;
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
    sendInFlightRef.current = true;
    setIsLoading(true);
    try {
      // No pre-check any more: it was an account-enumeration oracle, and this
      // endpoint deliberately answers the same for known and unknown numbers.
      // A resolved promise means the request was accepted, not that an SMS is
      // on its way — an unregistered number gets an identical response and no
      // message. The "account not found" case surfaces at verify instead.
      const challenge = await requestOtp(e164, "login");
      applyChallenge(challenge);
      setOtpCode("");
      setStep("otp");
    } catch (err: unknown) {
      showError(t("login.errorTitle"), describeAuthError(err, t));
    } finally {
      sendInFlightRef.current = false;
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
      // Cleared so the OS offers the new code instead of the stale one.
      setOtpCode("");
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

      // `existing_account` only answers a signup challenge; this one is login.
      if (result.kind !== "session") return;

      await adoptSession(result.user);
      await saveLastPhone(fullPhoneRef.current.replace(/\D/g, "").slice(-10));
      router.replace("/choose-role");
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
        router.replace("/choose-role");
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


  const handleEmailLogin = async () => {
    if (!emailAddress.trim() || !password.trim()) {
      showError(t("login.missingFieldsTitle"), t("login.missingFieldsMessage"));
      return;
    }
    setIsLoading(true);
    try {
      const user = await userDAO.loginWithPassword(
        emailAddress.trim(),
        password,
      );
      if (!user) throw new Error();
      if (rememberLogin) await saveLogin({ email: emailAddress.trim(), password });
      else await clearSavedLogin();
      await adoptSession(user);
      router.replace("/choose-role");
    } catch (err: unknown) {
      // A 401 means wrong email/password or an account without a password;
      // the backend deliberately doesn't say which.
      const message =
        err instanceof ApiError && err.statusCode !== 401 ? err.apiMessage : "";
      showError(
        t("login.loginFailedTitle"),
        message || t("login.invalidCredentialsMessage"),
      );
    } finally {
      setIsLoading(false);
    }
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
              <View className="mb-8 self-start">
                <HeaderBackButton marginLeft={0} onPress={() => setStep("phone")} />
              </View>

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
                  // Explicit because opacity:0 can make Android skip the view
                  // when it builds the autofill structure.
                  importantForAutofill="yes"
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
                <View style={{ marginBottom: 24 }}>
                  <PrimaryButton
                    label={t("login.verify")}
                    onPress={() => {
                      Keyboard.dismiss();
                      handleVerifyOTP();
                    }}
                    loading={isLoading}
                    // An expired code cannot succeed; resending is the way out.
                    disabled={expiresIn === 0}
                  />
                </View>
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
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <GradientLayout className="flex-1" resizeMode="cover">
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={{ flex: 1 }}
            >
              {method === "email" && (
                <TouchableOpacity
                  onPress={() => setMethod("mobile")}
                  className="absolute left-6 top-16 z-10 flex-row items-center gap-2"
                  accessibilityRole="button"
                  accessibilityLabel={t("login.backToPhone")}
                  hitSlop={12}
                >
                  <Ionicons name="arrow-back" size={24} color="white" />
                  <Text className="text-white font-outfit-medium">
                    {t("login.backToPhone")}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Brand header over the blue backdrop */}
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: insets.top }}>
                <Image
                  source={require("@/assets/images/brand_ring_white.png")}
                  style={{ width: 96, height: 96 }}
                  resizeMode="contain"
                />
                <Image
                  source={require("@/assets/images/brand_wordmark_white.png")}
                  style={{ width: 250, height: 250 * (51 / 947), marginTop: 16 }}
                  resizeMode="contain"
                />
              </View>

              {/* The form: a white sheet using the app's own controls (same 56px height, radius and palette) */}
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  borderTopLeftRadius: 32,
                  borderTopRightRadius: 32,
                  paddingHorizontal: 24,
                  paddingTop: 26,
                  paddingBottom: Math.max(insets.bottom, 16) + 8,
                  gap: 14,
                }}
              >
                <Text className="font-outfit-bold" style={{ fontSize: 26, lineHeight: 32, letterSpacing: -0.5, color: "#0B1530" }}>
                  {t("login.getStarted")}
                </Text>

                {method === "email" ? (
                  <View style={{ gap: 12 }}>
                    <Input
                      variant="light"
                      placeholder={t("login.email")}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      textContentType="username"
                      value={emailAddress}
                      onChangeText={setEmailAddress}
                      leftIcon={<Ionicons name="mail-outline" size={20} color="#8C96AE" />}
                    />
                    <Input
                      variant="light"
                      placeholder={t("login.password")}
                      isPassword
                      autoComplete="current-password"
                      textContentType="password"
                      value={password}
                      onChangeText={setPassword}
                      leftIcon={<Ionicons name="lock-closed-outline" size={20} color="#8C96AE" />}
                    />
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <TouchableOpacity
                        onPress={() => setRememberLogin((v) => !v)}
                        hitSlop={8}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: rememberLogin }}
                        style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                      >
                        <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: rememberLogin ? "#1E56E3" : "#C5CEE3", backgroundColor: rememberLogin ? "#1E56E3" : "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
                          {rememberLogin && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                        </View>
                        <Text className="font-outfit-medium" style={{ ...TYPE.helper, color: "#6B7490" }}>
                          {t("login.rememberMe")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={openForgot} hitSlop={8}>
                        <Text className="font-outfit-bold" style={{ ...TYPE.helper, color: "#1E56E3" }}>
                          {t("login.forgotPassword")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View
                      style={{ height: 56, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "#F6F8FC", borderWidth: 1.5, borderColor: "#E4EAF5", justifyContent: "center", alignItems: "center" }}
                    >
                      <Text className="font-outfit-medium" style={{ ...TYPE.body, color: "#0B1530" }}>
                        🇺🇸 +1
                      </Text>
                    </View>
                    <Input
                      variant="light"
                      placeholder="(000) 000-0000"
                      containerClassName="flex-1"
                      keyboardType="phone-pad"
                      value={phoneNumber}
                      onChangeText={handlePhoneChange}
                      maxLength={14}
                    />
                  </View>
                )}

                <PrimaryButton
                  label={t("login.loginButton")}
                  onPress={method === "email" ? handleEmailLogin : handleSendOTP}
                  loading={isLoading}
                />

                {/* Divider */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: "#E4EAF5" }} />
                  <Text className="font-outfit-medium" style={{ ...TYPE.helper, color: "#8C96AE" }}>
                    {t("login.or")}
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: "#E4EAF5" }} />
                </View>

                <View style={{ gap: 12 }}>
                  <SocialButton
                    label={t("login.signInWithGoogle")}
                    onPress={handleGoogleLogin}
                    disabled={isLoading}
                    icon={<Image source={require("@/assets/brands/google.png")} style={{ width: 20, height: 20 }} resizeMode="contain" />}
                  />
                  {Platform.OS === "ios" && (
                    <SocialButton
                      label={t("login.signInWithApple")}
                      onPress={handleAppleLogin}
                      disabled={isLoading}
                      icon={<Ionicons name="logo-apple" size={22} color="#000000" />}
                    />
                  )}
                  <SocialButton
                    label={method === "email" ? t("login.signInWithMobile") : t("login.signInWithEmail")}
                    onPress={() => setMethod(method === "email" ? "mobile" : "email")}
                    icon={<Ionicons name={method === "email" ? "call-outline" : "mail-outline"} size={22} color="#1E56E3" />}
                  />
                </View>

                <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", paddingTop: 2 }}>
                  <Text className="font-outfit-regular" style={{ ...TYPE.body, color: "#6B7490" }}>
                    {t("login.noAccount")}{" "}
                  </Text>
                  <TouchableOpacity onPress={() => router.push("/setup")} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
                    <Text className="font-outfit-bold" style={{ ...TYPE.question, color: "#1E56E3" }}>
                      {t("login.signUp")}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Consent notice at the very bottom, away from the phone field */}
                {method === "mobile" && <SmsConsent variant="light" />}
              </View>
            </KeyboardAvoidingView>
          </GradientLayout>
        </TouchableWithoutFeedback>
      )}

      {/* Error Modal */}
      <Modal supportedOrientations={MODAL_ORIENTATIONS}
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

      {/* Forgot Password Modal */}
      <Modal supportedOrientations={MODAL_ORIENTATIONS}
        visible={forgotVisible}
        transparent
        animationType="fade"
        onRequestClose={closeForgot}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View className="flex-1 bg-black/40 justify-center items-center px-6">
              <View className="bg-white rounded-3xl w-full p-8 shadow-xl">
                <View className="w-16 h-16 bg-blue-50 rounded-full justify-center items-center mb-6 self-center">
                  <Ionicons name="key-outline" size={30} color="#1D4ED8" />
                </View>

                <Text className="text-xl font-outfit-bold text-[#0F172A] mb-2 text-center">
                  {t("login.forgotModalTitle")}
                </Text>

                <Text className="text-base font-outfit-regular text-slate-500 text-center mb-6">
                  {t("login.forgotModalSubtitle")}
                </Text>

                {forgotMsg && (
                  <View
                    className={`flex-row items-start rounded-xl px-4 py-3 mb-4 ${
                      forgotMsg.type === "success" ? "bg-green-50" : "bg-red-50"
                    }`}
                  >
                    <Ionicons
                      name={
                        forgotMsg.type === "success"
                          ? "checkmark-circle"
                          : "alert-circle"
                      }
                      size={20}
                      color={forgotMsg.type === "success" ? "#16A34A" : "#EF4444"}
                    />
                    <Text
                      className={`flex-1 ml-2 font-outfit-medium ${
                        forgotMsg.type === "success"
                          ? "text-green-700"
                          : "text-red-600"
                      }`}
                    >
                      {forgotMsg.text}
                    </Text>
                  </View>
                )}

                {forgotMsg?.type !== "success" && (
                  <Input
                    placeholder={t("login.email")}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    editable={!forgotLoading}
                    containerClassName="border border-slate-200 mb-6"
                    leftIcon={
                      <Ionicons name="mail-outline" size={20} color="#9CA3AF" />
                    }
                  />
                )}

                {forgotMsg?.type === "success" ? (
                  <TouchableOpacity
                    className="bg-blue-700 w-full py-4 rounded-xl shadow-sm active:opacity-90"
                    onPress={closeForgot}
                  >
                    <Text className="text-white text-center font-outfit-bold text-lg">
                      {t("login.close")}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <Button
                      onPress={handleForgotSubmit}
                      isLoading={forgotLoading}
                      className="mb-3"
                    >
                      {t("login.sendResetButton")}
                    </Button>
                    <TouchableOpacity
                      className="bg-slate-100 w-full py-4 rounded-xl active:opacity-90"
                      onPress={closeForgot}
                      disabled={forgotLoading}
                    >
                      <Text className="text-slate-700 text-center font-outfit-bold text-lg">
                        {t("login.cancel")}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
