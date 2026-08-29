import { useAppointments } from '@/context/AppointmentsContext';
import { useUser } from '@/context/UserContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function MechanicFoundScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { user } = useUser();
    const params = useLocalSearchParams();
    const { requestId } = params;
    const { addAppointment, refresh } = useAppointments();

    const [assistanceRequest, setAssistanceRequest] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isConfirming, setIsConfirming] = useState(false);
    const [isConfirmed, setIsConfirmed] = useState(false);

    // Fetch the assistance request details
    useEffect(() => {
        const fetchRequest = async () => {
            if (!requestId) {
                setIsLoading(false);
                return;
            }
            try {
                const data = await assistanceDAO.getById(requestId as string);
                setAssistanceRequest(data);
                // If already accepted, disable the button immediately
                if (data?.status === 'accepted') {
                    setIsConfirmed(true);
                }
            } catch (error) {
                console.error('Failed to fetch assistance request:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchRequest();
    }, [requestId]);

    const handleConfirm = async () => {
        if (!requestId) return;

        setIsConfirming(true);
        try {
            const acceptedMechanicId = assistanceRequest.mechanicId || 'mech-1';
            await assistanceDAO.updateStatus(requestId as string, acceptedMechanicId, 'accepted');
            await refresh();
            setIsConfirmed(true);

            // For videocall type, redirect to video lobby instead of appointment detail
            if (assistanceRequest?.type === 'videocall' || assistanceRequest?.type === 'video') {
                router.replace({
                    pathname: '/video-lobby/[id]' as any,
                    params: { id: requestId as string }
                });
            } else {
                router.replace({
                    pathname: '/appointments/[id]',
                    params: { id: requestId as string }
                });
            }
        } catch (error) {
            console.error('Failed to confirm appointment:', error);
            Alert.alert(t('requestAssistance.mechanicFound.errorTitle'), t('requestAssistance.mechanicFound.errorMessage'));
        } finally {
            setIsConfirming(false);
        }
    };

    const handleCancel = () => {
        router.replace('/(tabs)/assist');
    };

    // Kept stable for the life of the screen. Regenerating it on every render
    // changed the text width inside a centered block, so the footer (and with it
    // the layout) visibly jittered sideways each time a socket event refreshed
    // the appointments context.
    const refNumber = React.useMemo(() => {
        const rand = () => Math.floor(10000 + Math.random() * 90000);
        const today = new Date()
            .toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
            .replace(/\//g, '-');
        return `FL${rand()}-${today}-USR${rand()}`;
    }, []);

    // Derive type label and icon from the request
    const typeLabel =
        assistanceRequest?.assistanceType === 'witness' ? t('requestAssistance.badge.accident') :
            assistanceRequest?.type === 'immediate' ? t('requestAssistance.badge.immediate') :
                assistanceRequest?.type === 'video' ? t('requestAssistance.badge.videoCall') :
                    t('requestAssistance.badge.scheduled');

    const typeIcon: any =
        assistanceRequest?.type === 'immediate' ? 'construct-outline' :
            assistanceRequest?.type === 'video' ? 'videocam-outline' :
                'calendar-outline';

    const typeSubtitle =
        assistanceRequest?.type === 'immediate'
            ? t('requestAssistance.mechanicFound.availableEta', { eta: assistanceRequest?.eta || '2hs' })
            : assistanceRequest?.type === 'video' ? t('requestAssistance.mechanicFound.availableStartCall')
                : t('requestAssistance.mechanicFound.availableDateTime', { date: assistanceRequest?.date || '', time: assistanceRequest?.time || '' }).trim();

    if (isLoading) {
        return (
            <View className="flex-1 bg-white justify-center items-center">
                <ActivityIndicator size="large" color="#0047AB" />
                <Text className="text-gray-500 font-outfit-medium mt-4">{t('requestAssistance.mechanicFound.loading')}</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="bg-white px-6 pt-14 pb-4 border-b border-gray-100 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <Ionicons name="chevron-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text className="text-xl font-outfit-bold text-[#0F172A] flex-1 text-center mr-8">
                    {t('requestAssistance.mechanicFound.headerTitle')}
                </Text>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
                {/* Title Section */}
                <Text className="text-blue-600 font-outfit-bold text-lg mb-1">{t('requestAssistance.mechanicFound.requestAMechanic')}</Text>
                <Text className="text-gray-800 font-outfit-medium text-sm mb-6">{t('requestAssistance.mechanicFound.selectBestMatch')}</Text>

                {/* Main Card */}
                <View
                    style={{
                        borderWidth: 2,
                        borderColor: '#2563EB',
                        borderRadius: 16,
                        backgroundColor: 'white',
                        padding: 20,
                        marginBottom: 20,
                    }}
                >
                    {/* Type Badge */}
                    <View className="flex-row items-center mb-4">
                        <View className="bg-blue-100 p-2 rounded-lg mr-3">
                            <Ionicons name={typeIcon} size={22} color="#2563EB" />
                        </View>
                        <View>
                            <Text className="font-outfit-bold text-[#0F172A] text-sm tracking-widest uppercase">
                                {typeLabel}
                            </Text>
                            <Text className="font-outfit-medium text-blue-600 text-sm">
                                {typeSubtitle}
                            </Text>
                        </View>
                    </View>

                    {/* Cost — prefers mechanic's proposed price, falls back to budget */}
                    <View className="mb-4">
                        <Text className="font-outfit-bold text-[#0F172A] text-base">
                            {t('requestAssistance.mechanicFound.costLabel')}
                        </Text>
                        <Text className="font-outfit-bold text-blue-600 text-2xl">
                            {assistanceRequest?.price
                                ? `$${assistanceRequest.price}`
                                : assistanceRequest?.budget
                                    ? `$${assistanceRequest.budget}`
                                    : t('requestAssistance.mechanicFound.tbd')}
                        </Text>
                    </View>

                    {/* Payment Method */}
                    <View className="mb-4">
                        <Text className="font-outfit-bold text-[#0F172A] text-base mb-2">{t('requestAssistance.mechanicFound.paymentMethod')}</Text>
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className="bg-blue-900 rounded-md px-3 py-1 mr-2">
                                    <Text className="text-white font-outfit-bold text-xs tracking-wider">
                                        P<Text style={{ fontStyle: 'italic' }}>Pay</Text>Pal
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity>
                                <Text className="text-blue-600 font-outfit-bold text-sm">{t('requestAssistance.mechanicFound.change')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Disclaimer */}
                    <Text className="text-blue-500 font-outfit-regular text-xs">
                        {t('requestAssistance.confirmation.feesInfo')}
                    </Text>
                </View>

                {/* Confirm Button */}
                <TouchableOpacity
                    onPress={!isConfirming && !isConfirmed ? handleConfirm : undefined}
                    disabled={isConfirming || isConfirmed}
                    style={{
                        backgroundColor: isConfirmed ? '#9CA3AF' : isConfirming ? '#6B7280' : '#0F172A',
                        borderRadius: 12,
                        paddingVertical: 16,
                        alignItems: 'center',
                        marginBottom: 24,
                        opacity: isConfirmed || isConfirming ? 0.7 : 1,
                    }}
                >
                    {isConfirming ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : (
                        <Text style={{ color: 'white', fontFamily: 'Outfit_700Bold', fontSize: 16 }}>
                            {isConfirmed ? t('requestAssistance.mechanicFound.requestConfirmed') : t('requestAssistance.confirmation.confirmAndRequest')}
                        </Text>
                    )}
                </TouchableOpacity>

                {/* Other Options */}
                <Text className="text-gray-800 font-outfit-bold text-base mb-4">{t('requestAssistance.mechanicFound.otherOptions')}</Text>

                {/* Immediate Assistance Option */}
                <TouchableOpacity
                    style={{
                        backgroundColor: '#F0F7FF',
                        borderRadius: 16,
                        padding: 20,
                        marginBottom: 12,
                    }}
                >
                    <View className="flex-row items-center">
                        <View className="bg-blue-100 p-2.5 rounded-lg mr-3">
                            <Ionicons name="construct-outline" size={22} color="#2563EB" />
                        </View>
                        <View className="flex-1">
                            <Text className="font-outfit-bold text-[#0F172A] text-sm tracking-widest uppercase">
                                {t('requestAssistance.badge.immediate')}
                            </Text>
                            <Text className="font-outfit-medium text-blue-600 text-sm">
                                {t('requestAssistance.mechanicFound.immediateEta')}
                            </Text>
                            <Text className="font-outfit-bold text-blue-600 text-sm">
                                {t('requestAssistance.mechanicFound.startingFrom', { price: 350 })}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Video Call Assistance Option */}
                <TouchableOpacity
                    style={{
                        backgroundColor: '#F0F7FF',
                        borderRadius: 16,
                        padding: 20,
                        marginBottom: 20,
                    }}
                >
                    <View className="flex-row items-center">
                        <View className="bg-blue-100 p-2.5 rounded-lg mr-3">
                            <Ionicons name="videocam-outline" size={22} color="#2563EB" />
                        </View>
                        <View className="flex-1">
                            <Text className="font-outfit-bold text-[#0F172A] text-sm tracking-widest uppercase">
                                {t('requestAssistance.badge.videoCall')}
                            </Text>
                            <Text className="font-outfit-medium text-blue-600 text-sm">
                                {t('requestAssistance.mechanicFound.videoCallAvailable')}
                            </Text>
                            <Text className="font-outfit-bold text-blue-600 text-sm">
                                {t('requestAssistance.mechanicFound.startingFrom', { price: 50 })}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Cancel Request */}
                <TouchableOpacity onPress={handleCancel} className="items-center mb-6">
                    <Text className="text-red-500 font-outfit-bold text-base">{t('requestAssistance.searching.cancelRequest')}</Text>
                </TouchableOpacity>

                {/* Reference Footer */}
                <View className="items-center mt-2">
                    <Text className="text-gray-400 font-outfit-regular text-[10px]">
                        {t('requestAssistance.searching.footer')}
                    </Text>
                    <Text className="text-gray-400 font-outfit-regular text-[10px]">
                        {refNumber}
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}
