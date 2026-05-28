import { Ionicons } from '@expo/vector-icons';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MediaStream } from '@daily-co/react-native-webrtc';
import { CallControls } from '@/components/video/CallControls';
import { VideoTile } from '@/components/video/VideoTile';
import { useDailyCall } from '@/lib/video/useDailyCall';

export default function VideoCallScreen() {
  const { roomUrl, token } = useGlobalSearchParams();
  const router = useRouter();
  const urlStr = Array.isArray(roomUrl) ? roomUrl[0] : roomUrl || '';
  const tokenStr = Array.isArray(token) ? token[0] : token || '';

  const {
    callState, localParticipant, remoteParticipant, isAudioMuted, isCameraOff, errorMessage,
    join, leave, toggleAudio, toggleCamera, switchCamera,
  } = useDailyCall();

  const [timeLeft, setTimeLeft] = useState<number>(5 * 60);

  useEffect(() => {
    if (urlStr) join(urlStr, tokenStr);
  }, [urlStr, tokenStr, join]);

  useEffect(() => {
    const start = Date.now();
    const duration = 5 * 60 * 1000;
    const interval = setInterval(() => {
      const remaining = Math.max(0, duration - (Date.now() - start));
      setTimeLeft(Math.ceil(remaining / 1000));
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleHangUp = async () => {
    await leave();
    router.back();
  };

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
          <Ionicons name="warning" size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorSubtitle}>{errorMessage || 'The video room is not available.'}</Text>
          <TouchableOpacity style={styles.goBackButton} onPress={() => router.back()}>
            <Text style={styles.goBackText}>Go Back</Text>
          </TouchableOpacity>
          {urlStr ? (
            <TouchableOpacity style={styles.retryButton} onPress={() => join(urlStr, tokenStr)}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.timerBar}>
        <View style={styles.timerLeft}>
          <View style={[styles.liveDot, timeLeft <= 0 && styles.liveDotExpired]} />
          <Text style={styles.timerLabel}>{timeLeft <= 0 ? 'Room Expired' : 'Live'}</Text>
        </View>
        {timeLeft > 0 && (
          <Text style={[styles.timerText, timeLeft <= 60 && styles.timerTextWarning]}>{formatTime(timeLeft)}</Text>
        )}
      </View>

      <View style={styles.stage}>
        {callState !== 'joined' && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0047AB" />
            <Text style={styles.loadingText}>Connecting…</Text>
          </View>
        )}
        {remoteParticipant ? (
          <VideoTile
            stream={remoteStream}
            name={remoteParticipant.user_name || 'Participant'}
            isCameraOff={remoteParticipant.tracks?.video?.state !== 'playable'}
            isLocal={false}
          />
        ) : (
          <View style={styles.center}>
            <Text style={styles.waitingText}>Waiting for the other participant…</Text>
          </View>
        )}
        <View style={styles.pip}>
          <VideoTile stream={localStream} name="You" isCameraOff={isCameraOff} isLocal />
        </View>
      </View>

      <CallControls
        isAudioMuted={isAudioMuted}
        isCameraOff={isCameraOff}
        onToggleAudio={toggleAudio}
        onToggleCamera={toggleCamera}
        onSwitchCamera={switchCamera}
        onHangUp={handleHangUp}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  timerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingBottom: 10,
    backgroundColor: '#1F2937',
  },
  timerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E' },
  liveDotExpired: { backgroundColor: '#EF4444' },
  timerLabel: { fontFamily: 'Outfit_700Bold', fontSize: 14, color: '#FFFFFF' },
  timerText: { fontFamily: 'Outfit_700Bold', fontSize: 16, color: '#FFFFFF' },
  timerTextWarning: { color: '#EF4444' },
  stage: { flex: 1, position: 'relative' },
  pip: {
    position: 'absolute', top: 16, right: 16, width: 100, height: 150,
    borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#374151',
  },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  loadingText: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: '#9CA3AF', marginTop: 12 },
  waitingText: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: '#9CA3AF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  errorTitle: { fontFamily: 'Outfit_700Bold', fontSize: 20, color: '#FFFFFF', marginTop: 16 },
  errorSubtitle: { fontFamily: 'Outfit_400Regular', fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 8 },
  goBackButton: { marginTop: 24, backgroundColor: '#374151', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  goBackText: { fontFamily: 'Outfit_700Bold', fontSize: 14, color: '#FFFFFF' },
  retryButton: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: '#60A5FA' },
});
