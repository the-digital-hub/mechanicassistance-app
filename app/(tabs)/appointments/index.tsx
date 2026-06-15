import { AppointmentCard } from '@/components/ui/AppointmentCard';
import { useAppointments } from '@/context/AppointmentsContext';
import { useFocusEffect, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { FlatList, Modal, Text, TouchableOpacity, View } from 'react-native';

export default function AppointmentsScreen() {
    const { getUpcoming, getPast, refresh, appointments: allAppointments } = useAppointments();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
    const [cancelModalVisible, setCancelModalVisible] = useState(false);
    const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [])
    );

    const upcomingCount = getUpcoming().length;
    const pastCount = getPast().length;
    const appointments = activeTab === 'upcoming' ? getUpcoming() : getPast();

    const handleCancelRequest = (id: string) => {
        setSelectedAppointmentId(id);
        setCancelModalVisible(true);
    };

    const confirmCancel = () => {
        setCancelModalVisible(false);
        if (selectedAppointmentId) {
            router.push({
                pathname: '/appointments/cancel-reason' as any,
                params: { id: selectedAppointmentId }
            });
        }
    };

    return (
        <View className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
            <View className="px-6 pt-4 pb-4">
                {/* Section Badge */}
                <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                  <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                  <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                    YOUR REQUEST
                  </Text>
                </View>

                {/* Title */}
                <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">Your request, all in one place</Text>

                {/* Subtitle */}
                <Text className="text-gray-500 font-outfit-regular text-base mb-6">
                  Track active requests, view past jobs and manage your booking form here.
                </Text>

                {/* Tab Switcher */}
                <View className="flex-row gap-4 p-1 rounded-2xl" style={{ backgroundColor: '#EDF1F7' }}>
                    <TouchableOpacity
                        className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl"
                        style={{ backgroundColor: activeTab === 'upcoming' ? '#FFFFFF' : 'transparent' }}
                        onPress={() => setActiveTab('upcoming')}
                    >
                        <Text className={`font-outfit-bold text-lg`} style={{ color: activeTab === 'upcoming' ? '#1E56E3' : '#9CA3AF' }}>Upcoming</Text>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: activeTab === 'upcoming' ? '#1E56E3' : '#E5E7EB', justifyContent: 'center', alignItems: 'center' }}>
                            <Text className={`font-outfit-bold text-sm`} style={{ color: activeTab === 'upcoming' ? '#FFFFFF' : '#9CA3AF', lineHeight: 16 }}>{upcomingCount}</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl"
                        style={{ backgroundColor: activeTab === 'past' ? '#FFFFFF' : 'transparent' }}
                        onPress={() => setActiveTab('past')}
                    >
                        <Text className={`font-outfit-bold text-lg`} style={{ color: activeTab === 'past' ? '#1E56E3' : '#9CA3AF' }}>Past</Text>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: activeTab === 'past' ? '#1E56E3' : '#E5E7EB', justifyContent: 'center', alignItems: 'center' }}>
                            <Text className={`font-outfit-bold text-sm`} style={{ color: activeTab === 'past' ? '#FFFFFF' : '#9CA3AF', lineHeight: 16 }}>{pastCount}</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={appointments}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View className="px-6">
                        <AppointmentCard
                            appointment={item}
                            onCancel={handleCancelRequest}
                        />
                    </View>
                )}
                contentContainerStyle={{ paddingBottom: 20 }}
                ListEmptyComponent={
                    <View className="items-center justify-center py-10">
                        <Text className="text-gray-400 font-outfit-medium">No {activeTab} appointments</Text>
                    </View>
                }
            />

            {/* Cancel Confirmation Modal */}
            <Modal
                transparent={true}
                visible={cancelModalVisible}
                animationType="fade"
                onRequestClose={() => setCancelModalVisible(false)}
            >
                <View className="flex-1 justify-center items-center bg-black/40 px-6">
                    <View className="bg-white rounded-2xl w-full p-6 items-center shadow-lg">
                        <View className="w-16 h-16 rounded-full border-2 border-red-500 items-center justify-center mb-4">
                            <X size={32} color="#EF4444" />
                        </View>

                        <Text className="text-xl font-outfit-bold text-blue-900 mb-2">Cancel Request</Text>
                        <Text className="text-gray-500 text-center font-outfit-regular mb-6">
                            Are you sure you'd like to cancel this request?
                        </Text>

                        <View className="flex-row gap-4 w-full">
                            <TouchableOpacity
                                className="flex-1 py-3 border border-gray-200 rounded-lg"
                                onPress={() => setCancelModalVisible(false)}
                            >
                                <Text className="text-center font-outfit-bold text-gray-700">No</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 py-3 bg-blue-700 rounded-lg"
                                onPress={confirmCancel}
                            >
                                <Text className="text-center font-outfit-bold text-white">Yes, Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
