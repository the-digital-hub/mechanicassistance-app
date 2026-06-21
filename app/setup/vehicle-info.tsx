import { saveSetupProgress } from "@/lib/storage";
import { Input } from "@/components/ui/Input";
import {
  decodeVin,
  fetchMakes,
  fetchModelsByMake,
  getVehicleLogoUrl,
  VEHICLE_COLORS,
} from "@/lib/vehicle";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface Vehicle {
  id: string;
  make: string;
  model: string;
  color: string;
  plate: string;
  vin: string;
  details: string;
}

export default function VehicleInfoScreen() {
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeModal, setActiveModal] = useState<"make" | "model" | null>(null);
  const [isVinSearching, setIsVinSearching] = useState(false);
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [isLoadingMakes, setIsLoadingMakes] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [makeSearchQuery, setMakeSearchQuery] = useState("");

  const scrollViewRef = useRef<ScrollView>(null);
  const detailsContainerRef = useRef<View>(null);
  const vinContainerRef = useRef<View>(null);

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

  // Form state
  const [formData, setFormData] = useState({
    make: "Select",
    model: "Select",
    color: "",
    plate: "",
    vin: "",
    details: "",
  });

  useEffect(() => {
    const loadMakes = async () => {
      setIsLoadingMakes(true);
      const data = await fetchMakes();
      setMakes(data);
      setIsLoadingMakes(false);
    };
    loadMakes();
  }, []);

  useEffect(() => {
    if (formData.make !== "Select") {
      const loadModels = async () => {
        setIsLoadingModels(true);
        const data = await fetchModelsByMake(formData.make);
        setModels(data);
        setIsLoadingModels(false);
      };
      loadModels();
    } else {
      setModels([]);
    }
  }, [formData.make]);

  const handleSelectMake = (make: string) => {
    setFormData((prev) => ({ ...prev, make, model: "Select" }));
    setActiveModal(null);
  };

  const handleSelectModel = (model: string) => {
    setFormData((prev) => ({ ...prev, model }));
    setActiveModal(null);
  };

  const handleVinLookup = async () => {
    const vin = formData.vin.trim();
    if (vin.length !== 17) {
      Alert.alert("Invalid VIN", "A VIN must be exactly 17 characters.");
      return;
    }

    setIsVinSearching(true);
    try {
      await decodeVin(
        vin,
        (make, model) => {
          setFormData((prev) => ({
            ...prev,
            make,
            model,
          }));
          Alert.alert("VIN Decoded", `Found: ${make} ${model}`, [
            { text: "OK" },
          ]);
        },
        (errorMsg) => {
          Alert.alert("VIN Not Found", errorMsg);
        },
      );
    } finally {
      setIsVinSearching(false);
    }
  };

  const handleAddVehicle = () => {
    const newVehicle: Vehicle = {
      id: Date.now().toString(),
      ...formData,
    };
    setVehicles((prev) => [...prev, newVehicle]);
    setIsAdding(false);
    // Reset form
    setFormData({
      make: "Select",
      model: "Select",
      color: "",
      plate: "",
      vin: "",
      details: "",
    });
  };

  const handleContinue = async () => {
    if (isAdding && vehicles.length === 0) {
      // If they haven't added any yet, maybe validate and add the current one
      if (formData.make !== "Select" && formData.model !== "Select") {
        handleAddVehicle();
        return;
      }
    }

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
              YOUR VEHICLES
            </Text>
          </View>

          {/* Title */}
          <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
            Vehicle Info
          </Text>

          {/* Subtitle */}
          <Text className="text-gray-500 font-outfit-regular text-base mb-8">
            Help us recognize you faster.
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
              <Text className="text-white font-outfit-bold text-center mr-2">Add vehicle</Text>
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
            <Text className="text-white font-outfit-bold text-center mr-2">Continue</Text>
            <ChevronRight size={20} color="white" />
          </LinearGradient>
        </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

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
            VEHICLE INFORMATION
          </Text>
        </View>

        {/* Title */}
        <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
          Vehicle Info
        </Text>

        {/* Subtitle */}
        <Text className="text-gray-500 font-outfit-regular text-base mb-8">
          Help us recognize you faster.
        </Text>

        <View className="space-y-6 gap-5">
          {/* VIN FIRST per user request */}
          <View>
            <Text className="font-outfit-medium text-[#0F172A] mb-2">
              VIN #
            </Text>
            <View className="flex-row items-center gap-2">
              <View ref={vinContainerRef} className="flex-1">
                <Input
                  value={formData.vin}
                  onChangeText={(text) => {
                    // Quick test helper bypass
                    if (text.includes(".")) {
                      setFormData((p) => ({ ...p, vin: "5YJ3E1EB9NF000001" }));
                    } else {
                      setFormData((p) => ({ ...p, vin: text.toUpperCase() }));
                    }
                  }}
                  onFocus={() => scrollToField(vinContainerRef)}
                  containerClassName="bg-white border border-gray-300 rounded-2xl h-12"
                  maxLength={17}
                  autoCapitalize="characters"
                  placeholder="Enter 17-character VIN"
                />
              </View>
              <TouchableOpacity
                onPress={handleVinLookup}
                disabled={isVinSearching || formData.vin.trim().length !== 17}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor:
                    formData.vin.trim().length === 17 ? "#0047AB" : "#CBD5E1",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isVinSearching ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="search" size={22} color="white" />
                )}
              </TouchableOpacity>
            </View>
            <Text className="text-xs font-outfit-regular text-slate-400 mt-1">
              Enter VIN and tap search to auto-fill Make & Model
            </Text>
          </View>

          <View>
            <Text className="font-outfit-medium text-[#0F172A] mb-2">
              Vehicle make
            </Text>
            <TouchableOpacity
              onPress={() => setActiveModal("make")}
              className="bg-white border border-gray-300 rounded-2xl flex-row items-center justify-between px-4"
              style={{ height: 52 }}
            >
              <View className="flex-row items-center gap-2">
                {/* {formData.make !== "Select" && (
                  <Image
                    source={{ uri: getVehicleLogoUrl(formData.make) }}
                    className="w-5 h-5"
                    resizeMode="contain"
                  />
                )} */}
                <Text className="text-[#0F172A] font-outfit-regular">
                  {formData.make}
                </Text>
              </View>
              {isLoadingMakes ? (
                <ActivityIndicator size="small" color="#0047AB" />
              ) : (
                <Ionicons name="chevron-down" size={20} color="#0047AB" />
              )}
            </TouchableOpacity>
          </View>

          <View>
            <Text className="font-outfit-medium text-[#0F172A] mb-2">
              Vehicle model
            </Text>
            <TouchableOpacity
              onPress={() =>
                formData.make !== "Select" && setActiveModal("model")
              }
              disabled={formData.make === "Select"}
              className={`bg-white border border-gray-300 rounded-2xl flex-row items-center justify-between px-4 ${formData.make === "Select" ? "opacity-50" : ""}`}
              style={{ height: 52 }}
            >
              <Text className="text-[#0F172A] font-outfit-regular">
                {formData.model}
              </Text>
              {isLoadingModels ? (
                <ActivityIndicator size="small" color="#0047AB" />
              ) : (
                <Ionicons name="chevron-down" size={20} color="#0047AB" />
              )}
            </TouchableOpacity>
          </View>

          <View>
            <Text className="font-outfit-medium text-[#0F172A] mb-2">
              Color
            </Text>
            <View className="flex-row gap-3">
              {VEHICLE_COLORS.map((c) => {
                const isSelected = formData.color === c.name;
                return (
                  <TouchableOpacity
                    key={c.name}
                    onPress={() =>
                      setFormData((p) => ({ ...p, color: c.name }))
                    }
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: c.hex,
                      borderWidth: isSelected ? 3 : 1,
                      borderColor: isSelected ? "#0047AB" : c.border,
                    }}
                  >
                    {isSelected && (
                      <View
                        style={{
                          flex: 1,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons
                          name="checkmark"
                          size={24}
                          color={c.name === "White" ? "#0047AB" : "#FFFFFF"}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            {formData.color ? (
              <Text className="text-xs font-outfit-medium text-blue-600 mt-2">
                {formData.color}
              </Text>
            ) : null}
          </View>

          <View>
            <Text className="font-outfit-medium text-[#0F172A] mb-2">
              License plate #
            </Text>
            <Input
              value={formData.plate}
              onChangeText={(text) =>
                setFormData((p) => ({ ...p, plate: text }))
              }
              containerClassName="bg-white border border-gray-300 rounded-2xl"
            />
          </View>

          <View ref={detailsContainerRef}>
            <Text className="font-outfit-medium text-[#0F172A] mb-2">
              Are there any further details that can better help identify your
              vehicle?
            </Text>
            <TextInput
              multiline
              numberOfLines={4}
              value={formData.details}
              onChangeText={(text) =>
                setFormData((p) => ({ ...p, details: text }))
              }
              onFocus={() => scrollToField(detailsContainerRef)}
              className="bg-white border border-gray-300 rounded-2xl p-4 font-outfit-regular text-[#0F172A] text-base"
              style={{ textAlignVertical: "top", height: 120 }}
            />
          </View>
        </View>

        <View className="mt-12 px-6">
          <TouchableOpacity
            onPress={handleAddVehicle}
            activeOpacity={0.8}
            disabled={formData.make === "Select" || formData.model === "Select"}
          >
            <LinearGradient
              colors={formData.make !== "Select" && formData.model !== "Select" ? ['#2B66F8', '#081E72'] : ['#B0C4FF', '#B0C4FF']}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 10,
                paddingVertical: 16,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: formData.make === "Select" || formData.model === "Select" ? 0.6 : 1,
              }}
            >
              <Text className="text-white font-outfit-bold text-center mr-2">Continue</Text>
              <ChevronRight size={20} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Selection Modal */}
        <Modal
          visible={!!activeModal}
          transparent
          animationType="slide"
          onRequestClose={() => setActiveModal(null)}
        >
          <View className="flex-1 bg-black/40 justify-end">
            <View className="bg-white rounded-t-3xl min-h-[50%] max-h-[80%] p-6">
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-xl font-outfit-bold text-[#0F172A]">
                  Select {activeModal === "make" ? "Make" : "Model"}
                </Text>
                <TouchableOpacity onPress={() => setActiveModal(null)}>
                  <Text className="text-blue-600 font-outfit-bold">Done</Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-xl px-3 mb-4">
                <Ionicons name="search" size={18} color="#64748B" />
                <TextInput
                  placeholder={`Search ${activeModal === "make" ? "Make" : "Model"}...`}
                  value={makeSearchQuery}
                  onChangeText={setMakeSearchQuery}
                  className="flex-1 h-11 px-2 font-outfit-medium text-[#0F172A]"
                />
                {makeSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setMakeSearchQuery("")}>
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {activeModal === "make" ? (
                  makes
                    .filter((m) =>
                      m.toLowerCase().includes(makeSearchQuery.toLowerCase()),
                    )
                    .map((make) => (
                      <TouchableOpacity
                        key={make}
                        className="py-4 border-b border-slate-50 flex-row items-center gap-3"
                        onPress={() => {
                          handleSelectMake(make);
                          setMakeSearchQuery("");
                        }}
                      >
                        {/* <Image
                          source={{ uri: getVehicleLogoUrl(make) }}
                          className="w-6 h-6"
                          resizeMode="contain"
                        /> */}
                        <Text
                          className={`text-lg font-outfit-medium ${formData.make === make ? "text-blue-600" : "text-[#0F172A]"}`}
                        >
                          {make}
                        </Text>
                      </TouchableOpacity>
                    ))
                ) : (
                  models
                    .filter((m) =>
                      m.toLowerCase().includes(makeSearchQuery.toLowerCase()),
                    )
                    .map((model) => (
                      <TouchableOpacity
                        key={model}
                        className="py-4 border-b border-slate-50"
                        onPress={() => {
                          handleSelectModel(model);
                          setMakeSearchQuery("");
                        }}
                      >
                        <Text
                          className={`text-lg font-outfit-medium ${formData.model === model ? "text-blue-600" : "text-[#0F172A]"}`}
                        >
                          {model}
                        </Text>
                      </TouchableOpacity>
                    ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
