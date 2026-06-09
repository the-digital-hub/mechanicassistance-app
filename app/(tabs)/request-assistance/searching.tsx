import { useSocket } from '@/context/SocketContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faWrench } from '@fortawesome/free-solid-svg-icons';

export default function SearchingScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { requestId, type } = params;
    const { lastMessage, clearChatHistory } = useSocket();

    const [spinValue] = useState(new Animated.Value(0));
    const [pulseValue] = useState(new Animated.Value(0));

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

        Animated.loop(
            Animated.timing(pulseValue, {
                toValue: 1,
                duration: 2500,
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

    // Ripple/expansion effect: scales up significantly and fades out continuously
    const rippleScale = pulseValue.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 2.8],
    });

    const rippleOpacity = pulseValue.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
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
                    <View className="bg-white p-4 flex-row items-center gap-4 mb-0" style={{ width: '100%', borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2, zIndex: 10 }}>
                        <View className="flex-1">
                            <Text className="text-gray-600 font-outfit-medium text-lg mb-1">Mechanics in your area</Text>
                            <Text className="text-blue-600 font-outfit-bold" style={{ fontSize: 44 }}>28+</Text>
                        </View>
                        <View className="w-16 h-16 rounded-2xl justify-center items-center" style={{ backgroundColor: '#E9F1FF' }}>
                            <Ionicons name="search" size={20} color="#0047AB" />
                        </View>
                    </View>

                    <View className="w-56 h-56 relative justify-center items-center mb-16 mt-16">
                        {/* Radar sweep - rotating line with trail */}
                        <Animated.View
                            style={{
                                position: 'absolute',
                                width: 200,
                                height: 200,
                                transform: [{ rotate: spin }],
                            }}
                        >
                            {/* Trail line 1 - fading */}
                            <View
                                style={{
                                    position: 'absolute',
                                    width: 3,
                                    height: 120,
                                    backgroundColor: '#2B66F8',
                                    left: 98.5,
                                    top: 0,
                                    opacity: 0.2,
                                    borderRadius: 1.5,
                                    shadowColor: '#2B66F8',
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 6,
                                    elevation: 3,
                                }}
                            />

                            {/* Trail line 2 - more fading */}
                            <View
                                style={{
                                    position: 'absolute',
                                    width: 3,
                                    height: 120,
                                    backgroundColor: '#4D77EF',
                                    left: 98.5,
                                    top: 0,
                                    opacity: 0.4,
                                    borderRadius: 1.5,
                                    shadowColor: '#4D77EF',
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0.5,
                                    shadowRadius: 7,
                                    elevation: 6,
                                }}
                            />

                            {/* Main sweep line - bright and visible */}
                            <View
                                style={{
                                    position: 'absolute',
                                    width: 3,
                                    height: 120,
                                    backgroundColor: '#0047AB',
                                    left: 98.5,
                                    top: 0,
                                    borderRadius: 1.5,
                                    shadowColor: '#0047AB',
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 1,
                                    shadowRadius: 8,
                                    elevation: 10,
                                }}
                            />

                            {/* Bright tip - intensified glow at the sweep front */}
                            <View
                                style={{
                                    position: 'absolute',
                                    width: 8,
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: '#FFFFFF',
                                    left: 96,
                                    top: 0,
                                    shadowColor: '#0047AB',
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 1,
                                    shadowRadius: 12,
                                    elevation: 12,
                                }}
                            />
                        </Animated.View>

                        {/* Glow halo - wider effect */}
                        <Animated.View
                            style={{
                                position: 'absolute',
                                width: 200,
                                height: 200,
                                transform: [{ rotate: spin }],
                                opacity: 0.5,
                            }}
                        >
                            <View
                                style={{
                                    position: 'absolute',
                                    width: 20,
                                    height: 100,
                                    backgroundColor: '#2B66F8',
                                    left: 90,
                                    top: 0,
                                    borderRadius: 10,
                                    opacity: 0.4,
                                }}
                            />
                        </Animated.View>

                        {/* Outer circle - ripple effect */}
                        <Animated.View
                            style={{
                                position: 'absolute',
                                width: 200,
                                height: 200,
                                borderRadius: 100,
                                borderWidth: 2,
                                borderColor: '#2B66F8',
                                transform: [{ scale: rippleScale }],
                                opacity: rippleOpacity,
                            }}
                        />

                        {/* Secondary ripple halo - delayed effect */}
                        <Animated.View
                            style={{
                                position: 'absolute',
                                width: 200,
                                height: 200,
                                borderRadius: 100,
                                borderWidth: 1,
                                borderColor: '#4D77EF',
                                transform: [{ scale: rippleScale }],
                                opacity: rippleOpacity.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.6, 0],
                                }),
                            }}
                        />

                        {/* Middle circle - subtle pulsation */}
                        <Animated.View
                            style={{
                                position: 'absolute',
                                width: 140,
                                height: 140,
                                borderRadius: 70,
                                borderWidth: 1.5,
                                borderColor: '#A5B4FC',
                                opacity: pulseValue.interpolate({
                                    inputRange: [0, 0.5, 1],
                                    outputRange: [0.4, 0.8, 0.4],
                                }),
                            }}
                        />

                        {/* Inner circle - subtle glow pulsation */}
                        <Animated.View
                            style={{
                                position: 'absolute',
                                width: 80,
                                height: 80,
                                borderRadius: 40,
                                borderWidth: 1.5,
                                borderColor: '#818CF8',
                                opacity: pulseValue.interpolate({
                                    inputRange: [0, 0.5, 1],
                                    outputRange: [0.5, 1, 0.5],
                                }),
                            }}
                        />

                        {/* Center circle with icon */}
                        <View
                            style={{
                                width: 100,
                                height: 100,
                                borderRadius: 50,
                                backgroundColor: '#0047AB',
                                justifyContent: 'center',
                                alignItems: 'center',
                                zIndex: 10,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8,
                                elevation: 8,
                            }}
                        >
                            <FontAwesomeIcon icon={faWrench} size={35} color="white" />
                        </View>

                        {/* Radar points - FIXED positions at DIFFERENT distances from center */}
                        {/* Point 1 - Very close (near center) - Top Right */}
                        <View
                            style={{
                                position: 'absolute',
                                width: 10,
                                height: 10,
                                borderRadius: 5,
                                backgroundColor: '#A5B4FC',
                                top: 35,
                                right: 80,
                                shadowColor: '#0047AB',
                                shadowOffset: { width: 0, height: 0 },
                                shadowOpacity: 0.6,
                                shadowRadius: 3,
                                elevation: 3,
                            }}
                        />

                        {/* Point 2 - Medium distance - Bottom Right */}
                        <View
                            style={{
                                position: 'absolute',
                                width: 10,
                                height: 10,
                                borderRadius: 5,
                                backgroundColor: '#A5B4FC',
                                bottom: 40,
                                right: 30,
                                shadowColor: '#0047AB',
                                shadowOffset: { width: 0, height: 0 },
                                shadowOpacity: 0.6,
                                shadowRadius: 3,
                                elevation: 3,
                            }}
                        />

                        {/* Point 3 - Medium-far distance - Bottom Left */}
                        <View
                            style={{
                                position: 'absolute',
                                width: 10,
                                height: 10,
                                borderRadius: 5,
                                backgroundColor: '#A5B4FC',
                                bottom: 15,
                                left: 50,
                                shadowColor: '#0047AB',
                                shadowOffset: { width: 0, height: 0 },
                                shadowOpacity: 0.6,
                                shadowRadius: 3,
                                elevation: 3,
                            }}
                        />

                        {/* Point 4 - Far distance - Top Left */}
                        <View
                            style={{
                                position: 'absolute',
                                width: 10,
                                height: 10,
                                borderRadius: 5,
                                backgroundColor: '#A5B4FC',
                                top: 10,
                                left: 60,
                                shadowColor: '#0047AB',
                                shadowOffset: { width: 0, height: 0 },
                                shadowOpacity: 0.6,
                                shadowRadius: 3,
                                elevation: 3,
                            }}
                        />
                    </View>

                    <Text className="text-blue-600 font-outfit-bold text-4xl tracking-widest mb-4">
                        SEARCHING <Text className="text-blue-600">...</Text>
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={handleCancel}
                    className="w-full py-4 mb-8 flex-row items-center justify-center border-2"
                    style={{ borderColor: '#FCA5A5', borderRadius: 10, backgroundColor: '#FEF0F0' }}
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
