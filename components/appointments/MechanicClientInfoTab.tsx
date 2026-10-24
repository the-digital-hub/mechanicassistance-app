import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { ClientReviewCard } from './ClientReviewCard';

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
                            (assistanceType ?? appointmentType) === 'videocall' ? 'Video Call Assistance' :
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

            <ClientReviewCard
                rating={rating}
                setRating={setRating}
                selectedOption={selectedOption}
                setSelectedOption={setSelectedOption}
                reviewText={reviewText}
                setReviewText={setReviewText}
                isSubmitted={isSubmitted}
                onSubmit={onSubmit}
            />
        </View>
    );
}
