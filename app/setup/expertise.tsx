import { useUser } from "@/context/UserContext";
import { expertiseDAO, ExpertiseItem } from "@/lib/dao/ExpertiseDAO";
import { saveSetupProgress } from "@/lib/storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';
import { SETUP_BG, SetupFooter, SetupHeading } from '@/components/setup/SetupKit';
import { BUTTON_RADIUS } from '@/lib/ui/floatingFooter';
import { TYPE } from '@/lib/ui/type';

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
            <Text className="font-outfit-semibold mb-2" style={{ fontSize: 16, color: '#0B1530' }}>{label}</Text>
            <TouchableOpacity
                onPress={() => setOpen(true)}
                disabled={loading}
                className="flex-row items-center justify-between px-4 py-3"
                style={{ minHeight: 52, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF2FA' }}
            >
                <Text
                    numberOfLines={2}
                    className="flex-1 pr-2 font-outfit-regular"
                    style={{ ...TYPE.body, color: selectedIds.length ? '#0B1530' : '#6B7490' }}
                >
                    {loading ? t("setup.expertise.loading") : summary}
                </Text>
                {loading ? (
                    <ActivityIndicator size="small" color="#0047AB" />
                ) : (
                    <Ionicons name="chevron-down" size={20} color="#0047AB" />
                )}
            </TouchableOpacity>

            <Modal supportedOrientations={MODAL_ORIENTATIONS} visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <Pressable
                    onPress={() => setOpen(false)}
                    className="flex-1 bg-black/40 justify-center px-6"
                >
                    <Pressable
                        onPress={(e) => e.stopPropagation()}
                        className="bg-white rounded-2xl max-h-[70%]"
                    >
                        <View className="px-5 pt-5 pb-3 flex-row items-center justify-between border-b border-gray-100">
                            <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, color: '#0B1530' }}>{label}</Text>
                            <TouchableOpacity onPress={() => setOpen(false)}>
                                <Ionicons name="close" size={22} color="#0F172A" />
                            </TouchableOpacity>
                        </View>
                        <KeyboardAwareScrollView className="px-2 py-2">
                            {options.length === 0 && (
                                <Text className="text-center py-6 font-outfit-regular" style={{ ...TYPE.body, color: '#6B7490' }}>
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
                                        <Text className="ml-3 font-outfit-regular flex-1" style={{ ...TYPE.body, color: '#0B1530' }}>
                                            {opt.name}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </KeyboardAwareScrollView>
                        <View className="px-5 py-4 border-t border-gray-100">
                            <TouchableOpacity onPress={() => setOpen(false)} activeOpacity={0.85} accessibilityRole="button" className="items-center justify-center" style={{ minHeight: 56, borderRadius: BUTTON_RADIUS, backgroundColor: '#E6EAF2' }}>
                                <Text className="font-outfit-bold" style={{ ...TYPE.button, color: '#4A5470' }}>{t("setup.expertise.done")}</Text>
                            </TouchableOpacity>
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
        <KeyboardAvoidingView className="flex-1" style={{ backgroundColor: SETUP_BG }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <KeyboardAwareScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 20, paddingTop: 18, paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
            >
                <SetupHeading title={t("setup.expertise.title")} subtitle={t("setup.expertise.subtitle")} />

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

                <View>
                    <Text className="font-outfit-semibold mb-2" style={{ fontSize: 16, color: '#0B1530' }}>
                        {t("setup.expertise.detailsLabel")}
                    </Text>
                    <TextInput
                        multiline
                        numberOfLines={4}
                        value={details}
                        onChangeText={setDetails}
                        className="font-outfit-regular p-4"
                        style={{ ...TYPE.body, color: '#0B1530', height: 128, textAlignVertical: "top", borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF2FA' }}
                    />
                </View>
            </KeyboardAwareScrollView>

            <SetupFooter
                label={saving ? t("setup.expertise.saving") : t("setup.expertise.continue")}
                onPress={handleContinue}
                disabled={saving}
                secondaryLabel={t("setup.skip")}
                onSecondary={() => router.push("/setup/availability")}
            />
        </KeyboardAvoidingView>
    );
}
