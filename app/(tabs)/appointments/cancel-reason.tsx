import { useAppointments } from '@/context/AppointmentsContext';
import { useSocket } from '@/context/SocketContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Circle, Info } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

const REASONS = [
    "No longer available",
    "Too far away",
    "Accepted another job",
    "Vehicle issue",
    "Missing required tools",
    "Personal emergency",
    "Other"
];

export default function CancelReasonScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { cancelAppointment } = useAppointments();
    const { clearChatHistory } = useSocket();
    const [selectedReason, setSelectedReason] = useState<string | null>(null);

    const handleDone = async () => {
        if (selectedReason && id) {
            const appointmentId = Array.isArray(id) ? id[0] : id;
            await cancelAppointment(appointmentId, selectedReason);
            clearChatHistory(appointmentId);
            router.navigate('/(tabs)/appointments');
        }
    };

    return (
        <View className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                <View className="px-6 pt-4">
                    {/* Section Badge */}
                    <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                            CANCEL REQUEST
                        </Text>
                    </View>

                    {/* Title */}
                    <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
                        Why are you canceling this request?
                    </Text>

                    {/* Subtitle */}
                    <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                        Please select the reason below. This helps us improve future assignments.
                    </Text>

                    {/* Reasons List */}
                    <View className="gap-3 mb-8">
                        {REASONS.map((reason) => (
                            <TouchableOpacity
                                key={reason}
                                onPress={() => setSelectedReason(reason)}
                                className={`py-4 px-4 rounded-2xl border flex-row items-center gap-3 ${selectedReason === reason
                                    ? 'bg-blue-50 border-blue-200'
                                    : 'bg-white border-gray-200'
                                    }`}
                            >
                                <Circle
                                    size={20}
                                    color={selectedReason === reason ? '#0047AB' : '#D1D5DB'}
                                    fill={selectedReason === reason ? '#0047AB' : 'transparent'}
                                />
                                <Text className={`font-outfit-medium text-base ${selectedReason === reason ? 'text-blue-900' : 'text-gray-700'
                                    }`}>
                                    {reason}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Information Message */}
                    <View className="flex-row gap-3 p-4 rounded-2xl mb-8" style={{ backgroundColor: '#EFF6FF' }}>
                        <Info size={20} color="#0047AB" style={{ marginTop: 2 }} />
                        <Text className="flex-1 font-outfit-regular text-base" style={{ color: '#0047AB', lineHeight: 20 }}>
                            Frequent cancellations may affect your acceptance rate and visibility in the request queue.
                        </Text>
                    </View>

                    {/* Buttons */}
                    <View className="gap-3">
                        {/* Cancel Request Button */}
                        <TouchableOpacity
                            onPress={handleDone}
                            disabled={!selectedReason}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={selectedReason ? ['#EF4444', '#DC2626'] : ['#FECACA', '#FECACA']}
                                start={{ x: 0, y: 1 }}
                                end={{ x: 1, y: 0 }}
                                style={{
                                    borderRadius: 10,
                                    paddingVertical: 16,
                                    paddingHorizontal: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: selectedReason ? 1 : 0.6,
                                }}
                            >
                                <Text className="text-white font-outfit-bold text-center">Cancel Request</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Keep Request Button */}
                        <TouchableOpacity
                            onPress={() => router.back()}
                            activeOpacity={0.8}
                        >
                            <View
                                style={{
                                    borderRadius: 10,
                                    paddingVertical: 16,
                                    paddingHorizontal: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#EFF6FF',
                                }}
                            >
                                <Text className="font-outfit-bold text-center" style={{ color: '#0047AB' }}>Keep Request</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
