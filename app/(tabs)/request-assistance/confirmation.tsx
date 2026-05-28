import { Button } from '@/components/ui/Button';
import { useUser } from '@/context/UserContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function ConfirmationScreen() {
    const router = useRouter();
    const { user } = useUser();
    const params = useLocalSearchParams();
    // latitude, longitude, addressLabel, finalAddress, type, vehicleId, vehicleName, description, issues, details, photos
    const {
        type,
        vehicleId,
        vehicleName,
        description,
        issues,
        details,
        photos,
        latitude,
        longitude,
        addressLabel,
        finalAddress
    } = params;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');

    // vehicleName is passed through the wizard from select-vehicle screen
    const vehicleStr = (vehicleName as string) || `Vehicle ID: ${vehicleId}`;

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            // Upload photos to S3, then create the assistance request with permanent URLs
            const localPhotos: string[] = photos ? JSON.parse(photos as string) : [];
            const uploadedUrls: string[] = [];

            for (let i = 0; i < localPhotos.length; i++) {
                setUploadProgress(`Uploading photo ${i + 1} of ${localPhotos.length}...`);
                const url = await assistanceDAO.uploadPhoto(localPhotos[i]);
                uploadedUrls.push(url);
            }

            setUploadProgress('');

            // Extract ZIP from address if possible, or use passed locationZip
            const paramsZip = (params.locationZip as string) || '';
            const addr = finalAddress || addressLabel || '';
            const zipMatch = typeof addr === 'string' ? addr.match(/\b\d{5}\b/) : null;
            const zipCode = paramsZip || (zipMatch ? zipMatch[0] : '');

            const response = await assistanceDAO.create({
                userId: user?.id || 'current-user-id',
                title: typeof description === 'string' ? description : 'Assistance Request',
                notes: typeof details === 'string' ? details : '',
                description: typeof details === 'string' ? details : '',
                type: type as any,
                assistanceType: type as string,
                vehicleId: vehicleId as string,
                car: vehicleStr,
                address: addr as string,
                locationLat: Number(latitude),
                locationLng: Number(longitude),
                status: 'pending',
                photos: uploadedUrls,
                budget: 'TBD',
                distance: '0 km',
                zip: zipCode
            });

            router.replace({
                pathname: '/request-assistance/searching',
                params: { requestId: response.id }
            });
        } catch (error) {
            console.error(error);
            setUploadProgress('');
            Alert.alert('Error', 'Failed to submit request. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getTypeLabel = () => {
        switch (type) {
            case 'immediate': return 'Immediate Assistance';
            case 'scheduled': return 'Scheduled Assistance';
            case 'videocall': return 'Video Call';
            case 'witness': return 'Accident Assistance';
            default: return 'Assistance';
        }
    };

    return (
        <View className="flex-1 bg-white">
            {/* Header */}
            <View className="px-6 pt-14 pb-4 border-b border-gray-100 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <Ionicons name="chevron-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text className="text-xl font-outfit-bold text-[#0F172A] flex-1 text-center">
                    Assistance
                </Text>
                <TouchableOpacity onPress={() => router.replace('/(tabs)/assist')} className="ml-4">
                    <Text className="text-red-500 font-outfit-medium text-xs">Cancel</Text>
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-6 pt-6">
                <Text className="text-blue-600 font-outfit-bold text-lg mb-1">Request a mechanic</Text>
                <Text className="text-gray-900 font-outfit-bold text-sm mb-6">Confirm assistance request</Text>

                <View className="bg-gray-50 rounded-2xl p-6 mb-6">
                    {/* Header Banner */}
                    <View className="bg-blue-600 -mx-6 -mt-6 rounded-t-2xl p-4 flex-row items-center mb-6">
                        <Ionicons name="construct" size={24} color="white" />
                        <Text className="text-white font-outfit-bold text-lg ml-2">{getTypeLabel()}</Text>
                    </View>

                    <View className="space-y-4">
                        <View>
                            <Text className="font-outfit-bold text-gray-900 text-base">Assistance needed:</Text>
                            <Text className="font-outfit-regular text-gray-700">{description || 'No description provided'}</Text>
                        </View>

                        <View>
                            <Text className="font-outfit-bold text-gray-900 text-base">Timeframe:</Text>
                            <Text className="font-outfit-regular text-gray-700">
                                {type === 'immediate' || type === 'witness' ? '4 Hs' : type === 'scheduled' ? '7 Days' : 'On Demand'}
                            </Text>
                        </View>

                        <View>
                            <Text className="font-outfit-bold text-gray-900 text-base">Car:</Text>
                            <Text className="font-outfit-regular text-gray-700">{vehicleStr}</Text>
                        </View>

                        <View>
                            <Text className="font-outfit-bold text-gray-900 text-base">Address:</Text>
                            <Text className="font-outfit-regular text-gray-700">{finalAddress || addressLabel}</Text>
                        </View>

                        <View>
                            <Text className="font-outfit-bold text-gray-900 text-base">Notes:</Text>
                            <Text className="font-outfit-regular text-gray-700">{details || 'None'}</Text>
                        </View>
                    </View>

                    <Text className="text-[10px] text-blue-500 mt-6 text-center">
                        No FEES will be charged to your account until work is done and approved.
                    </Text>
                </View>

                {isSubmitting ? (
                    <View className="items-center mb-8">
                        <ActivityIndicator size="large" color="#0047AB" />
                        {uploadProgress ? (
                            <Text className="text-gray-500 font-outfit-regular text-sm mt-2">{uploadProgress}</Text>
                        ) : null}
                    </View>
                ) : (
                    <Button onPress={handleConfirm} className="bg-blue-700 rounded-xl mb-8">
                        Confirm and Request
                    </Button>
                )}
            </ScrollView>
        </View>
    );
}
