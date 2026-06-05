import { useSocket } from '@/context/SocketContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function SearchingScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { requestId, type } = params;
    const { lastMessage, clearChatHistory } = useSocket();

    const [spinValue] = useState(new Animated.Value(0));

    const getTitle = () => {
        switch (type) {
            case 'immediate': return 'Immediate Assistance';
            case 'scheduled': return 'Scheduled Assistance';
            case 'videocall': return 'Video Call Assistance';
            case 'witness': return 'Accident Assistance';
            default: return 'Assistance';
        }
    };

    const getBadgeText = () => {
        switch (type) {
            case 'immediate': return 'IMMEDIATE ASSISTANCE';
            case 'scheduled': return 'SCHEDULED ASSISTANCE';
            case 'videocall': return 'VIDEO CALL ASSISTANCE';
            case 'witness': return 'ACCIDENT ASSISTANCE';
            default: return 'ASSISTANCE';
        }
    };

    useEffect(() => {
        Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 3000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();

        // Fallback: poll every 5s for status changes (in case WebSocket drops)
        const checkCurrentStatus = async () => {
            if (!requestId) return;
            try {
                const data = await assistanceDAO.getById(requestId as string);
                if (data && data.status === 'offered') {
                    router.replace({
                        pathname: '/request-assistance/mechanic-found',
                        params: { requestId: requestId as string }
                    });
                }
            } catch (error) {
                console.error('Failed to check status:', error);
            }
        };

        // Check immediately, then every 5 seconds
        checkCurrentStatus();
        const interval = setInterval(checkCurrentStatus, 5000);
        return () => clearInterval(interval);
    }, [requestId]);

    // Real-time listener for status updates
    useEffect(() => {
        if (lastMessage && lastMessage.type === 'assistance_update') {
            const payload = lastMessage.payload;
            // Check if this update is for our current request
            if (payload.requestId === requestId && payload.status === 'offered') {
                console.log('[SearchingScreen] Received offer via socket!');
                router.replace({
                    pathname: '/request-assistance/mechanic-found',
                    params: { requestId: requestId as string }
                });
            }
        }
    }, [lastMessage, requestId]);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const handleCancel = async () => {
        if (requestId) {
            try {
                // Also update the backend status to 'canceled'
                await assistanceDAO.updateStatus(requestId as string, '', 'canceled');
                clearChatHistory(requestId as string);
                alert('Assistance search cancelled.');
                router.replace('/(tabs)/dashboard');
            } catch (error) {
                console.error('Failed to cancel request:', error);
                alert('Error cancelling request. Please try again.');
            }
        }
    };

    const handleBackToMenu = () => {
        router.replace('/(tabs)/dashboard');
    };

    return (
        <View className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
            {/* Custom Header */}
            <View className="px-6 pt-20 pb-2 flex-row items-center justify-between" style={{ backgroundColor: '#F4F5FA', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 3, borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB' }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <View className="w-10 h-10 rounded-full justify-center items-center" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
                        <ChevronLeft size={20} color="#0047AB" />
                    </View>
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Outfit_500Medium', fontSize: 18, color: '#1A1A1A', flex: 1, textAlign: 'center' }}>
                    {getTitle()}
                </Text>
                <View className="w-6" />
            </View>

            <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>
                <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                    <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                        REQUEST A MECHANIC
                    </Text>
                </View>

                <Text className="text-gray-900 font-outfit-medium text-3xl mb-2">Searching for an available mechanic</Text>

                <Text className="text-gray-500 font-outfit-regular text-base mb-6">
                    We're scanning your area in real-time to find the best match.
                </Text>

                <View className="items-center mb-6">
                    <View className="bg-white rounded-3xl p-4 flex-row items-center gap-4 mb-6" style={{ width: '100%' }}>
                        <View className="flex-1">
                            <Text className="text-gray-600 font-outfit-medium text-base mb-2">Mechanics in your area</Text>
                            <Text className="text-blue-600 font-outfit-bold" style={{ fontSize: 48 }}>28+</Text>
                        </View>
                        <View className="w-20 h-20 rounded-2xl justify-center items-center" style={{ backgroundColor: '#E9F1FF' }}>
                            <Ionicons name="search" size={32} color="#0047AB" />
                        </View>
                    </View>

                    <View className="w-48 h-48 relative justify-center items-center mb-8">
                        <Animated.View style={{ transform: [{ rotate: spin }] }}>
                            <Ionicons name="search" size={120} color="#0047AB" />
                        </Animated.View>
                    </View>

                    <Text className="text-blue-600 font-outfit-bold text-4xl tracking-widest mb-4">
                        SEARCHING <Text className="text-blue-600">...</Text>
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={handleBackToMenu}
                    className="bg-blue-600 w-full py-4 rounded-full mb-4 flex-row items-center justify-center"
                >
                    <Ionicons name="home" size={18} color="white" style={{ marginRight: 8 }} />
                    <Text className="text-white font-outfit-bold text-center text-lg">Back to Main Menu</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleCancel}
                    className="w-full py-4 rounded-full mb-8 flex-row items-center justify-center border-2"
                    style={{ borderColor: '#FCA5A5' }}
                >
                    <Ionicons name="trash" size={18} color="#EF4444" style={{ marginRight: 8 }} />
                    <Text className="text-red-500 font-outfit-bold text-lg">Cancel Request</Text>
                </TouchableOpacity>

                <View className="mt-4 pb-6">
                    <Text className="text-[10px] text-gray-400 text-center font-outfit-medium">
                        Mechanic Assistance App # request:
                    </Text>
                    <Text className="text-[10px] text-gray-400 text-center font-outfit-medium">
                        FL-{new Date().toISOString().split('T')[0]}-{requestId || 'PENDING'}
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}
