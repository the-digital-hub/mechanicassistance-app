import { Input } from "@/components/ui/Input";
import { getSetupProgress, saveSetupProgress } from "@/lib/storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, Text, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';
import { SETUP_BG, SetupFooter, SetupHeading } from '@/components/setup/SetupKit';
import { TYPE } from '@/lib/ui/type';

const choiceStyle = (selected: boolean) => ({
  flex: 1,
  minHeight: 56,
  borderRadius: 16,
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  borderWidth: selected ? 2 : 1,
  borderColor: selected ? '#2B66F8' : '#EEF2FA',
  backgroundColor: selected ? '#E9F1FF' : '#FFFFFF',
});

export default function DealerInfoScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [workForDealer, setWorkForDealer] = useState<boolean | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyInvitation, setCompanyInvitation] = useState("");

  const handleContinue = async () => {
    await saveSetupProgress("dealerInfo", {
      workForDealer,
      companyName,
      companyInvitation,
    });

    const progress = await getSetupProgress();
    const role = progress.role?.role;

    if (role === "user") {
      router.push("./vehicle-info");
    } else {
      router.push("/setup/expertise");
    }
  };

  const label = (text: string) => (
    <Text className="font-outfit-semibold mb-2" style={{ fontSize: 16, color: '#0B1530' }}>{text}</Text>
  );

  return (
    <KeyboardAvoidingView className="flex-1" style={{ backgroundColor: SETUP_BG }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingTop: 18, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <SetupHeading title={t("setup.dealerInfo.title")} subtitle={t("setup.dealerInfo.subtitle")} />

        <Text className="font-outfit-bold mb-3" style={{ ...TYPE.question, color: '#0B1530' }}>
          {t("setup.dealerInfo.question")}
        </Text>

        {/* Yes/No: two equal selectable cards */}
        <View className="flex-row mb-8" style={{ gap: 12 }}>
          <TouchableOpacity onPress={() => setWorkForDealer(true)} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: workForDealer === true }} style={choiceStyle(workForDealer === true)}>
            <Text className="font-outfit-bold" style={{ ...TYPE.body, color: workForDealer === true ? '#1E56E3' : '#4A5470' }}>
              {t("setup.dealerInfo.yes")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setWorkForDealer(false)} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: workForDealer === false }} style={choiceStyle(workForDealer === false)}>
            <Text className="font-outfit-bold" style={{ ...TYPE.body, color: workForDealer === false ? '#1E56E3' : '#4A5470' }}>
              {t("setup.dealerInfo.no")}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ gap: 20 }}>
          <View>
            {label(t("setup.dealerInfo.companyName"))}
            <Input
              value={companyName}
              onChangeText={setCompanyName}
              containerClassName="border border-[#EEF2FA] rounded-[14px]"
            />
          </View>

          <View>
            {label(t("setup.dealerInfo.companyInvitation"))}
            <Input
              value={companyInvitation}
              onChangeText={setCompanyInvitation}
              containerClassName="border border-[#EEF2FA] rounded-[14px]"
            />
          </View>
        </View>
      </KeyboardAwareScrollView>

      <SetupFooter
        label={t("setup.dealerInfo.continue")}
        onPress={handleContinue}
        secondaryLabel={t("setup.skip")}
        onSecondary={() => router.push("/setup/expertise")}
      />
    </KeyboardAvoidingView>
  );
}
