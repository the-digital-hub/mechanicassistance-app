import { useSocket } from '@/context/SocketContext';
import { useUser } from '@/context/UserContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { userDAO } from '@/lib/dao/UserDAO';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Paperclip, Phone, Send } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Message {
    id: string;
    text: string;
    senderId: string;
    timestamp: string;
}

export default function ChatScreen() {
    const { id } = useLocalSearchParams();
    const conversationId = Array.isArray(id) ? id[0] : id;
    const router = useRouter();
    const { t } = useTranslation();
    const { user } = useUser();
    const { sendMessage, chatHistory } = useSocket();
    const [messageText, setMessageText] = useState('');
    const [recipient, setRecipient] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const scrollViewRef = useRef<ScrollView>(null);

    const messages = chatHistory[conversationId] || [];

    // Fetch recipient info based on appointment/assistance ID
    useEffect(() => {
        const fetchDetails = async () => {
            try {
                // Via the DAOs, not raw fetch: these endpoints require a Bearer
                // token, and the bare fetch this used to do sent none — so the
                // recipient never loaded and the error was swallowed below.
                const data = await assistanceDAO.getById(conversationId);
                if (!data) return;

                // If I am the user, recipient is the mechanic. If I am the mechanic, recipient is the user.
                const recipientId = user?.role === 'user' ? data.mechanicId : data.userId;

                if (recipientId) {
                    // Public projection: the full record is owner-only server-side.
                    setRecipient(await userDAO.getPublicProfile(recipientId));
                }
            } catch (error) {
                console.error('Failed to fetch chat details:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDetails();
    }, [conversationId, user]);

    const handleSend = () => {
        if (!messageText.trim() || !recipient || !user) return;

        const payload = {
            senderId: user.id,
            recipientId: recipient.id,
            conversationId: conversationId,
            text: messageText,
        };

        sendMessage('chat_message', payload);
        setMessageText('');
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
                <TouchableOpacity onPress={() => router.back()} className="mr-3">
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
                            <Text className="text-white/80 text-xs font-outfit-regular">{t('chat.online')}</Text>
                        </View>
                    </View>
                </View>
                <View className="flex-row items-center gap-4 mr-2">
                    <TouchableOpacity onPress={() => router.navigate(`/call/${id}`)}>
                        <View className="w-8 h-8 rounded-full bg-white/20 items-center justify-center">
                            <Phone size={18} color="white" />
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                ref={scrollViewRef}
                className="flex-1 px-4 py-6"
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
                {messages.length === 0 && (
                    <View className="items-center justify-center mt-10">
                        <Text className="text-gray-400 font-outfit-regular text-sm">{t('chat.noMessages')}</Text>
                        <Text className="text-gray-300 text-[10px] mt-2 italic">{t('chat.ephemeralNotice')}</Text>
                    </View>
                )}
                {messages.map((msg) => {
                    const isMe = msg.senderId === user?.id;
                    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                        <View key={msg.id} className="mb-6">
                            <View className={`max-w-[85%] ${isMe ? 'self-end' : 'self-start'}`}>
                                <View className={`p-4 rounded-2xl ${isMe ? 'bg-blue-600 rounded-tr-none' : 'bg-gray-50 border border-gray-100 rounded-tl-none'}`}>
                                    <Text className={`font-outfit-regular text-[13px] leading-5 ${isMe ? 'text-white' : 'text-gray-700'}`}>
                                        {msg.text}
                                    </Text>
                                </View>
                                <Text className={`text-gray-400 text-[10px] mt-1 font-outfit-medium ${isMe ? 'text-right' : 'text-left'}`}>
                                    {time}
                                </Text>
                            </View>
                        </View>
                    );
                })}
            </ScrollView>

            {/* Input Area */}
            <View className="px-4 pb-10 pt-4 border-t border-gray-100">
                <View className="flex-row items-center bg-gray-50 rounded-full px-2 py-1.5 border border-gray-200">
                    <TouchableOpacity className="w-9 h-9 items-center justify-center bg-blue-100 rounded-full mr-2">
                        <Paperclip size={18} color="#3B82F6" />
                    </TouchableOpacity>
                    <TextInput
                        className="flex-1 font-outfit-regular text-sm px-2"
                        placeholder={t('chat.writeHere')}
                        value={messageText}
                        onChangeText={setMessageText}
                        placeholderTextColor="#9CA3AF"
                    />
                    <TouchableOpacity
                        className="bg-blue-600 w-10 h-10 rounded-full items-center justify-center shadow-sm"
                        onPress={handleSend}
                    >
                        <Send size={18} color="white" style={{ transform: [{ rotate: '-45deg' }, { translateX: 2 }] }} />
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}


