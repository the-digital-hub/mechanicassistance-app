import { Button } from "@/components/ui/Button";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";
import { ApiError } from "@/lib/api/types";
import { userDAO } from "@/lib/dao/UserDAO";
import { appAlert } from "@/lib/ui/appAlert";
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';

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

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSecureResponse = (key: keyof typeof secureTextEntry) => {
    setSecureTextEntry((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Validation logic
  const hasMinLength = passwords.new.length >= 8;
  const hasSymbolOrNumber = /[0-9!@#$%^&*]/.test(passwords.new);

  const matches = passwords.new.length > 0 && passwords.new === passwords.confirm;
  const canSubmit = hasMinLength && hasSymbolOrNumber && matches && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      // No current password typed: an account made by phone has none yet, so this sets the first one.
      if (passwords.current) await userDAO.changePassword(passwords.current, passwords.new);
      else await userDAO.setPassword(passwords.new);
      setPasswords({ current: "", new: "", confirm: "" });
      appAlert(t('password.doneTitle'), t('password.doneBody'), [{ text: t('password.back'), onPress: () => router.back() }], { tone: 'success' });
    } catch (e) {
      if (e instanceof ApiError && e.statusCode === 409) setError(t('password.needCurrent'));
      else if (e instanceof ApiError && (e.statusCode === 401 || e.statusCode === 403)) setError(t('password.wrongCurrent'));
      else setError(t('password.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAwareScrollView style={{ backgroundColor: '#F6F8FC' }} contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24, paddingBottom: 40 }}>
      {/* Section Badge */}
      <View style={{ marginTop: 8 }}>
        <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
          {t('password.badge')}
        </Text>
      </View>
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
          <Text className="font-outfit-bold text-gray-900 mb-2" style={{ fontSize: 17, lineHeight: 23 }}>
            {t('password.currentPassword')}
          </Text>
          <View className="flex-row items-center bg-white border border-gray-300 rounded-2xl px-4 h-14">
            <TextInput
              className="flex-1 font-outfit-medium text-gray-900 text-[17px]"
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
          <Text className="font-outfit-regular mt-2" style={{ fontSize: 14, lineHeight: 19, color: '#6B7490' }}>
            {t('password.currentHint')}
          </Text>
        </View>

        {/* New Password */}
        <View>
          <Text className="font-outfit-bold text-gray-900 mb-2" style={{ fontSize: 17, lineHeight: 23 }}>
            {t('password.newPassword')}
          </Text>
          <View className="flex-row items-center bg-white border border-gray-300 rounded-2xl px-4 h-14">
            <TextInput
              className="flex-1 font-outfit-medium text-gray-900 text-[17px]"
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
          <Text className="font-outfit-bold text-gray-900 mb-2" style={{ fontSize: 17, lineHeight: 23 }}>
            {t('password.confirmPassword')}
          </Text>
          <View className="flex-row items-center bg-white border border-gray-300 rounded-2xl px-4 h-14">
            <TextInput
              className="flex-1 font-outfit-medium text-gray-900 text-[17px]"
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
          className={`font-outfit-regular text-[15px] mb-1 ${!hasMinLength ? "text-red-500" : "text-green-500"}`}
        >
          {t('password.ruleMinLength')}
        </Text>
        <Text
          className={`font-outfit-regular text-[15px] ${!hasSymbolOrNumber ? "text-red-500" : "text-green-500"}`}
        >
          {t('password.ruleSymbolOrNumber')}
        </Text>
      </View>

      {passwords.confirm.length > 0 && !matches ? (
        <Text className="font-outfit-regular text-red-500 mb-3" style={{ fontSize: 15 }}>{t('password.mismatch')}</Text>
      ) : null}
      {error ? <Text className="font-outfit-medium text-red-500 mb-3" style={{ fontSize: 15 }}>{error}</Text> : null}

      {/* Buttons Row */}
      <View className="gap-3">
        <TouchableOpacity
          onPress={() => void submit()}
          disabled={!canSubmit}
          activeOpacity={0.8}
          accessibilityRole="button"
          testID="password-submit"
        >
          <LinearGradient
            colors={['#2B66F8', '#081E72']}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderRadius: 14,
              paddingVertical: 16,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: canSubmit ? 1 : 0.6,
            }}
          >
            {saving ? <ActivityIndicator color="white" /> : <Text className="text-white font-outfit-bold text-lg text-center">{t('password.changePassword')}</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAwareScrollView>
  );
}
