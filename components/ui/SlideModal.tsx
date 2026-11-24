import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, useWindowDimensions, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';

/**
 * The app's bottom sheet container: the dim fades in on its own, in place, and the panel slides up over it. With the Modal's own
 * "slide" animation the dim rides up with the panel, which looks abrupt. The children are the panel (they sit at the bottom).
 */
export function SlideModal({ visible, onClose, dim = 'rgba(11,21,48,0.4)', closeOnBackdrop = true, avoidKeyboard = false, children }: {
    visible: boolean;
    /** Back button and, unless `closeOnBackdrop` is off, a tap outside the panel. */
    onClose: () => void;
    dim?: string;
    closeOnBackdrop?: boolean;
    /** Lifts the panel above the keyboard (sheets with a search field). */
    avoidKeyboard?: boolean;
    children: React.ReactNode;
}) {
    const { height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const [mounted, setMounted] = useState(visible);
    const progress = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (visible) {
            setMounted(true);
            Animated.timing(progress, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        } else {
            Animated.timing(progress, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
                if (finished) setMounted(false);
            });
        }
    }, [visible, progress]);

    const Body = avoidKeyboard ? KeyboardAvoidingView : View;
    const bodyProps = avoidKeyboard ? { behavior: Platform.OS === 'ios' ? ('padding' as const) : undefined } : {};

    return (
        <Modal supportedOrientations={MODAL_ORIENTATIONS} visible={mounted} transparent animationType="none" onRequestClose={onClose}>
            <Body {...bodyProps} style={{ flex: 1, justifyContent: 'flex-end' }}>
                <Animated.View pointerEvents="box-none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: dim, opacity: progress }}>
                    <Pressable style={{ flex: 1 }} onPress={closeOnBackdrop ? onClose : undefined} accessible={false} />
                </Animated.View>
                <Animated.View style={{ transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }}>
                    {children}
                    {/* Android draws the Modal under its navigation buttons: white strip of their height so the panel's last row clears them. */}
                    {Platform.OS === 'android' && insets.bottom > 0 ? <View style={{ height: insets.bottom, backgroundColor: '#FFFFFF' }} /> : null}
                </Animated.View>
            </Body>
        </Modal>
    );
}
