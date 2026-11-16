import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BRAND_GRADIENT } from '@/components/brand/MeshBackground';
import type { OnSiteVisit } from '@/lib/dao/OnSiteDAO';
import { compareVins, declaredVin, extractVin, isValidVin, normalizeVin, vinCheckDigitOk, type VinCapture } from '@/lib/onsite/vin';
import { ActionBar, Body, Card, CardTitle, Checkbox, Intro, OS, PrimaryButton, Tip } from './ui';

// Step 1 of the diagnostic: the vehicle's VIN (scanned from its barcode or typed) and,
// optionally, the odometer. The VIN is then compared with the one on the request and
// the one the OBD reader reports (see VinCrossCheck, shown on the OBD step).

const BARCODE_TYPES = ['code39', 'code128', 'pdf417', 'datamatrix', 'qr'] as const;

const FRAME_H = 340;
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

/** Brand-blue full-screen scanner: the camera in a rounded window, a moving scan line, and a way out by typing. */
function VinScanner({ visible, onClose, onVin }: { visible: boolean; onClose: () => void; onVin: (vin: string) => void }) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [notVin, setNotVin] = React.useState(false);
    const [found, setFound] = React.useState<string | null>(null);
    const handled = React.useRef(false);
    const line = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        if (!visible) return;
        handled.current = false;
        setNotVin(false);
        setFound(null);
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(line, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
                Animated.timing(line, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [visible, line]);

    // The scanner fires repeatedly while a code is in view: act on the first VIN only.
    const onScanned = ({ data }: { data: string }) => {
        if (handled.current) return;
        const vin = extractVin(data);
        if (!vin) {
            setNotVin(true);
            return;
        }
        handled.current = true;
        setNotVin(false);
        setFound(vin);
        // A beat to see the read VIN before going back to the form.
        setTimeout(() => onVin(vin), 650);
    };

    const tips = [
        { icon: 'car-outline' as const, text: t('appointments.onSite.vin.tipDoor') },
        { icon: 'sunny-outline' as const, text: t('appointments.onSite.vin.tipWindshield') },
        { icon: 'flashlight-outline' as const, text: t('appointments.onSite.vin.tipLight') },
    ];

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <View className="flex-1">
                <StatusBar style="light" />
                <LinearGradient colors={[...BRAND_GRADIENT]} locations={[0, 0.55, 1]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />

                <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20 }}>
                    <TouchableOpacity
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel={t('appointments.onSite.common.cancel')}
                        className="items-center justify-center"
                        style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)' }}
                    >
                        <Ionicons name="close" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text className="font-outfit-bold" style={{ fontSize: 30, letterSpacing: -0.8, lineHeight: 34, color: '#FFFFFF', marginTop: 18 }}>{t('appointments.onSite.vin.scanTitle')}</Text>
                    <Text className="font-outfit-regular" style={{ fontSize: 15, lineHeight: 21, color: 'rgba(255,255,255,0.82)', marginTop: 6 }}>{t('appointments.onSite.vin.scanSubtitle')}</Text>
                </View>

                {/* Viewfinder */}
                <View style={{ marginHorizontal: 20, marginTop: 22, height: FRAME_H, borderRadius: 26, overflow: 'hidden', backgroundColor: '#06123A', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)' }}>
                    {visible ? (
                        <CameraView
                            style={StyleSheet.absoluteFill}
                            facing="back"
                            barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
                            onBarcodeScanned={found ? undefined : onScanned}
                        />
                    ) : null}
                    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,24,100,0.18)' }]} />
                    <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
                    {!found ? (
                        <Animated.View
                            pointerEvents="none"
                            style={{
                                position: 'absolute', left: 26, right: 26, top: 26, height: 3, borderRadius: 2, backgroundColor: '#83D4ED',
                                shadowColor: '#83D4ED', shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
                                transform: [{ translateY: line.interpolate({ inputRange: [0, 1], outputRange: [0, FRAME_H - 58] }) }],
                            }}
                        />
                    ) : (
                        <View pointerEvents="none" className="items-center justify-center" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(16,185,129,0.82)' }]}>
                            <Ionicons name="checkmark-circle" size={54} color="#FFFFFF" />
                            <Text className="font-outfit-bold" style={{ fontSize: 17, letterSpacing: 1.2, color: '#FFFFFF', marginTop: 8 }}>{found}</Text>
                        </View>
                    )}
                </View>

                <View className="flex-row items-center self-center" style={{ gap: 8, marginTop: 14, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: notVin ? 'rgba(240,138,28,0.95)' : 'rgba(255,255,255,0.16)' }}>
                    <Ionicons name={notVin ? 'alert-circle-outline' : 'scan-outline'} size={16} color="#FFFFFF" />
                    <Text className="font-outfit-semibold" style={{ fontSize: 13, color: '#FFFFFF' }}>
                        {found ? t('appointments.onSite.vin.scanned') : notVin ? t('appointments.onSite.vin.notVin') : t('appointments.onSite.vin.scanHint')}
                    </Text>
                </View>

                {/* Where to look */}
                <View style={{ marginHorizontal: 20, marginTop: 18, padding: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', gap: 10 }}>
                    {tips.map((tip) => (
                        <View key={tip.icon} className="flex-row items-center" style={{ gap: 12 }}>
                            <View className="items-center justify-center" style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.16)' }}>
                                <Ionicons name={tip.icon} size={17} color="#FFFFFF" />
                            </View>
                            <Text className="flex-1 font-outfit-medium" style={{ fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.9)' }}>{tip.text}</Text>
                        </View>
                    ))}
                </View>

                <View style={{ flex: 1 }} />
                <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 16 }}>
                    <TouchableOpacity
                        onPress={onClose}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        className="items-center justify-center flex-row"
                        style={{ height: 56, borderRadius: 16, backgroundColor: '#FFFFFF', gap: 8 }}
                    >
                        <Ionicons name="create-outline" size={20} color="#1E56E3" />
                        <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#1E56E3' }}>{t('appointments.onSite.vin.typeInstead')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

export function ScreenDiagnosticsVin({ initial, onNext }: {
    initial: VinCapture | null;
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

                <Card style={{ padding: 16 }}>
                    <CardTitle title={t(`${k}.label`)} />
                    <TouchableOpacity
                        onPress={() => void openScanner()}
                        disabled={noVin}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        className="flex-row items-center justify-center gap-2.5 py-3.5 mt-1"
                        style={{ borderRadius: 14, backgroundColor: OS.blueSoft, borderWidth: 1.5, borderColor: OS.blueIce, opacity: noVin ? 0.4 : 1 }}
                        testID="vin-scan"
                    >
                        <Ionicons name="barcode-outline" size={22} color={OS.blue} />
                        <Text className="font-outfit-bold text-[15px]" style={{ color: OS.blue }}>
                            {blocked ? t(`${k}.allowCamera`) : t(`${k}.scan`)}
                        </Text>
                    </TouchableOpacity>
                    {blocked ? <Text className="font-outfit-regular text-[13px] mt-2" style={{ color: OS.muted }}>{t(`${k}.cameraBlocked`)}</Text> : null}

                    <View className="flex-row items-center gap-3 my-3.5">
                        <View style={{ flex: 1, height: 1, backgroundColor: OS.border }} />
                        <Text className="font-outfit-bold text-[13px]" style={{ color: OS.mutedLight }}>{t(`${k}.or`)}</Text>
                        <View style={{ flex: 1, height: 1, backgroundColor: OS.border }} />
                    </View>

                    <TextInput
                        value={vin}
                        onChangeText={(v) => {
                            setJustScanned(false);
                            setVin(normalizeVin(v).slice(0, 17));
                        }}
                        placeholder={t(`${k}.placeholder`)}
                        placeholderTextColor={OS.mutedLight}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        maxLength={20}
                        editable={!noVin}
                        className="font-outfit-bold"
                        style={{ fontSize: 17, letterSpacing: 1.2, color: OS.text, borderWidth: 1.5, borderColor: typedSomething && !valid && clean.length >= 17 && !noVin ? OS.red : OS.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: OS.page, opacity: noVin ? 0.4 : 1 }}
                        testID="vin-input"
                    />
                    <View className="flex-row items-center justify-between mt-2">
                        <Text className="font-outfit-regular text-[13px]" style={{ color: typedSomething && !valid && clean.length >= 17 ? OS.red : OS.muted }}>
                            {typedSomething && !valid && clean.length >= 17 ? t(`${k}.invalid`) : t(`${k}.charCount`, { count: clean.length })}
                        </Text>
                        {valid ? (
                            <View className="flex-row items-center gap-1">
                                <Ionicons name="checkmark-circle" size={16} color={OS.greenDark} />
                                <Text className="font-outfit-bold text-[13px]" style={{ color: OS.greenDark }}>{justScanned ? t(`${k}.scanned`) : t(`${k}.valid`)}</Text>
                            </View>
                        ) : null}
                    </View>
                </Card>

                {valid && !vinCheckDigitOk(clean) ? <Tip tone="orange">{t(`${k}.checkDigit`)}</Tip> : null}

                <Card style={{ padding: 16 }}>
                    <CardTitle title={t(`${k}.odometer`)} optional />
                    <View className="flex-row items-center" style={{ borderWidth: 1.5, borderColor: OS.border, borderRadius: 14, backgroundColor: OS.page, paddingHorizontal: 14 }}>
                        <Ionicons name="speedometer-outline" size={20} color={OS.mutedLight} />
                        <TextInput
                            value={odometer}
                            onChangeText={(v) => setOdometer(v.replace(/\D/g, '').slice(0, 7))}
                            keyboardType="number-pad"
                            placeholder={t(`${k}.odometerPlaceholder`)}
                            placeholderTextColor={OS.mutedLight}
                            className="flex-1 font-outfit-bold"
                            style={{ fontSize: 17, color: OS.text, paddingVertical: 14, paddingHorizontal: 10 }}
                            testID="odometer-input"
                        />
                        <Text className="font-outfit-bold text-[13px]" style={{ color: OS.mutedLight }}>{t(`${k}.miles`)}</Text>
                    </View>
                </Card>

                <Tip>{t(`${k}.tip`)}</Tip>

                {/* The way out is there but quiet: the goal is that every visit has its VIN. Not tied to the camera. */}
                {!valid || noVin ? (
                    <TouchableOpacity
                        onPress={() => setNoVin((v) => !v)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: noVin }}
                        className="flex-row items-center self-start mx-5 mt-6"
                        style={{ gap: 10 }}
                        testID="vin-skip"
                    >
                        <Checkbox checked={noVin} size={20} />
                        <Text className="font-outfit-medium" style={{ fontSize: 14, lineHeight: 20, color: OS.muted }}>{t(`${k}.skip`)}</Text>
                    </TouchableOpacity>
                ) : null}
                {noVin ? <Tip tone="orange">{t(`${k}.skipWarn`)}</Tip> : null}
            </Body>
            <ActionBar>
                <PrimaryButton
                    label={t('appointments.onSite.common.continue')}
                    onPress={() => onNext({ vin: noVin ? '' : clean, odometer })}
                    disabled={!(valid || noVin)}
                    testID="vin-continue"
                />
            </ActionBar>

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
