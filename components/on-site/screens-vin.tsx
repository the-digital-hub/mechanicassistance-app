import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { GestureResponderEvent } from 'react-native';
import { ActivityIndicator, Animated, Easing, InputAccessoryView, Keyboard, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { OnSiteVisit } from '@/lib/dao/OnSiteDAO';
import { allowAutoRotation, lockLandscape, lockPortrait } from '@/lib/orientation';
import { pinchZoom, startZoom } from '@/lib/onsite/cameraZoom';
import { backCameraZoomInfo, canReadText, recognizeText } from '@/modules/vin-text';
import { compareVins, declaredVin, extractVin, extractVinFromText, isValidVin, normalizeVin, vinCheckDigitOk, type VinCapture } from '@/lib/onsite/vin';
import { LinearGradient } from 'expo-linear-gradient';
import { AV, MONO_FONT } from '@/components/vehicles/vehicleFormDesign';
import { TYPE } from '@/lib/ui/type';
import { ActionBar, Body, Card, CardTitle, Checkbox, Intro, OnSiteDialog, OS, PrimaryButton, Tip } from './ui';

// Step 1 of the diagnostic: the vehicle's VIN (scanned from its barcode or typed) and,
// optionally, the odometer. The VIN is then compared with the one on the request and
// the one the OBD reader reports (see VinCrossCheck, shown on the OBD step).

const BARCODE_TYPES = ['code39', 'code93', 'code128', 'pdf417', 'datamatrix', 'qr'] as const;


const CORNER = 34;

/** One corner of the viewfinder. */
function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
    const top = pos === 'tl' || pos === 'tr';
    const left = pos === 'tl' || pos === 'bl';
    return (
        <View
            pointerEvents="none"
            style={{
                position: 'absolute',
                [top ? 'top' : 'bottom']: 14,
                [left ? 'left' : 'right']: 14,
                width: CORNER,
                height: CORNER,
                borderColor: '#FFFFFF',
                [top ? 'borderTopWidth' : 'borderBottomWidth']: 4,
                [left ? 'borderLeftWidth' : 'borderRightWidth']: 4,
                [top ? (left ? 'borderTopLeftRadius' : 'borderTopRightRadius') : (left ? 'borderBottomLeftRadius' : 'borderBottomRightRadius')]: 14,
            }}
        />
    );
}

/**
 * Full-screen scanner: the camera everywhere, a large window under a translucent veil, a moving scan line, and a way out by typing.
 * It follows how the phone is held: held on its side, the camera takes the wide side and the text sits next to it.
 */
function VinScannerBody({ onClose, onVin }: { onClose: () => void; onVin: (vin: string) => void }) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const landscape = width > height;
    const [notVin, setNotVin] = React.useState(false);
    const [found, setFound] = React.useState<string | null>(null);
    // The flashlight, for a sticker in a dark door jamb. It goes off by itself when the scanner closes.
    const [torch, setTorch] = React.useState(false);
    // Zoom like the Camera app: the virtual back camera (it switches lenses and focuses close up by itself), starting on the main
    // lens, and a pinch of two fingers anywhere on the picture zooms it.
    const zoomInfo = React.useMemo(() => backCameraZoomInfo(), []);
    const [zoom, setZoom] = React.useState(() => startZoom(zoomInfo));
    const zoomRef = React.useRef(zoom);
    zoomRef.current = zoom;
    const pinch = React.useRef<{ d0: number; z0: number } | null>(null);
    const onPinchTouch = (e: GestureResponderEvent) => {
        const touches = e.nativeEvent.touches;
        if (touches.length < 2) {
            pinch.current = null;
            return;
        }
        const d = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
        if (!pinch.current) {
            pinch.current = { d0: d, z0: zoomRef.current };
            return;
        }
        if (pinch.current.d0 > 0) setZoom(pinchZoom(pinch.current.z0, d / pinch.current.d0, zoomInfo?.max));
    };
    // The bottom block's height decides how much room the frame has: they must never overlap.
    const [stackH, setStackH] = React.useState(330);
    // Reading the printed VIN from a photo: for the windshield (no barcode) and for a door code the barcode reader misses.
    const cameraRef = React.useRef<CameraView>(null);
    const [reading, setReading] = React.useState(false);
    const [noText, setNoText] = React.useState(false);
    const handled = React.useRef(false);
    const line = React.useRef(new Animated.Value(0)).current;
    // A small shake when something is read that is not a VIN, and a pop when the VIN is read.
    const shake = React.useRef(new Animated.Value(0)).current;
    const pop = React.useRef(new Animated.Value(0)).current;

    // The scanner turns with the phone: sideways when the phone is, upright when it comes back. Only here: the rest of the app stays
    // upright, so leaving the scanner (a VIN read or not) always puts it back.
    // The button locks the screen the other way round (a wide barcode on a desk is easier to frame with the phone on its side, even if
    // the phone is not tilted); pressing it again goes back to following the phone.
    const [rotationLocked, setRotationLocked] = React.useState(false);
    React.useEffect(() => {
        allowAutoRotation();
        return () => lockPortrait();
    }, []);
    const toggleOrientation = () => {
        if (rotationLocked) {
            setRotationLocked(false);
            allowAutoRotation();
            return;
        }
        setRotationLocked(true);
        if (landscape) lockPortrait();
        else lockLandscape();
    };

    React.useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(line, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
                Animated.timing(line, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [line]);

    // The scanner fires repeatedly while a code is in view: act on the first VIN only.
    const onScanned = ({ data }: { data: string }) => {
        if (handled.current) return;
        const vin = extractVin(data);
        if (!vin) {
            setNotVin((was) => {
                if (!was) {
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
                    Animated.sequence([
                        Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
                        Animated.timing(shake, { toValue: -1, duration: 90, useNativeDriver: true }),
                        Animated.timing(shake, { toValue: 0.6, duration: 80, useNativeDriver: true }),
                        Animated.timing(shake, { toValue: 0, duration: 70, useNativeDriver: true }),
                    ]).start();
                }
                return true;
            });
            return;
        }
        accept(vin);
    };

    const accept = (vin: string) => {
        if (handled.current) return;
        handled.current = true;
        setNotVin(false);
        setNoText(false);
        setFound(vin);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        Animated.spring(pop, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }).start();
        // A beat to see the read VIN before going back to the form.
        setTimeout(() => onVin(vin), 650);
    };

    const readPrinted = async () => {
        if (reading || handled.current) return;
        setReading(true);
        setNoText(false);
        try {
            const picture = await cameraRef.current?.takePictureAsync({ quality: 0.8, skipProcessing: false });
            const vin = picture?.uri ? extractVinFromText(await recognizeText(picture.uri)) : null;
            if (vin) accept(vin);
            else {
                setNoText(true);
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
            }
        } catch {
            setNoText(true);
        } finally {
            setReading(false);
        }
    };

    const tips = [
        { icon: 'car-outline' as const, text: t('appointments.onSite.vin.tipDoor') },
        { icon: 'sunny-outline' as const, text: t('appointments.onSite.vin.tipWindshield') },
        { icon: 'flashlight-outline' as const, text: t('appointments.onSite.vin.tipLight') },
    ];

    // The camera fills the whole screen; a large window is cut out of a translucent dark veil, so the picture shows
    // everywhere and the window only says where to aim. Held on its side, the window takes the wide part.
    const winW = landscape ? Math.min(width * 0.6, width - insets.left - insets.right - 300) : width - 24;
    const winTop = landscape ? insets.top + 20 : insets.top + 184;
    const stackTop = height - insets.bottom - 16 - stackH;
    const winH = landscape ? height - insets.top - insets.bottom - 40 : Math.max(170, Math.min(height * 0.4, 380, stackTop - 14 - winTop));
    // On a short screen the tips would not leave room for the frame.
    const showTips = height >= 760;
    const winLeft = landscape ? width - Math.max(insets.right, 20) - winW : 12;
    const VEIL = 900; // border width of the veil: it spreads far past the screen on every side
    const glass = 'rgba(8,16,40,0.42)';

    const closeButton = (
        <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('appointments.onSite.common.cancel')}
            className="items-center justify-center"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: glass }}
        >
            <Ionicons name="close" size={22} color="#FFFFFF" />
        </TouchableOpacity>
    );

    const rotateButton = (
        <TouchableOpacity
            onPress={toggleOrientation}
            accessibilityRole="button"
            accessibilityState={{ selected: rotationLocked }}
            accessibilityLabel={rotationLocked ? t('appointments.onSite.vin.rotateAuto') : landscape ? t('appointments.onSite.vin.rotateToPortrait') : t('appointments.onSite.vin.rotateToLandscape')}
            className="items-center justify-center"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: rotationLocked ? 'rgba(255,255,255,0.92)' : glass }}
            testID="vin-rotate"
        >
            <MaterialCommunityIcons name={landscape ? 'phone-rotate-portrait' : 'phone-rotate-landscape'} size={25} color={rotationLocked ? '#1E56E3' : '#FFFFFF'} />
        </TouchableOpacity>
    );

    const torchButton = (
        <TouchableOpacity
            onPress={() => setTorch((on) => !on)}
            accessibilityRole="button"
            accessibilityState={{ selected: torch }}
            accessibilityLabel={torch ? t('appointments.onSite.vin.torchOff') : t('appointments.onSite.vin.torchOn')}
            className="items-center justify-center"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: torch ? 'rgba(255,255,255,0.92)' : glass }}
            testID="vin-torch"
        >
            <Ionicons name={torch ? 'flashlight' : 'flashlight-outline'} size={23} color={torch ? '#1E56E3' : '#FFFFFF'} />
        </TouchableOpacity>
    );

    const topButtons = (
        <View className="flex-row items-center justify-between">
            {closeButton}
            <View className="flex-row items-center" style={{ gap: 10 }}>
                {torchButton}
                {rotateButton}
            </View>
        </View>
    );

    const heading = (
        <>
            <Text className="font-outfit-bold" style={{ fontSize: landscape ? 24 : 26, letterSpacing: -0.6, lineHeight: landscape ? 28 : 31, color: '#FFFFFF', marginTop: landscape ? 14 : 16 }}>{t('appointments.onSite.vin.scanTitle')}</Text>
            <Text className="font-outfit-regular" style={{ fontSize: 15, lineHeight: 21, color: 'rgba(255,255,255,0.88)', marginTop: 4 }}>{t('appointments.onSite.vin.scanSubtitle')}</Text>
        </>
    );

    const statusPill = (
        <View className="flex-row items-center self-start" style={{ gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: notVin || noText ? 'rgba(240,138,28,0.95)' : glass }}>
            <Ionicons name={notVin || noText ? 'alert-circle-outline' : 'scan-outline'} size={16} color="#FFFFFF" />
            <Text className="font-outfit-semibold flex-shrink" style={{ fontSize: 14, color: '#FFFFFF' }}>
                {found ? t('appointments.onSite.vin.scanned') : noText ? t('appointments.onSite.vin.noText') : notVin ? t('appointments.onSite.vin.notVin') : t('appointments.onSite.vin.scanHint')}
            </Text>
        </View>
    );

    const readText = canReadText ? (
        <TouchableOpacity
            onPress={readPrinted}
            disabled={reading || !!found}
            activeOpacity={0.85}
            accessibilityRole="button"
            className="items-center justify-center flex-row"
            style={{ height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.92)', gap: 8, opacity: reading ? 0.75 : 1 }}
            testID="vin-read-text"
        >
            {reading ? <ActivityIndicator color="#1E56E3" /> : <MaterialCommunityIcons name="text-recognition" size={22} color="#1E56E3" />}
            <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#1E56E3' }}>
                {reading ? t('appointments.onSite.vin.reading') : t('appointments.onSite.vin.readText')}
            </Text>
        </TouchableOpacity>
    ) : null;

    // Not a white block: a glass button with a light outline, so it does not shout over the picture.
    const typeInstead = (
        <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            className="items-center justify-center flex-row"
            style={{ height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)', gap: 8 }}
        >
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#FFFFFF' }}>{t('appointments.onSite.vin.typeInstead')}</Text>
        </TouchableOpacity>
    );

    return (
            <View
                className="flex-1"
                style={{ backgroundColor: '#06123A' }}
                onTouchStart={onPinchTouch}
                onTouchMove={onPinchTouch}
                onTouchEnd={onPinchTouch}
                onTouchCancel={() => { pinch.current = null; }}
            >
                <StatusBar style="light" />
                <CameraView
                    ref={cameraRef}
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    enableTorch={torch}
                    zoom={zoom}
                    selectedLens={zoomInfo?.lens}
                    barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
                    onBarcodeScanned={found ? undefined : onScanned}
                />

                {/* The veil: translucent, with a rounded hole where the barcode goes. */}
                <View
                    pointerEvents="none"
                    style={{ position: 'absolute', left: winLeft - VEIL, top: winTop - VEIL, width: winW + 2 * VEIL, height: winH + 2 * VEIL, borderWidth: VEIL, borderColor: 'rgba(5,14,40,0.55)', borderRadius: VEIL + 26 }}
                />

                {/* The window: a thin outline, the corners and the scan line */}
                <Animated.View
                    pointerEvents="none"
                    style={{
                        position: 'absolute', left: winLeft, top: winTop, width: winW, height: winH, borderRadius: 26,
                        borderWidth: 1.5, borderColor: notVin ? 'rgba(240,138,28,0.95)' : 'rgba(255,255,255,0.4)',
                        transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] }) }],
                    }}
                >
                  {/* A soft glow that breathes with the corners (its opacity moves; a shadow itself cannot be animated natively). */}
                  <Animated.View
                    style={{
                        position: 'absolute', left: -1.5, top: -1.5, right: -1.5, bottom: -1.5, borderRadius: 26, borderWidth: 1.5,
                        borderColor: found ? 'rgba(16,185,129,0.9)' : notVin ? 'rgba(240,138,28,0.9)' : 'rgba(131,212,237,0.8)',
                        shadowColor: found ? '#10B981' : notVin ? '#F08A1C' : '#83D4ED', shadowOffset: { width: 0, height: 0 }, shadowRadius: 16, shadowOpacity: 0.9,
                        opacity: line.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.85] }),
                    }}
                  />
                  <View style={{ flex: 1, borderRadius: 26, overflow: 'hidden' }}>
                    {/* No sweeping line: the corners breathe slowly, and turn green when the code is read. */}
                    <Animated.View
                        style={[
                            StyleSheet.absoluteFill,
                            found
                                ? undefined
                                : {
                                      opacity: line.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
                                      transform: [{ scale: line.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1.0] }) }],
                                  },
                        ]}
                    >
                        <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
                    </Animated.View>
                    {!found ? null : (
                        <Animated.View className="items-center justify-center" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(16,185,129,0.8)', opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}>
                            <Ionicons name="checkmark-circle" size={54} color="#FFFFFF" />
                            <Text className="font-outfit-bold" style={{ fontSize: 17, letterSpacing: 1.2, color: '#FFFFFF', marginTop: 8 }}>{found}</Text>
                        </Animated.View>
                    )}
                  </View>
                </Animated.View>

                {landscape ? (
                    <View style={{ position: 'absolute', left: Math.max(insets.left, 20), top: insets.top + 16, bottom: insets.bottom + 16, width: winLeft - Math.max(insets.left, 20) - 20, justifyContent: 'space-between' }}>
                        <View>
                            {topButtons}
                            {heading}
                            <View style={{ marginTop: 12 }}>{statusPill}</View>
                        </View>
                        <View style={{ gap: 10 }}>
                            {readText}
                            {typeInstead}
                        </View>
                    </View>
                ) : (
                    <>
                        <View style={{ position: 'absolute', left: 20, right: 20, top: insets.top + 10 }}>
                            {topButtons}
                            {heading}
                        </View>

                        <View onLayout={(e) => setStackH(Math.round(e.nativeEvent.layout.height))} style={{ position: 'absolute', left: 20, right: 20, bottom: insets.bottom + 16, gap: 14 }}>
                            <View className="self-center">{statusPill}</View>
                            {/* Where to look: one quiet glass card */}
                            {showTips ? (
                            <View style={{ padding: 14, borderRadius: 18, backgroundColor: glass, gap: 10 }}>
                                {tips.map((tip) => (
                                    <View key={tip.icon} className="flex-row items-center" style={{ gap: 12 }}>
                                        <Ionicons name={tip.icon} size={18} color="rgba(255,255,255,0.92)" />
                                        <Text className="flex-1 font-outfit-medium" style={{ fontSize: 14, lineHeight: 19, color: 'rgba(255,255,255,0.92)' }}>{tip.text}</Text>
                                    </View>
                                ))}
                            </View>
                            ) : null}
                            {readText}
                            {typeInstead}
                        </View>
                    </>
                )}
            </View>
    );
}

/**
 * The modal is its own window: it needs its own SafeAreaProvider, or the insets inside it stay those of the
 * upright screen and, held on its side, the text runs under the Dynamic Island.
 */
export function VinScanner({ visible, onClose, onVin }: { visible: boolean; onClose: () => void; onVin: (vin: string) => void }) {
    return (
        <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
            <SafeAreaProvider>
                <VinScannerBody onClose={onClose} onVin={onVin} />
            </SafeAreaProvider>
        </Modal>
    );
}

const ODOMETER_ACCESSORY = 'odometer-done-bar';

export function ScreenDiagnosticsVin({ initial, requestVin, onNext }: {
    initial: VinCapture | null;
    /** VIN of the vehicle on the request; null when the owner never gave one. */
    requestVin?: string | null;
    onNext: (capture: VinCapture) => void;
}) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.vin';
    const [vin, setVin] = React.useState(initial?.vin ?? '');
    const [odometer, setOdometer] = React.useState(initial?.odometer ?? '');
    const [scanning, setScanning] = React.useState(false);
    const [justScanned, setJustScanned] = React.useState(false);
    // "Continue without the VIN": the mechanic may still want to record the odometer.
    const [noVin, setNoVin] = React.useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    // A resumed visit hands over what was saved a moment later.
    React.useEffect(() => {
        if (initial) {
            setVin((cur) => cur || initial.vin);
            setOdometer((cur) => cur || initial.odometer);
        }
    }, [initial]);

    const clean = normalizeVin(vin);
    const valid = isValidVin(clean);
    const typedSomething = clean.length > 0;
    const blocked = permission !== null && !permission.granted && !permission.canAskAgain;
    // Once a full VIN is in, it is checked against the vehicle the owner requested help for.
    const match = valid && !noVin ? compareVins(requestVin, clean) : 'unknown';

    const next = () => onNext({ vin: noVin ? '' : clean, odometer });
    const [differOpen, setDifferOpen] = React.useState(false);

    const openScanner = async () => {
        if (!permission?.granted) {
            const res = await requestPermission();
            if (!res.granted) return;
        }
        setScanning(true);
    };

    return (
        <>
            <Body>
                <Intro eyebrow={t(`${k}.eyebrow`)} title={t(`${k}.title`)} subtitle={t(`${k}.subtitle`)} />

                {/* The blue VIN card of "Add vehicle", so the same field looks the same wherever it is asked for. */}
                <View className="mx-4 mt-3.5">
                    {/* Without the VIN the card is not painted: it goes plain grey, so it reads as set aside and not as something still to fill. */}
                    <LinearGradient
                        colors={noVin ? ['#E9EDF4', '#E1E6EF'] : [AV.blue, AV.blueDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ borderRadius: 20, paddingHorizontal: 20, paddingVertical: 22, shadowColor: AV.blue, shadowOffset: { width: 0, height: 10 }, shadowOpacity: noVin ? 0 : 0.35, shadowRadius: 12, elevation: noVin ? 0 : 6 }}
                    >
                        <Text className="font-outfit-bold" style={{ ...TYPE.question, color: noVin ? '#8C96AE' : '#fff' }}>{t(`${k}.label`)}</Text>

                        <View style={{ gap: 12, marginTop: 16 }}>
                            <TouchableOpacity
                                onPress={() => void openScanner()}
                                disabled={noVin}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                className="flex-row items-center justify-center"
                                style={{ gap: 10, height: 52, borderRadius: 14, backgroundColor: noVin ? '#CBD2E1' : '#10B981' }}
                                testID="vin-scan"
                            >
                                <Ionicons name="barcode-outline" size={22} color={noVin ? '#8C96AE' : '#FFFFFF'} />
                                <Text className="font-outfit-bold" style={{ ...TYPE.body, color: noVin ? '#8C96AE' : '#FFFFFF' }}>
                                    {blocked ? t(`${k}.allowCamera`) : t(`${k}.scan`)}
                                </Text>
                            </TouchableOpacity>
                            {blocked ? <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: noVin ? '#8C96AE' : 'rgba(255,255,255,0.88)' }}>{t(`${k}.cameraBlocked`)}</Text> : null}

                            <View className="flex-row items-center" style={{ gap: 12 }}>
                                <View style={{ flex: 1, height: 1, backgroundColor: noVin ? '#CBD2E1' : 'rgba(255,255,255,0.3)' }} />
                                <Text className="font-outfit-bold" style={{ fontSize: 13, color: noVin ? '#8C96AE' : 'rgba(255,255,255,0.85)' }}>{t(`${k}.or`)}</Text>
                                <View style={{ flex: 1, height: 1, backgroundColor: noVin ? '#CBD2E1' : 'rgba(255,255,255,0.3)' }} />
                            </View>

                            <TextInput
                                value={vin}
                                onChangeText={(v) => {
                                    setJustScanned(false);
                                    setVin(normalizeVin(v).slice(0, 17));
                                }}
                                placeholder={t(`${k}.placeholder`)}
                                placeholderTextColor={AV.mutedLight}
                                autoCapitalize="characters"
                                autoCorrect={false}
                                maxLength={20}
                                editable={!noVin}
                                style={{
                                    height: 52, borderRadius: 14, paddingHorizontal: 16, backgroundColor: noVin ? '#F4F6FA' : '#fff',
                                    borderWidth: 1, borderColor: typedSomething && !valid && clean.length >= 17 && !noVin ? '#FCA5A5' : 'transparent',
                                    fontFamily: MONO_FONT, fontSize: 16, letterSpacing: 0.5, color: AV.text, opacity: noVin ? 0.6 : 1,
                                }}
                                testID="vin-input"
                            />
                        </View>

                        <View className="flex-row items-start justify-between" style={{ gap: 12, marginTop: 14 }}>
                            <Text className="font-outfit-regular" style={{ flex: 1, ...TYPE.helper, color: noVin ? '#8C96AE' : typedSomething && !valid && clean.length >= 17 ? '#FECACA' : 'rgba(255,255,255,0.85)' }}>
                                {valid
                                    ? (justScanned ? t(`${k}.scanned`) : t(`${k}.valid`))
                                    : typedSomething && clean.length >= 17 ? t(`${k}.invalid`) : t(`${k}.charCount`, { count: clean.length })}
                            </Text>
                            {valid && !noVin ? <Ionicons name="checkmark-circle" size={20} color="#86EFAC" /> : null}
                        </View>
                    </LinearGradient>
                </View>

                {valid && !vinCheckDigitOk(clean) ? <Tip tone="orange">{t(`${k}.checkDigit`)}</Tip> : null}

                {match === 'match' ? (
                    <View className="mx-4 mt-3 flex-row items-center gap-2.5 px-4 py-3.5 rounded-2xl" style={{ backgroundColor: OS.greenSoft }} testID="vin-matched">
                        <Ionicons name="checkmark-circle" size={22} color={OS.greenDark} />
                        <Text className="flex-1 font-outfit-bold" style={{ fontSize: 15, lineHeight: 21, color: OS.greenDark }}>{t(`${k}.matched`)}</Text>
                    </View>
                ) : null}
                {match === 'differ' ? (
                    <View className="mx-4 mt-3 px-4 py-3.5 rounded-2xl flex-row items-start" style={{ backgroundColor: OS.redSoft, gap: 10 }} testID="vin-differs">
                        <Ionicons name="alert-circle" size={22} color={OS.red} style={{ marginTop: -1 }} />
                        {/* The VINs sit under the text, in its column, not under the icon. */}
                        <View className="flex-1">
                            <Text className="font-outfit-bold" style={{ fontSize: 15, lineHeight: 21, color: OS.red }}>{t(`${k}.differs`)}</Text>
                            <Text className="font-outfit-medium mt-2" style={{ fontSize: 14, lineHeight: 20, color: OS.text }}>
                                {t(`${k}.cross.request`)}: <Text className="font-outfit-bold" style={{ letterSpacing: 0.8 }}>{normalizeVin(requestVin ?? '')}</Text>
                            </Text>
                            <Text className="font-outfit-medium mt-0.5" style={{ fontSize: 14, lineHeight: 20, color: OS.text }}>
                                {t(`${k}.cross.mine`)}: <Text className="font-outfit-bold" style={{ letterSpacing: 0.8 }}>{clean}</Text>
                            </Text>
                        </View>
                    </View>
                ) : null}

                <Card style={{ padding: 16 }}>
                    <CardTitle title={t(`${k}.odometer`)} optional />
                    <View className="flex-row items-center" style={{ borderWidth: 1.5, borderColor: OS.border, borderRadius: 14, backgroundColor: OS.page, paddingHorizontal: 14 }}>
                        <Ionicons name="speedometer-outline" size={20} color={OS.mutedLight} />
                        <TextInput
                            value={odometer}
                            onChangeText={(v) => setOdometer(v.replace(/\D/g, '').slice(0, 7))}
                            keyboardType="number-pad"
                            returnKeyType="done"
                            blurOnSubmit
                            onSubmitEditing={Keyboard.dismiss}
                            inputAccessoryViewID={ODOMETER_ACCESSORY}
                            placeholder={t(`${k}.odometerPlaceholder`)}
                            placeholderTextColor={OS.mutedLight}
                            className="flex-1 font-outfit-bold"
                            style={{ fontSize: 17, color: OS.text, paddingVertical: 14, paddingHorizontal: 10 }}
                            testID="odometer-input"
                        />
                        <Text className="font-outfit-bold text-[13px]" style={{ color: OS.mutedLight }}>{t(`${k}.miles`)}</Text>
                    </View>
                </Card>

                {/* The way out is there, but as a plain option and not the main road: every visit should have its VIN. Not tied to the camera. */}
                {!valid || noVin ? (
                    <TouchableOpacity
                        onPress={() => setNoVin((v) => !v)}
                        activeOpacity={0.8}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: noVin }}
                        className="flex-row items-center mx-4 mt-5"
                        style={{ gap: 12, minHeight: 56, paddingHorizontal: 16, borderRadius: 14, backgroundColor: noVin ? OS.blueSoft : '#F1F3F8', borderWidth: noVin ? 1.5 : 0, borderColor: OS.blue }}
                        testID="vin-skip"
                    >
                        <Checkbox checked={noVin} size={24} />
                        <View className="flex-1" style={{ paddingVertical: 8 }}>
                            {/* Quiet on purpose: the way out must not compete with scanning the VIN. Same grey for both lines, no accent colour. */}
                            <Text className="font-outfit-medium" style={{ fontSize: 15, lineHeight: 21, color: noVin ? OS.blue : OS.mutedLight }}>{t(`${k}.skip`)}</Text>
                            <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 19, color: noVin ? OS.blue : OS.mutedLight }}>{t(`${k}.skipNote`)}</Text>
                        </View>
                    </TouchableOpacity>
                ) : null}
                {noVin ? <Tip tone="orange">{t(`${k}.skipWarn`)}</Tip> : null}

                <Tip>{t(`${k}.tip`)}</Tip>
            </Body>
            <ActionBar>
                <PrimaryButton
                    label={t('appointments.onSite.common.continue')}
                    onPress={match === 'differ' ? () => setDifferOpen(true) : next}
                    disabled={!(valid || noVin)}
                    testID="vin-continue"
                />
            </ActionBar>

            {/* The iOS number pad has no return key: this bar gives it a Done. */}
            {Platform.OS === 'ios' ? (
                <InputAccessoryView nativeID={ODOMETER_ACCESSORY}>
                    <View className="flex-row justify-end px-4" style={{ backgroundColor: '#F6F8FC', borderTopWidth: 1, borderTopColor: OS.border }}>
                        <TouchableOpacity
                            onPress={Keyboard.dismiss}
                            hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
                            accessibilityRole="button"
                            className="justify-center"
                            style={{ minHeight: 48, paddingHorizontal: 8 }}
                            testID="odometer-done"
                        >
                            <Text className="font-outfit-bold" style={{ fontSize: 17, color: OS.blue }}>{t('appointments.onSite.common.done')}</Text>
                        </TouchableOpacity>
                    </View>
                </InputAccessoryView>
            ) : null}

            <OnSiteDialog
                visible={differOpen}
                tone="red"
                icon="alert-circle-outline"
                title={t(`${k}.differTitle`)}
                body={t(`${k}.differBody`)}
                details={
                    <View className="px-3.5 py-3 rounded-2xl" style={{ backgroundColor: OS.page }}>
                        <Text className="font-outfit-medium" style={{ fontSize: 14, lineHeight: 20, color: OS.muted }}>
                            {t(`${k}.cross.request`)}: <Text className="font-outfit-bold" style={{ color: OS.text, letterSpacing: 0.8 }}>{normalizeVin(requestVin ?? '')}</Text>
                        </Text>
                        <Text className="font-outfit-medium mt-0.5" style={{ fontSize: 14, lineHeight: 20, color: OS.muted }}>
                            {t(`${k}.cross.mine`)}: <Text className="font-outfit-bold" style={{ color: OS.text, letterSpacing: 0.8 }}>{clean}</Text>
                        </Text>
                    </View>
                }
                primaryLabel={t(`${k}.recheck`)}
                onPrimary={() => setDifferOpen(false)}
                secondaryLabel={t(`${k}.differContinue`)}
                onSecondary={() => {
                    setDifferOpen(false);
                    next();
                }}
                testID="vin-differ-dialog"
            />

            <VinScanner
                visible={scanning}
                onClose={() => setScanning(false)}
                onVin={(scanned) => {
                    setVin(scanned);
                    setJustScanned(true);
                    setScanning(false);
                }}
            />
        </>
    );
}

// ─────────── Cross-check: request vs. what the mechanic captured vs. OBD ───────────
export function VinCrossCheck({ entered, visit }: { entered: string | null | undefined; visit: OnSiteVisit | null }) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.vin.cross';
    const requestVin = declaredVin(visit);
    const obdVin = visit?.obdVin ?? null;
    const mine = entered || null;
    if (!mine && !obdVin) return null;

    const rows = [
        { key: 'request', label: t(`${k}.request`), value: requestVin },
        { key: 'mine', label: t(`${k}.mine`), value: mine },
        { key: 'obd', label: t(`${k}.obd`), value: obdVin },
    ];
    const known = rows.filter((r) => r.value);
    const pairs = [
        compareVins(requestVin, mine),
        compareVins(requestVin, obdVin),
        compareVins(mine, obdVin),
    ];
    const differs = pairs.includes('differ');
    const allMatch = !differs && known.length >= 2;
    const tone = differs ? { bg: OS.redSoft, fg: OS.red, icon: 'alert-circle' as const, text: t(`${k}.differ`) }
        : allMatch ? { bg: OS.greenSoft, fg: OS.greenDark, icon: 'checkmark-circle' as const, text: t(`${k}.match`) }
        : { bg: OS.blueSoft, fg: OS.blue, icon: 'information-circle' as const, text: t(`${k}.partial`) };

    return (
        <Card style={{ padding: 16 }}>
            <CardTitle title={t(`${k}.title`)} />
            <View className="flex-row items-center gap-2 px-3 py-2.5 rounded-xl mb-2" style={{ backgroundColor: tone.bg }}>
                <Ionicons name={tone.icon} size={18} color={tone.fg} />
                <Text className="flex-1 font-outfit-bold" style={{ fontSize: 14, lineHeight: 20, color: tone.fg }}>{tone.text}</Text>
            </View>
            {rows.map((r, i) => {
                // Flag the VIN that does not fit: when two agree, only the odd one out; when none do, all of them.
                const agreeing = (v: string) => known.filter((o) => compareVins(o.value, v) === 'match').length;
                const best = Math.max(0, ...known.map((o) => agreeing(o.value as string)));
                const flagged = differs && !!r.value && (best < 2 || agreeing(r.value) < best);
                return (
                    <View key={r.key} className="flex-row items-center justify-between gap-3 py-2.5" style={i > 0 ? { borderTopWidth: 1, borderTopColor: OS.borderSoft } : undefined}>
                        <Text className="font-outfit-medium" style={{ fontSize: 14, color: OS.muted }}>{r.label}</Text>
                        <Text className="font-outfit-bold" style={{ fontSize: 14, color: flagged ? OS.red : r.value ? OS.text : OS.mutedLight, letterSpacing: r.value ? 0.6 : 0 }}>
                            {r.value ? normalizeVin(r.value) : t(`${k}.notAvailable`)}
                        </Text>
                    </View>
                );
            })}
        </Card>
    );
}
