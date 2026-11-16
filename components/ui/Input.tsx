import { cn } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";

interface InputProps extends TextInputProps {
  leftIcon?: React.ReactNode;
  isPassword?: boolean;
  containerClassName?: string;
  /** `light`: field on a white surface (soft fill, 1.5px border, 56px). Default is the white field for dark backdrops. */
  variant?: 'dark' | 'light';
}

export function Input({
  className,
  containerClassName,
  leftIcon,
  isPassword = false,
  variant = 'dark',
  ...props
}: InputProps) {
  const light = variant === 'light';
  // A password field starts hidden; the eye reveals it (and hides it again).
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View
      className={cn(
        "flex-row items-center px-4",
        light ? "" : "bg-white rounded-xl",
        containerClassName,
      )}
      style={light
        ? { height: 56, borderRadius: 14, backgroundColor: '#F6F8FC', borderWidth: 1.5, borderColor: '#E4EAF5' }
        : { height: 52 }}
    >
      {leftIcon && <View className="mr-3">{leftIcon}</View>}
      <TextInput
        className={cn(
          "flex-1 font-outfit-medium",
          light ? "text-[#0B1530]" : "text-black",
          className,
        )}
        style={{
          height: "100%",
          fontSize: 17,
          textAlignVertical: 'center',
        }}
        secureTextEntry={isPassword && !showPassword}
        placeholderTextColor="#9CA3AF"
        // A password must be typed exactly: no auto-capital on the first letter, no autocorrect.
        {...(isPassword ? { autoCapitalize: 'none', autoCorrect: false } : {})}
        {...props}
      />
      {isPassword && (
        <TouchableOpacity
          onPress={() => setShowPassword((v) => !v)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={showPassword ? "Hide password" : "Show password"}
        >
          {/* Hidden: open eye (tap to show). Shown: crossed eye (tap to hide). */}
          <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color="#8C96AE" />
        </TouchableOpacity>
      )}
    </View>
  );
}
