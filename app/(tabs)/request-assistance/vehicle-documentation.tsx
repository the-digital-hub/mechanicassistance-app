import { Footer } from '@/components/scheduled/ui';
import { ROUNDED_HEADER } from '@/lib/ui/header';
import { RequestSteps, stepEyebrow } from '@/components/ui/RequestSteps';
import { TYPE } from '@/lib/ui/type';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, Check, ChevronLeft, Image as ImageIcon, Video as VideoIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { PendingAttachment } from '@/lib/media/attachments';
import { appAlert } from '@/lib/ui/appAlert';

const MAX_PHOTOS = 3;
/** Mirrors MAX_UPLOAD_BYTES.video in media-service — the upload 413s past this. */
const MAX_VIDEO_MB = 250;

type PhotoSlot = { uri: string; note: string };
type VideoSlot = { uri: string; note: string };

/**
 * The empty state of a media slot: an icon tile, a title, one short line and a real button, instead of a tall dashed
 * box with small text. The same structure as the OBD report upload.
 */
function PickCard({ icon, title, hint, actionLabel, actionIcon, onPress, testID }: {
    icon: React.ReactNode;
    title: string;
    hint: string;
    actionLabel: string;
    actionIcon: React.ReactNode;
    onPress: () => void;
    testID?: string;
}) {
    return (
        <View style={{ gap: 14 }}>
            <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#E9F1FF' }}>
                    {icon}
                </View>
                <View style={{ flex: 1 }}>
                    <Text className="font-outfit-bold" style={{ ...TYPE.question, color: '#0B1530' }}>{title}</Text>
                    <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: '#6B7490' }}>{hint}</Text>
                </View>
            </View>
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.85}
                accessibilityRole="button"
                className="flex-row items-center justify-center"
                style={{ height: 52, borderRadius: 14, backgroundColor: '#1E56E3', gap: 8 }}
                testID={testID}
            >
                {actionIcon}
                <Text className="font-outfit-bold" style={{ ...TYPE.button, color: '#FFFFFF' }}>{actionLabel}</Text>
            </TouchableOpacity>
        </View>
    );
}

export default function VehicleDocumentationScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { type } = params;

    const [tab, setTab] = useState<'video' | 'photos'>('photos');
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
            appAlert(
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
            appAlert(
                t('requestAssistance.vehicleDocumentation.videoTooLargeTitle'),
                t('requestAssistance.vehicleDocumentation.videoTooLargeMessage', { max: MAX_VIDEO_MB })
            );
            return;
        }

        setVideo({ uri: asset.uri, note: video?.note ?? '' });
    };

    const pickPhoto = async (source: 'camera' | 'library') => {
        if (photos.length >= MAX_PHOTOS) {
            appAlert(
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
        appAlert(
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
            className="flex-1 items-center py-3 rounded-xl"
            style={tab === id
                ? { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }
                : undefined}
        >
            <Text className="font-outfit-bold" style={{ ...TYPE.option, color: tab === id ? '#0047AB' : '#8C96AE' }}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    const StatusRow = ({ filled, onRemove }: { filled: boolean; onRemove?: () => void }) => (
        <View className="flex-row items-center justify-between mt-2.5">
            <View className="flex-row items-center">
                {filled
                    ? <Check size={16} color="#10B981" />
                    : <ImageIcon size={16} color="#8C96AE" />}
                <Text className="font-outfit-bold ml-2" style={{ ...TYPE.helper, color: filled ? '#0F8A55' : '#8C96AE' }}>
                    {filled
                        ? t('requestAssistance.vehicleDocumentation.captured')
                        : t('requestAssistance.vehicleDocumentation.pending')}
                </Text>
            </View>
            {filled && onRemove && (
                <TouchableOpacity onPress={onRemove}>
                    <Text className="font-outfit-bold" style={{ ...TYPE.helper, color: '#E53E3E' }}>
                        {t('requestAssistance.vehicleDocumentation.remove')}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <View className="flex-1" style={{ backgroundColor: '#F4F6FC' }}>
            {/* Custom Header */}
            <View className="px-6 pt-20 pb-2 flex-row items-center justify-between" style={[ROUNDED_HEADER, { paddingTop: 63 }]}>
                <TouchableOpacity onPress={() => router.back()}>
                    <View className="rounded-full justify-center items-center" style={{ width: 30, height: 30, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
                        <ChevronLeft size={16} color="#0047AB" />
                    </View>
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Outfit_500Medium', fontSize: 18, color: '#1A1A1A', flex: 1, textAlign: 'center' }}>
                    {getTitle()}
                </Text>
                <View className="w-6" />
            </View>
            <ScrollView className="flex-1 px-6 pt-4" contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
                    <RequestSteps type={params.type} step="photos" flush />
                <View className="flex-row items-center justify-between" style={{ marginBottom: 16 }}>
                    <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                            {stepEyebrow(t, params.type, 'photos')}
                        </Text>
                    </View>
                </View>

                <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
                    {t('requestAssistance.vehicleDocumentation.title')}
                </Text>
                <Text className="text-gray-500 font-outfit-regular text-base mb-6">
                    {t('requestAssistance.vehicleDocumentation.subtitle')}
                </Text>

                <View className="flex-row p-1 rounded-2xl mb-4" style={{ backgroundColor: '#EEF2FA' }}>
                    <Tab id="photos" label={t('requestAssistance.vehicleDocumentation.tabPhotos')} />
                    <Tab id="video" label={t('requestAssistance.vehicleDocumentation.tabVideo')} />
                </View>

                {tab === 'video' ? (
                    <View className="bg-white rounded-2xl p-4 mb-8" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 6 }}>
                        {video ? (
                            <View className="rounded-2xl items-center justify-center" style={{ width: '100%', aspectRatio: 4 / 3, backgroundColor: '#0B1530', overflow: 'hidden' }}>
                                <VideoView
                                    player={player}
                                    style={{ width: '100%', height: '100%' }}
                                    contentFit="cover"
                                    nativeControls
                                    fullscreenOptions={{ enable: true }}
                                />
                            </View>
                        ) : (
                            <PickCard
                                icon={<VideoIcon size={24} color="#1E56E3" />}
                                title={t('requestAssistance.vehicleDocumentation.recordIssue')}
                                hint={t('requestAssistance.vehicleDocumentation.videoHint')}
                                actionLabel={t('requestAssistance.vehicleDocumentation.addVideo')}
                                actionIcon={<VideoIcon size={22} color="#FFFFFF" />}
                                onPress={() => askSource(pickVideo)}
                                testID="doc-add-video"
                            />
                        )}

                        {video ? <StatusRow filled onRemove={() => setVideo(null)} /> : null}

                        {/* The note appears with the video, not before. */}
                        {video ? (
                            <TextInput
                                multiline
                                placeholder={t('requestAssistance.vehicleDocumentation.videoNotePlaceholder')}
                                placeholderTextColor="#D1D5DB"
                                value={video.note}
                                onChangeText={(note) => setVideo({ ...video, note })}
                                className="rounded-xl p-3 mt-3 font-outfit-regular text-[#0F172A]"
                                style={{ borderWidth: 1.5, borderColor: '#E4EAF5', backgroundColor: '#F4F6FC', height: 72, textAlignVertical: 'top', ...TYPE.body }}
                            />
                        ) : null}
                    </View>
                ) : (
                    <View className="bg-white rounded-2xl p-4 mb-8" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 6 }}>
                        {photos.map((photo, index) => (
                            <View key={`${photo.uri}-${index}`} className={index < photos.length - 1 ? 'pb-4 mb-4' : 'mb-4'} style={index < photos.length - 1 ? { borderBottomWidth: 1, borderBottomColor: '#EEF2FA' } : undefined}>
                                <Image source={{ uri: photo.uri }} resizeMode="cover" style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 16 }} />
                                <StatusRow filled onRemove={() => setPhotos(photos.filter((_, i) => i !== index))} />
                                <TextInput
                                    multiline
                                    placeholder={t('requestAssistance.vehicleDocumentation.photoNotePlaceholder')}
                                    placeholderTextColor="#D1D5DB"
                                    value={photo.note}
                                    onChangeText={(note) => setPhotoNote(index, note)}
                                    className="rounded-xl p-3 mt-3 font-outfit-regular text-[#0F172A]"
                                    style={{ borderWidth: 1.5, borderColor: '#E4EAF5', backgroundColor: '#F4F6FC', height: 72, textAlignVertical: 'top', ...TYPE.body }}
                                />
                            </View>
                        ))}

                        {photos.length < MAX_PHOTOS && (
                            <PickCard
                                icon={<Camera size={24} color="#1E56E3" />}
                                title={t('requestAssistance.vehicleDocumentation.photoOfIssue')}
                                hint={t('requestAssistance.vehicleDocumentation.photoHint', { max: MAX_PHOTOS })}
                                actionLabel={photos.length === 0 ? t('requestAssistance.vehicleDocumentation.addPhoto') : t('requestAssistance.vehicleDocumentation.addAnotherPhotoShort')}
                                actionIcon={<Camera size={22} color="#FFFFFF" />}
                                onPress={() => askSource(pickPhoto)}
                                testID="doc-add-photo"
                            />
                        )}
                    </View>
                )}
            </ScrollView>

            <Footer
                label={hasMedia ? t('requestAssistance.continue') : t('requestAssistance.vehicleDocumentation.skip')}
                onPress={handleContinue}
            />
        </View>
    );
}
