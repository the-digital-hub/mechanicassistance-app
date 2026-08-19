import { LEGAL_URLS } from "@/lib/config/legal";
import { cn } from "@/lib/utils";
import { openBrowserAsync, WebBrowserPresentationStyle } from "expo-web-browser";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

type Variant = "light" | "dark";

const VARIANTS: Record<Variant, { container: string; text: string; link: string }> = {
  light: {
    container: "bg-blue-50/50 p-4 rounded-xl",
    text: "text-xs text-slate-500 text-center font-outfit-regular leading-5",
    link: "font-outfit-bold text-[#0047AB] underline",
  },
  dark: {
    container: "bg-white/10 border border-white/15 p-4 rounded-xl",
    text: "text-xs text-white/70 text-center font-outfit-regular leading-5",
    link: "font-outfit-bold text-white underline",
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
  const styles = VARIANTS[variant];

  // openBrowserAsync directly instead of <ExternalLink>: that renders a <Link>,
  // which can't be nested inside a <Text> sentence.
  const open = (url: string) =>
    openBrowserAsync(url, {
      presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
    });

  return (
    <View className={cn(styles.container, className)}>
      <Text className={styles.text}>
        {t("setup.phone.consentPrefix")}{" "}
        <Text
          className={styles.link}
          accessibilityRole="link"
          onPress={() => open(LEGAL_URLS.privacy)}
        >
          {t("setup.phone.privacyPolicy")}
        </Text>{" "}
        {t("setup.phone.consentAnd")}{" "}
        <Text
          className={styles.link}
          accessibilityRole="link"
          onPress={() => open(LEGAL_URLS.terms)}
        >
          {t("setup.phone.termsOfService")}
        </Text>
        {t("setup.phone.consentSuffix")}
      </Text>
    </View>
  );
}
