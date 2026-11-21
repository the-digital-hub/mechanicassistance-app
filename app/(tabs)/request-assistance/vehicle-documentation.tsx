import { FONT } from '@/lib/ui/fonts';
import { Footer } from '@/components/scheduled/ui';
import { ROUNDED_HEADER } from '@/lib/ui/header';
import { RequestSteps, stepEyebrow } from '@/components/ui/RequestSteps';
import { TYPE } from '@/lib/ui/type';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ChevronLeft } from 'lucide-react-native';
import { CaptureTile } from '@/components/ui/CaptureTile';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
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

    // Which item's note is open under the grid: the video, a photo by index, or none.
    const [noteFor, setNoteFor] = useState<'video' | number | null>(null);

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
                <View className="w-6" />
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
                    {t('requestAssistance.vehicleDocumentation.subtitle')}
                </Text>

                {/* No tabs. Photo first, then video. With nothing yet: the two ways in, as tiles. With something: just what was added,
                    and buttons to keep adding (no empty tiles waiting to be filled). */}
                {(() => {
                    const voc = 'requestAssistance.vehicleDocumentation';
                    if (!video && photos.length === 0) {
                        return (
                            <View className="flex-row" style={{ gap: 12 }}>
                                <CaptureTile title={t(`${voc}.tilePhoto`)} hint={t(`${voc}.addPhoto`)} icon="camera-outline" onPress={() => askSource(pickPhoto)} testID="doc-add-photo" />
                                <CaptureTile title={t(`${voc}.tileVideo`)} hint={t(`${voc}.addVideo`)} icon="videocam-outline" onPress={() => askSource(pickVideo)} testID="doc-add-video" />
                            </View>
                        );
                    }
                    const cells: React.ReactNode[] = [
                        ...photos.map((photo, index) => (
                            <CaptureTile
                                key={`${photo.uri}-${index}`}
                                title={t(`${voc}.tilePhoto`)}
                                hint=""
                                icon="camera-outline"
                                uri={photo.uri}
                                onRemove={() => { setPhotos(photos.filter((_, i) => i !== index)); setNoteFor(null); }}
                                onPressFilled={() => setNoteFor(noteFor === index ? null : index)}
                                hasNote={!!photo.note.trim()}
                                selected={noteFor === index}
                            />
                        )),
                        ...(video ? [
                            <CaptureTile
                                key="video"
                                title={t(`${voc}.tileVideo`)}
                                hint=""
                                icon="videocam-outline"
                                uri={video.uri}
                                isVideo
                                onRemove={() => { setVideo(null); if (noteFor === 'video') setNoteFor(null); }}
                                onPressFilled={() => setNoteFor(noteFor === 'video' ? null : 'video')}
                                hasNote={!!video.note.trim()}
                                selected={noteFor === 'video'}
                            />,
                        ] : []),
                    ];
                    const rows: React.ReactNode[][] = [];
                    for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));
                    const addButton = (key: string, label: string, icon: 'camera-outline' | 'videocam-outline', onPress: () => void, testID: string) => (
                        <TouchableOpacity
                            key={key}
                            onPress={onPress}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            className="flex-row items-center justify-center"
                            style={{ gap: 8, minHeight: 52, borderRadius: 14, backgroundColor: '#E6EAF2' }}
                            testID={testID}
                        >
                            <Ionicons name={icon} size={22} color="#4A5470" />
                            <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#4A5470' }}>{label}</Text>
                        </TouchableOpacity>
                    );
                    return (
                        <View style={{ gap: 12 }}>
                            {rows.map((row, r) => (
                                <View key={r} className="flex-row" style={{ gap: 12 }}>
                                    {row}
                                    {row.length === 1 ? <View style={{ flex: 1, minWidth: 140 }} /> : null}
                                </View>
                            ))}
                            {photos.length < MAX_PHOTOS ? addButton('more-photo', t(`${voc}.addAnotherPhotoShort`), 'camera-outline', () => askSource(pickPhoto), 'doc-add-photo') : null}
                            {!video ? addButton('more-video', t(`${voc}.addVideo`), 'videocam-outline', () => askSource(pickVideo), 'doc-add-video') : null}
                        </View>
                    );
                })()}

                <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: '#6B7490', marginTop: 10 }}>
                    {t('requestAssistance.vehicleDocumentation.photoHint', { max: MAX_PHOTOS })}
                </Text>

                {/* The note of the tile that was tapped: it opens under the grid, not under every photo. */}
                {noteFor !== null ? (
                    <TextInput
                        multiline
                        autoFocus
                        placeholder={t(noteFor === 'video' ? 'requestAssistance.vehicleDocumentation.videoNotePlaceholder' : 'requestAssistance.vehicleDocumentation.photoNotePlaceholder')}
                        placeholderTextColor="#9AA4BC"
                        value={noteFor === 'video' ? video?.note ?? '' : photos[noteFor]?.note ?? ''}
                        onChangeText={(note) => (noteFor === 'video' ? setVideo((v) => (v ? { ...v, note } : v)) : setPhotoNote(noteFor, note))}
                        className="rounded-xl p-3 mt-3 font-outfit-regular text-[#0F172A]"
                        style={{ borderWidth: 1.5, borderColor: '#BFD2FA', backgroundColor: '#FFFFFF', height: 84, textAlignVertical: 'top', ...TYPE.body }}
                        testID="doc-note"
                    />
                ) : null}
            </KeyboardAwareScrollView>

            <Footer
                label={hasMedia ? t('requestAssistance.continue') : t('requestAssistance.vehicleDocumentation.skip')}
                onPress={handleContinue}
            />
        </View>
    );
}
