import { SHEET_ROLES } from "@/components/profile/SwitchRoleSheet";
import { GradientLayout } from "@/components/ui/GradientLayout";
import type { AppRole } from "@/lib/dao/interfaces";
import { TYPE } from "@/lib/ui/type";
import { Check, ChevronRight } from "lucide-react-native";
import React from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * "Where do you want to go?" — the roles the account holds as big cards over
 * the brand backdrop. Tapping one enters that role directly.
 */
export function RoleChoice({ roles, lastUsed, busy, onPick, onSignOut }: {
  roles: AppRole[];
  /** The role the account was last active as. */
  lastUsed: AppRole;
  busy: AppRole | null;
  onPick: (role: AppRole) => void;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <GradientLayout>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <Image source={require("@/assets/images/brand_ring_white.png")} style={{ width: 84, height: 84 }} resizeMode="contain" />
          <Text className="font-outfit-bold" style={{ fontSize: 30, lineHeight: 34, letterSpacing: -0.6, color: "#FFFFFF", textAlign: "center", marginTop: 20 }}>
            {t("chooseRole.title")}
          </Text>
          <Text className="font-outfit-regular" style={{ ...TYPE.body, color: "#C9D6EE", textAlign: "center", marginTop: 8 }}>
            {t("chooseRole.subtitle")}
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          {SHEET_ROLES.filter((r) => roles.includes(r.id as AppRole)).map(({ id, icon: Icon }) => {
            const role = id as AppRole;
            const loading = busy === role;
            return (
              <TouchableOpacity
                key={id}
                onPress={() => onPick(role)}
                disabled={!!busy}
                activeOpacity={0.88}
                accessibilityRole="button"
                testID={`choose-role-${id}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  padding: 16,
                  borderRadius: 20,
                  backgroundColor: "#FFFFFF",
                  opacity: busy && !loading ? 0.55 : 1,
                  shadowColor: "#061A66",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.25,
                  shadowRadius: 16,
                  elevation: 8,
                }}
              >
                <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: "#EAF1FF", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={26} color="#1E56E3" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <Text className="font-outfit-bold" style={{ ...TYPE.group, color: "#0B1530" }}>
                      {t(`profile.switchRole.roles.${id}.label`)}
                    </Text>
                    {role === lastUsed ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100, backgroundColor: "#ECFBF3" }}>
                        <Check size={12} color="#0E8A5F" strokeWidth={3} />
                        <Text className="font-outfit-bold" style={{ fontSize: 13, color: "#0E8A5F" }}>{t("chooseRole.lastUsed")}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: "#6B7490", marginTop: 2 }}>
                    {t(`profile.switchRole.roles.${id}.desc`)}
                  </Text>
                </View>
                {loading ? <ActivityIndicator color="#1E56E3" /> : <ChevronRight size={22} color="#1E56E3" />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Same pattern as "Don't have an account? Sign Up" on the sign-in screen: plain text + bold link */}
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 26 }}>
          <Text className="font-outfit-regular" style={{ ...TYPE.body, color: "rgba(255,255,255,0.8)" }}>
            {t("chooseRole.notYouLabel")}{" "}
          </Text>
          <TouchableOpacity
            onPress={onSignOut}
            disabled={!!busy}
            accessibilityRole="button"
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          >
            <Text className="font-outfit-bold" style={{ ...TYPE.question, color: "#FFFFFF", opacity: busy ? 0.6 : 1 }}>
              {t("chooseRole.logOut")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </GradientLayout>
  );
}
