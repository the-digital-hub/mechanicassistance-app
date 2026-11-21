import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import { absoluteMediaUrl, MediaKind, onSiteDAO, OnSiteMedia } from '@/lib/dao/OnSiteDAO';
import { NoteInput, OS } from './ui';
import { appAlert } from '@/lib/ui/appAlert';

// Capture slot for the on-site flow. Inside an OnSiteCaptureProvider, a slot with
// a `captureKind` uploads what is picked to media-service and attaches it to the
// visit; without one (OBD file, until phase 2) the file stays on the device.

interface CaptureContext {
    appointmentId: string;
    /** Captures already on the visit, for resuming a flow that was left mid-way. */
    media: OnSiteMedia[];
}

const OnSiteCaptureContext = React.createContext<CaptureContext | null>(null);

export function OnSiteCaptureProvider({ value, children }: { value: CaptureContext; children: React.ReactNode }) {
    return <OnSiteCaptureContext.Provider value={value}>{children}</OnSiteCaptureContext.Provider>;
}

/** Captures of one kind already attached to the visit. */
export function useExistingCaptures(kind?: MediaKind): OnSiteMedia[] {
    const ctx = React.useContext(OnSiteCaptureContext);
    return React.useMemo(() => (kind && ctx ? ctx.media.filter((m) => m.kind === kind) : []), [ctx, kind]);
}

export type MediaKindPicker = 'image' | 'video' | 'file';

interface MediaSlotProps {
    kind?: MediaKindPicker;
    /** What the capture is for on the visit; enables upload. */
    captureKind?: MediaKind;
    /** A capture already on the visit, shown instead of an empty slot. */
    existing?: OnSiteMedia;
    height?: number;
    placeholder: string;
    onChange?: (filled: boolean) => void;
    /** Show a note box once something has been captured (local only). */
    note?: boolean;
    onDeleteSlot?: () => void;
    padded?: boolean;
    /** Uploads the picked file another way than as a visit capture (e.g. the OBD report). */
    customUpload?: (file: Picked) => Promise<void>;
    /** A file already uploaded through `customUpload`, shown as done. */
    existingFileName?: string;
    /** Empty state as a compact card with a real button instead of a tall dashed box. */
    compact?: boolean;
    /** Compact empty state: a heading above the hint, the button's own label and its icon. */
    title?: string;
    actionLabel?: string;
    actionIcon?: React.ComponentProps<typeof Ionicons>['name'];
    /** A square capture tile (the whole tile is the button) instead of a card with a big button; sits in a row or grid. */
    tile?: boolean;
    /** Tile: a small pill on its top-left corner, e.g. "Required". */
    badge?: React.ReactNode;
    /** Tile: the empty state's icon and hint line. */
    tileIcon?: React.ComponentProps<typeof Ionicons>['name'];
    tileHint?: string;
}

export interface Picked {
    uri: string;
    name?: string;
    mimeType?: string;
    isVideo: boolean;
}

type UploadState = 'local' | 'uploading' | 'done' | 'error';

export function MediaSlot({
    kind = 'image',
    captureKind,
    existing,
    height = 170,
    placeholder,
    onChange,
    note,
    onDeleteSlot,
    padded = true,
    customUpload,
    existingFileName,
    compact,
    title,
    actionLabel,
    actionIcon,
    tile,
    badge,
    tileIcon,
    tileHint,
}: MediaSlotProps) {
    const { t } = useTranslation();
    const ctx = React.useContext(OnSiteCaptureContext);
    const uploads = !!customUpload || !!(ctx && captureKind && kind !== 'file');

    const [picked, setPicked] = React.useState<Picked | null>(() =>
        existing
            ? { uri: absoluteMediaUrl(existing.url), isVideo: existing.mediaType === 'video' }
            : existingFileName
                ? { uri: '', name: existingFileName, isVideo: false }
                : null,
    );
    const [mediaId, setMediaId] = React.useState<string | null>(existing?.id ?? null);
    const [state, setState] = React.useState<UploadState>(existing || existingFileName ? 'done' : 'local');
    const [text, setText] = React.useState('');

    const onChangeRef = React.useRef(onChange);
    onChangeRef.current = onChange;
    const filled = !!picked && (!uploads || state === 'done');
    React.useEffect(() => {
        onChangeRef.current?.(filled);
    }, [filled]);

    const upload = async (p: Picked) => {
        if (customUpload) {
            setState('uploading');
            try {
                await customUpload(p);
                setState('done');
            } catch {
                setState('error');
            }
            return;
        }
        if (!uploads || !ctx || !captureKind) return;
        setState('uploading');
        try {
            const media = await onSiteDAO.addCapture(ctx.appointmentId, captureKind, p.uri, p.isVideo ? 'video' : 'image');
            setMediaId(media.id);
            setState('done');
        } catch {
            setState('error');
        }
    };

    const accept = (p: Picked) => {
        setPicked(p);
        setState(uploads ? 'uploading' : 'local');
        void upload(p);
    };

    const mediaTypes: ImagePicker.MediaType[] = kind === 'video' ? ['videos'] : ['images'];

    const fromCamera = async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
        const res = await ImagePicker.launchCameraAsync({ mediaTypes, quality: 0.5, videoMaxDuration: 120 });
        if (!res.canceled) accept({ uri: res.assets[0].uri, name: res.assets[0].fileName ?? undefined, mimeType: res.assets[0].mimeType, isVideo: kind === 'video' });
    };

    const fromLibrary = async () => {
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes, quality: 0.5 });
        if (!res.canceled) accept({ uri: res.assets[0].uri, name: res.assets[0].fileName ?? undefined, mimeType: res.assets[0].mimeType, isVideo: kind === 'video' });
    };

    const fromFiles = async () => {
        const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
        if (!res.canceled) accept({ uri: res.assets[0].uri, name: res.assets[0].name, mimeType: res.assets[0].mimeType, isVideo: false });
    };

    const pick = () => {
        const options: { text: string; onPress?: () => void; style?: 'cancel' }[] = [
            { text: t('appointments.onSite.common.camera'), onPress: fromCamera },
            { text: t('appointments.onSite.common.library'), onPress: fromLibrary },
        ];
        if (kind === 'file') options.push({ text: t('appointments.onSite.common.files'), onPress: fromFiles });
        options.push({ text: t('appointments.onSite.common.cancel'), style: 'cancel' });
        appAlert(placeholder, undefined, options);
    };

    const remove = async () => {
        if (mediaId && ctx) {
            try {
                await onSiteDAO.removeCapture(ctx.appointmentId, mediaId);
            } catch {
                appAlert(t('appointments.onSite.common.error'));
                return;
            }
        }
        setPicked(null);
        setMediaId(null);
        setState('local');
        setText('');
    };

    const isImagePreview =
        picked && picked.uri && !picked.isVideo && (kind !== 'file' || /\.(jpe?g|png|heic|webp)$/i.test(picked.name ?? picked.uri));

    // A picked file that is not a picture or a video: shown as a file card, not as a dark box with a name in it.
    const isDocumentTile = !!picked && !picked.isVideo && !isImagePreview;

    const statusText =
        state === 'uploading'
            ? t('appointments.onSite.common.uploading')
            : state === 'error'
                ? t('appointments.onSite.common.uploadFailed')
                : picked
                    ? t('appointments.onSite.common.captured')
                    : t('appointments.onSite.common.pending');
    const statusColor = state === 'error' ? OS.red : filled ? OS.greenDark : OS.mutedLight;

    if (tile) {
        const icon = tileIcon ?? (kind === 'video' ? 'videocam-outline' : 'camera-outline');
        return (
            <View style={{ flex: 1, minWidth: 140 }}>
                <TouchableOpacity
                    onPress={picked ? (state === 'error' ? () => void upload(picked) : undefined) : pick}
                    activeOpacity={picked && state !== 'error' ? 1 : 0.8}
                    accessibilityRole="button"
                    accessibilityLabel={title ?? placeholder}
                    className="items-center justify-center overflow-hidden"
                    style={{
                        height,
                        borderRadius: 18,
                        // A photo or a video sits on dark; a document (a PDF has nothing to show but its name) gets a light file card instead.
                        backgroundColor: picked ? (isDocumentTile ? '#F4F8FF' : OS.text) : '#EEF4FF',
                        borderWidth: picked && !isDocumentTile ? 0 : 1.5,
                        borderColor: '#CFDDFB',
                    }}
                >
                    {!picked ? (
                        <View className="items-center px-3" style={{ gap: 8 }}>
                            <View className="items-center justify-center" style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFFFFF' }}>
                                <Ionicons name={icon} size={26} color={OS.blue} />
                            </View>
                            {title ? <Text className="font-outfit-bold text-center" style={{ fontSize: 16, lineHeight: 21, color: OS.text }} numberOfLines={2}>{title}</Text> : null}
                            <Text className="font-outfit-medium text-center" style={{ fontSize: 13, lineHeight: 17, color: OS.blue }}>{tileHint ?? t('appointments.onSite.common.tapToAdd')}</Text>
                        </View>
                    ) : isImagePreview ? (
                        <Image source={{ uri: picked.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : isDocumentTile ? (
                        <View className="items-center px-4" style={{ gap: 8 }}>
                            <View className="items-center justify-center" style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#E6EEFF' }}>
                                <Ionicons name="document-text" size={28} color={OS.blue} />
                            </View>
                            <Text className="font-outfit-bold text-center" style={{ fontSize: 15, lineHeight: 20, color: OS.text }} numberOfLines={2}>
                                {picked.name ?? title}
                            </Text>
                        </View>
                    ) : (
                        <View className="items-center px-3" style={{ gap: 6 }}>
                            <Ionicons name={picked.isVideo ? 'play-circle-outline' : 'document-text-outline'} size={44} color="rgba(255,255,255,0.85)" />
                            <Text className="font-outfit-medium text-center" style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }} numberOfLines={1}>
                                {picked.name ?? (picked.isVideo ? t('appointments.onSite.common.video') : '')}
                            </Text>
                        </View>
                    )}

                    {picked ? (
                        <View className="absolute flex-row items-center" style={{ left: 8, bottom: 8, gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: state === 'error' ? OS.red : 'rgba(11,21,48,0.72)' }}>
                            <Ionicons name={state === 'error' ? 'refresh' : filled ? 'checkmark-circle' : 'cloud-upload-outline'} size={15} color="#FFFFFF" />
                            <Text className="font-outfit-bold" style={{ fontSize: 13, color: '#FFFFFF' }}>
                                {state === 'error' ? t('appointments.onSite.common.retry') : state === 'uploading' ? t('appointments.onSite.common.uploading') : title ?? t('appointments.onSite.common.captured')}
                            </Text>
                        </View>
                    ) : null}
                    {state === 'uploading' ? (
                        <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: 'rgba(11,21,48,0.35)' }}>
                            <ActivityIndicator color="#FFFFFF" />
                        </View>
                    ) : null}
                </TouchableOpacity>

                {badge && !picked ? <View className="absolute" style={{ left: 8, top: 8 }} pointerEvents="none">{badge}</View> : null}
                {picked && state !== 'uploading' ? (
                    <TouchableOpacity
                        onPress={() => void (onDeleteSlot ? (mediaId ? remove().then(onDeleteSlot) : onDeleteSlot()) : remove())}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t('appointments.onSite.common.remove')}
                        className="absolute items-center justify-center"
                        style={{ right: 8, top: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(11,21,48,0.72)' }}
                    >
                        <Ionicons name="close" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                ) : null}
            </View>
        );
    }

    if (compact && !picked) {
        return (
            <View className={padded ? 'p-4' : ''}>
                {/* No grey box inside the card: the card is the frame, the icon and the hint sit on it and the button under them. */}
                <View style={{ gap: 14 }}>
                    <View className="flex-row items-center gap-3">
                        <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: OS.blueSoft }}>
                            <Ionicons name={kind === 'video' ? 'videocam-outline' : kind === 'file' ? 'document-text-outline' : 'camera-outline'} size={24} color={OS.blue} />
                        </View>
                        <View style={{ flex: 1 }}>
                            {title ? <Text className="font-outfit-bold" style={{ fontSize: 17, lineHeight: 22, color: OS.text }}>{title}</Text> : null}
                            <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 19, color: OS.muted }}>{placeholder}</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={pick}
                        activeOpacity={0.85}
                        className="flex-row items-center justify-center gap-2"
                        style={{ height: 52, borderRadius: 14, backgroundColor: OS.blue }}
                    >
                        <Ionicons name={actionIcon ?? 'add-circle-outline'} size={22} color="#FFFFFF" />
                        <Text className="font-outfit-bold" style={{ fontSize: 17, color: '#FFFFFF' }}>{actionLabel ?? t('appointments.onSite.common.tapToAdd')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View className={padded ? 'p-4' : ''}>
            <TouchableOpacity
                onPress={picked ? undefined : pick}
                activeOpacity={picked ? 1 : 0.7}
                className="items-center justify-center overflow-hidden"
                style={{
                    height,
                    borderRadius: 16,
                    backgroundColor: picked ? OS.text : OS.page,
                    borderWidth: picked ? 0 : 2,
                    borderStyle: 'dashed',
                    borderColor: OS.border,
                }}
            >
                {!picked ? (
                    <View className="items-center gap-2 px-3">
                        <Ionicons name={kind === 'video' ? 'videocam-outline' : kind === 'file' ? 'document-attach-outline' : 'camera-outline'} size={30} color={OS.mutedLight} />
                        <Text className="font-outfit-medium text-center" style={{ fontSize: 14, lineHeight: 20, color: OS.muted }}>{placeholder}</Text>
                        <Text className="font-outfit-bold underline" style={{ fontSize: 14, color: OS.blue }}>{t('appointments.onSite.common.tapToAdd')}</Text>
                    </View>
                ) : isImagePreview ? (
                    <Image source={{ uri: picked.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                    <View className="items-center gap-2 px-4">
                        <Ionicons name={picked.isVideo ? 'play-circle-outline' : 'document-text-outline'} size={44} color="rgba(255,255,255,0.8)" />
                        <Text className="font-outfit-medium text-[13px] text-center" style={{ color: 'rgba(255,255,255,0.8)' }} numberOfLines={1}>
                            {picked.name ?? (picked.isVideo ? t('appointments.onSite.common.video') : '')}
                        </Text>
                    </View>
                )}
                {state === 'uploading' ? (
                    <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: 'rgba(11,21,48,0.45)' }}>
                        <ActivityIndicator color="#FFFFFF" />
                    </View>
                ) : null}
            </TouchableOpacity>

            <View className="flex-row items-center justify-between mt-2.5">
                <View className="flex-row items-center gap-2 flex-1">
                    <Ionicons
                        name={state === 'error' ? 'alert-circle-outline' : filled ? 'checkmark' : kind === 'video' ? 'videocam-outline' : kind === 'file' ? 'document-attach-outline' : 'camera-outline'}
                        size={16}
                        color={statusColor}
                    />
                    <Text className="font-outfit-bold" style={{ fontSize: 14, color: statusColor }} numberOfLines={1}>{statusText}</Text>
                </View>
                <View className="flex-row items-center gap-3.5">
                    {state === 'error' && picked ? (
                        <TouchableOpacity onPress={() => void upload(picked)} hitSlop={10}>
                            <Text className="font-outfit-bold" style={{ fontSize: 14, color: OS.blue }}>{t('appointments.onSite.common.retry')}</Text>
                        </TouchableOpacity>
                    ) : null}
                    {picked && state !== 'uploading' ? (
                        <TouchableOpacity onPress={() => void remove()} hitSlop={10}>
                            <Text className="font-outfit-bold" style={{ fontSize: 14, color: OS.red }}>{t('appointments.onSite.common.remove')}</Text>
                        </TouchableOpacity>
                    ) : null}
                    {onDeleteSlot && state !== 'uploading' ? (
                        <TouchableOpacity onPress={() => void (mediaId ? remove().then(onDeleteSlot) : onDeleteSlot())} hitSlop={10}>
                            <Text className="font-outfit-bold" style={{ fontSize: 14, color: OS.red }}>{t('appointments.onSite.common.deletePhoto')}</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>

            {note && picked ? (
                <NoteInput value={text} onChangeText={setText} placeholder={t('appointments.onSite.common.photoNote')} />
            ) : null}
        </View>
    );
}

/**
 * Optional photos as a grid of tiles: the ones already taken, then one empty tile to add the next. No "add another"
 * button and no per-photo note: taking a photo opens the next tile on its own.
 */
export function PhotoList({
    placeholder,
    captureKind,
    height = 150,
    onAnyFilled,
    title,
    second,
    tileHint,
}: {
    placeholder: string;
    captureKind?: MediaKind;
    height?: number;
    onAnyFilled?: (v: boolean) => void;
    title?: string;
    /** A cell of the grid that is not a photo (e.g. the video tile), placed right after the first photo tile: photo on the left, it on the right. */
    second?: React.ReactNode;
    tileHint?: string;
}) {
    const existing = useExistingCaptures(captureKind);
    const nextId = React.useRef(existing.length + 1);
    // One tile per capture already on the visit, plus an empty one at the end.
    const [slots, setSlots] = React.useState<{ id: number; existing?: OnSiteMedia }[]>(() => [
        ...existing.map((m, i) => ({ id: i, existing: m })),
        { id: existing.length },
    ]);
    const [fills, setFills] = React.useState<Record<number, boolean>>({});

    const onAnyFilledRef = React.useRef(onAnyFilled);
    onAnyFilledRef.current = onAnyFilled;
    React.useEffect(() => {
        onAnyFilledRef.current?.(slots.some((s) => fills[s.id]));
    }, [slots, fills]);

    // When the last tile gets a photo, a new empty one opens after it.
    const lastId = slots[slots.length - 1]?.id;
    React.useEffect(() => {
        if (lastId !== undefined && fills[lastId]) setSlots((list) => [...list, { id: nextId.current++ }]);
    }, [lastId, fills]);

    // Two cells per row; an odd one out keeps its half instead of stretching.
    const photoCells: React.ReactNode[] = [
        ...slots.map((slot) => (
            <MediaSlot
                key={slot.id}
                tile
                padded={false}
                title={title}
                tileHint={tileHint}
                height={height}
                placeholder={placeholder}
                captureKind={captureKind}
                existing={slot.existing}
                onChange={(v) => setFills((f) => ({ ...f, [slot.id]: v }))}
                onDeleteSlot={slots.length > 1 ? () => setSlots((list) => (list.length > 1 ? list.filter((x) => x.id !== slot.id) : list)) : undefined}
            />
        )),
    ];
    // Photo first (left), then the extra cell (right), then the rest of the photos.
    const cells: React.ReactNode[] = second ? [photoCells[0], second, ...photoCells.slice(1)] : photoCells;
    const rows: React.ReactNode[][] = [];
    for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));

    return (
        <View style={{ gap: 12 }}>
            {rows.map((row, r) => (
                <View key={r} className="flex-row" style={{ gap: 12 }}>
                    {row}
                    {row.length === 1 ? <View style={{ flex: 1, minWidth: 140 }} /> : null}
                </View>
            ))}
        </View>
    );
}

/**
 * The optional evidence of a visit, on screen at once: the walk-around video as one tile and the extra photos as tiles
 * next to it, all in the same grid.
 */
export function ExtraCaptures({ videoKind, photoKind, existingVideo, videoPlaceholder, photoPlaceholder }: {
    videoKind: MediaKind;
    photoKind: MediaKind;
    existingVideo?: OnSiteMedia;
    videoPlaceholder: string;
    photoPlaceholder: string;
}) {
    const { t } = useTranslation();
    return (
        <View className="mx-4">
            <PhotoList
                placeholder={photoPlaceholder}
                captureKind={photoKind}
                title={t('appointments.onSite.photos.extraTitle')}
                tileHint={t('appointments.onSite.common.addPhoto')}
                second={
                    <MediaSlot kind="video" tile padded={false} height={150} title={t('appointments.onSite.photos.videoTitle')} tileIcon="videocam-outline" tileHint={t('appointments.onSite.common.recordVideo')} placeholder={videoPlaceholder} captureKind={videoKind} existing={existingVideo} />
                }
            />
        </View>
    );
}
