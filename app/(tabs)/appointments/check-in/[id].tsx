import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

// On-site check-in: the mechanic verifies the vehicle by scanning the owner's QR
// or typing their 4-digit PIN. UI only for now — nothing is validated against the
// backend yet and the camera is simulated (no scanner dependency in the app).

const C = {
    blue: '#1E56E3',
    blueSoft: '#EAF1FF',
    blueSofter: '#F4F8FF',
    blueDark: '#0B2A8E',
    blueIce: '#DCE7FA',
    text: '#0B1530',
    muted: '#6B7490',
    mutedLight: '#8C96AE',
    border: '#E4EAF5',
    borderSoft: '#EEF2FA',
    page: '#F6F8FC',
    orange: '#F08A1C',
    orangeSoft: '#FEF1E2',
};

const cardStyle = {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.borderSoft,
    shadowColor: '#0E2F8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
} as const;

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.85}
            className="items-center py-3.5 mt-3.5"
            style={{ borderRadius: 14, backgroundColor: disabled ? C.blueIce : C.blue }}
        >
            <Text className="text-white font-outfit-bold text-sm">{label}</Text>
        </TouchableOpacity>
    );
}

type Mode = 'qr' | 'pin';

export default function CheckInScreen() {
    const router = useRouter();
    const { t } = useTranslation();

    const [mode, setMode] = React.useState<Mode>('qr');
    const [cameraOpen, setCameraOpen] = React.useState(false);
    const [scanning, setScanning] = React.useState(false);
    const [pin, setPin] = React.useState('');
    const [mismatch, setMismatch] = React.useState(false);
    const scanTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(() => () => {
        if (scanTimer.current) clearTimeout(scanTimer.current);
    }, []);

    // Next steps of the on-site flow are not built yet: a match returns to the appointment.
    const onMatch = () => router.back();

    const scan = () => {
        setScanning(true);
        scanTimer.current = setTimeout(() => {
            setScanning(false);
            onMatch();
        }, 1400);
    };

    const Header = (
        <View className="flex-row items-center gap-3 px-4 pt-3 pb-1">
            <TouchableOpacity
                onPress={() => (mismatch ? setMismatch(false) : router.back())}
                className="items-center justify-center bg-white"
                style={{ width: 38, height: 38, borderRadius: 19, shadowColor: '#0E2F8A', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 }}
                testID="check-in-back"
            >
                <Ionicons name="chevron-back" size={18} color="#111111" />
            </TouchableOpacity>
            <Text className="font-outfit-bold text-base" style={{ color: C.text }}>
                {mismatch ? t('appointments.checkIn.mismatchTitle') : t('appointments.checkIn.title')}
            </Text>
        </View>
    );

    if (mismatch) {
        return (
            <View className="flex-1" style={{ backgroundColor: C.page }}>
                {Header}
                <View className="flex-1 items-center justify-center px-7">
                    <View className="items-center justify-center mb-4" style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.orangeSoft }}>
                        <Ionicons name="alert-circle-outline" size={28} color={C.orange} />
                    </View>
                    <Text className="font-outfit-bold text-[19px] text-center" style={{ color: C.text }}>
                        {t('appointments.checkIn.mismatchTitle')}
                    </Text>
                    <Text className="font-outfit-regular text-[13.5px] text-center mt-2 leading-5" style={{ color: C.muted }}>
                        {t('appointments.checkIn.mismatchBody')}
                    </Text>
                </View>
                <View className="px-4 pb-8">
                    <TouchableOpacity
                        onPress={() => setMismatch(false)}
                        activeOpacity={0.85}
                        className="items-center py-3.5"
                        style={{ borderRadius: 14, backgroundColor: C.orange }}
                        testID="check-in-retry"
                    >
                        <Text className="text-white font-outfit-bold text-sm">{t('appointments.checkIn.retry')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const tabButton = (id: Mode, label: string, icon: React.ComponentProps<typeof Ionicons>['name']) => {
        const active = mode === id;
        return (
            <TouchableOpacity
                key={id}
                onPress={() => setMode(id)}
                className="flex-1 flex-row items-center justify-center gap-1.5 py-3"
                style={{
                    borderRadius: 12,
                    backgroundColor: active ? '#FFFFFF' : 'transparent',
                    shadowColor: '#0E2F8A',
                    shadowOpacity: active ? 0.1 : 0,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: active ? 2 : 0,
                }}
                testID={`check-in-tab-${id}`}
            >
                <Ionicons name={icon} size={14} color={active ? C.blue : C.mutedLight} />
                <Text className="font-outfit-bold text-[13px]" style={{ color: active ? C.blue : C.mutedLight }}>
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View className="flex-1" style={{ backgroundColor: C.page }}>
            {Header}
            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
                <View className="px-5 pt-4 pb-1">
                    <View className="flex-row items-center gap-1.5 mb-3 px-2.5 py-1 rounded-full" style={{ backgroundColor: C.blueSoft, alignSelf: 'flex-start' }}>
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.blue }} />
                        <Text className="font-outfit-bold text-[10.5px] tracking-widest" style={{ color: C.blue }}>
                            {t('appointments.checkIn.step')}
                        </Text>
                    </View>
                    <Text className="font-outfit-bold text-2xl" style={{ color: C.text }}>
                        {t('appointments.checkIn.heading')}
                    </Text>
                    <Text className="font-outfit-regular text-[13.5px] mt-1.5 leading-5" style={{ color: C.muted }}>
                        {t('appointments.checkIn.subtitle')}
                    </Text>
                </View>

                {/* Scan QR / Enter PIN switch */}
                <View className="mx-4 mt-4 flex-row gap-1 p-1" style={{ borderRadius: 14, backgroundColor: C.borderSoft }}>
                    {tabButton('qr', t('appointments.checkIn.scanQr'), 'qr-code-outline')}
                    {tabButton('pin', t('appointments.checkIn.enterPin'), 'lock-closed-outline')}
                </View>

                {mode === 'qr' ? (
                    <View className="mx-4 mt-3.5 bg-white p-5" style={cardStyle}>
                        <View
                            className="items-center justify-center overflow-hidden"
                            style={{
                                height: 220,
                                borderRadius: 16,
                                backgroundColor: cameraOpen ? C.text : C.page,
                                borderWidth: cameraOpen ? 0 : 2,
                                borderStyle: 'dashed',
                                borderColor: C.border,
                            }}
                        >
                            {!cameraOpen ? (
                                <View className="items-center gap-3">
                                    <Ionicons name="scan-outline" size={40} color={C.mutedLight} />
                                    <Text className="font-outfit-bold text-xs" style={{ color: C.mutedLight }}>
                                        {t('appointments.checkIn.cameraOff')}
                                    </Text>
                                </View>
                            ) : scanning ? (
                                <ActivityIndicator size="large" color="#FFFFFF" />
                            ) : (
                                <>
                                    <View
                                        style={{ position: 'absolute', top: 24, right: 24, bottom: 24, left: 24, borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)', borderRadius: 18 }}
                                    />
                                    <Ionicons name="scan-outline" size={60} color="rgba(255,255,255,0.7)" />
                                </>
                            )}
                        </View>
                        <PrimaryButton
                            label={scanning ? t('appointments.checkIn.scanning') : cameraOpen ? t('appointments.checkIn.scanQr') : t('appointments.checkIn.openCamera')}
                            onPress={cameraOpen ? scan : () => setCameraOpen(true)}
                            disabled={scanning}
                        />
                    </View>
                ) : (
                    <View className="mx-4 mt-3.5 bg-white p-6" style={cardStyle}>
                        <TextInput
                            value={pin}
                            onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
                            keyboardType="number-pad"
                            maxLength={4}
                            placeholder="••••"
                            placeholderTextColor={C.mutedLight}
                            className="font-outfit-bold text-center"
                            style={{
                                fontSize: 32,
                                letterSpacing: 14,
                                color: C.text,
                                borderWidth: 1.5,
                                borderColor: C.border,
                                borderRadius: 14,
                                paddingVertical: 14,
                                backgroundColor: C.page,
                            }}
                            testID="check-in-pin"
                        />
                        <PrimaryButton
                            label={t('appointments.checkIn.verifyPin')}
                            onPress={onMatch}
                            disabled={pin.length !== 4}
                        />
                    </View>
                )}

                <View className="mx-4 mt-3.5 flex-row items-start gap-2 px-3 py-2.5 rounded-xl" style={{ backgroundColor: C.blueSofter }}>
                    <Ionicons name="information-circle-outline" size={15} color={C.blueDark} style={{ marginTop: 1 }} />
                    <Text className="flex-1 font-outfit-medium text-xs leading-4" style={{ color: C.blueDark }}>
                        {t('appointments.checkIn.secureTip')}
                    </Text>
                </View>

                <TouchableOpacity onPress={() => setMismatch(true)} className="items-center mt-3.5" testID="check-in-mismatch">
                    <Text className="font-outfit-bold text-xs underline" style={{ color: C.mutedLight }}>
                        {t('appointments.checkIn.mismatchLink')}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
