import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';

import { AO } from '@/components/offer/OfferSections';

const K = 'appointments.videoCall.live';

/** Languages live captions can be read in (Deepgram codes). One per call: the transcription listens in a single language. */
export const CAPTION_LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
] as const;
export type CaptionLanguage = (typeof CAPTION_LANGUAGES)[number]['code'];

/** The language the app is in, as the starting choice. */
export function defaultCaptionLanguage(appLanguage: string | undefined): CaptionLanguage {
    return appLanguage?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

/**
 * Turn live captions on (with the language they are heard in and the notice that both are
 * transcribed), or, once they are on, change the language or turn them off.
 */
export function CaptionsSheet({ visible, active, language, onLanguage, onStart, onStop, onClose }: {
    visible: boolean;
    /** The transcription is running. */
    active: boolean;
    language: CaptionLanguage;
    onLanguage: (language: CaptionLanguage) => void;
    onStart: () => void;
    onStop: () => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <Pressable style={{ flex: 1, backgroundColor: 'rgba(11,21,48,0.45)' }} onPress={onClose} />
            <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32 }} testID="captions-sheet">
                <Text className="font-outfit-bold" style={{ fontSize: 18, color: AO.text }}>
                    {t(active ? `${K}.captionsSheetOnTitle` : `${K}.captionsConsentTitle`)}
                </Text>
                {!active && (
                    <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: AO.muted, marginTop: 6 }}>{t(`${K}.captionsConsentBody`)}</Text>
                )}

                <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1, color: AO.mutedLight, marginTop: 18 }}>{t(`${K}.captionsLanguage`).toUpperCase()}</Text>
                <View className="flex-row" style={{ gap: 10, marginTop: 8 }}>
                    {CAPTION_LANGUAGES.map((l) => {
                        const selected = l.code === language;
                        return (
                            <TouchableOpacity
                                key={l.code}
                                onPress={() => onLanguage(l.code)}
                                activeOpacity={0.85}
                                accessibilityRole="radio"
                                accessibilityState={{ selected }}
                                className="flex-1 flex-row items-center justify-center"
                                style={{ gap: 8, minHeight: 48, borderRadius: 14, borderWidth: 1.5, borderColor: selected ? AO.blue : AO.border, backgroundColor: selected ? AO.blueSoft : '#FFFFFF' }}
                                testID={`captions-lang-${l.code}`}
                            >
                                {selected ? <Ionicons name="checkmark-circle" size={18} color={AO.blue} /> : null}
                                <Text className="font-outfit-bold" style={{ fontSize: 16, color: selected ? AO.blue : AO.text }}>{l.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <Text className="font-outfit-regular" style={{ fontSize: 13, lineHeight: 18, color: AO.muted, marginTop: 8 }}>{t(`${K}.captionsLanguageHint`)}</Text>

                <View className="flex-row" style={{ gap: 10, marginTop: 20 }}>
                    <TouchableOpacity
                        onPress={active ? onStop : onClose}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        className="flex-1 items-center justify-center"
                        style={{ minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#D9DFEC', backgroundColor: '#FFFFFF' }}
                        testID="captions-secondary"
                    >
                        <Text className="font-outfit-bold" style={{ fontSize: 16, color: active ? AO.red : '#6B7490' }}>{t(active ? `${K}.captionsTurnOff` : `${K}.captionsCancel`)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={onStart}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        className="flex-1 items-center justify-center"
                        style={{ minHeight: 52, borderRadius: 14, backgroundColor: AO.blue }}
                        testID="captions-primary"
                    >
                        <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#FFFFFF' }}>{t(active ? `${K}.captionsApply` : `${K}.captionsStart`)}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}
