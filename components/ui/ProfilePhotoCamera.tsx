import { CameraView, type CameraType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { RefreshCcw, X } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Mask, Rect } from 'react-native-svg';

import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';
import { TYPE } from '@/lib/ui/type';

/** The circle takes this much of the width: the rest is a margin, so the face is never cut by the edge of the avatar. */
const CIRCLE = 0.86;

function Body({ onClose, onCaptured }: { onClose: () => void; onCaptured: (uri: string) => void }) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const camera = useRef<CameraView>(null);
    const [facing, setFacing] = useState<CameraType>('front');
    const [busy, setBusy] = useState(false);
    // The preview is the whole picture (3:4), not a crop of it: what is inside the circle is what the avatar will show.
    const height = Math.round((width * 4) / 3);
    const diameter = Math.round(width * CIRCLE);

    const shoot = async () => {
        if (busy || !camera.current) return;
        setBusy(true);
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            const picture = await camera.current.takePictureAsync({ quality: 0.7 });
            if (picture?.uri) onCaptured(picture.uri);
        } finally {
            setBusy(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
            <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
                <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('setup.basicInfo.closeCamera')} hitSlop={10} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }} testID="profile-camera-close">
                    <X size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))} accessibilityRole="button" accessibilityLabel={t('setup.basicInfo.switchCamera')} hitSlop={10} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }} testID="profile-camera-flip">
                    <RefreshCcw size={20} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            <View style={{ width, height, marginTop: 12, overflow: 'hidden' }}>
                <CameraView ref={camera} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} facing={facing} />
                {/* A veil with a round window: the circle is the area of the photo. */}
                <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
                    <Defs>
                        <Mask id="window">
                            <Rect x={0} y={0} width={width} height={height} fill="#FFFFFF" />
                            <Circle cx={width / 2} cy={height / 2} r={diameter / 2} fill="#000000" />
                        </Mask>
                    </Defs>
                    <Rect x={0} y={0} width={width} height={height} fill="rgba(0,0,0,0.62)" mask="url(#window)" />
                    <Circle cx={width / 2} cy={height / 2} r={diameter / 2} fill="none" stroke="#FFFFFF" strokeWidth={3} />
                </Svg>
            </View>

            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: insets.bottom + 8 }}>
                <Text className="font-outfit-medium" style={{ ...TYPE.body, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginBottom: 14, paddingHorizontal: 24 }}>{t('setup.basicInfo.cameraHint')}</Text>
                <TouchableOpacity onPress={shoot} disabled={busy} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('setup.basicInfo.takePhoto')} style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }} testID="profile-camera-shoot">
                    {busy ? <ActivityIndicator color="#FFFFFF" /> : <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF' }} />}
                </TouchableOpacity>
            </View>
        </View>
    );
}

/**
 * Camera for the profile photo: a full-screen viewfinder with a round window, because the photo ends up in a circle. (The system camera
 * offers only a square crop.) The picture is kept whole; the avatar shows its centre, which is what the circle frames.
 */
export function ProfilePhotoCamera({ visible, onClose, onCaptured }: { visible: boolean; onClose: () => void; onCaptured: (uri: string) => void }) {
    return (
        <Modal supportedOrientations={MODAL_ORIENTATIONS} visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
            <SafeAreaProvider>
                <Body onClose={onClose} onCaptured={onCaptured} />
            </SafeAreaProvider>
        </Modal>
    );
}
