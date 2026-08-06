import { Button } from "@/components/ui/Button";
import { useUser } from "@/context/UserContext";
import { expertiseDAO, ExpertiseItem } from "@/lib/dao/ExpertiseDAO";
import { saveSetupProgress } from "@/lib/storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type DropdownProps = {
    label: string;
    placeholder: string;
    options: ExpertiseItem[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    loading?: boolean;
};

function MultiSelectDropdown({
    label,
    placeholder,
    options,
    selectedIds,
    onChange,
    loading,
}: DropdownProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const summary = useMemo(() => {
        if (!selectedIds.length) return placeholder;
        const names = options
            .filter((o) => selectedIds.includes(o.id))
            .map((o) => o.name);
        return names.join(", ");
    }, [selectedIds, options, placeholder]);

    const toggle = (id: string) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter((x) => x !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    };

    return (
        <View className="mb-4">
            <Text className="font-outfit-medium text-[#0F172A] mb-2">{label}</Text>
            <TouchableOpacity
                onPress={() => setOpen(true)}
                disabled={loading}
                className="bg-blue-50/50 min-h-12 flex-row items-center justify-between px-4 py-3 rounded-xl border-0"
            >
                <Text
                    numberOfLines={2}
                    className={`flex-1 pr-2 font-outfit-regular ${selectedIds.length ? "text-[#0F172A]" : "text-[#0F172A]/60"}`}
                >
                    {loading ? t("setup.expertise.loading") : summary}
                </Text>
                {loading ? (
                    <ActivityIndicator size="small" color="#0047AB" />
                ) : (
                    <Ionicons name="chevron-down" size={20} color="#0047AB" />
                )}
            </TouchableOpacity>

            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <Pressable
                    onPress={() => setOpen(false)}
                    className="flex-1 bg-black/40 justify-center px-6"
                >
                    <Pressable
                        onPress={(e) => e.stopPropagation()}
                        className="bg-white rounded-2xl max-h-[70%]"
                    >
                        <View className="px-5 pt-5 pb-3 flex-row items-center justify-between border-b border-gray-100">
                            <Text className="text-lg font-outfit-bold text-[#0F172A]">{label}</Text>
                            <TouchableOpacity onPress={() => setOpen(false)}>
                                <Ionicons name="close" size={22} color="#0F172A" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView className="px-2 py-2">
                            {options.length === 0 && (
                                <Text className="text-center text-[#0F172A]/60 py-6 font-outfit-regular">
                                    {t("setup.expertise.noOptions")}
                                </Text>
                            )}
                            {options.map((opt) => {
                                const checked = selectedIds.includes(opt.id);
                                return (
                                    <TouchableOpacity
                                        key={opt.id}
                                        onPress={() => toggle(opt.id)}
                                        className="flex-row items-center px-3 py-3 rounded-lg"
                                    >
                                        <Ionicons
                                            name={checked ? "checkbox" : "square-outline"}
                                            size={22}
                                            color={checked ? "#0047AB" : "#94A3B8"}
                                        />
                                        <Text className="ml-3 text-[#0F172A] font-outfit-regular flex-1">
                                            {opt.name}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                        <View className="px-5 py-4 border-t border-gray-100">
                            <Button onPress={() => setOpen(false)} size="default" className="bg-blue-700 rounded-xl">
                                {t("setup.expertise.done")}
                            </Button>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

export default function ExpertiseScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { user } = useUser();
    const [details, setDetails] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [assistanceTypes, setAssistanceTypes] = useState<ExpertiseItem[]>([]);
    const [services, setServices] = useState<ExpertiseItem[]>([]);
    const [selectedAssistanceIds, setSelectedAssistanceIds] = useState<string[]>([]);
    const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

    useEffect(() => {
        (async () => {
            try {
                const [a, s] = await Promise.all([
                    expertiseDAO.listAssistanceTypes(),
                    expertiseDAO.listServicesOffered(),
                ]);
                setAssistanceTypes(a);
                setServices(s);

                if (user?.id) {
                    try {
                        const prefs = await expertiseDAO.getPreferences(user.id);
                        setSelectedAssistanceIds(prefs.assistanceTypes.map((x) => x.id));
                        setSelectedServiceIds(prefs.servicesOffered.map((x) => x.id));
                    } catch (e) {
                        console.warn("[expertise] no prior prefs", e);
                    }
                }
            } catch (e) {
                console.error("[expertise] failed loading options", e);
            } finally {
                setLoading(false);
            }
        })();
    }, [user?.id]);

    const handleContinue = async () => {
        if (!user?.id) {
            router.push("/setup/availability");
            return;
        }
        try {
            setSaving(true);
            await expertiseDAO.setPreferences(user.id, {
                assistanceTypeIds: selectedAssistanceIds,
                serviceOfferedIds: selectedServiceIds,
            });
            await saveSetupProgress("expertise", {
                details,
                assistanceTypeIds: selectedAssistanceIds,
                serviceOfferedIds: selectedServiceIds,
            });
            router.push("/setup/availability");
        } catch (e) {
            console.error("[expertise] save failed", e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView
            className="flex-1 bg-white"
            contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        >
            <View className="mb-6">
                <Text className="text-xl font-outfit-bold text-[#0F172A] mb-1">
                    {t("setup.expertise.title")}
                </Text>
                <Text className="text-[#0047AB] font-outfit-medium text-base">
                    {t("setup.expertise.subtitle")}
                </Text>
            </View>

            <MultiSelectDropdown
                label={t("setup.expertise.assistanceTypeLabel")}
                placeholder={t("setup.expertise.select")}
                options={assistanceTypes}
                selectedIds={selectedAssistanceIds}
                onChange={setSelectedAssistanceIds}
                loading={loading}
            />
            <MultiSelectDropdown
                label={t("setup.expertise.servicesLabel")}
                placeholder={t("setup.expertise.select")}
                options={services}
                selectedIds={selectedServiceIds}
                onChange={setSelectedServiceIds}
                loading={loading}
            />

            <View className="mb-6">
                <Text className="font-outfit-medium text-[#0F172A] mb-2">
                    {t("setup.expertise.detailsLabel")}
                </Text>
                <TextInput
                    multiline
                    numberOfLines={4}
                    value={details}
                    onChangeText={setDetails}
                    className="bg-blue-50/50 rounded-xl p-4 font-outfit-regular text-[#0F172A] text-base h-32"
                    style={{ textAlignVertical: "top" }}
                />
            </View>

            <Button
                onPress={handleContinue}
                size="lg"
                className="bg-blue-700 rounded-xl"
                disabled={saving}
            >
                {saving ? t("setup.expertise.saving") : t("setup.expertise.continue")}
            </Button>
        </ScrollView>
    );
}
