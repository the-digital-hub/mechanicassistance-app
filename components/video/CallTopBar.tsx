import { FONT } from '@/lib/ui/fonts';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';
import { PulseDot } from '@/components/appointments/MechanicArrivalCard';
import { timerTone } from '@/components/appointments/VideoCallTimerCard';
import { formatElapsed } from '@/hooks/useElapsedSeconds';

export const VC = {
  navy: '#0F1729',
  navy2: '#1A2438',
  blue: '#1E56E3',
  cyan: '#5CD6F2',
  green: '#22C55E',
  orange: '#F59E0B',
  red: '#EF4444',
};

const K = 'appointments.videoCall.live';

export type CallStatus = 'live' | 'timeUp' | 'expired';

interface CallTopBarProps {
  /** Seconds left in the session; counts down only once the other person joined. */
  remaining: number;
  /** Session length, to colour the last minutes. */
  limit: number;
  status: CallStatus;
  topInset: number;
  /** Sideways screen: a thinner bar, to leave the height to the picture. */
  compact?: boolean;
}

/** "Live" · isologo + wordmark · session countdown. */
export function CallTopBar({ remaining, limit, status, topInset, compact = false }: CallTopBarProps) {
  const { t } = useTranslation();
  const tone = timerTone(limit - remaining, limit);
  const timerColor = tone === 'over' ? VC.red : tone === 'warn' ? VC.orange : '#FFFFFF';
  const label = status === 'live' ? t(`${K}.live`) : status === 'timeUp' ? t(`${K}.timeUp`) : t(`${K}.roomExpired`);

  return (
    <View style={[styles.bar, { paddingTop: topInset + (compact ? 4 : 8) }, compact && { paddingBottom: 6 }]}>
      <View style={styles.left}>
        <PulseDot color={status === 'live' ? VC.green : VC.red} size={9} />
        <Text testID="call-status" style={styles.label} numberOfLines={1}>{label}</Text>
      </View>
      <View style={styles.brand}>
        <View style={styles.logoCircle}>
          <Image
            source={require('@/assets/images/mechanic_assistance_isologo.png')}
            style={styles.logo}
            accessibilityLabel="Mechanic Assistance"
          />
        </View>
        <Text style={styles.wordmark} numberOfLines={1}>
          MECHANIC <Text style={{ color: VC.cyan }}>ASSISTANCE</Text>
        </Text>
      </View>
      <View style={styles.right}>
        <Text testID="call-remaining" style={[styles.timer, { color: timerColor }]}>{formatElapsed(remaining)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingBottom: 12, backgroundColor: VC.navy,
  },
  left: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  label: { fontFamily: FONT.bold, fontSize: 14, color: '#FFFFFF', flexShrink: 1 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoCircle: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  logo: { width: 24, height: 24 },
  wordmark: { fontFamily: FONT.bold, fontSize: 12, letterSpacing: 0.63, color: '#FFFFFF' },
  right: { flex: 1, alignItems: 'flex-end' },
  timer: { fontFamily: FONT.bold, fontSize: 17, fontVariant: ['tabular-nums'] },
});
