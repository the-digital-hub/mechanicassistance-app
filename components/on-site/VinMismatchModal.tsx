import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ObdVinResolution, onSiteDAO, OnSiteVisit } from '@/lib/dao/OnSiteDAO';
import { OS } from './ui';

// Asked as soon as an OBD reading's VIN is not the VIN of the request's
// vehicle. It cannot be dismissed: the mechanic has to say why before going on.
// The answer is kept on the visit and shown on the service report.

const VIN = /^[A-HJ-NPR-Z0-9]{17}$/;
const OPTIONS: ObdVinResolution[] = ['request_vin_wrong', 'scanner_misread', 'other'];

interface VinMismatchModalProps {
    appointmentId: string;
    visit: OnSiteVisit;
    onVisit: (visit: OnSiteVisit) => void;
}

export function VinMismatchModal({ appointmentId, visit, onVisit }: VinMismatchModalProps) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.obd.vinMismatch';

    const [choice, setChoice] = React.useState<ObdVinResolution | null>(null);
    const [vin, setVin] = React.useState('');
    const [note, setNote] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const cleanVin = vin.replace(/[\s-]/g, '').toUpperCase();
    const valid =
        choice === 'request_vin_wrong' ||
        (choice === 'scanner_misread' && VIN.test(cleanVin)) ||
        (choice === 'other' && note.trim().length > 0);

    const submit = async () => {
        if (!choice || !valid) return;
        setSaving(true);
        setError(null);
        try {
            const updated = await onSiteDAO.resolveObdVin(appointmentId, {
                resolution: choice,
                ...(choice === 'scanner_misread' ? { vin: cleanVin } : {}),
                ...(note.trim() ? { note: note.trim() } : {}),
            });
            // A corrected VIN that still differs comes back unanswered: ask again.
            if (updated.obdVinMismatch && !updated.obdVinResolution) setError(t(`${k}.stillMismatch`));
            onVisit(updated);
        } catch {
            setError(t('appointments.onSite.common.error'));
        } finally {
            setSaving(false);
        }
    };

    const inputStyle = { borderRadius: 12, borderWidth: 1.5, borderColor: OS.border, backgroundColor: OS.page, color: OS.text, textAlign: 'left' as const };

    return (
        <Modal visible transparent animationType="fade" onRequestClose={() => { /* must answer */ }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-center px-4" style={{ backgroundColor: 'rgba(11,21,48,0.55)' }}>
                <View className="bg-white" style={{ borderRadius: 20, maxHeight: '90%' }}>
                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18 }}>
                        <View className="flex-row items-center gap-2.5">
                            <View className="items-center justify-center" style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: OS.redSoft }}>
                                <Ionicons name="warning-outline" size={18} color={OS.red} />
                            </View>
                            <Text className="flex-1 font-outfit-bold text-[16px]" style={{ color: OS.text }}>{t(`${k}.title`)}</Text>
                        </View>
                        <Text className="font-outfit-regular text-[12.5px] mt-2 leading-5" style={{ color: OS.muted }}>{t(`${k}.body`)}</Text>

                        <View className="mt-3 px-3.5 py-3 rounded-2xl" style={{ backgroundColor: OS.page }}>
                            <VinRow label={t(`${k}.requestVin`)} value={visit.vehicleVin} />
                            <VinRow label={t(`${k}.scannerVin`)} value={visit.obdVin} highlight />
                        </View>

                        <Text className="font-outfit-bold text-xs mt-4" style={{ color: OS.text }}>{t(`${k}.question`)}</Text>
                        <View className="mt-2" style={{ borderRadius: 14, borderWidth: 1.5, borderColor: OS.border }}>
                            {OPTIONS.map((o, i) => (
                                <TouchableOpacity
                                    key={o}
                                    onPress={() => { setChoice(o); setError(null); }}
                                    activeOpacity={0.7}
                                    className="flex-row items-center gap-3 px-3.5 py-3"
                                    style={i > 0 ? { borderTopWidth: 1, borderTopColor: OS.borderSoft } : undefined}
                                    testID={`vin-mismatch-${o}`}
                                >
                                    <View className="items-center justify-center" style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: choice === o ? OS.blue : OS.border }}>
                                        {choice === o ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: OS.blue }} /> : null}
                                    </View>
                                    <Text className="flex-1 font-outfit-medium text-[13px]" style={{ color: OS.text }}>{t(`${k}.options.${o}`)}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {choice === 'scanner_misread' ? (
                            <TextInput
                                value={vin}
                                onChangeText={(v) => setVin(v.toUpperCase())}
                                placeholder={t(`${k}.vinPh`)}
                                placeholderTextColor={OS.mutedLight}
                                autoCapitalize="characters"
                                autoCorrect={false}
                                className="font-outfit-bold text-[13px] px-3 py-2.5 mt-3"
                                style={inputStyle}
                                testID="vin-mismatch-vin"
                            />
                        ) : null}
                        {choice ? (
                            <TextInput
                                value={note}
                                onChangeText={setNote}
                                placeholder={t(choice === 'other' ? `${k}.notePh` : `${k}.noteOptionalPh`)}
                                placeholderTextColor={OS.mutedLight}
                                multiline
                                maxLength={500}
                                className="font-outfit-regular text-[13px] px-3 py-2.5 mt-3"
                                style={[inputStyle, { minHeight: 72, textAlignVertical: 'top' }]}
                                testID="vin-mismatch-note"
                            />
                        ) : null}

                        {error ? <Text className="font-outfit-medium text-[11.5px] mt-2" style={{ color: OS.red }}>{error}</Text> : null}

                        <TouchableOpacity
                            onPress={submit}
                            disabled={!valid || saving}
                            activeOpacity={0.85}
                            className="items-center justify-center py-3.5 mt-4"
                            style={{ borderRadius: 14, backgroundColor: !valid || saving ? OS.blueIce : OS.blue }}
                            testID="vin-mismatch-submit"
                        >
                            {saving ? <ActivityIndicator color="#FFFFFF" /> : (
                                <Text className="text-white font-outfit-bold text-[15px]">{t(`${k}.submit`)}</Text>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function VinRow({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
    const { t } = useTranslation();
    return (
        <View className="flex-row items-center justify-between gap-2 py-1">
            <Text className="font-outfit-medium text-[11.5px]" style={{ color: OS.muted }}>{label}</Text>
            <Text className="font-outfit-bold text-[12.5px]" style={{ color: highlight ? OS.red : OS.text, letterSpacing: 0.5 }}>
                {value || t('appointments.onSite.obd.vinMismatch.unknown')}
            </Text>
        </View>
    );
}
