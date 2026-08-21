import { ApiError } from "@/lib/api/types";
import { verificationDAO } from "@/lib/dao/VerificationDAO";
import { saveSetupProgress } from "@/lib/storage";
import { startVerification } from "@didit-protocol/sdk-react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

/**
 * Identity verification (KYC) step of the setup wizard.
 *
 * The document never passes through us: the backend creates a Didit session, the
 * native SDK captures the document and the selfie, and Didit reports the outcome
 * to our webhook. The SDK's own result only decides what this screen shows next —
 * an `Approved` here is a hint, never proof.
 *
 * Requires a development build: the SDK is a native module and does not exist in
 * Expo Go.
 */

/** One numbered line in the "what happens next" list. */
function Step({ index, text }: { index: number; text: string }) {
  return (
    <View className="flex-row items-start gap-3 mb-3">
      <View
        className="w-6 h-6 rounded-full justify-center items-center mt-0.5"
        style={{ backgroundColor: "#E9F1FF" }}
      >
        <Text className="font-outfit-bold text-xs" style={{ color: "#0047AB" }}>
          {index}
        </Text>
      </View>
      <Text className="text-[#0F172A] font-outfit-regular text-sm flex-1">
        {text}
      </Text>
    </View>
  );
}

export default function IdentityScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [consentGiven, setConsentGiven] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  /** Set once the SDK reports a finished flow, so the button becomes Continue. */
  const [submitted, setSubmitted] = useState(false);

  const goToNextStep = () => router.push("/setup/address");

  /**
   * Skips verification for now. The account is created unverified, so the user
   * can browse the app but not request assistance (or, as a mechanic, offer on a
   * request) until they verify from the profile badge.
   */
  const handleVerifyLater = async () => {
    await saveSetupProgress("identity", { skipped: true });
    goToNextStep();
  };

  /**
   * Records the verification against the setup progress. UserDAO.register reads
   * `identity.verificationId` and sends it on POST /api/users, which is what
   * links the Didit session to the account being created.
   */
  const saveAndAdvance = async (verificationId: string, status: string) => {
    await saveSetupProgress("identity", { verificationId, status });
    setSubmitted(true);
    Alert.alert(
      t("setup.identity.submittedTitle"),
      t("setup.identity.submittedMessage"),
      [{ text: t("setup.identity.continue"), onPress: goToNextStep }],
    );
  };

  const handleStart = async () => {
    if (!consentGiven) {
      Alert.alert(
        t("setup.identity.consentRequiredTitle"),
        t("setup.identity.consentRequiredMessage"),
      );
      return;
    }

    setIsStarting(true);
    try {
      const session = await verificationDAO.createSession({
        language: i18n.language,
      });

      const result = await startVerification(session.sessionToken, {
        languageCode: i18n.language,
      });

      switch (result.type) {
        case "completed":
          // Any finished flow moves the wizard forward — In Review is a normal
          // outcome, and the real decision arrives by webhook either way.
          await saveAndAdvance(session.verificationId, result.session.status);
          break;

        case "cancelled":
          Alert.alert(
            t("setup.identity.cancelledTitle"),
            t("setup.identity.cancelledMessage"),
          );
          break;

        case "failed":
          Alert.alert(
            t("setup.identity.failedTitle"),
            t("setup.identity.failedMessage", { reason: result.error.message }),
          );
          break;
      }
    } catch (error: unknown) {
      // 409 ALREADY_VERIFIED is not a failure: a user re-entering the wizard
      // after being approved should just move on.
      if (error instanceof ApiError && error.statusCode === 409) {
        Alert.alert(
          t("setup.identity.alreadyVerifiedTitle"),
          t("setup.identity.alreadyVerifiedMessage"),
          [{ text: t("setup.identity.continue"), onPress: goToNextStep }],
        );
        return;
      }
      console.error("Failed to start identity verification:", error);
      Alert.alert(
        t("setup.identity.failedTitle"),
        t("setup.identity.failedMessage", {
          reason: (error as Error)?.message ?? "unknown",
        }),
      );
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: "#F4F6FC" }}
      contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Section badge */}
      <View
        className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full"
        style={{ backgroundColor: "#E9F1FF", alignSelf: "flex-start" }}
      >
        <View
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: "#0047AB" }}
        />
        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
          {t("setup.identity.badge")}
        </Text>
      </View>

      <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
        {t("setup.identity.title")}
      </Text>
      <Text className="text-gray-500 font-outfit-regular text-base mb-8">
        {t("setup.identity.subtitle")}
      </Text>

      {/* What happens next */}
      <View
        className="rounded-2xl p-4 mb-6"
        style={{ backgroundColor: "#F4F8FF" }}
      >
        <Text className="text-[#0F172A] font-outfit-medium text-sm mb-3">
          {t("setup.identity.stepsIntro")}
        </Text>
        <Step index={1} text={t("setup.identity.step1")} />
        <Step index={2} text={t("setup.identity.step2")} />
        <Step index={3} text={t("setup.identity.step3")} />
      </View>

      {/*
        Consent lives in our product, not in the SDK: Didit's docs are explicit
        that creating a session does not by itself prove the user was told what
        happens to their data.
      */}
      <View
        className="bg-white rounded-2xl p-4 mb-6 border"
        style={{ borderColor: "#E1EAFB" }}
      >
        <Text className="text-[#0F172A] font-outfit-medium text-sm mb-2">
          {t("setup.identity.consentTitle")}
        </Text>
        <Text className="text-slate-500 font-outfit-regular text-xs mb-4">
          {t("setup.identity.consentBody")}
        </Text>

        <TouchableOpacity
          onPress={() => setConsentGiven((given) => !given)}
          activeOpacity={0.7}
          className="flex-row items-center gap-3"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consentGiven }}
        >
          <View
            className="w-6 h-6 rounded-md justify-center items-center border-2"
            style={{
              borderColor: consentGiven ? "#0047AB" : "#CBD5E1",
              backgroundColor: consentGiven ? "#0047AB" : "transparent",
            }}
          >
            {consentGiven && (
              <Ionicons name="checkmark" size={16} color="white" />
            )}
          </View>
          <Text className="text-[#0F172A] font-outfit-regular text-sm flex-1">
            {t("setup.identity.accept")}
          </Text>
        </TouchableOpacity>
      </View>

      {submitted ? (
        <TouchableOpacity onPress={goToNextStep} activeOpacity={0.8}>
          <LinearGradient
            colors={["#2B66F8", "#081E72"]}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderRadius: 10,
              paddingVertical: 16,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text className="text-white font-outfit-bold text-center mr-2">
              {t("setup.identity.continue")}
            </Text>
            <ChevronRight size={20} color="white" />
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={handleStart}
          activeOpacity={0.8}
          disabled={isStarting || !consentGiven}
        >
          <LinearGradient
            colors={["#2B66F8", "#081E72"]}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderRadius: 10,
              paddingVertical: 16,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: isStarting || !consentGiven ? 0.6 : 1,
            }}
          >
            {isStarting ? (
              <>
                <ActivityIndicator color="white" />
                <Text className="text-white font-outfit-bold text-center">
                  {t("setup.identity.starting")}
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={18} color="white" />
                <Text className="text-white font-outfit-bold text-center">
                  {t("setup.identity.startButton")}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      )}

      {!submitted && (
        <TouchableOpacity
          onPress={handleVerifyLater}
          activeOpacity={0.8}
          disabled={isStarting}
          className="mt-3 rounded-[10px] py-4 px-4 items-center justify-center"
          style={{ backgroundColor: "#F3F4F6", opacity: isStarting ? 0.6 : 1 }}
        >
          <Text className="text-gray-700 font-outfit-bold text-center">
            {t("setup.identity.verifyLater")}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}
