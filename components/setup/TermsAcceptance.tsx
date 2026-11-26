import { LEGAL_URLS } from "@/lib/config/legal";
import { TYPE } from "@/lib/ui/type";
import { Ionicons } from "@expo/vector-icons";
import { openBrowserAsync, WebBrowserPresentationStyle } from "expo-web-browser";
import { useTranslation } from "react-i18next";
import { Text, TouchableOpacity, View } from "react-native";

type Props = {
  accepted: boolean;
  onToggle: () => void;
};

/**
 * Sign-up checkbox: the person accepts the Terms and Privacy Policy and agrees not to post offensive, abusive or illegal content
 * (App Store guideline 1.2 asks for terms with no tolerance for it before there is user-generated content, here chat and reviews).
 */
export function TermsAcceptance({ accepted, onToggle }: Props) {
  const { t } = useTranslation();
  const open = (url: string) => openBrowserAsync(url, { presentationStyle: WebBrowserPresentationStyle.AUTOMATIC });
  const link = { color: "#1E56E3", textDecorationLine: "underline" as const };

  return (
    <View
      className="flex-row"
      style={{ borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, gap: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: accepted ? "#1E56E3" : "#E1EAFB" }}
    >
      <TouchableOpacity
        onPress={onToggle}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
        accessibilityLabel={t("setup.terms.accessibilityLabel")}
        testID="terms-acceptance-checkbox"
      >
        <Ionicons name={accepted ? "checkbox" : "square-outline"} size={24} color={accepted ? "#1E56E3" : "#6B7490"} />
      </TouchableOpacity>
      <Text className="font-outfit-regular flex-1" style={{ ...TYPE.helper, color: "#6B7490" }} onPress={onToggle}>
        {t("setup.terms.prefix")}{" "}
        <Text className="font-outfit-bold" style={link} accessibilityRole="link" onPress={() => open(LEGAL_URLS.terms)}>
          {t("setup.phone.termsOfService")}
        </Text>{" "}
        {t("setup.terms.and")}{" "}
        <Text className="font-outfit-bold" style={link} accessibilityRole="link" onPress={() => open(LEGAL_URLS.privacy)}>
          {t("setup.phone.privacyPolicy")}
        </Text>
        {t("setup.terms.suffix")}
      </Text>
    </View>
  );
}
