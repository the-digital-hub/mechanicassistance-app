import { useUser } from "@/context/UserContext";
import { useVerification } from "@/context/VerificationContext";
import { ApiError } from "@/lib/api/types";
import { verificationDAO } from "@/lib/dao/VerificationDAO";
import { startVerification } from "@didit-protocol/sdk-react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
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

type Variant = "review" | "declined" | "notStarted" | "approved";

/**
 * Which copy and affordances to show for the current status.
 *
 * `Expired` and `Kyc Expired` fall through to `notStarted` on purpose: both need
 * a fresh session, which is exactly what that variant offers.
 */
function variantFor(status: string | null): Variant {
  if (status === "Approved") return "approved";
  if (status === "Declined" || status === "Abandoned") return "declined";
  if (
    status === "In Review" ||
    status === "In Progress" ||
    status === "Resubmitted" ||
    status === "Awaiting User"
  ) {
    return "review";
  }
  return "notStarted";
}

const ICONS: Record<
  Variant,
  { name: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  review: { name: "hourglass-outline", color: "#0047AB", bg: "#E9F1FF" },
  declined: { name: "alert-circle-outline", color: "#EF4444", bg: "#FEE2E2" },
  notStarted: { name: "shield-outline", color: "#0047AB", bg: "#E9F1FF" },
  approved: { name: "checkmark-circle", color: "#047857", bg: "#D1FAE5" },
};

export default function VerificationPendingScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useUser();
  const { status, declineReason, refresh } = useVerification();
  const [isStarting, setIsStarting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const variant = variantFor(status);
  const icon = ICONS[variant];
  // A user arrives here by choice, so the body must not say jobs are blocked —
  // nothing of theirs is. Only the two variants that talk about consequences
  // need the softer wording; `review` and `approved` read the same either way.
  const isMechanic = user?.role === "mechanic";
  const bodyKey =
    !isMechanic && (variant === "notStarted" || variant === "declined")
      ? `verification.${variant}BodyOptional`
      : `verification.${variant}Body`;
  // Neither "in review" nor "approved" has anything to retry.
  const canRetry = variant === "declined" || variant === "notStarted";

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

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F6FC" }}>
      {/* Always an exit: an unverified account is a supported state. */}
      <TouchableOpacity
        onPress={leave}
        activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={t("verification.notNow")}
        style={{ position: "absolute", top: 48, left: 16, zIndex: 10 }}
      >
        <Ionicons name="close" size={26} color="#0F172A" />
      </TouchableOpacity>

      <ScrollView
        style={{ backgroundColor: "#F4F6FC" }}
        contentContainerStyle={{
          padding: 24,
          paddingTop: 80,
          paddingBottom: 40,
          flexGrow: 1,
        }}
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
            {t("verification.screenBadge")}
          </Text>
        </View>

        <View
          className="w-16 h-16 rounded-full justify-center items-center mb-6"
          style={{ backgroundColor: icon.bg }}
        >
          <Ionicons name={icon.name} size={30} color={icon.color} />
        </View>

        <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
          {t(`verification.${variant}Title`)}
        </Text>
        <Text className="text-gray-500 font-outfit-regular text-base mb-4">
          {t(bodyKey)}
        </Text>

        {variant === "declined" && declineReason && (
          <View
            className="rounded-2xl p-4 mb-6"
            style={{ backgroundColor: "#FEE2E2" }}
          >
            <Text
              className="font-outfit-regular text-sm"
              style={{ color: "#B91C1C" }}
            >
              {t("verification.declinedReason", { reason: declineReason })}
            </Text>
          </View>
        )}

        <View style={{ flex: 1 }} />

        {variant === "approved" && (
          <TouchableOpacity
            onPress={leave}
            activeOpacity={0.8}
            className="mb-3"
          >
            <LinearGradient
              colors={["#10B981", "#047857"]}
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
              <Text className="text-white font-outfit-bold text-center">
                {t("verification.continueButton")}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {canRetry && (
          <TouchableOpacity
            onPress={handleRetry}
            activeOpacity={0.8}
            disabled={isStarting}
            className="mb-3"
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
                opacity: isStarting ? 0.6 : 1,
              }}
            >
              {isStarting ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={18} color="white" />
                  <Text className="text-white font-outfit-bold text-center">
                    {t(
                      variant === "declined"
                        ? "verification.retryButton"
                        : "verification.startButton",
                    )}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={handleRefresh}
          activeOpacity={0.8}
          disabled={isRefreshing}
          className="rounded-[10px] py-4 px-4 flex-row items-center justify-center"
          style={{ backgroundColor: "#F3F4F6", opacity: isRefreshing ? 0.6 : 1 }}
        >
          <Text className="text-gray-700 font-outfit-bold text-center">
            {isRefreshing
              ? t("verification.checking")
              : t("verification.refreshButton")}
          </Text>
        </TouchableOpacity>

        {variant !== "approved" && (
          <TouchableOpacity
            onPress={leave}
            activeOpacity={0.7}
            className="mt-1 py-4 px-4 items-center justify-center"
          >
            <Text className="text-gray-500 font-outfit-medium text-center">
              {t("verification.notNow")}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
