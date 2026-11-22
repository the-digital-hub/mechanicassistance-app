import { FONT } from '@/lib/ui/fonts';
import { LucideIcon } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    Dimensions,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

interface ConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  icon: LucideIcon;
  iconColor?: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonColor?: string;
  /** `success` (green): the dialog's button finishes a process (sends the offer, confirms). */
  confirmTone?: "primary" | "success";
  /** The fact the dialog is about (a day and time, a service), big in its own block, as in the app's alerts. */
  highlight?: { label: string; value: string; sub?: string; icon?: keyof typeof Ionicons.glyphMap };
}

export function ConfirmationModal({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  icon: Icon,
  iconColor = "#EF4444",
  confirmText = "Yes",
  cancelText = "No",
  confirmButtonColor = "#0047AB",
  highlight,
  confirmTone = "primary",
}: ConfirmationModalProps) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const [showModal, setShowModal] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withTiming(1, { duration: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(setShowModal)(false);
        }
      });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const backdropStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  if (!showModal) return null;

  return (
    <Modal supportedOrientations={MODAL_ORIENTATIONS} transparent visible={showModal} animationType="none">
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            activeOpacity={1}
          />
        </Animated.View>

        <Animated.View style={[styles.modal, animatedStyle]}>
          <View style={styles.iconContainer}>
            <Icon size={48} color={iconColor} />
          </View>

          <Text style={styles.title}>{title}</Text>
          {highlight ? (
            <View style={styles.highlight} testID="confirmation-highlight">
              <View style={styles.highlightIcon}>
                <Ionicons name={highlight.icon ?? "calendar-outline"} size={24} color={iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.highlightLabel}>{highlight.label}</Text>
                <Text style={styles.highlightValue}>{highlight.value}</Text>
                {highlight.sub ? <Text style={[styles.highlightValue, { color: iconColor }]}>{highlight.sub}</Text> : null}
              </View>
            </View>
          ) : null}
          <Text style={[styles.message, highlight ? { marginTop: 12 } : null]}>{message}</Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={onConfirm}
              activeOpacity={0.8}
              style={styles.confirmButtonTouchable}
            >
              <LinearGradient
                colors={confirmTone === "success" ? ['#10B981', '#047857'] : ['#2B66F8', '#081E72']}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={styles.confirmButton}
              >
                <Text style={styles.confirmButtonText}>{confirmText}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>{cancelText}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modal: {
    width: width * 0.85,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: FONT.bold,
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    fontFamily: FONT.regular,
    color: "#4B5563",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  highlight: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    gap: 14,
    marginTop: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "#EAF1FF",
  },
  highlightIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  highlightLabel: {
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0.4,
    fontFamily: FONT.semibold,
    color: "#6B7490",
    textTransform: "uppercase",
  },
  highlightValue: {
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
    fontFamily: FONT.bold,
    color: "#0B1530",
    marginTop: 2,
  },
  // Never two buttons side by side: the action on top, the way out under it, both full width.
  buttonContainer: {
    flexDirection: "column",
    gap: 8,
    width: "100%",
  },
  cancelButton: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: "#E6EAF2",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonTouchable: {
    borderRadius: 14,
    overflow: "hidden",
  },
  confirmButton: {
    minHeight: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontFamily: FONT.bold,
    color: "#4A5470",
    fontSize: 18,
  },
  confirmButtonText: {
    fontFamily: FONT.bold,
    color: "white",
    fontSize: 18,
  },
});
