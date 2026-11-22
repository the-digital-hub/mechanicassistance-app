import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { MediaSlot, type Picked } from '@/components/on-site/MediaSlot';
import { OS, cardShadow } from '@/components/on-site/ui';
import { requestObdDAO } from '@/lib/dao/RequestObdDAO';
import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';

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

    // The same design as the app's dialogs (`AppAlertHost`): a tile with the icon on top, a centred title and text, the data in a soft
    // block and full-size buttons.
    return (
        <Modal supportedOrientations={MODAL_ORIENTATIONS} visible transparent animationType="fade" onRequestClose={onContinue}>
            <View className="flex-1 items-center justify-center px-5" style={{ backgroundColor: 'rgba(11,21,48,0.55)' }}>
                <View className="w-full bg-white" style={[cardShadow, { maxWidth: 400, borderRadius: 24, maxHeight: '90%' }]}>
                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
                        <View className="items-center justify-center self-center" style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: tone.bg }}>
                            <Ionicons name="warning-outline" size={28} color={tone.fg} />
                        </View>
                        <Text className="font-outfit-bold text-center" style={{ fontSize: 20, lineHeight: 26, color: OS.text, marginTop: 14 }} testID="vin-check-title">
                            {t(`${k}.${variant}.title`)}
                        </Text>
                        <Text className="font-outfit-regular text-center" style={{ fontSize: 16, lineHeight: 23, color: OS.muted, marginTop: 8 }}>
                            {t(`${k}.${variant}.body`)}
                        </Text>

                        <View style={{ marginTop: 16, gap: 12, padding: 14, borderRadius: 16, backgroundColor: OS.page }}>
                            <VinRow icon="car-outline" label={t(`${k}.vehicleVin`)} value={vehicleVin} noVin={t(`${k}.noVin`)} />
                            <VinRow icon="scan-outline" label={t(`${k}.reportVin`)} value={obdVin} color={tone.fg} noVin={t(`${k}.noVin`)} />
                        </View>

                        {replacing ? (
                            <View className="mt-3" style={{ marginHorizontal: -16 }}>
                                <MediaSlot kind="file" height={130} placeholder={t(`${k}.uploadPlaceholder`)} customUpload={upload} />
                            </View>
                        ) : null}

                        <TouchableOpacity
                            onPress={onContinue}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            className="items-center justify-center"
                            style={{ minHeight: 56, borderRadius: 14, backgroundColor: OS.blue, marginTop: 20 }}
                            testID="vin-check-continue"
                        >
                            <Text className="font-outfit-bold" style={{ fontSize: 18, lineHeight: 24, color: '#FFFFFF' }}>{t(`${k}.continue`)}</Text>
                        </TouchableOpacity>

                        {onReplaced && !replacing ? (
                            <TouchableOpacity
                                onPress={() => setReplacing(true)}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                className="items-center justify-center"
                                style={{ minHeight: 56, borderRadius: 14, backgroundColor: '#E6EAF2', marginTop: 8 }}
                                testID="vin-check-replace"
                            >
                                <Text className="font-outfit-bold" style={{ fontSize: 18, lineHeight: 24, color: '#4A5470' }}>{t(`${k}.replace`)}</Text>
                            </TouchableOpacity>
                        ) : null}

                        {onCancelRequest ? (
                            <TouchableOpacity
                                onPress={cancel}
                                disabled={canceling}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                className="items-center justify-center"
                                style={{ minHeight: 56, borderRadius: 14, backgroundColor: '#E6EAF2', marginTop: 8 }}
                                testID="vin-check-cancel"
                            >
                                {canceling ? <ActivityIndicator color={OS.red} /> : (
                                    <Text className="font-outfit-bold" style={{ fontSize: 18, lineHeight: 24, color: '#4A5470' }}>{t(`${k}.cancel`)}</Text>
                                )}
                            </TouchableOpacity>
                        ) : null}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

function VinRow({ icon, label, value, color, noVin }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value?: string | null; color?: string; noVin: string }) {
    return (
        <View className="flex-row items-center" style={{ gap: 12 }}>
            <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: '#FFFFFF' }}>
                <Ionicons name={icon} size={20} color={color ?? OS.blue} />
            </View>
            <View className="flex-1" style={{ minWidth: 0 }}>
                <Text className="font-outfit-semibold uppercase" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 0.8, color: OS.muted }}>{label}</Text>
                <Text className="font-outfit-bold" style={{ fontSize: 15, lineHeight: 21, color: color ?? OS.text, letterSpacing: 0.5 }} selectable>
                    {value || noVin}
                </Text>
            </View>
        </View>
    );
}
