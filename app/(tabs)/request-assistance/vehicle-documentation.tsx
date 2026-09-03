import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Check, ChevronLeft, Image as ImageIcon, Video as VideoIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { PendingAttachment } from '@/lib/media/attachments';

const MAX_PHOTOS = 3;
/** Mirrors MAX_UPLOAD_BYTES.video in media-service — the upload 413s past this. */
const MAX_VIDEO_MB = 50;

type PhotoSlot = { uri: string; note: string };
type VideoSlot = { uri: string; note: string };

export default function VehicleDocumentationScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { type } = params;

    const [tab, setTab] = useState<'video' | 'photos'>('video');
    const [video, setVideo] = useState<VideoSlot | null>(null);
    const [photos, setPhotos] = useState<PhotoSlot[]>([]);

    // One player for the single video slot: it is re-pointed when the user picks
    // another clip and released with the screen. Paused on load — the user asked
    // for a preview, not for playback to start on its own.
    const player = useVideoPlayer(video?.uri ?? null, (instance) => {
        instance.loop = false;
    });

    const getTitle = () => {
        switch (type) {
            case 'immediate': return t('requestAssistance.header.immediate');
            case 'scheduled': return t('requestAssistance.header.scheduled');
            case 'videocall': return t('requestAssistance.header.videoCall');
            case 'witness': return t('requestAssistance.header.accident');
            default: return t('requestAssistance.header.default');
        }
    };

    /** Camera needs an explicit grant; the library picker does not on modern OS versions. */
    const ensureCamera = async (): Promise<boolean> => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            Alert.alert(
                t('requestAssistance.vehicleDocumentation.cameraPermissionTitle'),
                t('requestAssistance.vehicleDocumentation.cameraPermissionMessage')
            );
            return false;
        }
        return true;
    };

    const pickVideo = async (source: 'camera' | 'library') => {
        if (source === 'camera' && !(await ensureCamera())) return;

        const result = source === 'camera'
            ? await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: 60, quality: 0.5 })
            : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.5 });

        if (result.canceled) return;

        const asset = result.assets[0];
        // The picker reports the size for videos; reject here rather than let the
        // user wait through an upload the media service answers with a 413.
        if (asset.fileSize && asset.fileSize > MAX_VIDEO_MB * 1024 * 1024) {
            Alert.alert(
                t('requestAssistance.vehicleDocumentation.videoTooLargeTitle'),
                t('requestAssistance.vehicleDocumentation.videoTooLargeMessage', { max: MAX_VIDEO_MB })
            );
            return;
        }

        setVideo({ uri: asset.uri, note: video?.note ?? '' });
    };

    const pickPhoto = async (source: 'camera' | 'library') => {
        if (photos.length >= MAX_PHOTOS) {
            Alert.alert(
                t('requestAssistance.vehicleDocumentation.photoLimitTitle'),
                t('requestAssistance.vehicleDocumentation.photoLimitMessage', { max: MAX_PHOTOS })
            );
            return;
        }
        if (source === 'camera' && !(await ensureCamera())) return;

        const result = source === 'camera'
            ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.5 })
            : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.5 });

        if (result.canceled) return;
        setPhotos([...photos, { uri: result.assets[0].uri, note: '' }]);
    };

    const askSource = (onPick: (source: 'camera' | 'library') => void) => {
        Alert.alert(
            t('requestAssistance.vehicleDocumentation.sourceTitle'),
            undefined,
            [
                { text: t('requestAssistance.vehicleDocumentation.sourceCamera'), onPress: () => onPick('camera') },
                { text: t('requestAssistance.vehicleDocumentation.sourceLibrary'), onPress: () => onPick('library') },
                { text: t('requestAssistance.vehicleDocumentation.cancel'), style: 'cancel' },
            ]
        );
    };

    const setPhotoNote = (index: number, note: string) => {
        setPhotos(photos.map((photo, i) => (i === index ? { ...photo, note } : photo)));
    };

    const hasMedia = !!video || photos.length > 0;

    const handleContinue = () => {
        const attachments: PendingAttachment[] = [
            ...(video ? [{ uri: video.uri, type: 'video' as const, note: video.note.trim() }] : []),
            ...photos.map((photo) => ({ uri: photo.uri, type: 'photo' as const, note: photo.note.trim() })),
        ];

        router.push({
            pathname: '/request-assistance/location-map',
            params: {
                ...params,
                attachments: JSON.stringify(attachments),
            },
        });
    };

    const Tab = ({ id, label }: { id: 'video' | 'photos'; label: string }) => (
        <TouchableOpacity
            onPress={() => setTab(id)}
            className="flex-1 items-center py-2.5 rounded-xl"
            style={tab === id
                ? { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }
                : undefined}
        >
            <Text className="font-outfit-bold text-sm" style={{ color: tab === id ? '#0047AB' : '#8C96AE' }}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    const StatusRow = ({ filled, onRemove }: { filled: boolean; onRemove?: () => void }) => (
        <View className="flex-row items-center justify-between mt-2.5">
            <View className="flex-row items-center">
                {filled
                    ? <Check size={14} color="#10B981" />
                    : <ImageIcon size={14} color="#8C96AE" />}
                <Text className="font-outfit-bold text-xs ml-2" style={{ color: filled ? '#0F8A55' : '#8C96AE' }}>
                    {filled
                        ? t('requestAssistance.vehicleDocumentation.captured')
                        : t('requestAssistance.vehicleDocumentation.pending')}
                </Text>
            </View>
            {filled && onRemove && (
                <TouchableOpacity onPress={onRemove}>
                    <Text className="font-outfit-bold text-xs" style={{ color: '#E53E3E' }}>
                        {t('requestAssistance.vehicleDocumentation.remove')}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <View className="flex-1" style={{ backgroundColor: '#F4F6FC' }}>
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

            <ScrollView className="flex-1 px-6 pt-6" keyboardShouldPersistTaps="handled">
                <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                    <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                        {t('requestAssistance.vehicleDocumentation.optional')}
                    </Text>
                </View>

                <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
                    {t('requestAssistance.vehicleDocumentation.title')}
                </Text>
                <Text className="text-gray-500 font-outfit-regular text-base mb-6">
                    {t('requestAssistance.vehicleDocumentation.subtitle')}
                </Text>

                <Text className="text-gray-900 font-outfit-semibold text-base mb-3">
                    {t('requestAssistance.vehicleDocumentation.sectionTitle')}{' '}
                    <Text className="text-gray-400 font-outfit-regular text-xs">
                        {t('requestAssistance.vehicleDocumentation.sectionOptional')}
                    </Text>
                </Text>

                <View className="flex-row p-1 rounded-2xl mb-4" style={{ backgroundColor: '#EEF2FA' }}>
                    <Tab id="video" label={t('requestAssistance.vehicleDocumentation.tabVideo')} />
                    <Tab id="photos" label={t('requestAssistance.vehicleDocumentation.tabPhotos')} />
                </View>

                {tab === 'video' ? (
                    <View className="bg-white rounded-2xl p-4 mb-8" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 6 }}>
                        <TouchableOpacity
                            onPress={() => !video && askSource(pickVideo)}
                            activeOpacity={video ? 1 : 0.8}
                            className="rounded-2xl items-center justify-center"
                            style={video
                                ? { width: '85%', alignSelf: 'center', height: 180, backgroundColor: '#0B1530' }
                                : { width: '85%', alignSelf: 'center', height: 180, borderWidth: 2, borderStyle: 'dashed', borderColor: '#E4EAF5', backgroundColor: '#F4F6FC' }}
                        >
                            {video ? (
                                <VideoView
                                    player={player}
                                    style={{ width: '100%', height: '100%' }}
                                    contentFit="cover"
                                    nativeControls
                                    fullscreenOptions={{ enable: true }}
                                />
                            ) : (
                                <View className="items-center px-6">
                                    <VideoIcon size={30} color="#8C96AE" />
                                    <Text className="text-gray-400 font-outfit-semibold text-xs mt-2 text-center">
                                        {t('requestAssistance.vehicleDocumentation.recordIssue')}
                                    </Text>
                                    <Text className="text-[#0047AB] font-outfit-bold text-xs mt-1 text-center underline">
                                        {t('requestAssistance.vehicleDocumentation.browseVideo')}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <StatusRow filled={!!video} onRemove={() => setVideo(null)} />

                        <TextInput
                            multiline
                            placeholder={t('requestAssistance.vehicleDocumentation.videoNotePlaceholder')}
                            placeholderTextColor="#D1D5DB"
                            value={video?.note ?? ''}
                            editable={!!video}
                            onChangeText={(note) => video && setVideo({ ...video, note })}
                            className="rounded-xl p-3 mt-3 font-outfit-regular text-[#0F172A] text-sm"
                            style={{ borderWidth: 1.5, borderColor: '#E4EAF5', backgroundColor: '#F4F6FC', height: 64, textAlignVertical: 'top' }}
                        />
                    </View>
                ) : (
                    <View className="bg-white rounded-2xl p-4 mb-8" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 6 }}>
                        {photos.map((photo, index) => (
                            <View key={`${photo.uri}-${index}`} className={index < photos.length - 1 ? 'pb-4 mb-4' : 'mb-4'} style={index < photos.length - 1 ? { borderBottomWidth: 1, borderBottomColor: '#EEF2FA' } : undefined}>
                                <Image source={{ uri: photo.uri }} className="w-full rounded-2xl" style={{ height: 150 }} />
                                <StatusRow filled onRemove={() => setPhotos(photos.filter((_, i) => i !== index))} />
                                <TextInput
                                    multiline
                                    placeholder={t('requestAssistance.vehicleDocumentation.photoNotePlaceholder')}
                                    placeholderTextColor="#D1D5DB"
                                    value={photo.note}
                                    onChangeText={(note) => setPhotoNote(index, note)}
                                    className="rounded-xl p-3 mt-3 font-outfit-regular text-[#0F172A] text-sm"
                                    style={{ borderWidth: 1.5, borderColor: '#E4EAF5', backgroundColor: '#F4F6FC', height: 64, textAlignVertical: 'top' }}
                                />
                            </View>
                        ))}

                        {photos.length < MAX_PHOTOS && (
                            <TouchableOpacity
                                onPress={() => askSource(pickPhoto)}
                                className="rounded-2xl items-center justify-center"
                                style={{ height: 150, borderWidth: 2, borderStyle: 'dashed', borderColor: '#E4EAF5', backgroundColor: '#F4F6FC' }}
                            >
                                <Camera size={28} color="#8C96AE" />
                                <Text className="text-gray-400 font-outfit-semibold text-xs mt-2">
                                    {t('requestAssistance.vehicleDocumentation.photoOfIssue')}
                                </Text>
                                <Text className="text-[#0047AB] font-outfit-bold text-xs mt-1 underline">
                                    {photos.length === 0
                                        ? t('requestAssistance.vehicleDocumentation.browsePhoto')
                                        : t('requestAssistance.vehicleDocumentation.addAnotherPhoto')}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                <TouchableOpacity onPress={handleContinue} activeOpacity={0.8}>
                    <LinearGradient
                        colors={['#2B66F8', '#081E72']}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                            borderRadius: 10,
                            paddingVertical: 16,
                            paddingHorizontal: 16,
                            marginBottom: 32,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Text className="text-white font-outfit-bold text-center">
                            {hasMedia
                                ? t('requestAssistance.vehicleDocumentation.submit')
                                : t('requestAssistance.vehicleDocumentation.skip')}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
