import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { CheckInCode, onSiteDAO } from '@/lib/dao/OnSiteDAO';

/**
 * The customer's check-in code: a QR the mechanic scans on arrival, and the
 * same PIN in digits as a fallback. Shown while the appointment is accepted
 * and the mechanic has not checked in yet; renders nothing otherwise.
 */
export function CheckInCodeCard({ appointmentId, status }: { appointmentId: string; status?: string }) {
    const { t } = useTranslation();
    const [code, setCode] = React.useState<CheckInCode | null>(null);
    const [state, setState] = React.useState<'loading' | 'ready' | 'error' | 'hidden'>('loading');

    const visible = status === 'accepted';

    React.useEffect(() => {
        if (!visible) {
            setState('hidden');
            return;
        }
        let cancelled = false;
        setState('loading');
        onSiteDAO
            .getCheckinCode(appointmentId)
            .then((c) => {
                if (cancelled) return;
                setCode(c);
                setState('ready');
            })
            // 409 = the mechanic already checked in; anything else is a real failure.
            .catch((e: { statusCode?: number }) => !cancelled && setState(e?.statusCode === 409 ? 'hidden' : 'error'));
        return () => {
            cancelled = true;
        };
    }, [appointmentId, visible]);

    if (state === 'hidden') return null;

    return (
        <View
            className="bg-white"
            style={{
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingTop: 18,
                paddingBottom: 20,
                borderWidth: 1,
                borderColor: '#EEF2FA',
                shadowColor: '#0E2F8A',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.06,
                shadowRadius: 14,
                elevation: 3,
            }}
            testID="check-in-code-card"
        >
            <View className="flex-row items-center" style={{ gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#EAF1FF', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="qr-code-outline" size={18} color="#1E56E3" />
                </View>
                <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#0B1530', letterSpacing: -0.3 }}>{t('appointments.customerCheckIn.title')}</Text>
            </View>
            <Text className="font-outfit-regular" style={{ fontSize: 12.5, color: '#6B7490', lineHeight: 18, marginTop: 8 }}>
                {t('appointments.customerCheckIn.subtitle')}
            </Text>

            {state === 'loading' ? (
                <View style={{ height: 200, justifyContent: 'center' }}>
                    <ActivityIndicator color="#1E56E3" />
                </View>
            ) : state === 'error' || !code ? (
                <Text className="font-outfit-medium text-xs mt-4" style={{ color: '#E53E3E' }}>{t('appointments.customerCheckIn.unavailable')}</Text>
            ) : (
                <View className="items-center">
                    <View style={{ marginTop: 16, padding: 12, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4EAF5' }}>
                        <QRCode value={code.qrPayload} size={184} color="#0B1530" backgroundColor="#FFFFFF" />
                    </View>
                    <Text className="font-outfit-bold" style={{ marginTop: 14, fontSize: 11, letterSpacing: 1.4, color: '#8C96AE' }}>{t('appointments.customerCheckIn.pin')}</Text>
                    <View className="flex-row" style={{ gap: 8, marginTop: 6 }} testID="check-in-pin-value" accessibilityLabel={code.pin}>
                        {code.pin.split('').map((digit, i) => (
                            <View key={i} style={{ width: 46, height: 54, borderRadius: 12, backgroundColor: '#F4F8FF', borderWidth: 1, borderColor: '#EAF1FF', alignItems: 'center', justifyContent: 'center' }}>
                                <Text className="font-outfit-bold" style={{ fontSize: 26, color: '#0B1530' }}>{digit}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}
        </View>
    );
}
