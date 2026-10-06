import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Image, Text, TouchableOpacity, View } from 'react-native';
import { absoluteMediaUrl, MediaKind, onSiteDAO, OnSiteMedia } from '@/lib/dao/OnSiteDAO';
import { NoteInput, OS } from './ui';

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
        Alert.alert(placeholder, undefined, options);
    };

    const remove = async () => {
        if (mediaId && ctx) {
            try {
                await onSiteDAO.removeCapture(ctx.appointmentId, mediaId);
            } catch {
                Alert.alert(t('appointments.onSite.common.error'));
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

    const statusText =
        state === 'uploading'
            ? t('appointments.onSite.common.uploading')
            : state === 'error'
                ? t('appointments.onSite.common.uploadFailed')
                : picked
                    ? t('appointments.onSite.common.captured')
                    : t('appointments.onSite.common.pending');
    const statusColor = state === 'error' ? OS.red : filled ? OS.greenDark : OS.mutedLight;

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
                        <Text className="font-outfit-medium text-xs text-center" style={{ color: OS.mutedLight }}>{placeholder}</Text>
                        <Text className="font-outfit-bold text-[11px] underline" style={{ color: OS.blue }}>{t('appointments.onSite.common.tapToAdd')}</Text>
                    </View>
                ) : isImagePreview ? (
                    <Image source={{ uri: picked.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                    <View className="items-center gap-2 px-4">
                        <Ionicons name={picked.isVideo ? 'play-circle-outline' : 'document-text-outline'} size={44} color="rgba(255,255,255,0.8)" />
                        <Text className="font-outfit-medium text-xs text-center" style={{ color: 'rgba(255,255,255,0.8)' }} numberOfLines={1}>
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
                        name={state === 'error' ? 'alert-circle-outline' : filled ? 'checkmark' : 'camera-outline'}
                        size={14}
                        color={statusColor}
                    />
                    <Text className="font-outfit-bold text-xs" style={{ color: statusColor }} numberOfLines={1}>{statusText}</Text>
                </View>
                <View className="flex-row items-center gap-3.5">
                    {state === 'error' && picked ? (
                        <TouchableOpacity onPress={() => void upload(picked)}>
                            <Text className="font-outfit-bold text-[11.5px]" style={{ color: OS.blue }}>{t('appointments.onSite.common.retry')}</Text>
                        </TouchableOpacity>
                    ) : null}
                    {picked && state !== 'uploading' ? (
                        <TouchableOpacity onPress={() => void remove()}>
                            <Text className="font-outfit-bold text-[11.5px]" style={{ color: OS.red }}>{t('appointments.onSite.common.remove')}</Text>
                        </TouchableOpacity>
                    ) : null}
                    {onDeleteSlot && state !== 'uploading' ? (
                        <TouchableOpacity onPress={() => void (mediaId ? remove().then(onDeleteSlot) : onDeleteSlot())}>
                            <Text className="font-outfit-bold text-[11.5px]" style={{ color: OS.red }}>{t('appointments.onSite.common.deletePhoto')}</Text>
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

/** A growing list of optional photo slots ("+ Add another photo"). */
export function PhotoList({
    placeholder,
    captureKind,
    height = 120,
    onAnyFilled,
}: {
    placeholder: string;
    captureKind?: MediaKind;
    height?: number;
    onAnyFilled?: (v: boolean) => void;
}) {
    const { t } = useTranslation();
    const existing = useExistingCaptures(captureKind);
    const nextId = React.useRef(existing.length + 1);
    // Slots: one per capture already on the visit, else a single empty slot.
    const [slots, setSlots] = React.useState<{ id: number; existing?: OnSiteMedia }[]>(() =>
        existing.length ? existing.map((m, i) => ({ id: i, existing: m })) : [{ id: 0 }],
    );
    const [fills, setFills] = React.useState<Record<number, boolean>>({});

    const onAnyFilledRef = React.useRef(onAnyFilled);
    onAnyFilledRef.current = onAnyFilled;
    React.useEffect(() => {
        onAnyFilledRef.current?.(slots.some((s) => fills[s.id]));
    }, [slots, fills]);

    return (
        <View>
            {slots.map((slot, i) => (
                <View key={slot.id}>
                    <MediaSlot
                        height={height}
                        placeholder={placeholder}
                        captureKind={captureKind}
                        existing={slot.existing}
                        onChange={(v) => setFills((f) => ({ ...f, [slot.id]: v }))}
                        onDeleteSlot={i > 0 ? () => setSlots((list) => list.filter((x) => x.id !== slot.id)) : undefined}
                    />
                    <View className="px-4 -mt-2 pb-2">
                        <NoteInput placeholder={t('appointments.onSite.common.photoNote')} />
                    </View>
                </View>
            ))}
            <TouchableOpacity onPress={() => setSlots((list) => [...list, { id: nextId.current++ }])} className="px-4 pb-4">
                <Text className="font-outfit-bold text-xs" style={{ color: OS.blue }}>{t('appointments.onSite.common.addAnotherPhoto')}</Text>
            </TouchableOpacity>
        </View>
    );
}
