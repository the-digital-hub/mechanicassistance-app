import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VC } from '@/components/video/CallTopBar';

interface CallControlsProps {
  isAudioMuted: boolean;
  isCameraOff: boolean;
  onToggleAudio: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
  onHangUp: () => void;
  /** Safe-area bottom inset, added under the buttons. */
  bottomInset?: number;
}

// A control that is switched off (mic muted, camera off) inverts to white with
// a navy icon, so its state reads at a glance.
const btnStyle = (on: boolean) => [styles.btn, !on && styles.btnOff];
const iconColor = (on: boolean) => (on ? '#FFFFFF' : VC.navy);

export function CallControls({
  isAudioMuted, isCameraOff, onToggleAudio, onToggleCamera, onSwitchCamera, onHangUp, bottomInset = 0,
}: CallControlsProps) {
  return (
    <View style={[styles.bar, { paddingBottom: 34 + bottomInset }]}>
      <TouchableOpacity testID="ctrl-audio" style={btnStyle(!isAudioMuted)} onPress={onToggleAudio}>
        <Ionicons name={isAudioMuted ? 'mic-off' : 'mic'} size={24} color={iconColor(!isAudioMuted)} />
      </TouchableOpacity>
      <TouchableOpacity testID="ctrl-camera" style={btnStyle(!isCameraOff)} onPress={onToggleCamera}>
        <Ionicons name={isCameraOff ? 'videocam-off' : 'videocam'} size={24} color={iconColor(!isCameraOff)} />
      </TouchableOpacity>
      <TouchableOpacity testID="ctrl-switch" style={btnStyle(true)} onPress={onSwitchCamera}>
        <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
      </TouchableOpacity>
      <TouchableOpacity testID="ctrl-hangup" style={[styles.btn, styles.hangup]} onPress={onHangUp}>
        <Ionicons name="call" size={26} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', justifyContent: 'center', gap: 16,
    backgroundColor: VC.navy, paddingTop: 20,
  },
  btn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  btnOff: { backgroundColor: '#FFFFFF' },
  hangup: {
    backgroundColor: VC.red,
    shadowColor: VC.red, shadowOpacity: 0.7, shadowRadius: 10, shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});
