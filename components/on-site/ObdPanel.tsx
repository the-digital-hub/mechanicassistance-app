import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ObdCode, onSiteDAO, OnSiteVisit } from '@/lib/dao/OnSiteDAO';
import { MediaSlot, Picked } from './MediaSlot';
import { Card, CardTitle, OS, Tip } from './ui';

// The OBD scanner report of a visit: upload the file (its trouble codes are
// read in the background by the document service), see the codes with what
// they mean, or type them in when there is no readable file.

/** SAE J2012 trouble code: P/B/C/U, a digit 0-3, three hex digits. */
const OBD_CODE = /^[PBCU][0-3][0-9A-F]{3}$/;

const SEVERITY_STYLE: Record<string, { color: string; bg: string }> = {
    High: { color: '#B4231E', bg: '#FDECEC' },
    Medium: { color: OS.orangeText, bg: OS.orangeSoft },
    Low: { color: OS.muted, bg: OS.page },
};

interface ObdPanelProps {
    appointmentId: string;
    visit: OnSiteVisit | null;
    onVisit: (visit: OnSiteVisit) => void;
    /** Hide the file slot (codes and manual entry only). */
    allowUpload?: boolean;
}

export function ObdPanel({ appointmentId, visit, onVisit, allowUpload = true }: ObdPanelProps) {
    const { t, i18n } = useTranslation();
    const k = 'appointments.onSite.obd';
    const lang: 'en' | 'es' = i18n.language?.startsWith('en') ? 'en' : 'es';

    const [suggestionsOpen, setSuggestionsOpen] = React.useState(false);
    const [input, setInput] = React.useState('');
    const [inputError, setInputError] = React.useState<string | null>(null);
    const [saving, setSaving] = React.useState(false);

    const status = visit?.obdStatus ?? 'none';
    const codes: ObdCode[] = visit?.obdCodes ?? [];
    const fileName = visit?.obdDocumentKey?.split('/').pop();
    const anySuggestion = codes.some((c) => c.suggestion);

    const upload = async (file: Picked) => {
        const updated = await onSiteDAO.attachObdReport(appointmentId, file.uri, file.name, file.mimeType);
        onVisit(updated);
    };

    const saveCodes = async (list: string[]) => {
        setSaving(true);
        try {
            onVisit(await onSiteDAO.setObdCodes(appointmentId, list));
        } catch {
            Alert.alert(t('appointments.onSite.common.error'));
        } finally {
            setSaving(false);
        }
    };

    const addCode = () => {
        const code = input.trim().toUpperCase();
        if (!OBD_CODE.test(code)) {
            setInputError(t(`${k}.invalid`));
            return;
        }
        setInputError(null);
        setInput('');
        if (codes.some((c) => c.code === code)) return;
        void saveCodes([...codes.map((c) => c.code), code]);
    };

    const removeCode = (code: string) => void saveCodes(codes.filter((c) => c.code !== code).map((c) => c.code));

    return (
        <>
            {allowUpload ? (
                <Card>
                    <CardTitle title={t(`${k}.file`)} optional />
                    <MediaSlot
                        key={visit?.obdDocumentKey ?? 'none'}
                        kind="file"
                        height={150}
                        placeholder={t(`${k}.placeholder`)}
                        customUpload={upload}
                        existingFileName={fileName}
                    />
                </Card>
            ) : null}

            {status === 'processing' ? (
                <View className="mx-4 mt-3 flex-row items-center gap-2.5 px-3.5 py-3 rounded-2xl" style={{ backgroundColor: OS.blueSofter }}>
                    <ActivityIndicator size="small" color={OS.blue} />
                    <Text className="flex-1 font-outfit-medium text-[12px]" style={{ color: OS.blueDark }}>{t(`${k}.processing`)}</Text>
                </View>
            ) : null}
            {status === 'failed' ? <Tip tone="orange">{t(`${k}.failed`)}</Tip> : null}

            {codes.length ? (
                <Card>
                    <Text className="font-outfit-bold text-xs px-4 pt-3.5 pb-1" style={{ color: OS.text }}>
                        {status === 'manual' ? t(`${k}.manualTitle`) : t(`${k}.codesFound`)}
                    </Text>
                    {codes.map((c, i) => {
                        const severity = c.severity ? SEVERITY_STYLE[c.severity] : null;
                        return (
                            <View key={c.code} className="px-4 py-3" style={i > 0 ? { borderTopWidth: 1, borderTopColor: OS.borderSoft } : undefined}>
                                <View className="flex-row items-center justify-between gap-2">
                                    <Text className="font-outfit-bold text-[13px]" style={{ color: OS.text }}>{c.code}</Text>
                                    <View className="flex-row items-center gap-3">
                                        {severity && c.severity ? (
                                            <View className="px-2.5 py-0.5 rounded-full" style={{ backgroundColor: severity.bg }}>
                                                <Text className="font-outfit-bold text-[10.5px]" style={{ color: severity.color }}>
                                                    {t(`${k}.severity.${c.severity}`)}
                                                </Text>
                                            </View>
                                        ) : null}
                                        <TouchableOpacity onPress={() => removeCode(c.code)} disabled={saving}>
                                            <Text className="font-outfit-bold text-[11px]" style={{ color: OS.red }}>{t(`${k}.remove`)}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                <Text className="font-outfit-regular text-[12.5px] mt-1" style={{ color: OS.muted }}>
                                    {c.description ? c.description[lang] : t(`${k}.noDescription`)}
                                </Text>
                                {suggestionsOpen && c.suggestion ? (
                                    <View className="mt-2 px-3 py-2.5 rounded-xl" style={{ backgroundColor: OS.blueSofter }}>
                                        <Text className="font-outfit-bold text-[11px] mb-0.5" style={{ color: OS.blueDark }}>{t(`${k}.aiFix`)}</Text>
                                        <Text className="font-outfit-regular text-[12.5px] leading-5" style={{ color: OS.text }}>{c.suggestion[lang]}</Text>
                                    </View>
                                ) : null}
                            </View>
                        );
                    })}
                    {anySuggestion ? (
                        <View className="px-4 pt-1 pb-3.5">
                            <TouchableOpacity
                                onPress={() => setSuggestionsOpen((v) => !v)}
                                className="items-center py-3 rounded-xl"
                                style={{ backgroundColor: suggestionsOpen ? OS.page : OS.blue }}
                            >
                                <Text className="font-outfit-bold text-[13px]" style={{ color: suggestionsOpen ? OS.text : '#FFFFFF' }}>
                                    {suggestionsOpen ? t(`${k}.hideSuggestions`) : t(`${k}.showSuggestions`)}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}
                </Card>
            ) : null}

            <Card>
                <Text className="font-outfit-bold text-xs px-4 pt-3.5" style={{ color: OS.text }}>{t(`${k}.manualHint`)}</Text>
                <View className="flex-row gap-2 px-4 pt-2 pb-3">
                    <TextInput
                        value={input}
                        onChangeText={(v) => setInput(v.toUpperCase())}
                        onSubmitEditing={addCode}
                        placeholder={t(`${k}.manualPh`)}
                        placeholderTextColor={OS.mutedLight}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        maxLength={5}
                        returnKeyType="done"
                        className="flex-1 font-outfit-bold text-[13px] px-3 py-2.5"
                        style={{ borderRadius: 12, borderWidth: 1.5, borderColor: inputError ? OS.red : OS.border, backgroundColor: OS.page, color: OS.text }}
                        testID="obd-code-input"
                    />
                    <TouchableOpacity
                        onPress={addCode}
                        disabled={saving || !input.trim()}
                        className="justify-center px-3.5 rounded-xl"
                        style={{ backgroundColor: OS.blueSoft, opacity: saving || !input.trim() ? 0.6 : 1 }}
                    >
                        {saving ? <ActivityIndicator size="small" color={OS.blue} /> : (
                            <Text className="font-outfit-bold text-[12.5px]" style={{ color: OS.blue }}>{t(`${k}.add`)}</Text>
                        )}
                    </TouchableOpacity>
                </View>
                {inputError ? (
                    <Text className="font-outfit-medium text-[11px] px-4 pb-3 -mt-1" style={{ color: OS.red }}>{inputError}</Text>
                ) : null}
            </Card>
        </>
    );
}
