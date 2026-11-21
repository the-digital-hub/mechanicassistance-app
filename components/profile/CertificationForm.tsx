import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import React from 'react';
import { ApiError } from '@/lib/api/types';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { Footer, SC, TextField } from '@/components/scheduled/ui';
import { certificationsDAO, formatExpiry, parseExpiry, type Certification, type CertificationType } from '@/lib/dao/CertificationsDAO';
import { mediaDAO } from '@/lib/dao/MediaDAO';
import { MAX_DOCUMENT_BYTES } from '@/lib/legal-documents';
import { fetchMakes } from '@/lib/vehicle';

const K = 'certifications';
const TYPES: CertificationType[] = ['manufacturer', 'industry', 'other'];
/** Shown before the technician types: the brands most likely to hold a direct certification. */
const POPULAR_MAKES = ['Audi', 'BMW', 'Mercedes-Benz'];

/** A field title: big enough to read at a glance. */
function Title({ children }: { children: React.ReactNode }) {
    return <Text className="font-outfit-bold" style={{ fontSize: 18, lineHeight: 24, color: SC.text, marginBottom: 10 }}>{children}</Text>;
}

/** Three example badges and a line saying the technician can type whatever they want. */
function Picks({ items, value, onPick, hint }: { items: string[]; value: string; onPick: (v: string) => void; hint: string }) {
    // Once one of the badges is picked the row closes, the same in every field; typing something else brings it back.
    const v = value.trim().toLowerCase();
    if (v && items.some((m) => m.toLowerCase() === v)) return null;
    return (
        <View style={{ marginTop: 10, gap: 8 }}>
            {items.length > 0 ? (
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {items.map((m) => (
                        <TouchableOpacity key={m} onPress={() => onPick(m)} activeOpacity={0.8} accessibilityRole="button" style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: SC.blueSoft }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 15, color: SC.blue }}>{m}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            ) : null}
            <Text className="font-outfit-regular" style={{ fontSize: 14, color: SC.muted }}>{hint}</Text>
        </View>
    );
}

/** Add or edit one certification. `onSaved` receives the stored one. */
export function CertificationForm({ initial, onSaved }: { initial: Certification | null; onSaved: (c: Certification) => void }) {
    const { t, i18n } = useTranslation();
    const [type, setType] = React.useState<CertificationType>(initial?.type ?? 'manufacturer');
    const [name, setName] = React.useState(initial?.name ?? '');
    // Who issued it: the brand, the organization or whoever; the name is the kind of certification.
    const [issuer, setIssuer] = React.useState(initial?.issuer ?? '');
    const [credentialId, setCredentialId] = React.useState(initial?.credentialId ?? '');
    const initialExpiry = formatExpiry(initial?.expiresAt);
    const [expiry, setExpiry] = React.useState(initialExpiry);
    // The month/year picker under the Valid until field, and the year it is showing.
    const [pickerOpen, setPickerOpen] = React.useState(false);
    const [pickerYear, setPickerYear] = React.useState(initialExpiry ? Number(initialExpiry.slice(3)) : new Date().getFullYear());
    const [file, setFile] = React.useState<{ key: string; url: string; name?: string } | null>(
        initial?.fileKey && initial.fileUrl ? { key: initial.fileKey, url: initial.fileUrl, name: initial.originalName ?? undefined } : null,
    );
    const [uploading, setUploading] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [makes, setMakes] = React.useState<string[]>([]);

    React.useEffect(() => {
        if (type === 'manufacturer' && makes.length === 0) fetchMakes().then(setMakes).catch(() => undefined);
    }, [type, makes.length]);

    // Brands to pick from: the usual ones first, narrowed from the whole catalog as the technician types.
    const makeSuggestions = React.useMemo(() => {
        if (type !== 'manufacturer') return [];
        const q = issuer.trim().toLowerCase();
        if (!q) return POPULAR_MAKES;
        const list = makes.filter((m) => m.toLowerCase().includes(q) && m.toLowerCase() !== q);
        list.sort((a, b) => Number(b.toLowerCase().startsWith(q)) - Number(a.toLowerCase().startsWith(q)));
        return list.slice(0, 3);
    }, [type, issuer, makes]);

    // Example badges that change with the type chosen above.
    const list = (key: string): string[] => {
        const v = t(key, { returnObjects: true }) as unknown;
        return Array.isArray(v) ? (v as string[]) : [];
    };
    const issuerPicks = type === 'manufacturer' ? makeSuggestions : list(`${K}.issuerPicks.${type}`);
    const kindPicks = list(`${K}.kindPicks.${type}`);

    const expiryText = expiry.trim();
    const monthName = (m: number) => new Date(2000, m - 1, 1).toLocaleDateString(i18n.language, { month: 'short' });
    const expiryLabel = expiryText
        ? `${new Date(2000, Number(expiryText.slice(0, 2)) - 1, 1).toLocaleDateString(i18n.language, { month: 'long' })} ${expiryText.slice(3)}`
        : null;
    const pickMonth = (m: number) => {
        setExpiry(`${String(m).padStart(2, '0')}/${pickerYear}`);
        setPickerOpen(false);
    };
    const thisYear = new Date().getFullYear();
    // Who issued it is required for a brand or an industry body; optional for anything else.
    const issuerRequired = type !== 'other';
    const canSave = name.trim().length > 1 && (!issuerRequired || issuer.trim().length > 1) && !uploading && !saving;

    const attach = async () => {
        setError(null);
        const picked = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true, multiple: false });
        if (picked.canceled) return;
        const asset = picked.assets?.[0];
        if (!asset?.uri) return;
        if (asset.size && asset.size > MAX_DOCUMENT_BYTES) {
            setError(t(`${K}.fileTooLarge`));
            return;
        }
        setUploading(true);
        try {
            const up = await mediaDAO.uploadDocument(asset.uri, { name: asset.name, mimeType: asset.mimeType });
            setFile({ key: up.key, url: up.url, name: asset.name });
        } catch {
            setError(t(`${K}.fileFailed`));
        } finally {
            setUploading(false);
        }
    };

    const save = async () => {
        if (!canSave) return;
        setSaving(true);
        setError(null);
        const body = {
            type,
            name: name.trim(),
            issuer: issuer.trim() || undefined,
            credentialId: credentialId.trim() || undefined,
            expiresAt: expiryText ? parseExpiry(expiryText) : null,
            ...(file ? { fileKey: file.key, fileUrl: file.url, originalName: file.name } : {}),
        };
        try {
            const stored = initial ? await certificationsDAO.update(initial.id, body) : await certificationsDAO.create(body);
            onSaved(stored);
        } catch (e) {
            // The reason from the server (validation, permission...) goes next to the generic text: "could not save" alone hides what to fix.
            console.warn('[certifications] save failed', e);
            const detail = e instanceof ApiError ? ` (${e.statusCode}: ${e.apiMessage})` : '';
            setError(`${t(`${K}.saveFailed`)}${detail}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined} testID="certification-form">
            <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 28, gap: 22 }}>
                <View>
                    <Title>{t(`${K}.type`)}</Title>
                    <View className="flex-row" style={{ gap: 8 }}>
                        {TYPES.map((tp) => {
                            const on = tp === type;
                            return (
                                <TouchableOpacity
                                    key={tp}
                                    onPress={() => setType(tp)}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: on }}
                                    className="flex-1 items-center justify-center"
                                    // The longest label gets more room, and none wraps: a word split over two lines reads as a mistake.
                                    style={{ flexGrow: tp === 'manufacturer' ? 1.6 : 1, minHeight: 52, paddingHorizontal: 6, borderRadius: 14, borderWidth: 1.5, borderColor: on ? SC.blue : SC.border, backgroundColor: on ? SC.blueSoft : '#fff' }}
                                    testID={`cert-type-${tp}`}
                                >
                                    <Text className="font-outfit-bold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontSize: 16, color: on ? SC.blue : SC.text }}>{t(`${K}.types.${tp}`)}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <View>
                    <Title>{t(`${K}.issuerLabel.${type}`)}</Title>
                    <TextField value={issuer} onChangeText={setIssuer} placeholder={t(`${K}.issuerPlaceholder.${type}`)} maxLength={60} testID="cert-issuer" />
                    <Picks items={issuerPicks} value={issuer} onPick={setIssuer} hint={t(`${K}.orTypeYourOwn`)} />
                </View>

                <View>
                    <Title>{t(`${K}.kind`)}</Title>
                    <TextField value={name} onChangeText={setName} placeholder={t(`${K}.namePlaceholder.${type}`)} maxLength={80} testID="cert-name" />
                    <Picks items={kindPicks} value={name} onPick={setName} hint={t(`${K}.orTypeYourOwn`)} />
                </View>

                <View>
                    <Title>{t(`${K}.credentialId`)}</Title>
                    <TextField value={credentialId} onChangeText={setCredentialId} autoCapitalize="characters" maxLength={40} testID="cert-id" />
                </View>

                <View>
                    <Title>{t(`${K}.expires`)}</Title>
                    <View className="flex-row items-center" style={{ height: 52, borderRadius: 12, borderWidth: 1, borderColor: pickerOpen ? SC.blue : SC.border, backgroundColor: '#fff' }}>
                        <TouchableOpacity
                            onPress={() => setPickerOpen((o) => !o)}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            className="flex-1 flex-row items-center"
                            style={{ gap: 10, paddingHorizontal: 14, height: '100%' }}
                            testID="cert-expiry"
                        >
                            <Ionicons name="calendar-outline" size={20} color={expiryLabel ? SC.blue : SC.mutedLight} />
                            <Text className="font-outfit-medium flex-1" style={{ fontSize: 17, color: expiryLabel ? SC.text : '#9CA3AF', textTransform: expiryLabel ? 'capitalize' : 'none' }}>
                                {expiryLabel ?? t(`${K}.expiresPlaceholder`)}
                            </Text>
                            <Ionicons name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={SC.muted} />
                        </TouchableOpacity>
                        {expiryLabel ? (
                            <TouchableOpacity onPress={() => { setExpiry(''); setPickerOpen(false); }} hitSlop={8} accessibilityLabel={t(`${K}.noExpiry`)} style={{ paddingRight: 14 }} testID="cert-expiry-clear">
                                <Ionicons name="close-circle" size={20} color={SC.mutedLight} />
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {pickerOpen ? (
                        <View style={{ marginTop: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: SC.borderSoft, backgroundColor: SC.blueSofter, gap: 12 }} testID="cert-expiry-picker">
                            <View className="flex-row items-center justify-between">
                                <TouchableOpacity onPress={() => setPickerYear((y) => y - 1)} disabled={pickerYear <= thisYear - 10} hitSlop={10} accessibilityLabel="-" style={{ opacity: pickerYear <= thisYear - 10 ? 0.3 : 1 }}>
                                    <Ionicons name="chevron-back" size={24} color={SC.blue} />
                                </TouchableOpacity>
                                <Text className="font-outfit-bold" style={{ fontSize: 18, color: SC.text }}>{pickerYear}</Text>
                                <TouchableOpacity onPress={() => setPickerYear((y) => y + 1)} disabled={pickerYear >= thisYear + 15} hitSlop={10} accessibilityLabel="+" style={{ opacity: pickerYear >= thisYear + 15 ? 0.3 : 1 }}>
                                    <Ionicons name="chevron-forward" size={24} color={SC.blue} />
                                </TouchableOpacity>
                            </View>
                            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                                    const on = expiryText === `${String(m).padStart(2, '0')}/${pickerYear}`;
                                    return (
                                        <TouchableOpacity
                                            key={m}
                                            onPress={() => pickMonth(m)}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: on }}
                                            className="items-center justify-center"
                                            style={{ width: '23%', height: 44, borderRadius: 12, backgroundColor: on ? SC.blue : '#fff', borderWidth: 1, borderColor: on ? SC.blue : SC.border }}
                                            testID={`cert-month-${m}`}
                                        >
                                            <Text className="font-outfit-bold" style={{ fontSize: 15, color: on ? '#fff' : SC.text, textTransform: 'capitalize' }}>{monthName(m)}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    ) : null}
                    <Text className="font-outfit-regular" style={{ fontSize: 14, color: SC.muted, marginTop: 8 }}>{t(`${K}.optionalHint`)}</Text>
                </View>

                <View>
                    <Title>{t(`${K}.certificate`)}</Title>
                    <TouchableOpacity
                        onPress={() => void attach()}
                        disabled={uploading}
                        activeOpacity={0.85}
                        className="flex-row items-center"
                        style={{ gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: file ? SC.green : SC.border, backgroundColor: file ? SC.greenSoft : '#fff' }}
                        testID="cert-attach"
                    >
                        {uploading ? <ActivityIndicator color={SC.blue} /> : <Ionicons name={file ? 'checkmark-circle' : 'attach'} size={26} color={file ? SC.greenText : SC.blue} />}
                        <View style={{ flex: 1 }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 17, color: SC.text }} numberOfLines={1}>{file ? file.name ?? t(`${K}.attached`) : t(`${K}.attach`)}</Text>
                            <Text className="font-outfit-regular" style={{ fontSize: 14, color: SC.muted }}>{file ? t(`${K}.attachChange`) : t(`${K}.attachHint`)}</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {error ? <Text className="font-outfit-medium" style={{ fontSize: 15, color: SC.red }}>{error}</Text> : null}
            </ScrollView>

            <Footer label={saving ? t(`${K}.saving`) : t(`${K}.save`)} onPress={() => void save()} disabled={!canSave} loading={saving} />
        </KeyboardAvoidingView>
    );
}
