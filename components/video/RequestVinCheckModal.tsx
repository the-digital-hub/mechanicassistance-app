import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { MediaSlot, type Picked } from '@/components/on-site/MediaSlot';
import { OS } from '@/components/on-site/ui';
import { requestObdDAO } from '@/lib/dao/RequestObdDAO';

// Shown to the vehicle owner once a scanner report has been read and its VIN is
// either another vehicle's (`mismatch`) or cannot be compared because the
// vehicle has no VIN on file (`unknown`). A warning, not a block.
// - Video call, while searching: the owner attached the report, so they can
//   carry on, send another report, or cancel the request.
// - On-site visit: the mechanic scanned it and answers the discrepancy; the
//   owner is only told (no `onReplaced` / `onCancelRequest`).

export type RequestVinCheckVariant = 'mismatch' | 'unknown';

interface RequestVinCheckModalProps {
    requestId: string;
    variant: RequestVinCheckVariant;
    obdVin: string;
    vehicleVin?: string | null;
    onContinue: () => void;
    /** A new report was attached; its reading arrives later by socket. Omitted: no "upload another". */
    onReplaced?: () => void;
    /** Omitted: no "cancel request". */
    onCancelRequest?: () => void;
    /** Where the copy lives: the searching screen's, or the on-site visit's. */
    textKey?: string;
}

export function RequestVinCheckModal({
    requestId,
    variant,
    obdVin,
    vehicleVin,
    onContinue,
    onReplaced,
    onCancelRequest,
    textKey = 'requestAssistance.searching.vinCheck',
}: RequestVinCheckModalProps) {
    const { t } = useTranslation();
    const k = textKey;
    const [replacing, setReplacing] = React.useState(false);
    const [canceling, setCanceling] = React.useState(false);

    // MediaSlot shows its own error and lets the owner retry when this throws.
    const upload = async (file: Picked) => {
        await requestObdDAO.attach(requestId, { uri: file.uri, name: file.name, mimeType: file.mimeType });
        onReplaced?.();
    };

    const cancel = () => {
        setCanceling(true);
        onCancelRequest?.();
    };

    const tone = variant === 'mismatch' ? { fg: OS.red, bg: OS.redSoft } : { fg: OS.orange, bg: OS.orangeSoft };

    return (
        <Modal visible transparent animationType="fade" onRequestClose={onContinue}>
            <View className="flex-1 justify-center px-4" style={{ backgroundColor: 'rgba(11,21,48,0.55)' }}>
                <View className="bg-white" style={{ borderRadius: 20, maxHeight: '90%' }}>
                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18 }}>
                        <View className="flex-row items-center gap-2.5">
                            <View className="items-center justify-center" style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: tone.bg }}>
                                <Ionicons name="warning-outline" size={18} color={tone.fg} />
                            </View>
                            <Text className="flex-1 font-outfit-bold text-[16px]" style={{ color: OS.text }} testID="vin-check-title">
                                {t(`${k}.${variant}.title`)}
                            </Text>
                        </View>
                        <Text className="font-outfit-regular text-[12.5px] mt-2 leading-5" style={{ color: OS.muted }}>
                            {t(`${k}.${variant}.body`)}
                        </Text>

                        <View className="mt-3 px-3.5 py-3 rounded-2xl" style={{ backgroundColor: OS.page }}>
                            <VinRow label={t(`${k}.vehicleVin`)} value={vehicleVin} noVin={t(`${k}.noVin`)} />
                            <VinRow label={t(`${k}.reportVin`)} value={obdVin} color={tone.fg} noVin={t(`${k}.noVin`)} />
                        </View>

                        {replacing ? (
                            <View className="mt-3" style={{ marginHorizontal: -16 }}>
                                <MediaSlot kind="file" height={130} placeholder={t(`${k}.uploadPlaceholder`)} customUpload={upload} />
                            </View>
                        ) : null}

                        <TouchableOpacity
                            onPress={onContinue}
                            activeOpacity={0.85}
                            className="items-center justify-center py-3.5 mt-4"
                            style={{ borderRadius: 14, backgroundColor: OS.blue }}
                            testID="vin-check-continue"
                        >
                            <Text className="text-white font-outfit-bold text-[15px]">{t(`${k}.continue`)}</Text>
                        </TouchableOpacity>

                        {onReplaced && !replacing ? (
                            <TouchableOpacity
                                onPress={() => setReplacing(true)}
                                activeOpacity={0.85}
                                className="items-center justify-center py-3 mt-2"
                                style={{ borderRadius: 14, borderWidth: 1.5, borderColor: OS.border }}
                                testID="vin-check-replace"
                            >
                                <Text className="font-outfit-bold text-[14px]" style={{ color: OS.blue }}>{t(`${k}.replace`)}</Text>
                            </TouchableOpacity>
                        ) : null}

                        {onCancelRequest ? (
                            <TouchableOpacity
                                onPress={cancel}
                                disabled={canceling}
                                activeOpacity={0.85}
                                className="items-center justify-center py-3 mt-2"
                                testID="vin-check-cancel"
                            >
                                {canceling ? <ActivityIndicator color={OS.red} /> : (
                                    <Text className="font-outfit-bold text-[14px]" style={{ color: OS.red }}>{t(`${k}.cancel`)}</Text>
                                )}
                            </TouchableOpacity>
                        ) : null}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

function VinRow({ label, value, color, noVin }: { label: string; value?: string | null; color?: string; noVin: string }) {
    return (
        <View className="flex-row items-center justify-between gap-2 py-1">
            <Text className="font-outfit-medium text-[11.5px]" style={{ color: OS.muted }}>{label}</Text>
            <Text className="font-outfit-bold text-[12.5px]" style={{ color: color ?? OS.text, letterSpacing: 0.5 }}>
                {value || noVin}
            </Text>
        </View>
    );
}
