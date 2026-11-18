import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AO } from '@/components/offer/OfferSections';
import type { ChatLine } from '@/lib/video/callMessages';

const K = 'appointments.videoCall.live.chat';

/** Text chat during the call (codes, part numbers). It lives only while the call lasts. */
export function CallChatSheet({ visible, lines, onSend, onClose }: {
    visible: boolean;
    lines: ChatLine[];
    onSend: (text: string) => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const [draft, setDraft] = React.useState('');
    const send = () => {
        const text = draft.trim();
        if (!text) return;
        onSend(text);
        setDraft('');
    };

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <Pressable style={{ flex: 1, backgroundColor: 'rgba(11,21,48,0.35)' }} onPress={onClose} />
                <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', paddingTop: 16 }} testID="call-chat-sheet">
                    <View className="flex-row items-center" style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
                        <Text className="font-outfit-bold" style={{ flex: 1, fontSize: 18, color: AO.text }}>{t(`${K}.title`)}</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t(`${K}.close`)}>
                            <Ionicons name="close" size={24} color={AO.muted} />
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={lines}
                        keyExtractor={(l) => l.id}
                        style={{ minHeight: 120 }}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8, gap: 8 }}
                        ListEmptyComponent={
                            <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: AO.muted, textAlign: 'center', paddingVertical: 24 }}>{t(`${K}.empty`)}</Text>
                        }
                        renderItem={({ item }) => (
                            <View style={{ alignSelf: item.mine ? 'flex-end' : 'flex-start', maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, backgroundColor: item.mine ? AO.blue : AO.page }}>
                                <Text className="font-outfit-regular" style={{ fontSize: 16, lineHeight: 22, color: item.mine ? '#FFFFFF' : AO.text }}>{item.text}</Text>
                            </View>
                        )}
                    />
                    <View className="flex-row items-center" style={{ gap: 10, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 }}>
                        <TextInput
                            value={draft}
                            onChangeText={setDraft}
                            onSubmitEditing={send}
                            placeholder={t(`${K}.placeholder`)}
                            placeholderTextColor={AO.mutedLight}
                            returnKeyType="send"
                            maxLength={500}
                            style={{ flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: AO.border, paddingHorizontal: 14, fontFamily: 'Outfit_400Regular', fontSize: 16, color: AO.text, backgroundColor: AO.page }}
                            testID="call-chat-input"
                        />
                        <TouchableOpacity
                            onPress={send}
                            disabled={!draft.trim()}
                            accessibilityRole="button"
                            accessibilityLabel={t(`${K}.send`)}
                            style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: AO.blue, alignItems: 'center', justifyContent: 'center', opacity: draft.trim() ? 1 : 0.45 }}
                            testID="call-chat-send"
                        >
                            <Ionicons name="send" size={19} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
