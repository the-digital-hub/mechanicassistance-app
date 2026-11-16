import { supabase } from '@/lib/supabase';
import { Paperclip, Phone, Send, Video } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Message {
    id: string;
    content: string;
    is_user: boolean;
    created_at: string;
}

export default function LiveChatScreen() {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', is_user: false, created_at: '09:00' },
        { id: '2', content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', is_user: true, created_at: '09:30' },
    ]);

    useEffect(() => {
        // Prevent connection attempt if using placeholder
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        if (!supabaseUrl || supabaseUrl.includes('your-project')) {
            console.log('Supabase URL not configured, skipping real-time subscription.');
            return;
        }

        // Real-time subscription placeholder
        const subscription = supabase
            .channel('public:support_messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, (payload) => {
                // setMessages(prev => [...prev, payload.new as Message]);
                console.log('New message:', payload);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    const sendMessage = async () => {
        if (!message.trim()) return;

        const newMessage = {
            id: Date.now().toString(),
            content: message,
            is_user: true,
            created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, newMessage]);
        setMessage('');

        // Simulate Support Response
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                content: 'Mechanic is typing...',
                is_user: false,
                created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        }, 1000);

        // Supabase Insert Placeholder
        // await supabase.from('support_messages').insert({ content: message, is_user: true });
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-white"
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            {/* Header extension */}
            <View className="bg-blue-600 px-6 py-3 flex-row justify-between items-center">
                <Text className="text-white font-outfit-bold text-lg">Mechanic Assistance</Text>
                <View className="flex-row gap-4">
                    <Video size={24} color="white" />
                    <Phone size={24} color="white" />
                </View>
            </View>

            <FlatList
                data={messages}
                keyExtractor={item => item.id}
                className="flex-1 px-4 pt-4 bg-gray-50"
                renderItem={({ item }) => (
                    <View className={`mb-4 max-w-[80%] ${item.is_user ? 'self-end' : 'self-start'}`}>
                        <View className={`p-4 rounded-2xl ${item.is_user
                            ? 'bg-white border border-gray-100 rounded-tr-none'
                            : 'bg-gray-200 rounded-tl-none'
                            }`}>
                            <Text className={`font-outfit-regular ${item.is_user ? 'text-gray-600' : 'text-gray-800'}`}>
                                {item.content}
                            </Text>
                        </View>
                        <Text className={`text-[13px] text-gray-400 mt-1 ${item.is_user ? 'text-right' : 'text-left'}`}>
                            {item.created_at}
                        </Text>
                    </View>
                )}
            />

            <View className="p-4 bg-white border-t border-gray-100 flex-row items-center gap-3 pb-8">
                <TouchableOpacity className="bg-blue-50 p-2 rounded-full">
                    <Paperclip size={20} color="#0047AB" />
                </TouchableOpacity>
                <View className="flex-1 bg-gray-50 rounded-full px-4 py-2 border border-gray-100 flex-row items-center">
                    <TextInput
                        className="flex-1 font-outfit-regular text-gray-900 h-10"
                        placeholder="Write Here..."
                        value={message}
                        onChangeText={setMessage}
                    />
                    <TouchableOpacity>
                        {/* Mic Icon Placeholder */}
                        <Text>🎤</Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={sendMessage} className="bg-blue-600 p-3 rounded-full">
                    <Send size={20} color="white" />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}
