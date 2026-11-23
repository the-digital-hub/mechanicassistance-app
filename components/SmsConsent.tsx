import { LEGAL_URLS } from "@/lib/config/legal";
import { TYPE } from "@/lib/ui/type";
import { cn } from "@/lib/utils";
import { openBrowserAsync, WebBrowserPresentationStyle } from "expo-web-browser";
import { MessageSquareText } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

type Variant = "light" | "dark";

const VARIANTS: Record<Variant, { card: object; icon: string; text: string; link: string }> = {
  light: {
    card: { backgroundColor: "#F4F8FF", borderWidth: 1, borderColor: "#E1EAFB" },
    icon: "#1E56E3",
    text: "#6B7490",
    link: "#1E56E3",
  },
  dark: {
    card: { backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
    icon: "#FFFFFF",
    text: "rgba(255,255,255,0.75)",
    link: "#FFFFFF",
  },
};

type Props = {
  variant?: Variant;
  className?: string;
};

/**
 * SMS consent disclaimer required on every screen that captures a phone number
 * for OTP delivery (AWS end-user consent policy). Used by /setup and /login.
 */
export function SmsConsent({ variant = "light", className }: Props) {
  const { t } = useTranslation();
  const v = VARIANTS[variant];

  // openBrowserAsync directly instead of <ExternalLink>: that renders a <Link>,
  // which can't be nested inside a <Text> sentence.
  const open = (url: string) =>
    openBrowserAsync(url, {
      presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
    });

  const link = { color: v.link, textDecorationLine: "underline" as const };

  return (
    <View className={cn("flex-row", className)} style={[{ borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, gap: 10 }, v.card]}>
      <MessageSquareText size={18} color={v.icon} style={{ marginTop: 2 }} />
      <Text className="font-outfit-regular flex-1" style={{ ...TYPE.helper, color: v.text }}>
        {t("setup.phone.consentPrefix")}{" "}
        <Text className="font-outfit-bold" style={link} accessibilityRole="link" onPress={() => open(LEGAL_URLS.privacy)}>
          {t("setup.phone.privacyPolicy")}
        </Text>{" "}
        {t("setup.phone.consentAnd")}{" "}
        <Text className="font-outfit-bold" style={link} accessibilityRole="link" onPress={() => open(LEGAL_URLS.terms)}>
          {t("setup.phone.termsOfService")}
        </Text>
        {t("setup.phone.consentSuffix")}
      </Text>
    </View>
  );
}
