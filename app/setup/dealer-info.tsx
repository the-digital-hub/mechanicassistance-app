import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getSetupProgress, saveSetupProgress } from "@/lib/storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

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

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
    >
      {/* Header Skip Action is handled in _layout.tsx */}

      <View className="mb-6">
        <Text className="text-xl font-outfit-bold text-[#0F172A] mb-1">
          {t("setup.dealerInfo.title")}
        </Text>
        <Text className="text-[#0047AB] font-outfit-medium text-base">
          {t("setup.dealerInfo.subtitle")}
        </Text>
      </View>

      <Text className="font-outfit-regular text-[#0F172A] text-base mb-4">
        {t("setup.dealerInfo.question")}
      </Text>

      {/* Yes/No Toggle */}
      <View className="flex-row mb-8 gap-4">
        <TouchableOpacity
          onPress={() => setWorkForDealer(true)}
          className={`flex-1 py-3 border rounded-xl justify-center items-center ${workForDealer === true ? "bg-white border-[#0F172A] border-2" : "bg-white border-gray-200"}`}
        >
          <Text
            className={`font-outfit-medium ${workForDealer === true ? "text-[#0F172A]" : "text-gray-500"}`}
          >
            {t("setup.dealerInfo.yes")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setWorkForDealer(false)}
          className={`flex-1 py-3 border rounded-xl justify-center items-center ${workForDealer === false ? "bg-white border-[#0F172A] border-2" : "bg-white border-gray-200"}`}
        >
          <Text
            className={`font-outfit-medium ${workForDealer === false ? "text-[#0F172A]" : "text-gray-500"}`}
          >
            {t("setup.dealerInfo.no")}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="space-y-6 mb-8 gap-5">
        <View>
          <Text className="font-outfit-medium text-[#0F172A] mb-2">
            {t("setup.dealerInfo.companyName")}
          </Text>
          <Input
            value={companyName}
            onChangeText={setCompanyName}
            containerClassName="bg-blue-50/50 border-0 h-12"
          />
        </View>

        <View>
          <Text className="font-outfit-medium text-[#0F172A] mb-2">
            {t("setup.dealerInfo.companyInvitation")}
          </Text>
          <Input
            value={companyInvitation}
            onChangeText={setCompanyInvitation}
            containerClassName="bg-blue-50/50 border-0 h-12"
          />
        </View>
      </View>

      <Button
        onPress={handleContinue}
        size="lg"
        className="bg-blue-700 rounded-xl mt-auto"
      >
        {t("setup.dealerInfo.continue")}
      </Button>
    </ScrollView>
  );
}
