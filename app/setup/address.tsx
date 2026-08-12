import { AddressAutocomplete } from "@/components/ui/AddressAutocomplete";
import { Input } from "@/components/ui/Input";
import { US_STATES } from "@/lib/address";
import type { ParsedAddress } from "@/lib/places";
import { getSetupProgress, saveSetupProgress } from "@/lib/storage";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

/**
 * `locationLat`/`locationLng` mirror the backend column names, so the payload
 * built in UserDAO needs no renaming on the way out.
 */
type AddressFormData = {
  street: string;
  apartment: string;
  city: string;
  state: string;
  zip: string;
  locationLat?: number;
  locationLng?: number;
};

/**
 * Setup progress saved by older builds stored coordinates as `lat`/`lng`.
 * Read those once so a half-finished registration doesn't lose its location.
 */
const migrateCoords = (stored: Record<string, any>): AddressFormData => ({
  street: stored.street || "",
  apartment: stored.apartment || "",
  city: stored.city || "",
  state: stored.state || "",
  zip: stored.zip || "",
  locationLat: stored.locationLat ?? stored.lat,
  locationLng: stored.locationLng ?? stored.lng,
});

export default function AddressScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [addressType, setAddressType] = useState<"home" | "work">("home");
  const [showStateModal, setShowStateModal] = useState(false);

  const [homeData, setHomeData] = useState<AddressFormData>({
    street: "",
    apartment: "",
    city: "",
    state: "",
    zip: "",
  });
  const [workData, setWorkData] = useState<AddressFormData>({
    street: "",
    apartment: "",
    city: "",
    state: "",
    zip: "",
  });

  useEffect(() => {
    const loadData = async () => {
      const progress = await getSetupProgress();
      if (progress.address) {
        if (progress.address.home) setHomeData(migrateCoords(progress.address.home));
        if (progress.address.work) setWorkData(migrateCoords(progress.address.work));
        if (progress.address.type) setAddressType(progress.address.type);

        // Migrate old data structure if found
        if (
          !progress.address.home &&
          !progress.address.work &&
          progress.address.street
        ) {
          const legacyAddress = {
            street: progress.address.street || "",
            apartment: progress.address.apartment || "",
            city: progress.address.city || "",
            state: progress.address.state || "",
            zip: progress.address.zip || "",
          };
          if (progress.address.type === "work") setWorkData(legacyAddress);
          else setHomeData(legacyAddress);
        }
      }
    };
    loadData();
  }, []);

  const formData = addressType === "home" ? homeData : workData;

  const scrollViewRef = useRef<ScrollView>(null);
  const zipContainerRef = useRef<View>(null);

  const scrollToField = (fieldRef: React.RefObject<View | null>) => {
    if (!fieldRef.current || !scrollViewRef.current) return;

    fieldRef.current.measureLayout(
      scrollViewRef.current as any,
      (_x, y) =>
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, y - 100),
          animated: true,
        }),
      () => {},
    );
  };

  const handleChange = (key: string, value: string) => {
    const setter = addressType === "home" ? setHomeData : setWorkData;
    setter((prev) => ({ ...prev, [key]: value }));
  };

  /** Fills the active (home/work) form from a Google Places suggestion. */
  const handleSelectAddress = (address: ParsedAddress) => {
    const setter = addressType === "home" ? setHomeData : setWorkData;
    setter((prev) => ({
      ...prev,
      street: address.street || prev.street,
      apartment: address.apartment || prev.apartment,
      city: address.city || prev.city,
      state: address.state || prev.state,
      zip: address.zip || prev.zip,
      locationLat: address.locationLat,
      locationLng: address.locationLng,
    }));
  };

  /**
   * Typing over the street by hand invalidates the coordinates that came with
   * the suggestion, so drop them instead of saving a mismatched pair.
   */
  const handleStreetChange = (text: string) => {
    const setter = addressType === "home" ? setHomeData : setWorkData;
    setter((prev) => ({
      ...prev,
      street: text,
      locationLat: undefined,
      locationLng: undefined,
    }));
  };

  const handleContinue = async () => {
    // Save all address data
    await saveSetupProgress("address", {
      type: addressType,
      home: homeData,
      work: workData,
    });

    // Check role to decide next step
    const progress = await getSetupProgress();
    const role = progress.role?.role;

    if (role === "user") {
      router.push("/setup/vehicle-info");
    } else {
      router.push("/setup/credentials");
    }
  };

  const handleSkip = async () => {
    const progress = await getSetupProgress();
    const role = progress.role?.role;

    if (role === "user") {
      router.push("/setup/vehicle-info");
    } else {
      router.push("/setup/credentials");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView
        ref={scrollViewRef}
        style={{ backgroundColor: '#F6F8FC' }}
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section Badge */}
        <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
          <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
          <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
            {t('setup.address.badge')}
          </Text>
        </View>

        {/* Title */}
        <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
          {t('setup.address.title')}
        </Text>

        {/* Subtitle */}
        <Text className="text-gray-500 font-outfit-regular text-base mb-8">
          {t('setup.address.subtitle')}
        </Text>

        {/* Toggle */}
        <View className="flex-row mb-8">
          <TouchableOpacity
            onPress={() => setAddressType("home")}
            className={`flex-1 py-3 border rounded-l-xl justify-center items-center ${addressType === "home" ? "bg-white border-[#0047AB]" : "bg-gray-50 border-gray-200"}`}
          >
            <Text
              className={`font-outfit-medium ${addressType === "home" ? "text-[#0F172A]" : "text-gray-500"}`}
            >
              {t('setup.address.home')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setAddressType("work")}
            className={`flex-1 py-3 border rounded-r-xl justify-center items-center ${addressType === "work" ? "bg-white border-[#0047AB]" : "bg-gray-50 border-gray-200"}`}
          >
            <Text
              className={`font-outfit-medium ${addressType === "work" ? "text-[#0F172A]" : "text-gray-500"}`}
            >
              {t('setup.address.work')}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="space-y-4 mb-4 gap-5">
          <View className="relative z-50">
            <Text className="font-outfit-medium text-[#0F172A] mb-2">
              {t('setup.address.streetNumber')}
            </Text>
            <AddressAutocomplete
              value={formData.street}
              onChangeText={handleStreetChange}
              onSelect={handleSelectAddress}
              containerClassName="bg-white border border-gray-300 rounded-2xl"
              placeholder={t('setup.address.streetPlaceholder')}
            />
          </View>

          <View>
            <Text className="font-outfit-medium text-[#0F172A] mb-2">
              {t('setup.address.apartment')}
            </Text>
            <Input
              value={formData.apartment}
              onChangeText={(text) => handleChange("apartment", text)}
              containerClassName="bg-white border border-gray-300 rounded-2xl"
            />
          </View>

          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className="font-outfit-medium text-[#0F172A] mb-2">
                {t('setup.address.city')}
              </Text>
              <Input
                value={formData.city}
                onChangeText={(text) => handleChange("city", text)}
                containerClassName="bg-white border border-gray-300 rounded-2xl"
              />
            </View>

            <View className="flex-1">
              <Text className="font-outfit-medium text-[#0F172A] mb-2">
                {t('setup.address.state')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowStateModal(true)}
                className="bg-white border border-gray-300 rounded-2xl justify-center px-4"
                style={{ height: 52 }}
              >
                <Text
                  className={`font-outfit-medium ${formData.state ? "text-[#0F172A]" : "text-gray-400"}`}
                  style={{ lineHeight: 25 }}
                >
                  {formData.state || t('setup.address.select')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View ref={zipContainerRef}>
            <Text className="font-outfit-medium text-[#0F172A] mb-2">{t('setup.address.zip')}</Text>
            <Input
              value={formData.zip}
              onChangeText={(text) => {
                const cleaned = text.replace(/\D/g, "").slice(0, 5);
                handleChange("zip", cleaned);
              }}
              onFocus={() => scrollToField(zipContainerRef)}
              containerClassName="bg-white border border-gray-300 rounded-2xl"
              keyboardType="number-pad"
              maxLength={5}
            />
          </View>
        </View>

        <View className="flex-row gap-3 mt-4 mb-10">
          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.8}
            style={{ flex: 0.3 }}
          >
            <View
              style={{
                borderRadius: 10,
                paddingVertical: 16,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#F3F4F6',
                borderWidth: 1,
                borderColor: '#E5E7EB',
              }}
            >
              <Text className="text-gray-700 font-outfit-bold text-center">{t('setup.address.skip')}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleContinue}
            activeOpacity={0.8}
            style={{ flex: 0.7 }}
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
              <Text className="text-white font-outfit-bold text-center mr-2">{t('setup.address.continue')}</Text>
              <ChevronRight size={20} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* State Selection Modal */}
        <Modal
          visible={showStateModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowStateModal(false)}
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl h-2/3">
              <View className="p-6 border-b border-gray-100 flex-row justify-between items-center">
                <Text className="text-xl font-outfit-bold text-blue-900">
                  {t('setup.address.selectState')}
                </Text>
                <TouchableOpacity onPress={() => setShowStateModal(false)}>
                  <Text className="text-blue-600 font-outfit-bold">{t('setup.address.done')}</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={US_STATES}
                keyExtractor={(item) => item.code}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    className={`px-6 py-4 border-b border-gray-50 flex-row justify-between items-center ${formData.state === item.code ? "bg-blue-50" : ""}`}
                    onPress={() => {
                      handleChange("state", item.code);
                      setShowStateModal(false);
                    }}
                  >
                    <Text
                      className={`text-base font-outfit-medium ${formData.state === item.code ? "text-blue-900" : "text-gray-800"}`}
                    >
                      {item.name}
                    </Text>
                    <Text className="text-sm font-outfit-bold text-blue-600">
                      {item.code}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
