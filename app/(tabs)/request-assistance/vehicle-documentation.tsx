import { HeaderBell } from '@/components/HeaderBell';
import { FONT } from '@/lib/ui/fonts';
import { Footer } from '@/components/scheduled/ui';
import { ROUNDED_HEADER } from '@/lib/ui/header';
import { RequestSteps, stepEyebrow } from '@/components/ui/RequestSteps';
import { TYPE } from '@/lib/ui/type';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { PendingAttachment } from '@/lib/media/attachments';
import { appAlert } from '@/lib/ui/appAlert';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';

const MAX_PHOTOS = 3;
/** Mirrors MAX_UPLOAD_BYTES.video in media-service — the upload 413s past this. */
const MAX_VIDEO_MB = 250;

type PhotoSlot = { uri: string; note: string };
type VideoSlot = { uri: string; note: string };

export default function VehicleDocumentationScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { type } = params;

    const [video, setVideo] = useState<VideoSlot | null>(null);
    const [photos, setPhotos] = useState<PhotoSlot[]>([]);


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

    /** The picker is started from the source dialog's button, so a rejection would otherwise vanish and the button would seem dead. */
    const pickerFailed = (error: unknown) => {
        console.warn('[vehicle-documentation] picker failed', error);
        appAlert(
            t('requestAssistance.vehicleDocumentation.pickerErrorTitle'),
            t('requestAssistance.vehicleDocumentation.pickerErrorMessage')
        );
    };

    const pickVideo = async (source: 'camera' | 'library') => {
        if (source === 'camera' && !(await ensureCamera())) return;

        let result: ImagePicker.ImagePickerResult;
        try {
            result = source === 'camera'
                ? await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: 60, quality: 0.5 })
                : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.5 });
        } catch (error) {
            pickerFailed(error);
            return;
        }

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

        let result: ImagePicker.ImagePickerResult;
        try {
            result = source === 'camera'
                ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.5 })
                : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.5 });
        } catch (error) {
            pickerFailed(error);
            return;
        }

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

    const hasMedia = !!video || photos.length > 0;

    const setPhotoNote = (index: number, note: string) => {
        setPhotos(photos.map((photo, i) => (i === index ? { ...photo, note } : photo)));
    };

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

    return (
        <View className="flex-1" style={{ backgroundColor: '#F4F6FC' }}>
            {/* Custom Header */}
            <View className="px-6 pt-20 pb-2 flex-row items-center justify-between" style={[ROUNDED_HEADER, { paddingTop: 63 }]}>
                <TouchableOpacity onPress={() => router.back()}>
                    <View className="rounded-full justify-center items-center" style={{ width: 30, height: 30, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
                        <ChevronLeft size={16} color="#0047AB" />
                    </View>
                </TouchableOpacity>
                <Text style={{ fontFamily: FONT.medium, fontSize: 18, color: '#1A1A1A', flex: 1, textAlign: 'center' }}>
                    {getTitle()}
                </Text>
                <HeaderBell />
            </View>
            <KeyboardAwareScrollView className="flex-1 px-6 pt-4" contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
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
                    {t('requestAssistance.vehicleDocumentation.subtitle', { max: MAX_PHOTOS })}
                </Text>

                {/* Like the legal documents: one white card per item, top to bottom. A card with something in it shows the picture,
                    its own detail field and "Remove"; the next empty card carries the blue button to add it. */}
                {(() => {
                    const voc = 'requestAssistance.vehicleDocumentation';
                    const card = (key: string, title: string, body: React.ReactNode) => (
                        <View key={key} style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#EEF2FA', shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 2 }} testID={`doc-card-${key}`}>
                            <Text className="font-outfit-bold text-[#0B1530]" style={{ fontSize: 17, lineHeight: 23, marginBottom: 12 }}>{title}</Text>
                            {body}
                        </View>
                    );
                    const filled = (uri: string, isVideo: boolean, note: string, onChange: (note: string) => void, onRemove: () => void, testID: string) => (
                        <View style={{ gap: 12 }}>
                            <View style={{ gap: 12 }}>
                                <View className="items-center justify-center overflow-hidden" style={{ width: '100%', height: 170, borderRadius: 14, backgroundColor: '#0B1530' }}>
                                    {isVideo ? (
                                        <Ionicons name="play-circle-outline" size={52} color="rgba(255,255,255,0.88)" />
                                    ) : (
                                        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                    )}
                                </View>
                                <TextInput
                                    multiline
                                    value={note}
                                    onChangeText={onChange}
                                    placeholder={t(`${voc}.detailPlaceholder`)}
                                    placeholderTextColor="#9AA4BC"
                                    className="font-outfit-regular"
                                    style={{ minHeight: 72, borderRadius: 14, borderWidth: 1.5, borderColor: '#D5DCEB', backgroundColor: '#F8FAFE', paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: 'top', ...TYPE.body, color: '#0F172A' }}
                                    testID={`${testID}-note`}
                                />
                            </View>
                            <TouchableOpacity
                                onPress={onRemove}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                className="flex-row items-center self-start"
                                style={{ gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#FEE2E2' }}
                                testID={`${testID}-remove`}
                            >
                                <Ionicons name="trash-outline" size={14} color="#DC2626" />
                                <Text className="font-outfit-bold" style={{ fontSize: 14, color: '#DC2626' }}>{t(`${voc}.remove`)}</Text>
                            </TouchableOpacity>
                        </View>
                    );
                    const empty = (icon: 'camera-outline' | 'videocam-outline', hint: string, label: string, onPress: () => void, testID: string) => (
                        <View style={{ gap: 14 }}>
                            <View className="flex-row items-center" style={{ gap: 12 }}>
                                <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#EAF1FF' }}>
                                    <Ionicons name={icon} size={22} color="#1E56E3" />
                                </View>
                                <Text className="flex-1 font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: '#6B7490' }}>{hint}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={onPress}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                className="flex-row items-center justify-center"
                                style={{ gap: 8, minHeight: 56, borderRadius: 14, backgroundColor: '#1E56E3' }}
                                testID={testID}
                            >
                                <Ionicons name={icon} size={20} color="#FFFFFF" />
                                <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#FFFFFF' }}>{label}</Text>
                            </TouchableOpacity>
                        </View>
                    );
                    return (
                        <View style={{ gap: 16 }}>
                            {photos.map((photo, index) => card(
                                `photo-${index}`,
                                t(`${voc}.photoCardTitle`, { n: index + 1 }),
                                filled(photo.uri, false, photo.note, (note) => setPhotoNote(index, note), () => setPhotos(photos.filter((_, i) => i !== index)), `doc-photo-${index}`),
                            ))}
                            {photos.length < MAX_PHOTOS ? card(
                                'photo-next',
                                t(`${voc}.photoCardTitle`, { n: photos.length + 1 }),
                                empty('camera-outline', t(`${voc}.photoCardHint`), t(`${voc}.addPhoto`), () => askSource(pickPhoto), 'doc-add-photo'),
                            ) : null}
                            {card(
                                'video',
                                t(`${voc}.videoCardTitle`),
                                video
                                    ? filled(video.uri, true, video.note, (note) => setVideo((v) => (v ? { ...v, note } : v)), () => setVideo(null), 'doc-video')
                                    : empty('videocam-outline', t(`${voc}.videoCardHint`), t(`${voc}.addVideo`), () => askSource(pickVideo), 'doc-add-video'),
                            )}
                        </View>
                    );
                })()}
            </KeyboardAwareScrollView>

            <Footer
                label={hasMedia ? t('requestAssistance.continue') : t('requestAssistance.vehicleDocumentation.skip')}
                onPress={handleContinue}
            />
        </View>
    );
}
