import { useSocket } from '@/context/SocketContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Text, TouchableOpacity, View } from 'react-native';

export default function SearchingScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { requestId } = params;
    const { lastMessage, clearChatHistory } = useSocket();

    const [spinValue] = useState(new Animated.Value(0));

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
                router.replace('/(tabs)/assist');
            } catch (error) {
                console.error('Failed to cancel request:', error);
                alert('Error cancelling request. Please try again.');
            }
        }
    };

    const handleBackToMenu = () => {
        router.push('/(tabs)');
    };

    return (
        <View className="flex-1 bg-white">
            <View className="px-6 pt-14 pb-4 border-b border-gray-100 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <Ionicons name="chevron-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text className="text-xl font-outfit-bold text-[#0F172A] flex-1 text-center mr-8">
                    Assistance
                </Text>
            </View>

            <View className="flex-1 px-6 justify-center items-center">
                <View className="mb-8">
                    <Text className="text-blue-600 font-outfit-bold text-lg text-center mb-1">Request a mechanic</Text>
                    <Text className="text-gray-900 font-outfit-bold text-base text-center">
                        Searching for an available mechanic
                    </Text>
                </View>

                <View className="items-center mb-12">
                    <Text className="text-[#0047AB] font-outfit-bold text-2xl mb-2">Over 40</Text>
                    <Text className="text-[#0047AB] font-outfit-medium text-xl mb-8">mechanics in your area</Text>

                    <View className="w-48 h-48 relative justify-center items-center">
                        <Animated.View style={{ transform: [{ rotate: spin }] }}>
                            <Ionicons name="search" size={120} color="#0047AB" />
                        </Animated.View>
                    </View>
                </View>

                <Text className="text-[#0047AB] font-outfit-bold text-3xl tracking-widest uppercase mb-8">
                    SEARCHING
                </Text>


                <TouchableOpacity
                    onPress={handleBackToMenu}
                    className="bg-blue-600 w-full py-4 rounded-xl mb-4"
                >
                    <Text className="text-white font-outfit-bold text-center">Back to Main Menu</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleCancel}
                    className="bg-red-50 px-6 py-2 rounded-full mb-8"
                >
                    <Text className="text-red-500 font-outfit-bold">Cancel Request</Text>
                </TouchableOpacity>

                <View className="mt-4">
                    <Text className="text-[10px] text-gray-400 text-center font-outfit-medium">
                        Mechanic Assistance App # request:
                    </Text>
                    <Text className="text-[10px] text-gray-400 text-center font-outfit-medium">
                        FL-{new Date().toISOString().split('T')[0]}-{requestId || 'PENDING'}
                    </Text>
                </View>
            </View>
        </View>
    );
}
