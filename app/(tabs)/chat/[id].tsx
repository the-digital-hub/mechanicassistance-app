import { ChatMessage, toChatMessage, useSocket } from '@/context/SocketContext';
import { useUser } from '@/context/UserContext';
import { ApiError } from '@/lib/api/types';
import { chatDAO, newClientMessageId } from '@/lib/dao/ChatDAO';
import type { ChatConversation, SendChatMessagePayload } from '@/lib/dao/interfaces';
import { mediaDAO } from '@/lib/dao/MediaDAO';
import { userDAO } from '@/lib/dao/UserDAO';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goBackOr } from '@/lib/navigation/goBackOr';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, Lock, Paperclip, Send } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function ChatScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const conversationId = Array.isArray(id) ? id[0] : id;
    const router = useRouter();
    const { t } = useTranslation();
    const { user } = useUser();
    const { chatHistory, mergeChatMessages } = useSocket();
    const [messageText, setMessageText] = useState('');
    const [recipient, setRecipient] = useState<any>(null);
    const [conversation, setConversation] = useState<ChatConversation | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [uploading, setUploading] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);
    // Only jump to the bottom for new messages, not when older ones are prepended.
    const stickToBottom = useRef(true);

    const messages = chatHistory[conversationId] || [];
    const canWrite = conversation?.canWrite ?? false;

    // The conversation (who is on the other side, whether it is still open)
    // and the newest page of history. The id is the appointment id.
    const load = useCallback(async () => {
        setLoadError(false);
        try {
            // One after the other: the first read of a new chat creates it, and
            // two parallel reads both tried to and one failed.
            const conv = await chatDAO.getConversation(conversationId);
            setConversation(conv);
            const page = await chatDAO.listMessages(conversationId);
            mergeChatMessages(conversationId, page.items.map(toChatMessage));
            setNextCursor(page.nextCursor);

            const recipientId = user?.id === conv.userId ? conv.mechanicId : conv.userId;
            // Public projection: the full record is owner-only server-side.
            // A missing profile only blanks the header; the chat stays usable.
            userDAO
                .getPublicProfile(recipientId)
                .then(setRecipient)
                .catch((error) => console.error('Failed to load chat recipient:', error));
        } catch (error) {
            console.error('Failed to load chat:', error);
            setLoadError(true);
        } finally {
            setIsLoading(false);
        }
    }, [conversationId, user?.id, mergeChatMessages]);

    useEffect(() => {
        load();
    }, [load]);

    const loadOlder = async () => {
        if (!nextCursor || loadingOlder) return;
        setLoadingOlder(true);
        stickToBottom.current = false;
        try {
            const page = await chatDAO.listMessages(conversationId, nextCursor);
            mergeChatMessages(conversationId, page.items.map(toChatMessage));
            setNextCursor(page.nextCursor);
        } catch (error) {
            console.error('Failed to load older messages:', error);
        } finally {
            setLoadingOlder(false);
        }
    };

    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
        stickToBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
        if (contentOffset.y < 40) loadOlder();
    };

    // Shows the message at once, then swaps it for the stored copy. A retry
    // reuses the same clientMessageId, so the server never stores it twice.
    const deliver = async (payload: SendChatMessagePayload, preview: Partial<ChatMessage> = {}) => {
        if (!user) return;
        const pending: ChatMessage = {
            id: payload.clientMessageId,
            clientMessageId: payload.clientMessageId,
            text: payload.text ?? '',
            senderId: user.id,
            timestamp: new Date().toISOString(),
            conversationId,
            kind: payload.kind,
            status: 'sending',
            ...preview,
        };
        stickToBottom.current = true;
        mergeChatMessages(conversationId, [pending]);
        try {
            const stored = await chatDAO.sendMessage(conversationId, payload);
            mergeChatMessages(conversationId, [toChatMessage(stored)]);
        } catch (error) {
            mergeChatMessages(conversationId, [{ ...pending, status: 'failed' }]);
            if (error instanceof ApiError && error.statusCode === 409) {
                // Ended while the screen was open: re-read, which flips to read-only.
                load();
            } else if (error instanceof ApiError && error.statusCode === 429) {
                setNotice(t('chat.rateLimited'));
            }
        }
    };

    const handleSend = () => {
        const text = messageText.trim();
        if (!text || !canWrite) return;
        setMessageText('');
        setNotice(null);
        deliver({ clientMessageId: newClientMessageId(), kind: 'text', text });
    };

    const retry = (msg: ChatMessage) => {
        if (msg.status !== 'failed' || !msg.clientMessageId || msg.kind === 'image') return;
        deliver({ clientMessageId: msg.clientMessageId, kind: 'text', text: msg.text });
    };

    const handleAttach = async () => {
        if (!canWrite || uploading) return;
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.6,
        });
        if (result.canceled) return;
        const localUri = result.assets[0].uri;
        setUploading(true);
        setNotice(null);
        try {
            const { key } = await mediaDAO.uploadPhoto(localUri, { purpose: 'chat' });
            await deliver(
                { clientMessageId: newClientMessageId(), kind: 'image', mediaKey: key },
                { mediaUrl: localUri },
            );
        } catch (error) {
            console.error('Failed to send photo:', error);
            setNotice(t('chat.photoFailed'));
        } finally {
            setUploading(false);
        }
    };

    if (isLoading) {
        return (
            <View className="flex-1 bg-white justify-center items-center">
                <ActivityIndicator size="large" color="#0047AB" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="flex-1 bg-white"
        >
            {/* Header */}
            <View className="bg-blue-600 px-4 pt-12 pb-4 flex-row items-center border-b border-blue-500 shadow-sm">
                <TouchableOpacity onPress={() => goBackOr(router, { pathname: '/appointments/[id]', params: { id: String(id) } })} className="mr-3">
                    <ChevronLeft size={24} color="white" />
                </TouchableOpacity>
                <View className="flex-row items-center flex-1">
                    <View className="w-10 h-10 rounded-full border border-white/20 bg-blue-50 justify-center items-center overflow-hidden">
                        {recipient?.profileImage ? (
                            <Image source={{ uri: recipient.profileImage }} className="w-full h-full" />
                        ) : (
                            <Text className="text-blue-600 font-outfit-bold">{recipient?.name?.[0]}</Text>
                        )}
                    </View>
                    <View className="ml-3">
                        <Text className="text-white font-outfit-bold text-lg">{recipient?.name} {recipient?.surname}</Text>
                        <View className="flex-row items-center">
                            <View className="w-2 h-2 bg-emerald-400 rounded-full mr-1.5" />
                            <Text className="text-white/80 text-[13px] font-outfit-regular">{t('chat.online')}</Text>
                        </View>
                    </View>
                </View>
            </View>

            <ScrollView
                ref={scrollViewRef}
                className="flex-1 px-4 py-6"
                showsVerticalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={200}
                onContentSizeChange={() => {
                    if (stickToBottom.current) scrollViewRef.current?.scrollToEnd({ animated: true });
                }}
            >
                {loadingOlder && (
                    <Text className="text-gray-400 text-[13px] text-center mb-4 font-outfit-regular">{t('chat.loadingOlder')}</Text>
                )}
                {loadError && (
                    <TouchableOpacity onPress={load} className="items-center mt-6">
                        <Text className="text-red-500 font-outfit-regular text-[13px] text-center">{t('chat.loadFailed')}</Text>
                    </TouchableOpacity>
                )}
                {!loadError && messages.length === 0 && (
                    <View className="items-center justify-center mt-10">
                        <Text className="text-gray-400 font-outfit-regular text-sm">{t('chat.noMessages')}</Text>
                        <Text className="text-gray-300 text-[13px] mt-2 italic">{t('chat.savedNotice')}</Text>
                    </View>
                )}
                {messages.map((msg) => {
                    const isMe = msg.senderId === user?.id;
                    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const failed = msg.status === 'failed';

                    return (
                        <TouchableOpacity
                            key={msg.id}
                            className="mb-6"
                            activeOpacity={failed ? 0.6 : 1}
                            disabled={!failed}
                            onPress={() => retry(msg)}
                        >
                            <View className={`max-w-[85%] ${isMe ? 'self-end' : 'self-start'}`} style={{ opacity: msg.status === 'sending' ? 0.6 : 1 }}>
                                <View className={`rounded-2xl overflow-hidden ${msg.kind === 'image' ? 'p-1' : 'p-4'} ${isMe ? 'bg-blue-600 rounded-tr-none' : 'bg-gray-50 border border-gray-100 rounded-tl-none'}`}>
                                    {msg.kind === 'image' && msg.mediaUrl ? (
                                        <Image
                                            source={{ uri: msg.mediaUrl }}
                                            accessibilityLabel={t('chat.photo')}
                                            style={{ width: 220, height: 220, borderRadius: 14 }}
                                            resizeMode="cover"
                                        />
                                    ) : null}
                                    {msg.text ? (
                                        <Text className={`font-outfit-regular text-[13px] leading-5 ${msg.kind === 'image' ? 'px-3 py-2' : ''} ${isMe ? 'text-white' : 'text-gray-700'}`}>
                                            {msg.text}
                                        </Text>
                                    ) : null}
                                </View>
                                <Text className={`text-[13px] mt-1 font-outfit-medium ${failed ? 'text-red-500' : 'text-gray-400'} ${isMe ? 'text-right' : 'text-left'}`}>
                                    {failed ? t('chat.sendFailed') : time}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Input Area */}
            <View className="px-4 pb-10 pt-4 border-t border-gray-100">
                {notice && (
                    <Text className="text-red-500 text-[13px] font-outfit-regular mb-2 text-center">{notice}</Text>
                )}
                {conversation && !canWrite ? (
                    <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-3 border border-gray-200">
                        <Lock size={16} color="#6B7280" />
                        <Text className="ml-2 flex-1 text-gray-500 text-[13px] font-outfit-regular">{t('chat.readOnly')}</Text>
                    </View>
                ) : (
                    <View className="flex-row items-center bg-gray-50 rounded-full px-2 py-1.5 border border-gray-200">
                        <TouchableOpacity
                            className="w-9 h-9 items-center justify-center bg-blue-100 rounded-full mr-2"
                            onPress={handleAttach}
                            disabled={!canWrite || uploading}
                        >
                            {uploading ? <ActivityIndicator size="small" color="#3B82F6" /> : <Paperclip size={18} color="#3B82F6" />}
                        </TouchableOpacity>
                        <TextInput
                            className="flex-1 h-10 font-outfit-regular px-2"
                            style={{ fontSize: 14, letterSpacing: 0, textAlign: 'left', textAlignVertical: 'center', paddingVertical: 0 }}
                            placeholder={t('chat.writeHere')}
                            value={messageText}
                            onChangeText={setMessageText}
                            placeholderTextColor="#9CA3AF"
                            maxLength={2000}
                            editable={canWrite}
                        />
                        <TouchableOpacity
                            className="bg-blue-600 w-10 h-10 rounded-full items-center justify-center shadow-sm"
                            onPress={handleSend}
                            disabled={!canWrite}
                        >
                            <Send size={18} color="white" />
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </KeyboardAvoidingView>
    );
}
