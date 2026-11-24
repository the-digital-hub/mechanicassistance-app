import { ApiError } from "@/lib/api/types";
import { verificationDAO } from "@/lib/dao/VerificationDAO";
import { saveSetupProgress } from "@/lib/storage";
import { startVerification } from "@didit-protocol/sdk-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from 'react-native';
import { appAlert } from '@/lib/ui/appAlert';
import { SETUP_BG, SetupFooter, SetupHeading } from '@/components/setup/SetupKit';
import { IdentityConsent, IdentitySteps } from '@/components/setup/IdentityIntro';

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
    appAlert(
      t("setup.identity.submittedTitle"),
      t("setup.identity.submittedMessage"),
      [{ text: t("setup.identity.continue"), onPress: goToNextStep }],
    );
  };

  const handleStart = async () => {
    if (!consentGiven) {
      appAlert(
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
          appAlert(
            t("setup.identity.cancelledTitle"),
            t("setup.identity.cancelledMessage"),
          );
          break;

        case "failed":
          appAlert(
            t("setup.identity.failedTitle"),
            t("setup.identity.failedMessage", { reason: result.error.message }),
          );
          break;
      }
    } catch (error: unknown) {
      // 409 ALREADY_VERIFIED is not a failure: a user re-entering the wizard
      // after being approved should just move on.
      if (error instanceof ApiError && error.statusCode === 409) {
        appAlert(
          t("setup.identity.alreadyVerifiedTitle"),
          t("setup.identity.alreadyVerifiedMessage"),
          [{ text: t("setup.identity.continue"), onPress: goToNextStep }],
        );
        return;
      }
      // 401: the sign-up token (30 minutes) is gone. Say so, and offer the way forward: verify the phone again.
      if (error instanceof ApiError && error.statusCode === 401) {
        appAlert(
          t("setup.identity.expiredTitle"),
          t("setup.identity.expiredMessage"),
          [{ text: t("setup.identity.expiredAction"), onPress: () => router.replace("/setup") }],
          { tone: "warning" },
        );
        return;
      }
      console.error("Failed to start identity verification:", error);
      appAlert(
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
    <View className="flex-1" style={{ backgroundColor: SETUP_BG }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingTop: 18, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SetupHeading screen="identity" badge={t("setup.identity.badge")} title={t("setup.identity.title")} subtitle={t("setup.identity.subtitle")} />

        {/* What happens next */}
        <IdentitySteps />

        {/* Consent */}
        <IdentityConsent checked={consentGiven} onToggle={() => setConsentGiven((given) => !given)} />
      </ScrollView>

      {submitted ? (
        <SetupFooter label={t("setup.identity.continue")} onPress={goToNextStep} />
      ) : (
        <SetupFooter
          label={isStarting ? t("setup.identity.starting") : t("setup.identity.startButton")}
          onPress={handleStart}
          loading={isStarting}
          disabled={!consentGiven}
          chevron={false}
          secondaryLabel={t("setup.identity.verifyLater")}
          onSecondary={handleVerifyLater}
          secondaryDisabled={isStarting}
        />
      )}
    </View>
  );
}
