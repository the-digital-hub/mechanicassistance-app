import { Button } from '@/components/ui/Button';
import { useUser } from '@/context/UserContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
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

    const getTitle = () => {
        switch (type) {
            case 'immediate': return 'Immediate Assistance';
            case 'scheduled': return 'Scheduled Assistance';
            case 'videocall': return 'Video Call Assistance';
            case 'witness': return 'Accident Assistance';
            default: return 'Assistance';
        }
    };

    const getBadgeText = () => {
        switch (type) {
            case 'immediate': return 'IMMEDIATE ASSISTANCE';
            case 'scheduled': return 'SCHEDULED ASSISTANCE';
            case 'videocall': return 'VIDEO CALL ASSISTANCE';
            case 'witness': return 'ACCIDENT ASSISTANCE';
            default: return 'ASSISTANCE';
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
                params: { requestId: response.id, type }
            });
        } catch (error) {
            console.error(error);
            setUploadProgress('');
            Alert.alert('Error', 'Failed to submit request. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <View className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
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

            <ScrollView className="flex-1 px-6 pt-6">
                <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                    <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                        {getBadgeText()}
                    </Text>
                </View>

                <Text className="text-gray-900 font-outfit-medium text-3xl mb-2">Confirm your request</Text>

                <Text className="text-gray-500 font-outfit-regular text-base mb-6">
                    Review and confirm your assistance request details
                </Text>

                <View className="bg-white overflow-hidden mb-6" style={{ borderRadius: 10 }}>
                    {/* Header Banner */}
                    <LinearGradient
                        colors={['#2B66F8', '#081E72']}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                            paddingHorizontal: 24,
                            paddingVertical: 16,
                            flexDirection: 'row',
                            alignItems: 'center',
                        }}
                    >
                        <Ionicons name="construct" size={24} color="white" />
                        <Text className="text-white font-outfit-bold text-xl ml-3">{getTypeLabel()}</Text>
                    </LinearGradient>

                    {/* Content */}
                    <View className="px-6 py-4">
                        <View className="mb-3">
                            <Text className="text-gray-400 font-outfit-medium text-sm uppercase tracking-wide mb-1">Assistance needed</Text>
                            <Text className="text-gray-900 font-outfit-semibold text-lg">{description || 'No description provided'}</Text>
                        </View>

                        <View className="border-t border-gray-200 pt-3 mb-3">
                            <Text className="text-gray-400 font-outfit-medium text-sm uppercase tracking-wide mb-1">Timeframe</Text>
                            <Text className="text-gray-900 font-outfit-semibold text-lg">
                                {type === 'immediate' || type === 'witness' ? '4 Hours' : type === 'scheduled' ? '7 Days' : 'On Demand'}
                            </Text>
                        </View>

                        <View className="border-t border-gray-200 pt-3 mb-3">
                            <Text className="text-gray-400 font-outfit-medium text-sm uppercase tracking-wide mb-1">Car</Text>
                            <Text className="text-gray-900 font-outfit-semibold text-lg">{vehicleStr}</Text>
                        </View>

                        <View className="border-t border-gray-200 pt-3 mb-3">
                            <Text className="text-gray-400 font-outfit-medium text-sm uppercase tracking-wide mb-1">Address</Text>
                            <Text className="text-gray-900 font-outfit-semibold text-lg">{finalAddress || addressLabel}</Text>
                        </View>

                        <View className="border-t border-gray-200 pt-3">
                            <Text className="text-gray-400 font-outfit-medium text-sm uppercase tracking-wide mb-1">Notes</Text>
                            <Text className="text-gray-900 font-outfit-semibold text-lg">{details || 'None'}</Text>
                        </View>
                    </View>

                    {/* Fees Info */}
                    <View className="mx-6 mb-6 p-4 rounded-2xl items-center" style={{ backgroundColor: '#EFF6FF' }}>
                        <Text className="text-blue-600 font-outfit-semibold text-center">
                            No FEES will be charged to your account until work is done and approved.
                        </Text>
                    </View>
                </View>

                {isSubmitting ? (
                    <View className="items-center mb-8">
                        <ActivityIndicator size="large" color="#0047AB" />
                        {uploadProgress ? (
                            <Text className="text-gray-500 font-outfit-regular text-sm mt-2">{uploadProgress}</Text>
                        ) : null}
                    </View>
                ) : (
                    <TouchableOpacity
                        onPress={handleConfirm}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={['#2B66F8', '#081E72']}
                            start={{ x: 0, y: 1 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                                borderRadius: 10,
                                paddingVertical: 16,
                                paddingHorizontal: 16,
                                marginBottom: 32,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Text className="text-white font-outfit-bold text-center mr-2">Confirm and Request</Text>
                            <ChevronRight size={20} color="white" />
                        </LinearGradient>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
}
