import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface MechanicBudgetTabProps {
    appointment: any;
    onAskPayment: () => void;
}

export function MechanicBudgetTab({ appointment, onAskPayment }: MechanicBudgetTabProps) {
    const baseAmount = parseFloat(appointment.budget?.replace('$', '') || '0');
    const additional = appointment.additionalFunds?.reduce((sum: number, f: any) => sum + parseFloat(f.amount || '0'), 0) || 0;
    const fee = (baseAmount + additional) * 0.15; // Example 15% fee
    const total = baseAmount + additional + fee;

    return (
        <View className="gap-6">
            {/* Blue Header Banner */}
            <View className="bg-blue-600 rounded-xl p-4 flex-row items-center gap-3">
                <View className="bg-white/20 p-2 rounded-full">
                    <Ionicons name="construct" size={24} color="white" />
                </View>
                <Text className="text-white font-outfit-bold text-lg">
                    {appointment.assistanceType === 'witness' ? 'ACCIDENT ASSISTANCE' :
                        (appointment.assistanceType ?? appointment.type) === 'immediate' ? 'Immediate Assistance' :
                            (appointment.assistanceType ?? appointment.type) === 'videocall' || appointment.type === 'video' ? 'Video Call Assistance' :
                                'Scheduled Assistance'}
                </Text>
            </View>

            {/* Receipt Details */}
            <View className="bg-gray-50 rounded-xl p-6 gap-4 border border-gray-100">
                <View>
                    <Text className="font-outfit-bold text-gray-900 text-base">Date / Hour:</Text>
                    <Text className="text-gray-600 font-outfit-regular">{new Date(appointment.date).toLocaleDateString()} - 10:00 AM</Text>
                </View>

                <View>
                    <Text className="font-outfit-bold text-gray-900 text-base">Assistance duration:</Text>
                    <Text className="text-gray-600 font-outfit-regular">0:53 minutes</Text>
                </View>

                <View>
                    <Text className="font-outfit-bold text-gray-900 text-base">Assistance Amount:</Text>
                    <Text className="text-gray-600 font-outfit-regular">${baseAmount.toFixed(2)}</Text>
                </View>

                <View>
                    <Text className="font-outfit-bold text-gray-900 text-base">Additional:</Text>
                    <Text className="text-gray-600 font-outfit-regular">${additional.toFixed(2)}</Text>
                </View>

                <View>
                    <Text className="font-outfit-bold text-gray-900 text-base">Fee APP:</Text>
                    <Text className="text-gray-600 font-outfit-regular">${fee.toFixed(2)}</Text>
                </View>

                <View className="mt-2 pt-4 border-t border-gray-200">
                    <Text className="font-outfit-bold text-gray-900 text-xl">TOTAL:</Text>
                    <Text className="text-blue-600 font-outfit-bold text-2xl">${total.toFixed(2)}</Text>
                </View>

                <View>
                    <View className="flex-row items-center gap-2">
                        <Text className="font-outfit-bold text-gray-900 text-base">Collection Method:</Text>
                        <Text className="text-red-500 text-xs font-outfit-medium">Change</Text>
                    </View>
                    <Text className="text-gray-600 font-outfit-regular">Bank Account</Text>
                </View>
            </View>

            {/* Ask for Payment Button */}
            <TouchableOpacity
                onPress={onAskPayment}
                className="bg-blue-600 w-full py-4 rounded-xl items-center justify-center mt-4"
            >
                <Text className="text-white font-outfit-bold text-lg">Ask for payment</Text>
            </TouchableOpacity>

            {/* Footer Navigation (Simulated visual for verification) */}
            <View className="flex-row justify-between px-4 pt-4 border-t border-gray-100 opacity-50">
                <View className="items-center"><Ionicons name="person-outline" size={20} /><Text className="text-[10px]">Profile</Text></View>
                <View className="items-center"><Ionicons name="add-circle" size={24} color="#3B82F6" /><Text className="text-[10px] text-blue-600">Assist</Text></View>
                <View className="items-center"><Ionicons name="calendar-outline" size={20} /><Text className="text-[10px]">Appointments</Text></View>
                <View className="items-center"><Ionicons name="notifications-outline" size={20} /><Text className="text-[10px]">Notifications</Text></View>
            </View>
        </View>
    );
}
