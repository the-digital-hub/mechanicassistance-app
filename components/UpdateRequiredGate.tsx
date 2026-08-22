import { ConfigService } from "@/lib/config/ConfigService";
import Constants from "expo-constants";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Platform, Text, TouchableOpacity, View } from "react-native";

/**
 * Blocks the app when the running build is older than the backend supports.
 *
 * Inactive until the backend starts sending `minSupportedVersion`. It ships now
 * on purpose: a forced upgrade only works if the build being upgraded already
 * contains the gate, so this has to be in the field *before* the release that
 * removes anything an old build depends on.
 */
export function UpdateRequiredGate({ children }: { children: ReactNode }) {
    const { t } = useTranslation();

    const minimum = ConfigService.getMinSupportedVersion();
    const current = Constants.expoConfig?.version ?? "0.0.0";

    if (!minimum || !isOlder(current, minimum)) return <>{children}</>;

    const storeUrl = ConfigService.getStoreUrl(
        Platform.OS === "ios" ? "ios" : "android",
    );

    return (
        <View className="flex-1 bg-white items-center justify-center px-8">
            <Text className="text-xl font-outfit-bold text-[#0F172A] text-center mb-3">
                {t("common.updateRequired.title")}
            </Text>
            <Text className="text-base font-outfit-medium text-slate-600 text-center mb-8">
                {t("common.updateRequired.message")}
            </Text>
            {storeUrl ? (
                <TouchableOpacity
                    onPress={() => void Linking.openURL(storeUrl)}
                    className="bg-blue-700 rounded-xl px-8 py-4"
                >
                    <Text className="text-white font-outfit-bold">
                        {t("common.updateRequired.action")}
                    </Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

/**
 * Semver-ish comparison over dot-separated numbers.
 *
 * Compares numerically rather than as strings, so "1.10.0" is correctly newer
 * than "1.9.0" — a string compare would get that backwards and lock out users
 * who are already up to date.
 */
function isOlder(current: string, minimum: string): boolean {
    const a = current.split(".").map((n) => Number(n) || 0);
    const b = minimum.split(".").map((n) => Number(n) || 0);

    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
        const left = a[i] ?? 0;
        const right = b[i] ?? 0;
        if (left !== right) return left < right;
    }

    return false;
}
