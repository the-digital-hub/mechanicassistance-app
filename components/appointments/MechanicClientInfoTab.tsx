import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface MechanicClientInfoTabProps {
    client: any;
    appointmentType?: string;
    assistanceType?: string;
    rating: number;
    setRating: (rating: number) => void;
    selectedOption: string;
    setSelectedOption: (option: string) => void;
    reviewText: string;
    setReviewText: (text: string) => void;
    isSubmitted: boolean;
    onSubmit: () => void;
    onMessage?: () => void;
}

export function MechanicClientInfoTab({
    client,
    appointmentType,
    assistanceType,
    rating,
    setRating,
    selectedOption,
    setSelectedOption,
    reviewText,
    setReviewText,
    isSubmitted,
    onSubmit,
    onMessage
}: MechanicClientInfoTabProps) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const options = [
        'Issue was fully resolved',
        'Saved me time',
        'Client was professional'
    ];

    return (
        <View className="gap-6">
            {/* Blue Header Banner */}
            <View className="bg-blue-600 rounded-xl p-4 flex-row items-center gap-3">
                <View className="bg-white/20 p-2 rounded-full">
                    <Ionicons name="construct" size={24} color="white" />
                </View>
                <Text className="text-white font-outfit-bold text-lg">
                    {assistanceType === 'witness' ? 'ACCIDENT ASSISTANCE' :
                        (assistanceType ?? appointmentType) === 'immediate' ? 'Immediate Assistance' :
                            (assistanceType ?? appointmentType) === 'videocall' || appointmentType === 'video' ? 'Video Call Assistance' :
                                'Scheduled Assistance'}
                </Text>
            </View>

            {/* Client Profile Card */}
            <View className="flex-row items-center gap-4">
                <Image
                    source={{ uri: client?.profileImage || 'https://i.pravatar.cc/150?u=client' }}
                    className="w-16 h-16 rounded-full bg-gray-200"
                />
                <View>
                    <Text className="text-gray-500 font-outfit-medium text-xs">Client:</Text>
                    <Text className="font-outfit-bold text-gray-900 text-lg">{client?.name || 'Unknown'} {client?.surname || ''}.</Text>
                    <View className="flex-row items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(s => (
                            <Ionicons key={s} name="star" size={14} color="#3B82F6" />
                        ))}
                    </View>
                </View>
            </View>

            {/* Action Buttons */}
            <View className="gap-3">
                <TouchableOpacity className="bg-blue-600 w-full py-3 rounded-lg flex-row items-center justify-center gap-2">
                    <Ionicons name="call" size={20} color="white" />
                    <Text className="text-white font-outfit-bold text-base">Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    className="bg-blue-600 w-full py-3 rounded-lg flex-row items-center justify-center gap-2"
                    onPress={onMessage}
                >
                    <Ionicons name="chatbubble-ellipses" size={20} color="white" />
                    <Text className="text-white font-outfit-bold text-base">Message</Text>
                </TouchableOpacity>
            </View>

            <View className="h-[1px] bg-gray-100 my-2" />

            {/* Rating Section */}
            <Text className="font-outfit-bold text-gray-900 text-base">How would you rate the client?</Text>
            <View className="flex-row justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => !isSubmitted && setRating(star)} disabled={isSubmitted}>
                        <Ionicons
                            name={star <= rating ? "star" : "star-outline"}
                            size={32}
                            color="#3B82F6"
                        />
                    </TouchableOpacity>
                ))}
            </View>

            {/* Experience Details Dropdown (Combo) */}
            <View className="z-50">
                <Text className="font-outfit-bold text-gray-900 text-base mb-2">Experience details</Text>

                <TouchableOpacity
                    onPress={() => !isSubmitted && setIsDropdownOpen(!isDropdownOpen)}
                    disabled={isSubmitted}
                    className="bg-white border border-gray-200 rounded-xl p-4 flex-row justify-between items-center"
                >
                    <Text className={selectedOption ? "text-gray-900 font-outfit-medium" : "text-gray-400 font-outfit-regular"}>
                        {selectedOption || 'Select an option'}
                    </Text>
                    <Ionicons name={isDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color="#6B7280" />
                </TouchableOpacity>

                {isDropdownOpen && (
                    <View className="absolute top-[80px] w-full bg-white border border-gray-100 rounded-xl shadow-lg z-50">
                        {options.map((option, index) => (
                            <TouchableOpacity
                                key={option}
                                onPress={() => {
                                    setSelectedOption(option);
                                    setIsDropdownOpen(false);
                                }}
                                className={`p-4 border-b border-gray-50 flex-row items-center justify-between ${index === options.length - 1 ? 'border-b-0' : ''}`}
                            >
                                <Text className={`font-outfit-regular ${selectedOption === option ? 'text-blue-600 font-outfit-bold' : 'text-gray-700'}`}>
                                    {option}
                                </Text>
                                {selectedOption === option && (
                                    <Ionicons name="checkmark" size={20} color="#3B82F6" />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            {/* Client Review Text Area */}
            <View>
                <Text className="font-outfit-bold text-gray-900 text-base mb-2">Client review</Text>
                <TextInput
                    className="bg-white border border-gray-200 rounded-xl p-4 min-h-[100px] font-outfit-regular text-gray-700"
                    placeholder="Type a review here..."
                    multiline
                    textAlignVertical="top"
                    value={reviewText}
                    onChangeText={setReviewText}
                    editable={!isSubmitted}
                />
            </View>

            {/* Send Button */}
            {!isSubmitted && (
                <TouchableOpacity
                    onPress={onSubmit}
                    className="bg-blue-600 w-full py-4 rounded-xl items-center justify-center mb-6"
                >
                    <Text className="text-white font-outfit-bold text-lg">Send</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
