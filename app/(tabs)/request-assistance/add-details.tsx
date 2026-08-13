import { Button } from '@/components/ui/Button';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus, Upload } from 'lucide-react-native';
import React, { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

const MAX_PHOTOS = 3;

export default function AddDetailsScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { type, vehicleId, vehicleName, description, issues, symptomId } = params;

    const [details, setDetails] = useState('');
    const [photos, setPhotos] = useState<string[]>([]);

    const getTitle = () => {
        switch (type) {
            case 'immediate': return t('requestAssistance.header.immediate');
            case 'scheduled': return t('requestAssistance.header.scheduled');
            case 'videocall': return t('requestAssistance.header.videoCall');
            case 'witness': return t('requestAssistance.header.accident');
            default: return t('requestAssistance.header.default');
        }
    };

    const getBadgeText = () => {
        switch (type) {
            case 'immediate': return t('requestAssistance.badge.immediate');
            case 'scheduled': return t('requestAssistance.badge.scheduled');
            case 'videocall': return t('requestAssistance.badge.videoCall');
            case 'witness': return t('requestAssistance.badge.accident');
            default: return t('requestAssistance.badge.default');
        }
    };

    const pickImage = async () => {
        if (photos.length >= MAX_PHOTOS) {
            Alert.alert(t('requestAssistance.addDetails.photoLimitTitle'), t('requestAssistance.addDetails.photoLimitMessage', { max: MAX_PHOTOS }));
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
        });

        if (!result.canceled) {
            setPhotos([...photos, result.assets[0].uri]);
        }
    };

    const handleConfirm = () => {
        router.push({
            pathname: '/request-assistance/location-map',
            params: {
                type,
                vehicleId,
                vehicleName,
                description,
                issues,
                // Not persisted yet (no symptom column on assistance_requests);
                // carried through so the later steps keep it. Every screen after
                // this one forwards `...params`, so this is the last hop that
                // has to name it explicitly.
                symptomId,
                details,
                photos: JSON.stringify(photos) // Pass photos as string
            }
        });
    };

    return (
        <View className="flex-1 bg-white">
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

                <Text className="text-gray-900 font-outfit-medium text-3xl mb-4">{t('requestAssistance.addDetails.title')}</Text>

                <Text className="text-gray-500 font-outfit-regular text-base mb-6">
                    {t('requestAssistance.addDetails.subtitle')}
                </Text>

                <View className="mb-6">
                    <TextInput
                        multiline
                        numberOfLines={4}
                        placeholder={t('requestAssistance.addDetails.placeholder')}
                        placeholderTextColor="#D1D5DB"
                        value={details}
                        onChangeText={setDetails}
                        className="bg-white border border-gray-300 rounded-2xl p-4 font-outfit-regular text-[#0F172A] text-base h-32"
                        style={{ textAlignVertical: 'top' }}
                    />
                </View>

                {/* Photo Upload Area */}
                <TouchableOpacity
                    onPress={pickImage}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-8 items-center justify-center mb-4 bg-gray-50/30"
                >
                    <View className="w-12 h-12 bg-blue-100 rounded-full justify-center items-center mb-2">
                        <Upload size={24} color="#0047AB" />
                    </View>
                    <Text className="text-gray-500 font-outfit-medium text-xs text-center">
                        {t('requestAssistance.addDetails.uploadPrefix')} <Text className="text-blue-600">{t('requestAssistance.addDetails.uploadHere')}</Text> {t('requestAssistance.addDetails.uploadSuffix')}
                    </Text>
                    <Text className="text-gray-400 font-outfit-regular text-xs text-center mt-1">
                        {t('requestAssistance.addDetails.maxPhotos', { max: MAX_PHOTOS, count: photos.length })}
                    </Text>
                </TouchableOpacity>

                {/* Photo List */}
                {photos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                        {photos.map((uri, index) => (
                            <View key={index} className="mr-3 relative">
                                <Image source={{ uri }} className="w-20 h-20 rounded-lg" />
                                <TouchableOpacity
                                    onPress={() => setPhotos(photos.filter((_, i) => i !== index))}
                                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full items-center justify-center"
                                >
                                    <Text className="text-white text-xs font-outfit-bold leading-none">✕</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                )}

                <TouchableOpacity
                    onPress={pickImage}
                    disabled={photos.length >= MAX_PHOTOS}
                    className="flex-row items-center justify-center mb-8"
                >
                    <Plus size={20} color={photos.length >= MAX_PHOTOS ? '#9CA3AF' : '#0047AB'} />
                    <Text className={`font-outfit-bold ml-2 ${photos.length >= MAX_PHOTOS ? 'text-gray-400' : 'text-[#0047AB]'}`}>
                        {photos.length >= MAX_PHOTOS ? t('requestAssistance.addDetails.photoLimitReached', { max: MAX_PHOTOS }) : t('requestAssistance.addDetails.addPhotos')}
                    </Text>
                </TouchableOpacity>

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
                        <Text className="text-white font-outfit-bold text-center mr-2">{t('requestAssistance.addDetails.confirmIssue')}</Text>
                        <ChevronRight size={20} color="white" />
                    </LinearGradient>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
