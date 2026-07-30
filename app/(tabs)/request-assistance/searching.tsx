import { useSocket } from '@/context/SocketContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Clock, Zap, Car, MapPin, DollarSign } from 'lucide-react-native';
import { AssistanceRequest } from '@/lib/dao/interfaces';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faWrench } from '@fortawesome/free-solid-svg-icons';

export default function SearchingScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { requestId, type } = params;
    const { lastMessage, clearChatHistory } = useSocket();

    const STEPS = [
        { title: t('requestAssistance.searching.step1Title'), subtitle: t('requestAssistance.searching.step1Subtitle') },
        { title: t('requestAssistance.searching.step2Title'), subtitle: t('requestAssistance.searching.step2Subtitle') },
        { title: t('requestAssistance.searching.step3Title'), subtitle: t('requestAssistance.searching.step3Subtitle') },
    ];

    const [spinValue] = useState(new Animated.Value(0));
    const [pulseValue] = useState(new Animated.Value(0));
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [activeStep, setActiveStep] = useState(0);
    const [requestData, setRequestData] = useState<AssistanceRequest | null>(null);

    const getTitle = () => {
        switch (type) {
            case 'immediate': return t('requestAssistance.header.immediate');
            case 'scheduled': return t('requestAssistance.header.scheduled');
            case 'videocall': return t('requestAssistance.header.videoCall');
            case 'witness': return t('requestAssistance.header.accident');
            default: return t('requestAssistance.header.default');
        }
    };

    const getBadgeText = () => {
        switch (type) {
            case 'immediate': return t('requestAssistance.badge.immediate');
            case 'scheduled': return t('requestAssistance.badge.scheduled');
            case 'videocall': return t('requestAssistance.badge.videoCall');
            case 'witness': return t('requestAssistance.badge.accident');
            default: return t('requestAssistance.badge.default');
        }
    };

    useEffect(() => {
        const timer = setInterval(() => {
            setElapsedSeconds(prev => prev + 1);
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const stepTimer = setInterval(() => {
            setActiveStep(prev => {
                if (prev >= 2) {
                    clearInterval(stepTimer);
                    return 2;
                }
                return prev + 1;
            });
        }, 3000);

        return () => clearInterval(stepTimer);
    }, []);

    useEffect(() => {
        Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 1200,
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
                if (data) setRequestData(data);
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
            if ((payload.id === requestId || payload.requestId === requestId) && payload.status === 'offered') {
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
                alert(t('requestAssistance.searching.cancelledAlert'));
                router.replace('/(tabs)/dashboard');
            } catch (error) {
                console.error('Failed to cancel request:', error);
                alert(t('requestAssistance.searching.cancelErrorAlert'));
            }
        }
    };

    const handleBackToMenu = () => {
        router.replace('/(tabs)/dashboard');
    };

    return (
        <View className="flex-1" style={{ backgroundColor: '#F4F6FC' }}>
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
                        {t('requestAssistance.searching.badge')}
                    </Text>
                </View>

                <Text className="text-gray-900 font-outfit-medium text-3xl mb-2">{t('requestAssistance.searching.title')}</Text>

                <Text className="text-gray-500 font-outfit-regular text-base mb-6">
                    {t('requestAssistance.searching.subtitle')}
                </Text>

                <View className="items-center mb-6">
                    <View style={{ width: '100%', borderRadius: 24, shadowColor: '#2B66F8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10 }}>
                        <LinearGradient
                            colors={['#2B66F8', '#081E72']}
                            start={{ x: 0, y: 1 }}
                            end={{ x: 1, y: 0 }}
                            style={{ width: '100%', borderRadius: 24, padding: 24 }}
                        >
                        {/* Badge */}
                        <View className="flex-row items-center gap-1.5 mb-4 px-3 py-1.5 rounded-full self-center" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' }}>
                            <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#10B981' }} />
                            <Text className="text-white font-outfit-semibold text-xs tracking-widest">
                                {t('requestAssistance.searching.searchingNearby')}
                            </Text>
                        </View>

                        {/* Timer */}
                        <View className="flex-row items-center justify-center mb-4">
                            <Text className="text-white font-outfit-bold" style={{ fontSize: 48 }}>
                                {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}
                            </Text>
                        </View>

                        {/* Average match time */}
                        <Text className="text-white text-center font-outfit-regular text-base mb-6">
                            {t('requestAssistance.searching.averageMatchTime')}
                        </Text>

                        {/* Mechanics notified */}
                        <View className="flex-row items-center justify-center px-3 py-1.5 rounded-full self-center" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' }}>
                            <Text className="text-white font-outfit-semibold text-xs tracking-widest">{t('requestAssistance.searching.mechanicsNotified', { count: 6 })}</Text>
                        </View>
                        </LinearGradient>
                    </View>

                    {/* Progress Steps */}
                    <View className="w-full gap-3 mb-4 mt-8">
                        {STEPS.map((step, index) => {
                            const isActive = activeStep === index;
                            const isDone = activeStep > index;

                            return (
                                <View
                                    key={step.title}
                                    className={`flex-row items-center p-4 rounded-2xl ${isActive ? 'bg-white border-2' : 'bg-white'}`}
                                    style={{
                                        borderColor: isActive ? '#0047AB' : '#E5E7EB',
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: 0.08,
                                        shadowRadius: 8,
                                        elevation: 4,
                                    }}
                                >
                                    {isDone ? (
                                        <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                                            <Ionicons name="checkmark" size={26} color="#10B981" />
                                        </View>
                                    ) : isActive ? (
                                        <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                                            <Animated.View
                                                style={{
                                                    width: 34,
                                                    height: 34,
                                                    borderRadius: 17,
                                                    borderWidth: 3,
                                                    borderColor: '#DBE4FF',
                                                    borderTopColor: '#0047AB',
                                                    transform: [{ rotate: spin }],
                                                }}
                                            />
                                        </View>
                                    ) : (
                                        <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                                            <Text className="font-outfit-bold" style={{ fontSize: 18, color: '#9CA3AF' }}>{index + 1}</Text>
                                        </View>
                                    )}
                                    <View className="flex-1">
                                        <Text className="font-outfit-semibold text-[17px] text-gray-900">{step.title}</Text>
                                        <Text className="font-outfit-regular text-[14px] text-gray-500">{step.subtitle}</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                </View>

                {/* Request Summary Grid */}
                <View
                    className="bg-white rounded-2xl mb-8"
                    style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.08,
                        shadowRadius: 8,
                        elevation: 4,
                    }}
                >
                    {/* Header */}
                    <View className="px-5 py-4 border-b border-gray-100">
                        <Text className="font-outfit-bold text-lg text-gray-900">{t('requestAssistance.searching.yourRequest')}</Text>
                    </View>

                    {/* Service */}
                    <View className="flex-row items-center px-5 py-4 border-b border-gray-100">
                        <View className="w-11 h-11 rounded-xl justify-center items-center mr-4" style={{ backgroundColor: '#E9F1FF' }}>
                            <Zap size={20} color="#0047AB" />
                        </View>
                        <Text className="font-outfit-medium text-base text-gray-500">{t('requestAssistance.searching.service')}</Text>
                        <Text className="flex-1 text-right font-outfit-semibold text-base text-gray-900" numberOfLines={1}>{getTitle()}</Text>
                    </View>

                    {/* Vehicle */}
                    <View className="flex-row items-center px-5 py-4 border-b border-gray-100">
                        <View className="w-11 h-11 rounded-xl justify-center items-center mr-4" style={{ backgroundColor: '#E9F1FF' }}>
                            <Car size={20} color="#0047AB" />
                        </View>
                        <Text className="font-outfit-medium text-base text-gray-500">{t('requestAssistance.searching.vehicle')}</Text>
                        <Text className="flex-1 text-right font-outfit-semibold text-base text-gray-900" numberOfLines={1}>{requestData?.car || '—'}</Text>
                    </View>

                    {/* Location */}
                    <View className="flex-row items-center px-5 py-4 border-b border-gray-100">
                        <View className="w-11 h-11 rounded-xl justify-center items-center mr-4" style={{ backgroundColor: '#E9F1FF' }}>
                            <MapPin size={20} color="#0047AB" />
                        </View>
                        <Text className="font-outfit-medium text-base text-gray-500">{t('requestAssistance.searching.location')}</Text>
                        <Text className="flex-1 text-right font-outfit-semibold text-base text-gray-900" numberOfLines={1}>{requestData?.address || '—'}</Text>
                    </View>

                    {/* Budget */}
                    <View className="flex-row items-center px-5 py-4">
                        <View className="w-11 h-11 rounded-xl justify-center items-center mr-4" style={{ backgroundColor: '#E9F1FF' }}>
                            <DollarSign size={20} color="#0047AB" />
                        </View>
                        <Text className="font-outfit-medium text-base text-gray-500">{t('requestAssistance.searching.budget')}</Text>
                        <Text className="flex-1 text-right font-outfit-semibold text-base text-gray-900" numberOfLines={1}>{requestData?.budget || '—'}</Text>
                    </View>
                </View>

                <TouchableOpacity
                    onPress={handleCancel}
                    className="w-full py-4 mb-8 flex-row items-center justify-center border-2"
                    style={{ borderColor: '#FCA5A5', borderRadius: 10, backgroundColor: '#FEF0F0' }}
                >
                    <Text className="text-red-500 font-outfit-bold text-lg">{t('requestAssistance.searching.cancelRequest')}</Text>
                </TouchableOpacity>

                <View className="mt-4 pb-6">
                    <Text className="text-[10px] text-gray-400 text-center font-outfit-medium">
                        {t('requestAssistance.searching.footer')}
                    </Text>
                    <Text className="text-[10px] text-gray-400 text-center font-outfit-medium">
                        FL-{new Date().toISOString().split('T')[0]}-{requestId || 'PENDING'}
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}
