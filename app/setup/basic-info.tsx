import { DatePicker } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/Input";
import { useEmailAvailability } from "@/hooks/useEmailAvailability";
import { mediaDAO } from "@/lib/dao/MediaDAO";
import { getAddRoleState } from "@/lib/setup-add-role";
import { getSetupProgress, saveSetupProgress } from "@/lib/storage";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { SETUP_BG, SetupFooter, SetupHeading } from "@/components/setup/SetupKit";
import { KeyboardAwareScrollView } from "@/components/ui/KeyboardAwareScrollView";
import { TYPE } from "@/lib/ui/type";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { z } from "zod";
import { appAlert } from '@/lib/ui/appAlert';

export default function BasicInfoScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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
  // Adding a role to an existing account (lib/setup-add-role.ts): the account
  // already exists, so there is no password to set, and its own email is not
  // "taken".
  const [isAddRole, setIsAddRole] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const checkedEmailStatus = useEmailAvailability(formData.email);
  const isOwnEmail =
    !!accountEmail &&
    formData.email.trim().toLowerCase() === accountEmail.trim().toLowerCase();
  const emailStatus = isOwnEmail ? "idle" : checkedEmailStatus;

  // Add-role only: shows what the pre-fill seeded from the account.
  useEffect(() => {
    getSetupProgress().then((progress) => {
      const addRole = getAddRoleState(progress);
      if (!addRole) return;
      setIsAddRole(true);
      setAccountEmail(addRole.email ?? null);

      const saved = progress?.basicInfo as Partial<typeof formData> | undefined;
      if (!saved) return;
      setFormData((prev) => ({
        ...prev,
        name: saved.name ?? prev.name,
        surname: saved.surname ?? prev.surname,
        email: saved.email ?? prev.email,
        dob: saved.dob ?? prev.dob,
        profileImage: saved.profileImage ?? prev.profileImage,
      }));
      if (saved.profileImage) setLocalProfileUri(saved.profileImage);
    });
  }, []);

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
      appAlert(t("setup.basicInfo.uploadFailedTitle"), t("setup.basicInfo.uploadFailedMessage"));
      setLocalProfileUri(null);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // ─── Zod schema (evaluated on every formData change) ───────────────────
  const passwordSchema = useMemo(
    () =>
      z
        .string()
        .min(8, "At least 8 characters")
        .regex(
          /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
          "Contains a symbol or number",
        ),
    [],
  );

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
  const ruleMatch =
    formData.confirmPassword.length > 0 &&
    formData.password === formData.confirmPassword;

  const handleContinue = async () => {
    if (emailStatus === 'taken' || emailStatus === 'checking') return;
    if (!isAddRole && (!pwResult.success || !ruleMatch)) return;
    await saveSetupProgress("basicInfo", formData);

    // Didit identity verification is required for mechanics and optional for
    // users, so only mechanics get the step in the wizard. A user can still
    // verify later from the profile screen. Keep in sync with lib/setup-resume.ts.
    // An account adding a role whose identity is already approved skips it.
    const progress = await getSetupProgress();
    const role = progress?.role?.role;
    const identityDone = !!progress?.identity?.prefilled;
    router.push(role === "mechanic" && !identityDone ? "/setup/identity" : "/setup/address");
  };

  const labelStyle = { ...TYPE.body, color: '#0B1530', marginBottom: 8 } as const;
  const inputBox = "bg-white border border-[#E4EAF5] rounded-[14px]";

  return (
    <View className="flex-1" style={{ backgroundColor: SETUP_BG }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <KeyboardAwareScrollView
          ref={scrollViewRef}
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingTop: 18, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SetupHeading screen="basic-info" badge={t("setup.basicInfo.badge")} title={t("setup.basicInfo.title")} subtitle={t("setup.basicInfo.subtitle")} />

          {/* Profile Photo */}
          <View className="flex-row items-center" style={{ padding: 16, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF2FA', marginBottom: 24 }}>
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
                  <Ionicons name="pencil" size={13} color="#0047AB" />
                </View>
              )}
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, color: '#0B1530' }}>
                {t("setup.basicInfo.profilePhoto")}
              </Text>
              <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: '#6B7490' }}>
                {t("setup.basicInfo.updateAvatar")}
              </Text>
            </View>
          </View>

          {/* Model-based inputs with labels */}
          <View style={{ gap: 18, marginBottom: 20 }}>
            <View>
              <Text className="font-outfit-semibold capitalize" style={labelStyle}>
                {t("setup.basicInfo.name")}
              </Text>
              <Input
                value={formData.name}
                onChangeText={(text) =>
                  setFormData((p) => ({ ...p, name: text }))
                }
                containerClassName={inputBox}
              />
            </View>

            <View>
              <Text className="font-outfit-semibold capitalize" style={labelStyle}>
                {t("setup.basicInfo.surname")}
              </Text>
              <Input
                value={formData.surname}
                onChangeText={(text) =>
                  setFormData((p) => ({ ...p, surname: text }))
                }
                containerClassName={inputBox}
              />
            </View>

            <View>
              <Text className="font-outfit-semibold capitalize" style={labelStyle}>
                {t("setup.basicInfo.email")}
              </Text>
              <Input
                value={formData.email}
                onChangeText={(text) =>
                  setFormData((p) => ({ ...p, email: text }))
                }
                containerClassName={inputBox}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {emailStatus === 'checking' && (
                <Text className="font-outfit-regular mt-1" style={{ ...TYPE.helper, color: '#6B7490' }}>{t("setup.basicInfo.checkingAvailability")}</Text>
              )}
              {emailStatus === 'taken' && (
                <Text className="font-outfit-regular mt-1" style={{ ...TYPE.helper, color: '#DC2626' }}>{t("setup.basicInfo.emailTaken")}</Text>
              )}
              {emailStatus === 'available' && (
                <Text className="font-outfit-regular mt-1" style={{ ...TYPE.helper, color: '#10B981' }}>{t("setup.basicInfo.emailAvailable")}</Text>
              )}
              {emailStatus === 'error' && (
                <Text className="font-outfit-regular mt-1" style={{ ...TYPE.helper, color: '#F97316' }}>{t("setup.basicInfo.emailCheckError")}</Text>
              )}
            </View>

            <View>
              <Text className="font-outfit-semibold" style={labelStyle}>
                {t("setup.basicInfo.dob")}
              </Text>
              <DatePicker
                value={formData.dob}
                onChange={(date) => setFormData((p) => ({ ...p, dob: date }))}
                placeholder="MM / DD / YYYY"
                containerClassName={inputBox}
              />
            </View>

            {!isAddRole && (
            <>
            <View ref={passwordContainerRef}>
              <Text className="font-outfit-semibold capitalize" style={labelStyle}>
                {t("setup.basicInfo.accountPassword")}
              </Text>
              <View className="relative">
                <Input
                  value={formData.password}
                  onChangeText={(text) =>
                    setFormData((p) => ({ ...p, password: text }))
                  }
                  onFocus={() => scrollToField(passwordContainerRef)}
                  containerClassName={inputBox}
                    isPassword={true}
                />
              </View>
            </View>

            <View ref={confirmPasswordContainerRef}>
              <Text className="font-outfit-semibold capitalize" style={labelStyle}>
                {t("setup.basicInfo.confirmPassword")}
              </Text>
              <Input
                value={formData.confirmPassword}
                onChangeText={(text) =>
                  setFormData((p) => ({ ...p, confirmPassword: text }))
                }
                onFocus={() => scrollToField(confirmPasswordContainerRef)}
                containerClassName={inputBox}
                isPassword={true}
              />
            </View>
            </>
            )}
          </View>

          {/* Password Requirements */}
          {isAddRole ? null : (
          <View style={{ padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF2FA', gap: 4 }}>
            <Text
              className="font-outfit-regular"
              style={{ ...TYPE.helper, color: ruleLength ? '#10B981' : '#6B7490' }}
            >
              • {t("setup.basicInfo.ruleMinLength")}
            </Text>
            <Text
              className="font-outfit-regular"
              style={{ ...TYPE.helper, color: ruleSymbol ? '#10B981' : '#6B7490' }}
            >
              • {t("setup.basicInfo.ruleSymbol")}
            </Text>
            <Text
              className="font-outfit-regular"
              style={{ ...TYPE.helper, color: ruleMatch ? '#10B981' : '#6B7490' }}
            >
              • {t("setup.basicInfo.rulePasswordsMatch")}
            </Text>
          </View>
          )}
        </KeyboardAwareScrollView>

        <SetupFooter label={t("setup.basicInfo.continue")} onPress={handleContinue} loading={isUploadingPhoto} />
      </KeyboardAvoidingView>
    </View>
  );
}
