import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { MediaSlot, Picked } from '@/components/on-site/MediaSlot';
import { Card, CardTitle, OS, Tip } from '@/components/on-site/ui';
import { useSocket } from '@/context/SocketContext';
import { absoluteMediaUrl } from '@/lib/dao/OnSiteDAO';
import { requestObdDAO, RequestObdReport } from '@/lib/dao/RequestObdDAO';

// The OBD scanner report of a video call. The owner attaches (or replaces) the
// file; its codes are read in the background by the document service. The
// mechanic sees the codes with what they mean and can type them in when there
// is no readable file. Same look and texts as the on-site ObdPanel.

/** SAE J2012 trouble code: P/B/C/U, a digit 0-3, three hex digits. */
const OBD_CODE = /^[PBCU][0-3][0-9A-F]{3}$/;

const SEVERITY_STYLE: Record<string, { color: string; bg: string }> = {
    High: { color: '#B4231E', bg: '#FDECEC' },
    Medium: { color: OS.orangeText, bg: OS.orangeSoft },
    Low: { color: OS.muted, bg: OS.page },
};

/**
 * The report of one request, kept fresh by `obd_update` socket events.
 * `null` while loading or when the request has none to show.
 */
export function useRequestObd(requestId: string | undefined) {
    const [report, setReport] = React.useState<RequestObdReport | null>(null);
    const { lastMessage } = useSocket();

    const reload = React.useCallback(() => {
        if (!requestId) return;
        requestObdDAO.get(requestId).then(setReport).catch(() => { /* not a video call, or no access */ });
    }, [requestId]);

    React.useEffect(reload, [reload]);

    React.useEffect(() => {
        if (lastMessage?.type !== 'obd_update' || lastMessage?.payload?.id !== requestId) return;
        reload();
    }, [lastMessage, requestId, reload]);

    return { report, setReport, reload };
}

interface RequestObdPanelProps {
    requestId: string;
    role: 'owner' | 'mechanic';
    /** False once the call is over: nothing can change any more. */
    editable: boolean;
    /** Pass the hook's state when the parent also needs it (tab dot, call button). */
    state?: ReturnType<typeof useRequestObd>;
}

export function RequestObdPanel({ requestId, role, editable, state }: RequestObdPanelProps) {
    const own = useRequestObd(state ? undefined : requestId);
    const { report, setReport } = state ?? own;
    const { t, i18n } = useTranslation();
    const k = 'appointments.onSite.obd';
    const kv = 'appointments.videoCall.obd';
    const lang: 'en' | 'es' = i18n.language?.startsWith('en') ? 'en' : 'es';

    const [input, setInput] = React.useState('');
    const [inputError, setInputError] = React.useState<string | null>(null);
    const [saving, setSaving] = React.useState(false);
    const [suggestionsOpen, setSuggestionsOpen] = React.useState(false);
    const [openingFile, setOpeningFile] = React.useState(false);

    const status = report?.status ?? 'none';
    const codes = report?.codes ?? [];
    const fileName = report?.documentKey?.split('/').pop();
    const anySuggestion = codes.some((c) => c.suggestion);
    const canUpload = role === 'owner' && editable;
    const canType = role === 'mechanic' && editable;

    const upload = async (file: Picked) => {
        setReport(await requestObdDAO.attach(requestId, file));
    };

    const saveCodes = async (list: string[]) => {
        setSaving(true);
        try {
            setReport(await requestObdDAO.setCodes(requestId, list));
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

    // The link is signed per tap and lives a few minutes, so it is never kept.
    const openFile = async () => {
        setOpeningFile(true);
        try {
            const link = await requestObdDAO.fileLink(requestId);
            await openBrowserAsync(absoluteMediaUrl(link.url), {
                presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
            });
        } catch {
            Alert.alert(t(`${kv}.openFileError`));
        } finally {
            setOpeningFile(false);
        }
    };

    const removeCode = (code: string) => void saveCodes(codes.filter((c) => c.code !== code).map((c) => c.code));

    if (!report) {
        return (
            <View className="items-center py-8">
                <ActivityIndicator color={OS.blue} />
            </View>
        );
    }

    return (
        <>
            {canUpload ? (
                <Card>
                    <CardTitle title={t(`${kv}.file`)} optional />
                    <MediaSlot
                        key={report.documentKey ?? 'none'}
                        kind="file"
                        height={150}
                        placeholder={t(`${kv}.placeholder`)}
                        customUpload={upload}
                        existingFileName={fileName}
                    />
                </Card>
            ) : null}

            {status === 'none' && !canUpload && !codes.length ? (
                <Tip>{role === 'mechanic' ? t(`${kv}.noneMechanic`) : t(`${kv}.noneOwner`)}</Tip>
            ) : null}
            {status === 'processing' ? (
                <View className="mx-4 mt-3 flex-row items-center gap-2.5 px-3.5 py-3 rounded-2xl" style={{ backgroundColor: OS.blueSofter }}>
                    <ActivityIndicator size="small" color={OS.blue} />
                    <Text className="flex-1 font-outfit-medium text-[12px]" style={{ color: OS.blueDark }}>{t(`${k}.processing`)}</Text>
                </View>
            ) : null}
            {status === 'failed' ? (
                <Tip tone="orange">{role === 'owner' ? t(`${kv}.failedOwner`) : t(`${kv}.failedMechanic`)}</Tip>
            ) : null}
            {report.vinMismatch ? <Tip tone="orange">{t(`${kv}.vinMismatch`, { vin: report.vin ?? '' })}</Tip> : null}
            {role === 'mechanic' && fileName ? (
                <View className="mx-5 mt-3 flex-row items-center gap-3">
                    <Text className="flex-1 font-outfit-medium text-[11.5px]" style={{ color: OS.muted }} numberOfLines={1}>
                        {t(`${kv}.fileSent`, { name: fileName })}
                    </Text>
                    <TouchableOpacity
                        onPress={openFile}
                        disabled={openingFile}
                        className="px-3 py-1.5 rounded-full"
                        style={{ backgroundColor: OS.blueSoft, opacity: openingFile ? 0.6 : 1 }}
                        accessibilityRole="button"
                        accessibilityLabel={t(`${kv}.openFile`)}
                        testID="request-obd-open-file"
                    >
                        {openingFile ? <ActivityIndicator size="small" color={OS.blue} /> : (
                            <Text className="font-outfit-bold text-[11.5px]" style={{ color: OS.blue }}>{t(`${kv}.openFile`)}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            ) : null}

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
                                        {canType ? (
                                            <TouchableOpacity onPress={() => removeCode(c.code)} disabled={saving}>
                                                <Text className="font-outfit-bold text-[11px]" style={{ color: OS.red }}>{t(`${k}.remove`)}</Text>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                </View>
                                <Text className="font-outfit-regular text-[12.5px] mt-1" style={{ color: OS.muted }}>
                                    {c.description ? c.description[lang] : t(`${k}.noDescription`)}
                                </Text>
                                {role === 'mechanic' && suggestionsOpen && c.suggestion ? (
                                    <View className="mt-2 px-3 py-2.5 rounded-xl" style={{ backgroundColor: OS.blueSofter }}>
                                        <Text className="font-outfit-bold text-[11px] mb-0.5" style={{ color: OS.blueDark }}>{t(`${k}.aiFix`)}</Text>
                                        <Text className="font-outfit-regular text-[12.5px] leading-5" style={{ color: OS.text }}>{c.suggestion[lang]}</Text>
                                    </View>
                                ) : null}
                            </View>
                        );
                    })}
                    {role === 'mechanic' && anySuggestion ? (
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

            {canType ? (
                <Card>
                    <Text className="font-outfit-bold text-xs px-4 pt-3.5" style={{ color: OS.text }}>{t(`${k}.manualHint`)}</Text>
                    <View className="flex-row gap-2 px-4 pt-2 pb-3">
                        <TextInput
                            value={input}
                            // No native maxLength: iOS spreads a placeholder longer
                            // than maxLength across the field ("e . g .  P 0 3 0 1").
                            onChangeText={(v) => setInput(v.toUpperCase().slice(0, 5))}
                            onSubmitEditing={addCode}
                            placeholder={t(`${k}.manualPh`)}
                            placeholderTextColor={OS.mutedLight}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            returnKeyType="done"
                            className="flex-1 font-outfit-bold text-[13px] px-3 py-2.5"
                            style={{ borderRadius: 12, borderWidth: 1.5, borderColor: inputError ? OS.red : OS.border, backgroundColor: OS.page, color: OS.text, textAlign: 'left' }}
                            testID="request-obd-code-input"
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
            ) : null}
        </>
    );
}
