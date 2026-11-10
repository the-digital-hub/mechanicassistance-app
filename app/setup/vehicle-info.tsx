import { saveSetupProgress } from "@/lib/storage";
import { VehicleForm, type VehicleFormPayload } from "@/components/vehicles/VehicleForm";
import { VehicleFormHeader } from "@/components/vehicles/vehicleFormDesign";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

/** A vehicle kept on the device until POST /api/users creates the account. */
type SetupVehicle = VehicleFormPayload & { id: string };

export default function VehicleInfoScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(true);
  const [vehicles, setVehicles] = useState<SetupVehicle[]>([]);

  const handleAddVehicle = (payload: VehicleFormPayload) => {
    setVehicles((prev) => [...prev, { id: Date.now().toString(), ...payload }]);
    setIsAdding(false);
  };

  const handleContinue = async () => {
    await saveSetupProgress("vehicles", vehicles);
    router.push("/setup/success");
  };

  if (!isAdding && vehicles.length > 0) {
    return (
      <View className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
          {/* Section Badge */}
          <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
            <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
            <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
              {t("setup.vehicleInfo.yourVehicles")}
            </Text>
          </View>

          {/* Title */}
          <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
            {t("setup.vehicleInfo.title")}
          </Text>

          {/* Subtitle */}
          <Text className="text-gray-500 font-outfit-regular text-base mb-8">
            {t("setup.vehicleInfo.subtitle")}
          </Text>

          {vehicles.map((v, index) => (
            <View
              key={v.id}
              className={`flex-row items-center p-5 rounded-2xl mb-4 border-2 ${index === 0 ? "border-blue-600" : "border-slate-100 bg-slate-50/50"}`}
            >
              <View className="w-12 h-12 bg-white rounded-full items-center justify-center mr-4 border border-slate-100 shadow-sm overflow-hidden">
                {/* <Image
                  source={{ uri: getVehicleLogoUrl(v.make) }}
                  className="w-8 h-8"
                  resizeMode="contain"
                /> */}
              </View>
              <View className="flex-1">
                <Text className="text-lg font-outfit-bold text-[#0F172A] uppercase">
                  {v.make} {v.model}
                </Text>
                <Text className="text-blue-500 font-outfit-medium text-xs tracking-widest uppercase">
                  {v.plate}
                </Text>
              </View>
            </View>
          ))}

          <TouchableOpacity
            onPress={() => setIsAdding(true)}
            activeOpacity={0.8}
            className="mt-4"
          >
            <LinearGradient
              colors={['#2B66F8', '#081E72']}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 10,
                paddingVertical: 16,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text className="text-white font-outfit-bold text-center mr-2">{t("setup.vehicleInfo.addVehicle")}</Text>
              <ChevronRight size={20} color="white" />
            </LinearGradient>
          </TouchableOpacity>

        <TouchableOpacity
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#2B66F8', '#081E72']}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderRadius: 10,
              paddingVertical: 16,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 32,
            }}
          >
            <Text className="text-white font-outfit-bold text-center mr-2">{t("setup.vehicleInfo.continue")}</Text>
            <ChevronRight size={20} color="white" />
          </LinearGradient>
        </TouchableOpacity>
        </ScrollView>
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
