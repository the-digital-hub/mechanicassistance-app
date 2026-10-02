import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image, Text, TouchableOpacity, View } from 'react-native';
import { NoteInput, OS } from './ui';

// Capture slot for the on-site flow. Keeps the picked file on the device only —
// nothing is uploaded yet (the on-site flow has no backend).

export type MediaKind = 'image' | 'video' | 'file';

interface MediaSlotProps {
    kind?: MediaKind;
    height?: number;
    placeholder: string;
    onChange?: (filled: boolean) => void;
    /** Show a note box once something has been captured. */
    note?: boolean;
    onDeleteSlot?: () => void;
    padded?: boolean;
}

interface Picked {
    uri: string;
    name?: string;
    isVideo: boolean;
}

export function MediaSlot({ kind = 'image', height = 170, placeholder, onChange, note, onDeleteSlot, padded = true }: MediaSlotProps) {
    const { t } = useTranslation();
    const [picked, setPicked] = React.useState<Picked | null>(null);
    const [text, setText] = React.useState('');

    const set = (p: Picked | null) => {
        setPicked(p);
        onChange?.(!!p);
    };

    const mediaTypes: ImagePicker.MediaType[] = kind === 'video' ? ['videos'] : ['images'];

    const fromCamera = async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
        const res = await ImagePicker.launchCameraAsync({ mediaTypes, quality: 0.5, videoMaxDuration: 120 });
        if (!res.canceled) set({ uri: res.assets[0].uri, name: res.assets[0].fileName ?? undefined, isVideo: kind === 'video' });
    };

    const fromLibrary = async () => {
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes, quality: 0.5 });
        if (!res.canceled) set({ uri: res.assets[0].uri, name: res.assets[0].fileName ?? undefined, isVideo: kind === 'video' });
    };

    const fromFiles = async () => {
        const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
        if (!res.canceled) set({ uri: res.assets[0].uri, name: res.assets[0].name, isVideo: false });
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

    const isImagePreview = picked && !picked.isVideo && (kind !== 'file' || /\.(jpe?g|png|heic|webp)$/i.test(picked.name ?? picked.uri));

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
            </TouchableOpacity>

            <View className="flex-row items-center justify-between mt-2.5">
                <View className="flex-row items-center gap-2 flex-1">
                    <Ionicons name={picked ? 'checkmark' : 'camera-outline'} size={14} color={picked ? OS.green : OS.mutedLight} />
                    <Text className="font-outfit-bold text-xs" style={{ color: picked ? OS.greenDark : OS.mutedLight }} numberOfLines={1}>
                        {picked ? t('appointments.onSite.common.captured') : t('appointments.onSite.common.pending')}
                    </Text>
                </View>
                <View className="flex-row items-center gap-3.5">
                    {picked ? (
                        <TouchableOpacity onPress={() => { set(null); setText(''); }}>
                            <Text className="font-outfit-bold text-[11.5px]" style={{ color: OS.red }}>{t('appointments.onSite.common.remove')}</Text>
                        </TouchableOpacity>
                    ) : null}
                    {onDeleteSlot ? (
                        <TouchableOpacity onPress={onDeleteSlot}>
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
export function PhotoList({ placeholder, height = 120, onAnyFilled }: { placeholder: string; height?: number; onAnyFilled?: (v: boolean) => void }) {
    const { t } = useTranslation();
    const nextId = React.useRef(1);
    const [ids, setIds] = React.useState<number[]>([0]);
    const [fills, setFills] = React.useState<Record<number, boolean>>({});

    React.useEffect(() => {
        onAnyFilled?.(ids.some((id) => fills[id]));
    }, [ids, fills, onAnyFilled]);

    return (
        <View>
            {ids.map((id, i) => (
                <View key={id}>
                    <MediaSlot
                        height={height}
                        placeholder={placeholder}
                        onChange={(v) => setFills((f) => ({ ...f, [id]: v }))}
                        onDeleteSlot={i > 0 ? () => setIds((list) => list.filter((x) => x !== id)) : undefined}
                    />
                    <View className="px-4 -mt-2 pb-2">
                        <NoteInput placeholder={t('appointments.onSite.common.photoNote')} />
                    </View>
                </View>
            ))}
            <TouchableOpacity onPress={() => setIds((list) => [...list, nextId.current++])} className="px-4 pb-4">
                <Text className="font-outfit-bold text-xs" style={{ color: OS.blue }}>{t('appointments.onSite.common.addAnotherPhoto')}</Text>
            </TouchableOpacity>
        </View>
    );
}
