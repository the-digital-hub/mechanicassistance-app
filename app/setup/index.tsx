import { ApiError } from "@/lib/api/types";
import { userDAO } from "@/lib/dao/UserDAO";
import { sendOTP } from "@/lib/firebase/auth";
import { saveSetupProgress } from "@/lib/storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
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
import { LinearGradient } from "expo-linear-gradient";

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

    setIsChecking(true);
    try {
      const fullPhone = `+1${phoneNumber}`;

      const exists = await userDAO.checkPhoneExists(fullPhone);
      if (exists) {
        showError(
          t("setup.phone.existsTitle"),
          t("setup.phone.existsMessage"),
        );
        return;
      }

      await saveSetupProgress("phone", { phoneNumber: fullPhone });
      await sendOTP(fullPhone);
      router.push("/setup/otp");
    } catch (error: any) {
      const rawMessage = error?.message || "";
      const displayMessage = rawMessage.includes("auth/too-many-requests")
        ? t("setup.phone.tooManyAttempts")
        : error instanceof ApiError
          ? t("setup.phone.verifyFailed")
          : rawMessage || t("setup.phone.genericError");
      showError(t("setup.phone.errorTitle"), displayMessage);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        className="flex-1"
        style={{ backgroundColor: '#F6F8FC' }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView className="flex-1 px-6 pt-4">
          {/* Section Badge */}
          <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
            <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
            <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
              {t("setup.phone.badge")}
            </Text>
          </View>

          {/* Title */}
          <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
            {t("setup.phone.title")}
          </Text>

          {/* Subtitle */}
          <Text className="text-gray-500 font-outfit-regular text-base mb-8">
            {t("setup.phone.subtitle")}
          </Text>

          {/* Phone input row */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => inputRef.current?.focus()}
            className="flex-row items-center mb-8 border-b-2 border-slate-200 pb-2"
          >
            <Text className="text-3xl font-outfit-bold text-[#0F172A] mr-4">
              +1
            </Text>
            <TextInput
              ref={inputRef}
              value={formattedNumber}
              onChangeText={handleChangeText}
              keyboardType="phone-pad"
              placeholder="(000) 000-0000"
              placeholderTextColor="#E2E8F0"
              maxLength={14} // (XXX) XXX-XXXX = 14 chars
              className="text-3xl font-outfit-regular flex-1 text-gray-700"
              style={{ paddingVertical: 0 }}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </TouchableOpacity>

          <View className="bg-blue-50/50 p-4 rounded-xl mt-auto mb-4">
            <Text className="text-xs text-slate-500 text-center font-outfit-regular leading-5">
              {t("setup.phone.consentPrefix")}{" "}
              <Text className="font-outfit-bold text-[#0047AB]">
                {t("setup.phone.termsOfService")}
              </Text>{" "}
              {t("setup.phone.consentAnd")}{" "}
              <Text className="font-outfit-bold text-[#0047AB]">
                {t("setup.phone.privacyPolicy")}
              </Text>{" "}
              {t("setup.phone.consentSuffix")}
            </Text>
          </View>

          {/* Continue button */}
          <TouchableOpacity
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={phoneNumber.length < 10 || isChecking}
            className="mb-8 mt-auto"
          >
            <LinearGradient
              colors={phoneNumber.length === 10 ? ['#2B66F8', '#081E72'] : ['#B0C4FF', '#B0C4FF']}
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
              {isChecking ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text className="text-white font-outfit-bold text-center mr-2">{t("setup.phone.continue")}</Text>
                  <ChevronRight size={20} color="white" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>

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

              <TouchableOpacity
                className="bg-blue-700 w-full py-4 rounded-xl shadow-sm"
                onPress={hideError}
              >
                <Text className="text-white text-center font-outfit-bold text-lg">
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
