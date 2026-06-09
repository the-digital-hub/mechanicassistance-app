import { Button } from "@/components/ui/Button";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";
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
    <View className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
      {/* Custom Header */}
      <View className="px-6 pt-20 pb-2 flex-row items-center justify-between" style={{ backgroundColor: '#F4F5FA', borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB' }}>
          <TouchableOpacity onPress={() => router.back()}>
              <View className="w-10 h-10 rounded-full justify-center items-center" style={{ backgroundColor: '#FFFFFF' }}>
                  <ChevronLeft size={20} color="#0047AB" />
              </View>
          </TouchableOpacity>
          <Text style={{ fontFamily: 'Outfit_500Medium', fontSize: 18, color: '#1A1A1A', flex: 1, textAlign: 'center' }}>
              Profile
          </Text>
          <View className="w-6" />
      </View>

    <ScrollView className="flex-1 px-6 pt-6">
      {/* Section Badge */}
      <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
          PASSWORD SETTINGS
        </Text>
      </View>

      {/* Title */}
      <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
        Account Password
      </Text>

      {/* Subtitle */}
      <Text className="text-gray-500 font-outfit-regular text-base mb-8">
        Secure your account with a strong password
      </Text>

      <View className="gap-6 mb-8">
        {/* Current Password */}
        <View>
          <Text className="font-outfit-medium text-gray-900 mb-2">
            Current Password
          </Text>
          <View className="flex-row items-center bg-white border border-gray-300 rounded-2xl px-4 h-12">
            <TextInput
              className="flex-1 font-outfit-medium text-gray-900"
              secureTextEntry={secureTextEntry.current}
              value={passwords.current}
              onChangeText={(t) => setPasswords({ ...passwords, current: t })}
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
              Forgot Password?
            </Text>
          </TouchableOpacity>
        </View>

        {/* New Password */}
        <View>
          <Text className="font-outfit-medium text-gray-900 mb-2">
            New Password
          </Text>
          <View className="flex-row items-center bg-white border border-gray-300 rounded-2xl px-4 h-12">
            <TextInput
              className="flex-1 font-outfit-medium text-gray-900"
              secureTextEntry={secureTextEntry.new}
              value={passwords.new}
              onChangeText={(t) => setPasswords({ ...passwords, new: t })}
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
            Confirm New Password
          </Text>
          <View className="flex-row items-center bg-white border border-gray-300 rounded-2xl px-4 h-12">
            <TextInput
              className="flex-1 font-outfit-medium text-gray-900"
              secureTextEntry={secureTextEntry.confirm}
              value={passwords.confirm}
              onChangeText={(t) => setPasswords({ ...passwords, confirm: t })}
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
          Must not contain your name or email.
        </Text>
        <Text
          className={`font-outfit-regular text-xs mb-1 ${!hasMinLength ? "text-red-500" : "text-green-500"}`}
        >
          At least 8 characters.
        </Text>
        <Text
          className={`font-outfit-regular text-xs ${!hasSymbolOrNumber ? "text-red-500" : "text-green-500"}`}
        >
          Contains a symbol or a number
        </Text>
      </View>

      <TouchableOpacity activeOpacity={0.8} style={{ marginBottom: 40 }}>
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
          <Text className="text-white font-outfit-bold text-center mr-2">Change Password</Text>
          <ChevronRight size={20} color="white" />
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
    </View>
  );
}
