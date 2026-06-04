import { useAppointments } from '@/context/AppointmentsContext';
import { useUser } from '@/context/UserContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, Clock } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function AssistDetailScreen() {
    const { id, type, assistanceType, title, car, address, zip, budget, distance, userId } = useLocalSearchParams();
    const router = useRouter();
    const navigation = useNavigation();
    const { user } = useUser();
    const { appointments, addAppointment } = useAppointments();

    const isImmediate = type === 'immediate' || type === 'videocall' || type === 'witness' || assistanceType === 'witness';
    const isVideo = type === 'videocall';

    const [showNotification, setShowNotification] = useState(false);

    // Selection States
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isDateOpen, setIsDateOpen] = useState(false);

    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [isTimeOpen, setIsTimeOpen] = useState(false);

    const DATES = ['Monday, July 14', 'Tuesday, July 15', 'Wednesday, July 16'];
    const TIMES = ['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '04:00 PM'];

    const handleAccept = async () => {
        if (!isImmediate && (!selectedDate || !selectedTime)) {
            alert('Please select a date and time.');
            return;
        }

        const appointmentId = Array.isArray(id) ? id[0] : id || '';

        // Find if it was previously accepted/canceled
        const existingAppt = appointments.find(a => a.id === appointmentId);

        const newAppointment = {
            id: appointmentId,
            type: (type as any) || 'scheduled',
            title: (title as string) || 'Assistance',
            date: isImmediate ? 'Today' : selectedDate!,
            time: isImmediate ? 'Now' : selectedTime!,
            car: (car as string) || '',
            address: (address as string) || '',
            zip: (zip as string) || '',
            notes: existingAppt ? `Re-accepted after cancellation. ${existingAppt.notes || ''}` : 'Request accepted.',
            budget: (budget as string) || '$0',
            status: 'accepted' as const,
            userId: (userId as string) || '',
            mechanicId: user?.id || '',
        };

        try {
            if (user?.role === 'mechanic' && user?.id) {
                await assistanceDAO.updateStatus(appointmentId, user.id, 'offered');
            }
            setShowNotification(true);
            setTimeout(() => {
                setShowNotification(false);

                // Navigate to Appointments tab immediately
                router.replace('/(tabs)/appointments');

                // Reset the Assist stack to the root (List View)
                navigation.dispatch(
                    CommonActions.reset({
                        index: 0,
                        routes: [{ name: 'index' }],
                    })
                );
            }, 2000);
        } catch (error: any) {
            alert(`Failed to accept request: ${error.message || 'Unknown error'}`);
        }
    };

    return (
        <View className="flex-1 bg-white">
            <ScrollView className="flex-1">
                {/* Header Section */}
                <View className={`px-4 py-4 ${isVideo ? 'bg-cyan-600' : 'bg-blue-600'}`}>
                    <Text className="text-white font-outfit-bold text-lg text-center">
                        {assistanceType === 'witness' ? 'ACCIDENT ASSISTANCE' : isVideo ? 'Video Call Assistance' : isImmediate ? 'Immediate Assistance' : 'Scheduled Assistance'}
                    </Text>
                </View>

                <View className="p-6">
                    {/* Details Info */}
                    <View className="mb-6 gap-4">
                        <View>
                            <Text className="font-outfit-bold text-gray-900 mb-1">Assistance needed:</Text>
                            <Text className="font-outfit-regular text-gray-600">{title}</Text>
                        </View>
                        <View>
                            <Text className="font-outfit-bold text-gray-900 mb-1">Car:</Text>
                            <Text className="font-outfit-regular text-gray-600">{car}</Text>
                        </View>
                        <View>
                            <Text className="font-outfit-bold text-gray-900 mb-1">Address:</Text>
                            <Text className="font-outfit-regular text-gray-600">{address}</Text>
                        </View>
                        <View>
                            <Text className="font-outfit-bold text-gray-900 mb-1">Assistance Budget:</Text>
                            <Text className="font-outfit-bold text-blue-600 text-lg">{budget}</Text>
                        </View>
                    </View>

                    {/* Date Selector (Only if scheduled) */}
                    {!isImmediate && (
                        <>
                            <View className="mb-6 z-20">
                                <Text className="font-outfit-bold text-gray-900 mb-2">Day Availability Options</Text>
                                <TouchableOpacity
                                    className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 flex-row justify-between items-center"
                                    onPress={() => { setIsDateOpen(!isDateOpen); setIsTimeOpen(false); }}
                                >
                                    <Text className={selectedDate ? "text-gray-900 font-outfit-medium" : "text-gray-500 font-outfit-regular"}>
                                        {selectedDate || 'Select Date'}
                                    </Text>
                                    <Calendar size={18} color="#9CA3AF" />
                                </TouchableOpacity>

                                {isDateOpen && (
                                    <View className="mt-1 bg-white border border-gray-100 rounded-lg shadow-sm absolute top-full w-full z-10">
                                        {DATES.map((day) => (
                                            <TouchableOpacity
                                                key={day}
                                                className="p-3 border-b border-gray-50 last:border-0"
                                                onPress={() => { setSelectedDate(day); setIsDateOpen(false); }}
                                            >
                                                <Text className="text-gray-700 font-outfit-regular">{day}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            {/* Time Selector */}
                            <View className="mb-8 z-10">
                                <Text className="font-outfit-bold text-gray-900 mb-2">Select time</Text>
                                <TouchableOpacity
                                    className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 flex-row justify-between items-center"
                                    onPress={() => { setIsTimeOpen(!isTimeOpen); setIsDateOpen(false); }}
                                >
                                    <Text className={selectedTime ? "text-gray-900 font-outfit-medium" : "text-gray-500 font-outfit-regular"}>
                                        {selectedTime || 'Select Time'}
                                    </Text>
                                    <Clock size={16} color="#9CA3AF" />
                                </TouchableOpacity>

                                {isTimeOpen && (
                                    <View className="mt-1 bg-white border border-gray-100 rounded-lg shadow-sm absolute top-full w-full z-10">
                                        {TIMES.map((time) => (
                                            <TouchableOpacity
                                                key={time}
                                                className="p-3 border-b border-gray-50 last:border-0"
                                                onPress={() => { setSelectedTime(time); setIsTimeOpen(false); }}
                                            >
                                                <Text className="text-gray-700 font-outfit-regular">{time}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                        </>
                    )}

                    <TouchableOpacity
                        className={`w-full py-4 rounded-xl items-center shadow-sm ${isImmediate || (selectedDate && selectedTime) ? 'bg-emerald-500' : 'bg-gray-300'}`}
                        onPress={handleAccept}
                        disabled={!isImmediate && (!selectedDate || !selectedTime)}
                    >
                        <Text className="text-white font-outfit-bold text-lg">Accept request</Text>
                    </TouchableOpacity>

                    <Text className="text-center text-[10px] text-gray-400 mt-4">
                        Posted: 07/07/2026 - 03:15 AM{'\n'}ID:#34532-2384-33327
                    </Text>
                </View>
            </ScrollView>

            {/* Notification Modal */}
            {showNotification && (
                <View className="absolute top-0 left-0 right-0 bottom-0 justify-center items-center bg-black/40 px-10 z-50">
                    <View className="bg-white p-6 rounded-2xl w-full items-center shadow-lg">
                        <View className="mb-4 relative">
                            <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center">
                                <Text className="text-2xl">🔔</Text>
                            </View>
                            <View className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border border-white" />
                        </View>
                        <Text className="font-outfit-bold text-lg text-blue-900 mb-4 text-center">New assistance request</Text>
                        <Text className="text-gray-500 text-center text-xs mb-6 px-4">
                            {isImmediate
                                ? `You accepted the immediate request for ${title}.`
                                : `You accepted the request for ${selectedDate} at ${selectedTime}.`
                            }
                        </Text>
                        <TouchableOpacity
                            className="bg-emerald-500 w-full py-3 rounded-lg"
                            onPress={() => {
                                setShowNotification(false);
                                router.replace('/(tabs)/appointments');
                                navigation.dispatch(
                                    CommonActions.reset({
                                        index: 0,
                                        routes: [{ name: 'index' }],
                                    })
                                );
                            }}
                        >
                            <Text className="text-white text-center font-outfit-bold">View request</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
}
