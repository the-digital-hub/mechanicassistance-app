import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

interface MechanicStatusTabProps {
    appointment: any;
    statusUpdate: string;
    setStatusUpdate: (status: string) => void;
    onUpdateStatus: () => void;
    additionalAmount: string;
    setAdditionalAmount: (amount: string) => void;
    additionalType: string;
    setAdditionalType: (type: string) => void;
    onRequestFunds: () => void;
}

export function MechanicStatusTab({
    appointment,
    statusUpdate,
    setStatusUpdate,
    onUpdateStatus,
    additionalAmount,
    setAdditionalAmount,
    additionalType,
    setAdditionalType,
    onRequestFunds
}: MechanicStatusTabProps) {
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

    const statusOptions = ['Arrived QR Scanned', 'Delayed', 'Assistance completed', 'Car scanned', 'Report an issue'];
    const typeOptions = ['Autopart', 'Additional Service', 'Product'];

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

            {/* Timeline (Static for now based on design) */}
            <View className="gap-4 pl-2">
                {/* Item 1 */}
                <View className="flex-row gap-4">
                    <View className="items-center">
                        <View className="w-3 h-3 bg-blue-500 rounded-full" />
                        <View className="w-0.5 h-full bg-blue-200 flex-1" />
                    </View>
                    <View>
                        <Text className="font-outfit-bold text-gray-900">Assistance accepted:</Text>
                        <Text className="text-gray-500 font-outfit-regular">{new Date(appointment.acceptedAt || Date.now()).toLocaleString()}</Text>
                    </View>
                </View>

                {/* Item 2 */}
                <View className="flex-row gap-4">
                    <View className="items-center">
                        <View className="w-3 h-3 bg-blue-500 rounded-full" />
                        <View className="w-0.5 h-full bg-blue-200 flex-1" />
                    </View>
                    <View>
                        <Text className="font-outfit-bold text-gray-900">Assistance in progress:</Text>
                        <Text className="text-gray-500 font-outfit-regular">{new Date().toLocaleString()}</Text>
                    </View>
                </View>

                {/* Item 3 */}
                <View className="flex-row gap-4">
                    <View className="items-center">
                        <View className="w-3 h-3 bg-gray-300 rounded-full" />
                    </View>
                    <View>
                        <Text className="font-outfit-bold text-gray-400">Ask for $ Additional:</Text>
                        <Text className="text-gray-400 font-outfit-regular">--/--/--</Text>
                    </View>
                </View>
            </View>

            <View className="h-[1px] bg-gray-100 my-2" />

            {/* Update Status Dropdown */}
            <View className="z-20">
                <Text className="font-outfit-bold text-gray-900 text-base mb-2">Update status</Text>

                <TouchableOpacity
                    onPress={() => {
                        setIsStatusDropdownOpen(!isStatusDropdownOpen);
                        setIsTypeDropdownOpen(false); // Close other dropdown
                    }}
                    className="bg-white border border-gray-200 rounded-xl p-4 flex-row justify-between items-center"
                >
                    <Text className={statusUpdate ? "text-gray-900 font-outfit-medium" : "text-gray-400 font-outfit-regular"}>
                        {statusUpdate || 'Select status'}
                    </Text>
                    <Ionicons name={isStatusDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color="#6B7280" />
                </TouchableOpacity>

                {isStatusDropdownOpen && (
                    <View className="absolute top-[80px] w-full bg-white border border-gray-100 rounded-xl shadow-lg z-50">
                        {statusOptions.map((option, index) => (
                            <TouchableOpacity
                                key={option}
                                onPress={() => {
                                    setStatusUpdate(option);
                                    setIsStatusDropdownOpen(false);
                                }}
                                className={`p-4 border-b border-gray-50 flex-row items-center justify-between ${index === statusOptions.length - 1 ? 'border-b-0' : ''}`}
                            >
                                <Text className={`font-outfit-regular ${statusUpdate === option ? 'text-blue-600 font-outfit-bold' : 'text-gray-700'}`}>
                                    {option}
                                </Text>
                                {statusUpdate === option && (
                                    <Ionicons name="checkmark" size={20} color="#3B82F6" />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            {/* Additional Funds Request */}
            <View className="z-10">
                <Text className="font-outfit-bold text-gray-900 text-base mb-2">Additional funds request</Text>
                <View className="flex-row items-center bg-blue-50 border border-blue-100 rounded-lg px-4 h-12 mb-4">
                    <Text className="text-gray-500 mr-2">$</Text>
                    <TextInput
                        value={additionalAmount}
                        onChangeText={setAdditionalAmount}
                        placeholder="0.00"
                        keyboardType="numeric"
                        className="flex-1 font-outfit-bold text-gray-900"
                    />
                </View>

                {/* Type of Additional Dropdown */}
                <View className="z-50 mb-4">
                    <Text className="font-outfit-bold text-gray-900 text-base mb-2">Type of additional</Text>

                    <TouchableOpacity
                        onPress={() => {
                            setIsTypeDropdownOpen(!isTypeDropdownOpen);
                            setIsStatusDropdownOpen(false); // Close other dropdown
                        }}
                        className="bg-white border border-gray-200 rounded-xl p-4 flex-row justify-between items-center"
                    >
                        <Text className={additionalType ? "text-gray-900 font-outfit-medium" : "text-gray-400 font-outfit-regular"}>
                            {additionalType || 'Select type'}
                        </Text>
                        <Ionicons name={isTypeDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color="#6B7280" />
                    </TouchableOpacity>

                    {isTypeDropdownOpen && (
                        <View className="absolute top-[80px] w-full bg-white border border-gray-100 rounded-xl shadow-lg z-50">
                            {typeOptions.map((option, index) => (
                                <TouchableOpacity
                                    key={option}
                                    onPress={() => {
                                        setAdditionalType(option);
                                        setIsTypeDropdownOpen(false);
                                    }}
                                    className={`p-4 border-b border-gray-50 flex-row items-center justify-between ${index === typeOptions.length - 1 ? 'border-b-0' : ''}`}
                                >
                                    <Text className={`font-outfit-regular ${additionalType === option ? 'text-blue-600 font-outfit-bold' : 'text-gray-700'}`}>
                                        {option}
                                    </Text>
                                    {additionalType === option && (
                                        <Ionicons name="checkmark" size={20} color="#3B82F6" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>


                <Text className="font-outfit-bold text-gray-900 text-base mb-2">Details</Text>
                <TextInput
                    className="bg-white border border-gray-200 rounded-xl p-4 min-h-[100px] font-outfit-regular text-gray-700 mb-4"
                    placeholder="Type details here..."
                    multiline
                    textAlignVertical="top"
                />

                <TouchableOpacity
                    className="border border-dashed border-blue-300 bg-white p-6 rounded-xl items-center justify-center mb-6"
                >
                    <Ionicons name="cloud-upload-outline" size={24} color="#3B82F6" />
                    <Text className="text-blue-500 font-outfit-medium text-xs mt-2 text-center">Click here{'\n'}to upload images / auto scanner report</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={onUpdateStatus}
                    className="bg-blue-600 w-full py-4 rounded-xl items-center justify-center"
                >
                    <Text className="text-white font-outfit-bold text-lg">Update status / Request approval</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
