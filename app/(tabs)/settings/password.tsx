import { Button } from "@/components/ui/Button";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function PasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [secureTextEntry, setSecureTextEntry] = useState({
    current: true,
    new: true,
    confirm: true,
  });

  const toggleSecureResponse = (key: keyof typeof secureTextEntry) => {
    setSecureTextEntry((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Validation logic
  const hasMinLength = passwords.new.length >= 8;
  const hasSymbolOrNumber = /[0-9!@#$%^&*]/.test(passwords.new);
  const hasNameOrEmail = false; // Placeholder logic

  return (
    <ScrollView style={{ backgroundColor: '#F6F8FC' }} contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24, paddingBottom: 40 }}>
      {/* Section Badge */}
      <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
          {t('password.badge')}
        </Text>
      </View>

      {/* Title */}
      <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
        {t('password.title')}
      </Text>

      {/* Subtitle */}
      <Text className="text-gray-500 font-outfit-regular text-base mb-8">
        {t('password.subtitle')}
      </Text>

      <View className="gap-6 mb-8">
        {/* Current Password */}
        <View>
          <Text className="font-outfit-medium text-gray-900 mb-2">
            {t('password.currentPassword')}
          </Text>
          <View className="flex-row items-center bg-white border border-gray-300 rounded-2xl px-4 h-12">
            <TextInput
              className="flex-1 font-outfit-medium text-gray-900"
              secureTextEntry={secureTextEntry.current}
              value={passwords.current}
              onChangeText={(text) => setPasswords({ ...passwords, current: text })}
              placeholder="*************"
            />
            <TouchableOpacity onPress={() => toggleSecureResponse("current")}>
              {secureTextEntry.current ? (
                <EyeOff size={20} color="#0047AB" />
              ) : (
                <Eye size={20} color="#0047AB" />
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity className="self-end mt-2">
            <Text className="text-blue-600 font-outfit-medium text-xs">
              {t('password.forgotPassword')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* New Password */}
        <View>
          <Text className="font-outfit-medium text-gray-900 mb-2">
            {t('password.newPassword')}
          </Text>
          <View className="flex-row items-center bg-white border border-gray-300 rounded-2xl px-4 h-12">
            <TextInput
              className="flex-1 font-outfit-medium text-gray-900"
              secureTextEntry={secureTextEntry.new}
              value={passwords.new}
              onChangeText={(text) => setPasswords({ ...passwords, new: text })}
              placeholder="*************"
            />
            <TouchableOpacity onPress={() => toggleSecureResponse("new")}>
              {secureTextEntry.new ? (
                <EyeOff size={20} color="#0047AB" />
              ) : (
                <Eye size={20} color="#0047AB" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Confirm Password */}
        <View>
          <Text className="font-outfit-medium text-gray-900 mb-2">
            {t('password.confirmPassword')}
          </Text>
          <View className="flex-row items-center bg-white border border-gray-300 rounded-2xl px-4 h-12">
            <TextInput
              className="flex-1 font-outfit-medium text-gray-900"
              secureTextEntry={secureTextEntry.confirm}
              value={passwords.confirm}
              onChangeText={(text) => setPasswords({ ...passwords, confirm: text })}
              placeholder="*************"
            />
            <TouchableOpacity onPress={() => toggleSecureResponse("confirm")}>
              {secureTextEntry.confirm ? (
                <EyeOff size={20} color="#0047AB" />
              ) : (
                <Eye size={20} color="#0047AB" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Validation Feedback */}
      <View className="mb-10">
        <Text
          className={`font-outfit-regular text-xs mb-1 ${!hasNameOrEmail ? "text-red-500" : "text-green-500"}`}
        >
          {t('password.ruleNoNameEmail')}
        </Text>
        <Text
          className={`font-outfit-regular text-xs mb-1 ${!hasMinLength ? "text-red-500" : "text-green-500"}`}
        >
          {t('password.ruleMinLength')}
        </Text>
        <Text
          className={`font-outfit-regular text-xs ${!hasSymbolOrNumber ? "text-red-500" : "text-green-500"}`}
        >
          {t('password.ruleSymbolOrNumber')}
        </Text>
      </View>

      {/* Buttons Row */}
      <View className="flex-row gap-3">
        {/* Back Button - 30% width */}
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.8}
          style={{ flex: 0.3 }}
          className="py-4 rounded-lg border border-gray-300 items-center"
        >
          <Text className="text-gray-900 font-outfit-semibold text-base">{t('password.back')}</Text>
        </TouchableOpacity>

        {/* Change Password Button - 70% width */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={{ flex: 0.7 }}
        >
          <LinearGradient
            colors={['#2B66F8', '#081E72']}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderRadius: 8,
              paddingVertical: 16,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text className="text-white font-outfit-bold text-base text-center">{t('password.changePassword')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
