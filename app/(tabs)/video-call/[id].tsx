import { Ionicons } from '@expo/vector-icons';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MediaStream } from '@daily-co/react-native-webrtc';
import { CallControls } from '@/components/video/CallControls';
import { CallTopBar, VC, type CallStatus } from '@/components/video/CallTopBar';
import { VideoTile } from '@/components/video/VideoTile';
import { ExtendCallSheet } from '@/components/video/ExtendCallSheet';
import { useUser } from '@/context/UserContext';
import { useDailyCall } from '@/lib/video/useDailyCall';
import { goBackOr } from '@/lib/navigation/goBackOr';
import { videoCallDAO } from '@/lib/dao/VideoCallDAO';
import { contractedSeconds, graceSecondsOf } from '@/lib/video/callLength';
import { useElapsedSeconds } from '@/hooks/useElapsedSeconds';
import { useVideoCallState } from '@/hooks/useVideoCallState';

const K = 'appointments.videoCall.live';

export default function VideoCallScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id, roomUrl, token, expiry } = useGlobalSearchParams();
  const router = useRouter();
  const appointmentId = Array.isArray(id) ? id[0] : id || '';
  const appointmentHref = { pathname: '/appointments/[id]' as const, params: { id: appointmentId } };
  const urlStr = Array.isArray(roomUrl) ? roomUrl[0] : roomUrl || '';
  const tokenStr = Array.isArray(token) ? token[0] : token || '';
  const { user } = useUser();
  // Only the vehicle owner buys extra time; the mechanic's timer follows it.
  const isOwner = user?.role === 'user';
  const [extendOpen, setExtendOpen] = useState(false);
  // How long the call may run (base + extensions) and when the room closes,
  // refreshed when either side extends it (video_call_update "extended").
  const { state: callTime, reload: reloadCallTime } = useVideoCallState(appointmentId || undefined, !!appointmentId);
  const limitSeconds = contractedSeconds(callTime);
  const expiryTs = callTime?.roomExpiryUnixSec ?? Number(Array.isArray(expiry) ? expiry[0] : expiry || 0);

  const {
    callState, localParticipant, remoteParticipant, isAudioMuted, isCameraOff, errorMessage,
    join, leave, toggleAudio, toggleCamera, switchCamera,
  } = useDailyCall();

  const calcTimeLeft = (ts: number) =>
    ts > 0 ? Math.max(0, ts - Math.floor(Date.now() / 1000)) : 5 * 60;

  const [timeLeft, setTimeLeft] = useState<number>(() => calcTimeLeft(expiryTs));

  useEffect(() => {
    if (urlStr) join(urlStr, tokenStr);
  }, [urlStr, tokenStr, join]);

  useEffect(() => {
    const interval = setInterval(() => setTimeLeft(calcTimeLeft(expiryTs)), 1000);
    return () => clearInterval(interval);
  }, [expiryTs]);

  // The session starts when the other participant first shows up. Both phones
  // report it; the server keeps the first time, and answers with how long ago
  // that was, so both sides count the same elapsed time.
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const startReported = useRef(false);
  const hasRemote = remoteParticipant !== null;

  useEffect(() => {
    if (callState !== 'joined' || !hasRemote || startReported.current || !appointmentId) return;
    startReported.current = true;
    const fallbackStart = Date.now();
    videoCallDAO
      .markStarted(appointmentId)
      .then((state) => setStartedAtMs(state.startedAtLocalMs ?? fallbackStart))
      .catch((err) => {
        console.warn('[VideoCall] markStarted failed:', (err as Error).message);
        setStartedAtMs(fallbackStart);
      });
  }, [callState, hasRemote, appointmentId]);

  const elapsed = useElapsedSeconds(startedAtMs);
  // Counts down the session once the other person is in; a full session until then.
  const remaining = startedAtMs === null ? limitSeconds : Math.max(0, limitSeconds - elapsed);
  const status: CallStatus = timeLeft <= 0 ? 'expired' : remaining === 0 ? 'timeUp' : 'live';

  const handleHangUp = async () => {
    await leave();
    // Back to the appointment, not to the lobby (rejoining from there is one tap
    // away on the detail) and not to whatever tab happened to be underneath.
    router.navigate(appointmentHref, { withAnchor: true });
  };

  // The server ends the call when the grace after the time is up runs out; this
  // phone leaves at the same moment instead of waiting for the room to eject it.
  // An extension bought meanwhile raises limitSeconds and cancels this.
  const autoLeft = useRef(false);
  const graceOver = startedAtMs !== null && elapsed >= limitSeconds + graceSecondsOf(callTime);
  useEffect(() => {
    if (!graceOver || autoLeft.current) return;
    autoLeft.current = true;
    void handleHangUp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graceOver]);

  const buildStream = (p: typeof localParticipant) => {
    const track = p?.tracks?.video?.persistentTrack;
    const state = p?.tracks?.video?.state;
    return track && state === 'playable' ? new MediaStream([track as unknown as never]) : null;
  };
  const localStream = buildStream(localParticipant);
  const remoteStream = buildStream(remoteParticipant);

  if (!urlStr || callState === 'error') {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="warning" size={64} color={VC.red} />
          <Text style={styles.errorTitle}>{t(`${K}.connectionError`)}</Text>
          <Text style={styles.errorSubtitle}>{errorMessage || t(`${K}.roomUnavailable`)}</Text>
          <TouchableOpacity style={styles.goBackButton} onPress={() => goBackOr(router, appointmentHref)}>
            <Text style={styles.goBackText}>{t(`${K}.goBack`)}</Text>
          </TouchableOpacity>
          {urlStr ? (
            <TouchableOpacity style={styles.retryButton} onPress={() => join(urlStr, tokenStr)}>
              <Text style={styles.retryText}>{t(`${K}.retry`)}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CallTopBar remaining={remaining} limit={limitSeconds} status={status} topInset={insets.top} />
      {isOwner && (
        <ExtendCallSheet
          visible={extendOpen}
          appointmentId={appointmentId}
          onClose={() => setExtendOpen(false)}
          onExtended={() => reloadCallTime()}
        />
      )}

      <LinearGradient colors={[VC.navy2, '#2A3550']} style={styles.stage}>
        {callState !== 'joined' && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={VC.cyan} />
            <Text style={styles.loadingText}>{t(`${K}.connecting`)}</Text>
          </View>
        )}
        {remoteParticipant ? (
          <VideoTile
            stream={remoteStream}
            name={remoteParticipant.user_name || t(`${K}.participant`)}
            isCameraOff={remoteParticipant.tracks?.video?.state !== 'playable'}
            isLocal={false}
          />
        ) : (
          <View style={styles.center}>
            <Text style={styles.waitingText}>{t(`${K}.waiting`)}</Text>
          </View>
        )}
        {isOwner && callState === 'joined' && (
          <TouchableOpacity
            style={styles.addTime}
            onPress={() => setExtendOpen(true)}
            activeOpacity={0.85}
            testID="call-add-time"
            accessibilityRole="button"
          >
            <Ionicons name="time-outline" size={16} color="#FFFFFF" />
            <Text style={styles.addTimeText}>{t(`${K}.addTime`)}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.pip}>
          <View style={styles.pipInner}>
            <VideoTile stream={localStream} name={t(`${K}.you`)} isCameraOff={isCameraOff} isLocal />
          </View>
        </View>
      </LinearGradient>

      <CallControls
        isAudioMuted={isAudioMuted}
        isCameraOff={isCameraOff}
        onToggleAudio={toggleAudio}
        onToggleCamera={toggleCamera}
        onSwitchCamera={switchCamera}
        onHangUp={handleHangUp}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VC.navy },
  stage: { flex: 1, position: 'relative' },
  // Outer view carries the shadow, inner one clips the video to the radius.
  pip: {
    position: 'absolute', top: 14, right: 14, width: 104, height: 144, borderRadius: 16, zIndex: 3,
    shadowColor: '#000000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  pipInner: {
    flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: VC.navy2,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
  },
  addTime: {
    position: 'absolute', top: 14, left: 14, zIndex: 3, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, backgroundColor: 'rgba(30,86,227,0.9)',
  },
  addTimeText: { fontFamily: 'Outfit_700Bold', fontSize: 13, color: '#FFFFFF' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: VC.navy, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  loadingText: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 12 },
  waitingText: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  errorTitle: { fontFamily: 'Outfit_700Bold', fontSize: 20, color: '#FFFFFF', marginTop: 16 },
  errorSubtitle: { fontFamily: 'Outfit_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 8 },
  goBackButton: { marginTop: 24, backgroundColor: VC.blue, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  goBackText: { fontFamily: 'Outfit_700Bold', fontSize: 14, color: '#FFFFFF' },
  retryButton: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: VC.cyan },
});
