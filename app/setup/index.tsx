import { SmsConsent } from "@/components/SmsConsent";
import { describeAuthError } from "@/lib/auth/describe";
import { requestOtp, toE164 } from "@/lib/auth/otp";
import { clearSetupProgress, getSetupProgress, mergeSetupProgress, saveSetupProgress } from "@/lib/storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { SETUP_BG, SetupFooter, SetupHeading } from "@/components/setup/SetupKit";
import { TYPE } from "@/lib/ui/type";
import { BUTTON_RADIUS } from "@/lib/ui/floatingFooter";
import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';

export default function PhoneNumberScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [phoneNumber, setPhoneNumber] = useState(""); // raw digits only
  const [isChecking, setIsChecking] = useState(false);
  const [errorModal, setErrorModal] = useState({
    visible: false,
    title: "",
    message: "",
  });
  const inputRef = useRef<TextInput>(null);
  const submitInFlightRef = useRef(false);

  const showError = (title: string, message: string) =>
    setErrorModal({ visible: true, title, message });
  const hideError = () =>
    setErrorModal({ visible: false, title: "", message: "" });

  // Keep only digits, max 10
  const handleChangeText = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 10);
    setPhoneNumber(digits);
  };

  // Format digits → (XXX) XXX-XXXX
  const formattedNumber = (() => {
    if (!phoneNumber) return "";
    const area = phoneNumber.slice(0, 3);
    const prefix = phoneNumber.slice(3, 6);
    const line = phoneNumber.slice(6, 10);
    if (phoneNumber.length > 6) return `(${area}) ${prefix}-${line}`;
    if (phoneNumber.length > 3) return `(${area}) ${prefix}`;
    return area ? `(${area}` : "";
  })();

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (phoneNumber.length < 10) {
      showError(
        t("setup.phone.invalidTitle"),
        t("setup.phone.invalidMessage"),
      );
      return;
    }

    // isChecking only disables the button on the next render; guard double taps.
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setIsChecking(true);
    try {
      const fullPhone = toE164(phoneNumber);

      // No availability pre-check: it was an account-enumeration oracle. A
      // number that already has an account gets the same response here and no
      // message; the conflict surfaces when the account is created.
      const challenge = await requestOtp(fullPhone, "signup");

      // The same number that left a registration half-way picks it up again once its code is verified: what was typed stays and
      // `resumeFrom` remembers where it stopped (the OTP step reads it). Another number starts clean, so nobody inherits someone else's data.
      const previous = await getSetupProgress();
      const samePhone = previous?.phone?.phoneNumber === fullPhone;
      const stoppedAt: string | undefined = samePhone
        ? previous.resumeFrom ?? (previous.lastStep && !["phone", "otp"].includes(previous.lastStep) ? previous.lastStep : undefined)
        : undefined;
      if (previous?.phone && !samePhone) await clearSetupProgress();

      // The timers travel with the progress so the OTP screen can resume them
      // after navigation instead of restarting from zero.
      await saveSetupProgress("phone", {
        phoneNumber: fullPhone,
        requestId: challenge.requestId,
        expiresAtMs: Date.now() + challenge.expiresIn * 1000,
        resendAtMs: Date.now() + challenge.resendAfter * 1000,
      });

      if (stoppedAt) await mergeSetupProgress({ resumeFrom: stoppedAt });

      router.push("/setup/otp");
    } catch (error: unknown) {
      showError(t("setup.phone.errorTitle"), describeAuthError(error, t));
    } finally {
      submitInFlightRef.current = false;
      setIsChecking(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        className="flex-1"
        style={{ backgroundColor: SETUP_BG }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingTop: 18, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SetupHeading screen="phone" badge={t("setup.phone.badge")} title={t("setup.phone.title")} subtitle={t("setup.phone.subtitle")} />

          {/* Phone input row */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => inputRef.current?.focus()}
            className="flex-row items-center"
            style={{ minHeight: 64, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF2FA', marginBottom: 20 }}
          >
            <Text className="font-outfit-bold" style={{ fontSize: 26, lineHeight: 32, color: '#0B1530', marginRight: 12 }}>
              +1
            </Text>
            <TextInput
              ref={inputRef}
              value={formattedNumber}
              onChangeText={handleChangeText}
              keyboardType="phone-pad"
              placeholder="(000) 000-0000"
              placeholderTextColor="#C5CCDB"
              maxLength={14} // (XXX) XXX-XXXX = 14 chars
              className="font-outfit-regular flex-1"
              style={{ paddingVertical: 0, fontSize: 26, lineHeight: 32, color: '#0B1530' }}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </TouchableOpacity>

          <SmsConsent variant="light" />
        </ScrollView>

        <SetupFooter
          label={t("setup.phone.continue")}
          onPress={handleSubmit}
          disabled={phoneNumber.length < 10}
          loading={isChecking}
        />

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

              <Text className="font-outfit-bold text-center mb-2" style={{ ...TYPE.section, color: '#0B1530' }}>
                {errorModal.title}
              </Text>

              <Text className="font-outfit-regular text-center mb-8" style={{ ...TYPE.body, color: '#6B7490' }}>
                {errorModal.message}
              </Text>

              <TouchableOpacity
                className="w-full items-center justify-center"
                style={{ minHeight: 56, borderRadius: BUTTON_RADIUS, backgroundColor: '#1E56E3' }}
                onPress={hideError}
              >
                <Text className="text-white text-center font-outfit-bold" style={TYPE.button}>
                  {t("setup.phone.gotIt")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
