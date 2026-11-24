import { useUser } from "@/context/UserContext";
import { useVerification } from "@/context/VerificationContext";
import { ApiError } from "@/lib/api/types";
import { verificationDAO } from "@/lib/dao/VerificationDAO";
import { startVerification } from "@didit-protocol/sdk-react-native";
import { AlertCircle, BadgeCheck, Hourglass, ShieldCheck, X, type LucideIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CONFIRM_GRADIENT } from "@/lib/ui/floatingFooter";
import { SETUP_BG, SETUP_GRADIENT, SetupFooter, SetupHeading } from "@/components/setup/SetupKit";
import { EmptyStateIcon } from "@/components/ui/EmptyStateIcon";
import { IdentityConsent, IdentitySteps } from "@/components/setup/IdentityIntro";
import { TYPE } from "@/lib/ui/type";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { appAlert } from '@/lib/ui/appAlert';

/**
 * Identity verification screen.
 *
 * Not a blocking destination: an unverified account uses the app normally, and
 * for users verification is entirely optional. This is where the mechanic
 * profile badge and the one gated action (offering on a request) send the
 * mechanic when verification is what stands in the way. Enforcement itself
 * lives in appointments-service.
 *
 * Approval arrives by webhook, so the screen updates itself — VerificationContext
 * listens for `verification_update` — and then steps out of the way instead of
 * stranding the user here.
 */

type Variant = "review" | "inProgress" | "declined" | "notStarted" | "approved";

/**
 * Which copy and affordances to show for the current status.
 *
 * `In Progress` and `Awaiting User` are the user's move, not Didit's: the flow
 * was opened and left unfinished (typically cancelled during sign-up before
 * "verify later"). Showing them as "we are reviewing" left no button to resume,
 * stranding the user here. Only `In Review` and `Resubmitted` are truly waiting.
 *
 * `Expired` and `Kyc Expired` fall through to `notStarted` on purpose: both need
 * a fresh session, which is exactly what that variant offers.
 */
function variantFor(status: string | null): Variant {
  if (status === "Approved") return "approved";
  if (status === "Declined" || status === "Abandoned") return "declined";
  if (status === "In Review" || status === "Resubmitted") return "review";
  if (status === "In Progress" || status === "Awaiting User") {
    return "inProgress";
  }
  return "notStarted";
}

const ICONS: Record<Variant, LucideIcon> = {
  review: Hourglass,
  inProgress: ShieldCheck,
  declined: AlertCircle,
  notStarted: ShieldCheck,
  approved: BadgeCheck,
};

export default function VerificationPendingScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useUser();
  const { status, declineReason, refresh } = useVerification();
  const [isStarting, setIsStarting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);

  const variant = variantFor(status);
  // A user arrives here by choice, so the body must not say jobs are blocked —
  // nothing of theirs is. Only the two variants that talk about consequences
  // need the softer wording; `review` and `approved` read the same either way.
  const isMechanic = user?.role === "mechanic";
  const bodyKey =
    !isMechanic &&
    (variant === "notStarted" ||
      variant === "declined" ||
      variant === "inProgress")
      ? `verification.${variant}BodyOptional`
      : `verification.${variant}Body`;
  // Neither "in review" nor "approved" has anything to retry. An unfinished
  // flow resumes: the backend hands back the same Didit session.
  const canRetry =
    variant === "declined" ||
    variant === "notStarted" ||
    variant === "inProgress";

  const handleRetry = async () => {
    setIsStarting(true);
    try {
      const session = await verificationDAO.createSession({
        language: i18n.language,
      });
      const result = await startVerification(session.sessionToken, {
        languageCode: i18n.language,
      });
      switch (result.type) {
        // Backing out is a valid choice, not an error: say so and leave the
        // user on the screen, which now offers its own way out.
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
      // Either way the decision comes back by webhook; pull the current status
      // so the screen reflects the new attempt right away.
      await refresh();
    } catch (error: unknown) {
      // Already approved elsewhere (another device, a manual review): a refresh
      // is all that is needed to unblock.
      if (error instanceof ApiError && error.statusCode === 409) {
        await refresh();
        return;
      }
      console.error("Failed to restart identity verification:", error);
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  /**
   * Leaves the screen. Verification is optional, so there is always a way out;
   * falls back to the tabs when this was the first route in the stack.
   */
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/dashboard");
  };

  const insets = useSafeAreaInsets();
  // One action at the bottom: resume / start / retry; when there is nothing to start (in review) checking the status is the one; approved
  // only continues. No "check again" next to a start button: the screen updates itself when the decision arrives.
  const primary =
    variant === "approved"
      ? { label: t("verification.continueButton"), onPress: leave, loading: false, gradient: CONFIRM_GRADIENT, chevron: true }
      : canRetry
        ? {
            label: t(variant === "declined" ? "verification.retryButton" : variant === "inProgress" ? "verification.resumeButton" : "verification.startButton"),
            onPress: handleRetry,
            loading: isStarting,
            gradient: SETUP_GRADIENT,
            chevron: true,
          }
        : { label: isRefreshing ? t("verification.checking") : t("verification.refreshButton"), onPress: handleRefresh, loading: isRefreshing, gradient: SETUP_GRADIENT, chevron: false };
  // A new check (not started, or started again after a decline) says what happens with the ID and asks to accept it; picking up one already
  // started only shows it.
  const needsConsent = variant === "notStarted" || variant === "declined";

  return (
    <View style={{ flex: 1, backgroundColor: SETUP_BG }}>
      {/* Always an exit: an unverified account is a supported state. Same white circle as the back arrow everywhere. */}
      <View style={{ position: "absolute", top: Math.max(insets.top, 12) + 4, left: 20, zIndex: 10 }}>
        <TouchableOpacity
          onPress={leave}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={t("verification.notNow")}
          testID="verify-close"
        >
          <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
            <X size={18} color="#0047AB" />
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingTop: Math.max(insets.top, 12) + 64, paddingBottom: 24, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <SetupHeading badge={t("verification.screenBadge")} title={t(`verification.${variant}Title`)} subtitle={t(bodyKey)} />

        {/* With something to start: what happens next, like in Account Set-up. Otherwise (in review, approved) just the status icon. */}
        {canRetry ? (
          <IdentitySteps />
        ) : (
          <View className="items-center" style={{ marginTop: 4, marginBottom: 24 }}>
            <EmptyStateIcon icon={ICONS[variant]} />
          </View>
        )}

        {variant === "declined" && declineReason && (
          <View className="flex-row items-center" style={{ gap: 12, padding: 14, borderRadius: 16, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FBD5D5" }}>
            <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#FDE2E2" }}>
              <AlertCircle size={22} color="#DC2626" />
            </View>
            <Text className="flex-1 font-outfit-semibold" style={{ ...TYPE.helper, color: "#B42318" }}>
              {t("verification.declinedReason", { reason: declineReason })}
            </Text>
          </View>
        )}

        {canRetry ? (
          <View style={{ marginTop: variant === "declined" && declineReason ? 16 : 0 }}>
            <IdentityConsent checked={consentGiven} onToggle={() => setConsentGiven((given) => !given)} checkbox={needsConsent} />
          </View>
        ) : null}
      </ScrollView>

      <SetupFooter
        label={primary.label}
        onPress={primary.onPress}
        loading={primary.loading}
        disabled={canRetry && needsConsent && !consentGiven}
        gradient={primary.gradient}
        chevron={primary.chevron}
        testID="verify-primary"
      />
    </View>
  );
}
