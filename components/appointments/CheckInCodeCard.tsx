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
            className="bg-white items-center px-5 py-5"
            style={{
                borderRadius: 20,
                borderWidth: 1,
                borderColor: '#EEF2FA',
                shadowColor: '#1E56E3',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.15,
                shadowRadius: 16,
                elevation: 5,
            }}
            testID="check-in-code-card"
        >
            <View className="flex-row items-center gap-2 self-start">
                <Ionicons name="qr-code-outline" size={16} color="#1E56E3" />
                <Text className="font-outfit-bold text-[15px]" style={{ color: '#0B1530' }}>{t('appointments.customerCheckIn.title')}</Text>
            </View>
            <Text className="font-outfit-regular text-xs mt-1 self-start" style={{ color: '#6B7490' }}>
                {t('appointments.customerCheckIn.subtitle')}
            </Text>

            {state === 'loading' ? (
                <View style={{ height: 200, justifyContent: 'center' }}>
                    <ActivityIndicator color="#1E56E3" />
                </View>
            ) : state === 'error' || !code ? (
                <Text className="font-outfit-medium text-xs mt-4" style={{ color: '#E53E3E' }}>{t('appointments.customerCheckIn.unavailable')}</Text>
            ) : (
                <>
                    <View className="mt-4 p-3 rounded-2xl" style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4EAF5' }}>
                        <QRCode value={code.qrPayload} size={180} color="#0B1530" backgroundColor="#FFFFFF" />
                    </View>
                    <Text className="font-outfit-medium text-[11px] uppercase mt-4" style={{ color: '#8C96AE' }}>{t('appointments.customerCheckIn.pin')}</Text>
                    <Text className="font-outfit-bold mt-1" style={{ color: '#0B1530', fontSize: 34, letterSpacing: 12 }} testID="check-in-pin-value">
                        {code.pin}
                    </Text>
                </>
            )}
        </View>
    );
}
