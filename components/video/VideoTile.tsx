import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RTCView, MediaStream } from '@daily-co/react-native-webrtc';

interface VideoTileProps {
  stream: MediaStream | null;
  name: string;
  isCameraOff: boolean;
  isLocal: boolean;
  /** The local picture comes from the rear camera: it is shown as it is, not mirrored. */
  backCamera?: boolean;
}

export function VideoTile({ stream, name, isCameraOff, isLocal, backCamera = false }: VideoTileProps) {
  const showVideo = !isCameraOff && stream != null;
  const initial = name?.trim()?.charAt(0)?.toUpperCase() || '?';

  if (!showVideo) {
    return (
      <View style={[styles.tile, styles.placeholder]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.name}>{name}</Text>
      </View>
    );
  }

  return (
    <RTCView
      testID="rtc-view"
      streamURL={stream.toURL()}
      objectFit="cover"
      // Only the selfie camera is a mirror: with the rear one, moving the phone to one side moves the picture to the other.
      mirror={isLocal && !backCamera}
      style={styles.tile}
    />
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, backgroundColor: '#1A2438' },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Outfit_700Bold', fontSize: 32, color: '#FFFFFF' },
  name: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: '#9CA3AF' },
});
