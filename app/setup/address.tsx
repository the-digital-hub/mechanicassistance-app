import { AddressAutocomplete } from "@/components/ui/AddressAutocomplete";
import { Input } from "@/components/ui/Input";
import { US_STATES } from "@/lib/address";
import type { Address } from "@/lib/dao/interfaces";
import type { ParsedAddress } from "@/lib/places";
import { getAddRoleState } from "@/lib/setup-add-role";
import { getSetupProgress, saveSetupProgress } from "@/lib/storage";
import { useRouter } from "expo-router";
import { useHeaderHeight } from "@react-navigation/elements";
import { KeyboardAwareScrollView } from "@/components/ui/KeyboardAwareScrollView";
import { SETUP_BG, SetupFooter, SetupHeading } from "@/components/setup/SetupKit";
import { BUTTON_RADIUS } from "@/lib/ui/floatingFooter";
import { TYPE } from "@/lib/ui/type";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SlideModal } from '@/components/ui/SlideModal';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
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
  const [addressType, setAddressType] = useState<"home" | "work" | "other">("home");
  /** The user's own name for the "other" address (Other tab). */
  const [otherLabel, setOtherLabel] = useState("");
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

  const [otherData, setOtherData] = useState<AddressFormData>({
    street: "",
    apartment: "",
    city: "",
    state: "",
    zip: "",
  });

  const formSetters = { home: setHomeData, work: setWorkData, other: setOtherData };
  const activeSetter = formSetters[addressType];

  // Adding a role to an existing account: its addresses, offered as "use this".
  // The new role's address starts empty because it may differ from the other's.
  const [existingAddresses, setExistingAddresses] = useState<Address[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const progress = await getSetupProgress();
      setExistingAddresses(
        (getAddRoleState(progress)?.existingAddresses ?? []).filter((a) => a.street || a.city),
      );
      if (progress.address) {
        if (progress.address.home) setHomeData(migrateCoords(progress.address.home));
        if (progress.address.work) setWorkData(migrateCoords(progress.address.work));
        if (progress.address.other) setOtherData(migrateCoords(progress.address.other));
        if (typeof progress.address.otherLabel === "string") setOtherLabel(progress.address.otherLabel);
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

  const formData = { home: homeData, work: workData, other: otherData }[addressType];

  const scrollViewRef = useRef<ScrollView>(null);
  // The screen starts under the step header: that is what the keyboard's offset has to be (a fixed number left a gap above the keyboard).
  const headerHeight = useHeaderHeight();
  const zipContainerRef = useRef<View>(null);
  const streetContainerRef = useRef<View>(null);

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
    const setter = activeSetter;
    setter((prev) => ({ ...prev, [key]: value }));
  };

  /** Fills the active (home/work) form from a Google Places suggestion. */
  const handleSelectAddress = (address: ParsedAddress) => {
    const setter = activeSetter;
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

  /** Copies one of the account's addresses into the active (home/work) form. */
  const handleUseExisting = (address: Address) => {
    const setter = activeSetter;
    setter({
      street: address.street ?? "",
      apartment: address.apartment ?? "",
      city: address.city ?? "",
      state: address.state ?? "",
      zip: address.zip ?? "",
      locationLat: address.locationLat,
      locationLng: address.locationLng,
    });
  };

  /**
   * Typing over the street by hand invalidates the coordinates that came with
   * the suggestion, so drop them instead of saving a mismatched pair.
   */
  const handleStreetChange = (text: string) => {
    // The suggestions open under the field: bring it up so they have the room above the keyboard.
    if (text.length >= 3) scrollToField(streetContainerRef);
    const setter = activeSetter;
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
      other: otherData,
      otherLabel: otherLabel.trim(),
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

  const fieldLabel = "font-outfit-semibold mb-2";
  const fieldLabelStyle = { fontSize: 15, color: '#0B1530' } as const;
  const inputBox = "bg-white border border-[#E1E7F2] rounded-[14px]";

  return (
    <View className="flex-1" style={{ backgroundColor: SETUP_BG }}>
    <KeyboardAvoidingView
      behavior="padding"
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
    >
      <KeyboardAwareScrollView
        ref={scrollViewRef}
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingTop: 18, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SetupHeading screen="address" badge={t('setup.address.badge')} title={t('setup.address.title')} subtitle={t('setup.address.subtitle')} />

        {existingAddresses.length > 0 && (
          <View className="mb-6 overflow-hidden" style={{ backgroundColor: '#F4F8FF', borderRadius: 16, borderWidth: 1, borderColor: '#EEF2FA' }}>
            <Text className="font-outfit-semibold px-4 pt-4 pb-2" style={{ ...TYPE.body, color: '#0B1530' }}>
              {t('setup.addRole.existingAddresses')}
            </Text>
            {existingAddresses.map((address, index) => (
              <View
                key={address.id ?? index}
                className="flex-row items-center px-4 py-3"
                style={{ borderTopWidth: index > 0 ? 1 : 0, borderTopColor: '#E1EAFB' }}
              >
                <View className="flex-1 mr-3">
                  <Text className="font-outfit-medium" style={{ ...TYPE.helper, color: '#0B1530' }} numberOfLines={1}>
                    {address.street}
                  </Text>
                  <Text className="font-outfit-regular" style={{ ...TYPE.caption, color: '#6B7490' }} numberOfLines={1}>
                    {[address.city, address.state, address.zip].filter(Boolean).join(', ')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleUseExisting(address)}
                  className="px-3 py-2 rounded-full"
                  style={{ backgroundColor: '#E9F1FF' }}
                >
                  <Text className="font-outfit-semibold" style={{ ...TYPE.caption, color: '#1E56E3' }}>
                    {t('setup.addRole.useThis')}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Toggle: soft slate track, chosen type in white */}
        <View className="flex-row" style={{ gap: 6, padding: 6, borderRadius: 18, backgroundColor: '#E6EAF2', marginBottom: addressType === "other" ? 16 : 24 }}>
          {(["home", "work", "other"] as const).map((type) => {
            const on = addressType === type;
            return (
              <TouchableOpacity
                key={type}
                onPress={() => setAddressType(type)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                className="flex-1 justify-center items-center"
                style={{ minHeight: 44, borderRadius: BUTTON_RADIUS, backgroundColor: on ? '#FFFFFF' : 'transparent' }}
              >
                <Text className="font-outfit-semibold" style={{ ...TYPE.body, color: on ? '#0B1530' : '#6B7490' }}>
                  {t(`addresses.name.${type}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {addressType === "other" && (
          <View className="mb-6">
            <Text className={fieldLabel} style={fieldLabelStyle}>
              {t('addresses.name.label')}
            </Text>
            <Input
              value={otherLabel}
              onChangeText={setOtherLabel}
              placeholder={t('addresses.name.customPlaceholder')}
              maxLength={40}
              containerClassName={inputBox}
            />
          </View>
        )}

        <View className="mb-4 gap-5">
          <View ref={streetContainerRef} className="relative z-50">
            <Text className={fieldLabel} style={fieldLabelStyle}>
              {t('setup.address.streetNumber')}
            </Text>
            <AddressAutocomplete
              value={formData.street}
              onChangeText={handleStreetChange}
              onSelect={handleSelectAddress}
              containerClassName={inputBox}
              placeholder={t('setup.address.streetPlaceholder')}
            />
          </View>

          <View>
            <Text className={fieldLabel} style={fieldLabelStyle}>
              {t('setup.address.apartment')}
            </Text>
            <Input
              value={formData.apartment}
              onChangeText={(text) => handleChange("apartment", text)}
              containerClassName={inputBox}
            />
          </View>

          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className={fieldLabel} style={fieldLabelStyle}>
                {t('setup.address.city')}
              </Text>
              <Input
                value={formData.city}
                onChangeText={(text) => handleChange("city", text)}
                containerClassName={inputBox}
              />
            </View>

            <View className="flex-1">
              <Text className={fieldLabel} style={fieldLabelStyle}>
                {t('setup.address.state')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowStateModal(true)}
                className="bg-white border justify-center px-4"
                style={{ minHeight: 52, borderRadius: BUTTON_RADIUS, borderColor: '#E1E7F2' }}
              >
                <Text
                  className="font-outfit-medium"
                  style={{ ...TYPE.body, color: formData.state ? '#0B1530' : '#9AA3B8' }}
                >
                  {formData.state || t('setup.address.select')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View ref={zipContainerRef}>
            <Text className={fieldLabel} style={fieldLabelStyle}>{t('setup.address.zip')}</Text>
            <Input
              value={formData.zip}
              onChangeText={(text) => {
                const cleaned = text.replace(/\D/g, "").slice(0, 5);
                handleChange("zip", cleaned);
              }}
              onFocus={() => scrollToField(zipContainerRef)}
              containerClassName={inputBox}
              keyboardType="number-pad"
              maxLength={5}
            />
          </View>
        </View>
      </KeyboardAwareScrollView>

      <SetupFooter
        label={t('setup.address.continue')}
        onPress={handleContinue}
        secondaryLabel={t('setup.address.skip')}
        onSecondary={handleSkip}
      />
    </KeyboardAvoidingView>

    {/* State Selection Modal */}
        <SlideModal visible={showStateModal} onClose={() => setShowStateModal(false)} dim="rgba(0,0,0,0.5)">
          <View>
            <View className="bg-white rounded-t-3xl" style={{ height: Dimensions.get('window').height * 0.66 }}>
              <View className="p-6 border-b border-gray-100 flex-row justify-between items-center">
                <Text className="font-outfit-bold" style={{ ...TYPE.section, color: '#0B1530' }}>
                  {t('setup.address.selectState')}
                </Text>
                <TouchableOpacity onPress={() => setShowStateModal(false)}>
                  <Text className="font-outfit-bold" style={{ ...TYPE.body, color: '#1E56E3' }}>{t('setup.address.done')}</Text>
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
                      className="font-outfit-medium" style={{ ...TYPE.body, color: formData.state === item.code ? '#081E72' : '#0B1530' }}
                    >
                      {item.name}
                    </Text>
                    <Text className="font-outfit-bold" style={{ ...TYPE.helper, color: '#1E56E3' }}>
                      {item.code}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </SlideModal>
    </View>
  );
}
