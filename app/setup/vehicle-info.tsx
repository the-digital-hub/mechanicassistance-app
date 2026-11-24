import { saveSetupProgress } from "@/lib/storage";
import { VehicleForm, type VehicleFormPayload } from "@/components/vehicles/VehicleForm";
import { VehicleFormHeader } from "@/components/vehicles/vehicleFormDesign";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SETUP_BG, SetupFooter, SetupHeading } from "@/components/setup/SetupKit";
import { TYPE } from "@/lib/ui/type";
import { useState } from "react";
import { VehicleTitle } from "@/components/ui/VehicleTitle";
import { EmptyStateIcon } from "@/components/ui/EmptyStateIcon";
import { Car, ListChecks, ScanBarcode, Search } from "lucide-react-native";
import { StepTips } from "@/components/setup/StepTips";
import { hasVin } from "@/lib/vehicles/duplicateVin";
import { appAlert } from "@/lib/ui/appAlert";
import { useTranslation } from "react-i18next";
import {
  ScrollView,
  Text,
  View,
} from "react-native";

/** A vehicle kept on the device until POST /api/users creates the account. */
type SetupVehicle = VehicleFormPayload & { id: string };

export default function VehicleInfoScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  // First the question (adding a vehicle now is optional), then the form for whoever says yes.
  const [asked, setAsked] = useState(false);
  const [isAdding, setIsAdding] = useState(true);
  const [vehicles, setVehicles] = useState<SetupVehicle[]>([]);

  const handleAddVehicle = (payload: VehicleFormPayload) => {
    // A VIN is one vehicle: it is not added twice.
    if (hasVin(vehicles, payload.vin)) {
      appAlert(t("vehicles.form.duplicateVinTitle"), t("vehicles.form.duplicateVinMessage"));
      return;
    }
    setVehicles((prev) => [...prev, { id: Date.now().toString(), ...payload }]);
    setIsAdding(false);
  };

  const handleContinue = async () => {
    await saveSetupProgress("vehicles", vehicles);
    router.push("/setup/success");
  };

  // Not now: the account is made without a vehicle, which can be added any time from the profile.
  const handleLater = async () => {
    await saveSetupProgress("vehicles", []);
    router.push("/setup/success");
  };

  if (!asked && vehicles.length === 0) {
    return (
      <View className="flex-1" style={{ backgroundColor: SETUP_BG }}>
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingTop: 18, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <SetupHeading screen="vehicle-info" badge={t("setup.vehicleInfo.askBadge")} title={t("setup.vehicleInfo.askTitle")} subtitle={t("setup.vehicleInfo.askSubtitle")} />
          <View className="items-center" style={{ marginTop: 8, marginBottom: 20 }}>
            <EmptyStateIcon icon={Car} />
          </View>
          {/* How to make the most of it, as tips: the VIN fills the data in, the scanner reads it, and the more complete the better for the repair. */}
          <StepTips
            testID="vehicle-tips"
            steps={[
              { key: "vin", icon: Search, label: t("setup.vehicleInfo.tips.vin.label"), text: t("setup.vehicleInfo.tips.vin.text") },
              { key: "scan", icon: ScanBarcode, label: t("setup.vehicleInfo.tips.scan.label"), text: t("setup.vehicleInfo.tips.scan.text") },
              { key: "more", icon: ListChecks, label: t("setup.vehicleInfo.tips.more.label"), text: t("setup.vehicleInfo.tips.more.text") },
            ]}
          />
        </ScrollView>

        <SetupFooter
          label={t("setup.vehicleInfo.addNow")}
          onPress={() => setAsked(true)}
          secondaryLabel={t("setup.vehicleInfo.later")}
          onSecondary={handleLater}
          chevron={false}
          testID="vehicle-add-now"
        />
      </View>
    );
  }

  if (!isAdding && vehicles.length > 0) {
    return (
      <View className="flex-1" style={{ backgroundColor: SETUP_BG }}>
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingTop: 18, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <SetupHeading screen="vehicle-info" badge={t("setup.vehicleInfo.yourVehicles", { count: vehicles.length })} title={t("setup.vehicleInfo.listTitle", { count: vehicles.length })} subtitle={t("setup.vehicleInfo.subtitle")} />

          {vehicles.map((v, index) => (
            <View
              key={v.id}
              className="flex-row items-center bg-white"
              style={{
                padding: 16,
                borderRadius: 16,
                marginBottom: 12,
                borderWidth: index === 0 ? 2 : 1,
                borderColor: index === 0 ? "#1E56E3" : "#EEF2FA",
              }}
            >
              <View className="w-12 h-12 rounded-full items-center justify-center mr-4 overflow-hidden" style={{ backgroundColor: "#E9F1FF" }}>
                <Ionicons name="car" size={24} color="#1E56E3" />
              </View>
              <View className="flex-1">
                <Text className="font-outfit-bold uppercase" style={{ ...TYPE.cardTitle, color: "#0B1530" }}>
                  <VehicleTitle vehicle={v} />
                </Text>
                <Text className="font-outfit-medium uppercase" style={{ ...TYPE.eyebrow, color: "#1E56E3", marginTop: 2 }}>
                  {v.plate}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <SetupFooter
          label={t("setup.vehicleInfo.continue")}
          onPress={handleContinue}
          secondaryLabel={t("setup.vehicleInfo.addVehicle")}
          onSecondary={() => setIsAdding(true)}
        />
      </View>
    );
  }

  return (
    <VehicleForm
      submitLabel={t("setup.vehicleInfo.continue")}
      onSubmit={handleAddVehicle}
      safeBottom
      header={
        <VehicleFormHeader
          badge={t("setup.vehicleInfo.badge")}
          title={t("setup.vehicleInfo.title")}
          subtitle={t("setup.vehicleInfo.subtitle")}
        />
      }
    />
  );
}
