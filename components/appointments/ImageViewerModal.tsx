import { X } from 'lucide-react-native';
import React from 'react';
import { FlatList, Image, Modal, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';

export interface ViewerImage {
    uri: string;
    note?: string | null;
}

/**
 * The photos of a request at full size: opens on the one that was tapped, swipe sideways for the others, the note under it, a counter on
 * top and a close button. (Videos have their own player.)
 */
export function ImageViewerModal({ images, startIndex, onClose }: {
    images: ViewerImage[];
    /** `null` = closed. */
    startIndex: number | null;
    onClose: () => void;
}) {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const [index, setIndex] = React.useState(startIndex ?? 0);
    React.useEffect(() => {
        if (startIndex !== null) setIndex(startIndex);
    }, [startIndex]);

    const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
    const current = images[index];

    return (
        <Modal supportedOrientations={MODAL_ORIENTATIONS} visible={startIndex !== null && images.length > 0} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <View style={{ flex: 1, backgroundColor: '#000000' }} testID="image-viewer">
                {startIndex !== null ? (
                    <FlatList
                        data={images}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        initialScrollIndex={Math.min(startIndex, images.length - 1)}
                        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
                        keyExtractor={(item, i) => `${item.uri}-${i}`}
                        onMomentumScrollEnd={onEnd}
                        renderItem={({ item }) => (
                            <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
                                <Image source={{ uri: item.uri }} style={{ width, height: height * 0.75 }} resizeMode="contain" />
                            </View>
                        )}
                    />
                ) : null}

                <View style={{ position: 'absolute', top: insets.top + 8, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} pointerEvents="box-none">
                    <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.16)', opacity: images.length > 1 ? 1 : 0 }}>
                        <Text className="font-outfit-bold" style={{ fontSize: 14, color: '#FFFFFF' }} testID="image-viewer-counter">{index + 1} / {images.length}</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)' }} testID="image-viewer-close">
                        <X size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>

                {current?.note ? (
                    <View style={{ position: 'absolute', left: 20, right: 20, bottom: insets.bottom + 24, padding: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.14)' }}>
                        <Text className="font-outfit-regular" style={{ fontSize: 16, lineHeight: 22, color: '#FFFFFF' }}>{current.note}</Text>
                    </View>
                ) : null}
            </View>
        </Modal>
    );
}
