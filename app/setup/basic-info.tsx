import { DatePicker } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/Input";
import { useEmailAvailability } from "@/hooks/useEmailAvailability";
import { mediaDAO } from "@/lib/dao/MediaDAO";
import { saveSetupProgress } from "@/lib/storage";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { z } from "zod";

export default function BasicInfoScreen() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    surname: "",
    email: "",
    dob: "",
    password: "",
    confirmPassword: "",
    profileImage: "" as string | null,
  });
  const [localProfileUri, setLocalProfileUri] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const emailStatus = useEmailAvailability(formData.email);

  const scrollViewRef = useRef<ScrollView>(null);
  const passwordContainerRef = useRef<View>(null);
  const confirmPasswordContainerRef = useRef<View>(null);

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

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled) return;
    const localUri = result.assets[0].uri;
    setLocalProfileUri(localUri);
    setIsUploadingPhoto(true);
    try {
      const uploaded = await mediaDAO.uploadPhoto(localUri);
      setFormData((prev) => ({ ...prev, profileImage: uploaded.url }));
    } catch {
      Alert.alert("Upload Failed", "Could not upload profile photo. Please try again.");
      setLocalProfileUri(null);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // ─── Zod schema (evaluated on every formData change) ───────────────────
  const passwordSchema = useMemo(() => {
    const nameParts = [formData.name, formData.surname]
      .join(" ")
      .toLowerCase()
      .split(/\s+/)
      .filter((p) => p.length > 2);
    const emailUser = formData.email.split("@")[0].toLowerCase();

    return z
      .string()
      .min(8, "At least 8 characters")
      .regex(
        /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
        "Contains a symbol or number",
      )
      .refine(
        (pw) => {
          const lower = pw.toLowerCase();
          return (
            !nameParts.some((p) => lower.includes(p)) &&
            !lower.includes(emailUser)
          );
        },
        { message: "Must not contain your name or email" },
      );
  }, [formData.name, formData.surname, formData.email]);

  const pwResult = useMemo(
    () => passwordSchema.safeParse(formData.password),
    [passwordSchema, formData.password],
  );

  // Individual rule booleans — used to color the 3 static bullets
  const pwTouched = formData.password.length > 0;
  const ruleLength = pwTouched && formData.password.length >= 8;
  const ruleSymbol =
    pwTouched &&
    /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password);
  const ruleNameEmail =
    pwTouched &&
    !pwResult.error?.issues.some(
      (i) => i.message === "Must not contain your name or email",
    );
  const ruleMatch =
    formData.confirmPassword.length > 0 &&
    formData.password === formData.confirmPassword;

  const handleContinue = async () => {
    if (!pwResult.success || !ruleMatch || emailStatus === 'taken' || emailStatus === 'checking') return;
    await saveSetupProgress("basicInfo", formData);
    router.push("/setup/identity"); // Navigate to Identity next per user instruction
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
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
            BASIC INFORMATION
          </Text>
        </View>

        {/* Title */}
        <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
          Basic Info
        </Text>

        {/* Subtitle */}
        <Text className="text-gray-500 font-outfit-regular text-base mb-8">
          Please enter your information
        </Text>

        {/* Profile Photo */}
        <View className="flex-row items-center mb-8">
          <TouchableOpacity
            onPress={pickImage}
            disabled={isUploadingPhoto}
            className="w-24 h-24 bg-blue-50 rounded-full items-center justify-center border-2 border-dashed border-blue-200 mr-4 relative overflow-hidden"
          >
            {localProfileUri ? (
              <Image source={{ uri: localProfileUri }} className="w-full h-full" />
            ) : (
              <Ionicons name="camera" size={32} color="#0047AB" style={{ opacity: 0.5 }} />
            )}
            {isUploadingPhoto && (
              <View className="absolute inset-0 bg-black/40 items-center justify-center">
                <ActivityIndicator color="#fff" />
              </View>
            )}
            {!isUploadingPhoto && (
              <View className="absolute bottom-1 right-1 bg-white rounded-full p-1.5 border border-blue-100 shadow-sm">
                <Ionicons name="pencil" size={12} color="#0047AB" />
              </View>
            )}
          </TouchableOpacity>
          <View>
            <Text className="font-outfit-bold text-[#0F172A] text-lg">
              Profile Photo
            </Text>
            <Text className="font-outfit-regular text-slate-400 text-sm">
              Update your avatar
            </Text>
          </View>
        </View>

        {/* Model-based inputs with labels */}
        <View className="space-y-4 mb-6 gap-5">
          <View>
            <Text className="font-outfit-medium text-[#0F172A] mb-2 capitalize">
              Name
            </Text>
            <Input
              value={formData.name}
              onChangeText={(text) =>
                setFormData((p) => ({ ...p, name: text }))
              }
              containerClassName="bg-white border border-gray-300 rounded-2xl"
            />
          </View>

          <View>
            <Text className="font-outfit-medium text-[#0F172A] mb-2 capitalize">
              Surname
            </Text>
            <Input
              value={formData.surname}
              onChangeText={(text) =>
                setFormData((p) => ({ ...p, surname: text }))
              }
              containerClassName="bg-white border border-gray-300 rounded-2xl"
            />
          </View>

          <View>
            <Text className="font-outfit-medium text-[#0F172A] mb-2 capitalize">
              email
            </Text>
            <Input
              value={formData.email}
              onChangeText={(text) =>
                setFormData((p) => ({ ...p, email: text }))
              }
              containerClassName="bg-white border border-gray-300 rounded-2xl"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {emailStatus === 'checking' && (
              <Text className="font-outfit-regular text-xs text-slate-400 mt-1">Checking availability…</Text>
            )}
            {emailStatus === 'taken' && (
              <Text className="font-outfit-regular text-xs text-red-500 mt-1">Email already registered</Text>
            )}
            {emailStatus === 'available' && (
              <Text className="font-outfit-regular text-xs text-green-600 mt-1">Email available</Text>
            )}
            {emailStatus === 'error' && (
              <Text className="font-outfit-regular text-xs text-orange-500 mt-1">Could not verify email</Text>
            )}
          </View>

          <View>
            <Text className="font-outfit-medium text-[#0F172A] mb-2">
              Date of birth
            </Text>
            <DatePicker
              value={formData.dob}
              onChange={(date) => setFormData((p) => ({ ...p, dob: date }))}
              placeholder="MM / DD / YYYY"
              containerClassName="bg-white border border-gray-300 rounded-2xl"
            />
          </View>

          <View ref={passwordContainerRef}>
            <Text className="font-outfit-medium text-[#0F172A] mb-2 capitalize">
              Account Password
            </Text>
            <View className="relative">
              <Input
                value={formData.password}
                onChangeText={(text) =>
                  setFormData((p) => ({ ...p, password: text }))
                }
                onFocus={() => scrollToField(passwordContainerRef)}
                containerClassName="bg-white border border-gray-300 rounded-2xl"
                isPassword={true}
              />
            </View>
          </View>

          <View ref={confirmPasswordContainerRef}>
            <Text className="font-outfit-medium text-[#0F172A] mb-2 capitalize">
              Confirm Password
            </Text>
            <Input
              value={formData.confirmPassword}
              onChangeText={(text) =>
                setFormData((p) => ({ ...p, confirmPassword: text }))
              }
              onFocus={() => scrollToField(confirmPasswordContainerRef)}
              containerClassName="bg-white border border-gray-300 rounded-2xl"
              isPassword={true}
            />
          </View>
        </View>

        {/* Password Requirements */}
        <View className="mb-8 pl-2">
          <Text
            className={`font-outfit-regular text-sm mb-1 ${
              ruleNameEmail ? "text-green-600" : "text-gray-600"
            }`}
          >
            • Must not contain your name or email.
          </Text>
          <Text
            className={`font-outfit-regular text-sm mb-1 ${
              ruleLength ? "text-green-600" : "text-gray-600"
            }`}
          >
            • At least 8 characters.
          </Text>
          <Text
            className={`font-outfit-regular text-sm ${
              ruleSymbol ? "text-green-600" : "text-gray-600"
            }`}
          >
            • Contains a symbol or a number
          </Text>
          <Text
            className={`font-outfit-regular text-sm mt-1 ${
              ruleMatch ? "text-green-600" : "text-gray-600"
            }`}
          >
            • Passwords match
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleContinue}
          activeOpacity={0.8}
          disabled={isUploadingPhoto}
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
            {isUploadingPhoto ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Text className="text-white font-outfit-bold text-center mr-2">Continue</Text>
                <ChevronRight size={20} color="white" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
