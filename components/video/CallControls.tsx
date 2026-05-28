import React from 'react';
import { StyleSheet, TouchableOpacity, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CallControlsProps {
  isAudioMuted: boolean;
  isCameraOff: boolean;
  onToggleAudio: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
  onHangUp: () => void;
}

export function CallControls({
  isAudioMuted, isCameraOff, onToggleAudio, onToggleCamera, onSwitchCamera, onHangUp,
}: CallControlsProps) {
  return (
    <View style={styles.bar}>
      <TouchableOpacity testID="ctrl-audio" style={styles.btn} onPress={onToggleAudio}>
        <Ionicons name={isAudioMuted ? 'mic-off' : 'mic'} size={24} color="#FFFFFF" />
      </TouchableOpacity>
      <TouchableOpacity testID="ctrl-camera" style={styles.btn} onPress={onToggleCamera}>
        <Ionicons name={isCameraOff ? 'videocam-off' : 'videocam'} size={24} color="#FFFFFF" />
      </TouchableOpacity>
      <TouchableOpacity testID="ctrl-switch" style={styles.btn} onPress={onSwitchCamera}>
        <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
      </TouchableOpacity>
      <TouchableOpacity testID="ctrl-hangup" style={[styles.btn, styles.hangup]} onPress={onHangUp}>
        <Ionicons name="call" size={24} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', justifyContent: 'center', gap: 20,
    backgroundColor: '#1F2937', paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  btn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#374151',
    alignItems: 'center', justifyContent: 'center',
  },
  hangup: { backgroundColor: '#EF4444' },
});
