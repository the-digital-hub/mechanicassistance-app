import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AO } from '@/components/offer/OfferSections';
import { SheetDim } from '@/components/ui/SheetDim';
import { SheetHandle } from '@/components/ui/SheetHandle';
import { GradientButton } from '@/components/appointments/VideoCallSections';
import { certificationsDAO, formatExpiry, parseExpiry, type Certification, type CertificationType } from '@/lib/dao/CertificationsDAO';
import { mediaDAO } from '@/lib/dao/MediaDAO';
import { MAX_DOCUMENT_BYTES } from '@/lib/legal-documents';
import { fetchMakes } from '@/lib/vehicle';
import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';
import { SHEET } from '@/lib/ui/sheet';

const K = 'certifications';
const TYPES: CertificationType[] = ['manufacturer', 'industry', 'other'];
/** Shown before the technician types: the brands most likely to hold a direct certification. */
const POPULAR_MAKES = ['Audi', 'BMW', 'Mercedes-Benz', 'Toyota', 'Ford', 'Honda'];

const field = { borderWidth: 1, borderColor: AO.border, borderRadius: 12, paddingHorizontal: 14, height: 50, fontSize: 16, color: AO.text, backgroundColor: '#fff' } as const;

/** Add or edit one certification. `onSaved` receives the stored one. */
export function CertificationSheet({ visible, initial, onClose, onSaved }: {
    visible: boolean;
    initial: Certification | null;
    onClose: () => void;
    onSaved: (c: Certification) => void;
}) {
    const { t, i18n } = useTranslation();
    const [type, setType] = React.useState<CertificationType>('manufacturer');
    const [name, setName] = React.useState('');
    // For a manufacturer certification: which brand issued it (the name is then the kind of certification).
    const [issuer, setIssuer] = React.useState('');
    const [credentialId, setCredentialId] = React.useState('');
    const [expiry, setExpiry] = React.useState('');
    // The month/year picker under the Valid until field, and the year it is showing.
    const [pickerOpen, setPickerOpen] = React.useState(false);
    const [pickerYear, setPickerYear] = React.useState(new Date().getFullYear());
    const [file, setFile] = React.useState<{ key: string; url: string; name?: string } | null>(null);
    const [uploading, setUploading] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [makes, setMakes] = React.useState<string[]>([]);

    React.useEffect(() => {
        if (!visible) return;
        setType(initial?.type ?? 'manufacturer');
        setName(initial?.name ?? '');
        setIssuer(initial?.issuer ?? '');
        setCredentialId(initial?.credentialId ?? '');
        const initialExpiry = formatExpiry(initial?.expiresAt);
        setExpiry(initialExpiry);
        setPickerOpen(false);
        setPickerYear(initialExpiry ? Number(initialExpiry.slice(3)) : new Date().getFullYear());
        setFile(initial?.fileKey && initial.fileUrl ? { key: initial.fileKey, url: initial.fileUrl, name: initial.originalName ?? undefined } : null);
        setError(null);
    }, [visible, initial]);

    React.useEffect(() => {
        if (visible && type === 'manufacturer' && makes.length === 0) fetchMakes().then(setMakes).catch(() => undefined);
    }, [visible, type, makes.length]);

    // Brands to pick from: the usual ones first, narrowed from the whole catalog as the technician types.
    const makeSuggestions = React.useMemo(() => {
        if (type !== 'manufacturer') return [];
        const q = issuer.trim().toLowerCase();
        if (!q) return POPULAR_MAKES;
        const list = makes.filter((m) => m.toLowerCase().includes(q) && m.toLowerCase() !== q);
        list.sort((a, b) => Number(b.toLowerCase().startsWith(q)) - Number(a.toLowerCase().startsWith(q)));
        return list.slice(0, 6);
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
    const isBrand = type === 'manufacturer';
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
        } catch {
            setError(t(`${K}.saveFailed`));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal supportedOrientations={MODAL_ORIENTATIONS} transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <SheetDim />
            <Pressable style={{ flex: 1 }} onPress={onClose} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={{ ...SHEET, maxHeight: '90%', paddingTop: 12 }} testID="certification-sheet">
                    <SheetHandle />
                    <View className="flex-row items-center justify-between" style={{ paddingHorizontal: 20 }}>
                        <Text className="font-outfit-bold" style={{ fontSize: 20, color: AO.text }}>{t(initial ? `${K}.editTitle` : `${K}.addTitle`)}</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button"><Ionicons name="close" size={26} color={AO.muted} /></TouchableOpacity>
                    </View>
                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 28, paddingBottom: 56, gap: 16 }}>
                        <View>
                            <Text className="font-outfit-bold" style={{ fontSize: 14, color: AO.text, marginBottom: 8 }}>{t(`${K}.type`)}</Text>
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
                                            style={{ minHeight: 46, borderRadius: 12, borderWidth: 1.5, borderColor: on ? AO.blue : AO.border, backgroundColor: on ? AO.blueSoft : '#fff' }}
                                            testID={`cert-type-${tp}`}
                                        >
                                            <Text className="font-outfit-bold" style={{ fontSize: 15, color: on ? AO.blue : AO.text }}>{t(`${K}.types.${tp}`)}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        <View>
                            <Text className="font-outfit-bold" style={{ fontSize: 14, color: AO.text, marginBottom: 8 }}>{t(`${K}.issuerLabel.${type}`)}</Text>
                            <TextInput value={issuer} onChangeText={setIssuer} placeholder={t(`${K}.issuerPlaceholder.${type}`)} placeholderTextColor={AO.mutedLight} style={field} maxLength={60} testID="cert-issuer" />
                            {issuerPicks.length > 0 ? (
                                <View className="flex-row flex-wrap" style={{ gap: 6, marginTop: 8 }}>
                                    {issuerPicks.map((m) => (
                                        <TouchableOpacity key={m} onPress={() => setIssuer(m)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: AO.blueSoft }}>
                                            <Text className="font-outfit-bold" style={{ fontSize: 14, color: AO.blue }}>{m}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : null}
                        </View>

                        <View>
                            <Text className="font-outfit-bold" style={{ fontSize: 14, color: AO.text, marginBottom: 8 }}>{t(`${K}.kind`)}</Text>
                            <TextInput value={name} onChangeText={setName} placeholder={t(`${K}.namePlaceholder.${type}`)} placeholderTextColor={AO.mutedLight} style={field} maxLength={80} testID="cert-name" />
                            {kindPicks.length > 0 ? (
                                <View className="flex-row flex-wrap" style={{ gap: 6, marginTop: 8 }}>
                                    {kindPicks.map((k) => (
                                        <TouchableOpacity key={k} onPress={() => setName(k)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: AO.blueSoft }}>
                                            <Text className="font-outfit-bold" style={{ fontSize: 14, color: AO.blue }}>{k}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : null}
                        </View>

                        <View>
                            <Text className="font-outfit-bold" style={{ fontSize: 14, color: AO.text, marginBottom: 8 }}>{t(`${K}.credentialId`)}</Text>
                            <TextInput value={credentialId} onChangeText={setCredentialId} autoCapitalize="characters" placeholderTextColor={AO.mutedLight} style={field} maxLength={40} testID="cert-id" />
                        </View>

                        <View>
                            <Text className="font-outfit-bold" style={{ fontSize: 14, color: AO.text, marginBottom: 8 }}>{t(`${K}.expires`)}</Text>
                            <View className="flex-row items-center" style={{ ...field, paddingHorizontal: 0, borderColor: pickerOpen ? AO.blue : AO.border }}>
                                <TouchableOpacity
                                    onPress={() => setPickerOpen((o) => !o)}
                                    activeOpacity={0.8}
                                    accessibilityRole="button"
                                    className="flex-1 flex-row items-center"
                                    style={{ gap: 10, paddingHorizontal: 14, height: '100%' }}
                                    testID="cert-expiry"
                                >
                                    <Ionicons name="calendar-outline" size={20} color={expiryLabel ? AO.blue : AO.mutedLight} />
                                    <Text className="font-outfit-medium flex-1" style={{ fontSize: 16, color: expiryLabel ? AO.text : AO.mutedLight, textTransform: expiryLabel ? 'capitalize' : 'none' }}>
                                        {expiryLabel ?? t(`${K}.expiresPlaceholder`)}
                                    </Text>
                                    <Ionicons name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={AO.muted} />
                                </TouchableOpacity>
                                {expiryLabel ? (
                                    <TouchableOpacity onPress={() => { setExpiry(''); setPickerOpen(false); }} hitSlop={8} accessibilityLabel={t(`${K}.noExpiry`)} style={{ paddingRight: 14 }} testID="cert-expiry-clear">
                                        <Ionicons name="close-circle" size={20} color={AO.mutedLight} />
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            {pickerOpen ? (
                                <View style={{ marginTop: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: AO.borderSoft, backgroundColor: AO.blueSofter, gap: 12 }} testID="cert-expiry-picker">
                                    <View className="flex-row items-center justify-between">
                                        <TouchableOpacity onPress={() => setPickerYear((y) => y - 1)} disabled={pickerYear <= thisYear - 10} hitSlop={10} accessibilityLabel="-" style={{ opacity: pickerYear <= thisYear - 10 ? 0.3 : 1 }}>
                                            <Ionicons name="chevron-back" size={24} color={AO.blue} />
                                        </TouchableOpacity>
                                        <Text className="font-outfit-bold" style={{ fontSize: 18, color: AO.text }}>{pickerYear}</Text>
                                        <TouchableOpacity onPress={() => setPickerYear((y) => y + 1)} disabled={pickerYear >= thisYear + 15} hitSlop={10} accessibilityLabel="+" style={{ opacity: pickerYear >= thisYear + 15 ? 0.3 : 1 }}>
                                            <Ionicons name="chevron-forward" size={24} color={AO.blue} />
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
                                                    style={{ width: '23%', height: 42, borderRadius: 12, backgroundColor: on ? AO.blue : '#fff', borderWidth: 1, borderColor: on ? AO.blue : AO.border }}
                                                    testID={`cert-month-${m}`}
                                                >
                                                    <Text className="font-outfit-bold" style={{ fontSize: 15, color: on ? '#fff' : AO.text, textTransform: 'capitalize' }}>{monthName(m)}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            ) : null}
                            <Text className="font-outfit-regular" style={{ fontSize: 13, color: AO.muted, marginTop: 6 }}>{t(`${K}.optionalHint`)}</Text>
                        </View>

                        <TouchableOpacity
                            onPress={() => void attach()}
                            disabled={uploading}
                            activeOpacity={0.85}
                            className="flex-row items-center"
                            style={{ gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: file ? AO.green : AO.border, backgroundColor: file ? AO.greenSoft : '#fff' }}
                            testID="cert-attach"
                        >
                            {uploading ? <ActivityIndicator color={AO.blue} /> : <Ionicons name={file ? 'checkmark-circle' : 'attach'} size={24} color={file ? AO.greenText : AO.blue} />}
                            <View style={{ flex: 1 }}>
                                <Text className="font-outfit-bold" style={{ fontSize: 16, color: AO.text }} numberOfLines={1}>{file ? file.name ?? t(`${K}.attached`) : t(`${K}.attach`)}</Text>
                                <Text className="font-outfit-regular" style={{ fontSize: 13, color: AO.muted }}>{file ? t(`${K}.attachChange`) : t(`${K}.attachHint`)}</Text>
                            </View>
                        </TouchableOpacity>

                        {error ? <Text className="font-outfit-medium" style={{ fontSize: 14, color: AO.red }}>{error}</Text> : null}

                        <GradientButton large label={saving ? t(`${K}.saving`) : t(`${K}.save`)} onPress={() => void save()} disabled={!canSave} testID="cert-save" />
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
