import { useCallback, useEffect, useRef, useState } from 'react';
import Daily, {
  DailyCall, DailyEventObjectParticipant, DailyParticipant,
} from '@daily-co/react-native-daily-js';

export type CallState = 'idle' | 'joining' | 'joined' | 'error';

export interface UseDailyCall {
  callState: CallState;
  localParticipant: DailyParticipant | null;
  remoteParticipant: DailyParticipant | null;
  isAudioMuted: boolean;
  isCameraOff: boolean;
  errorMessage: string | null;
  join: (roomUrl: string, token: string) => Promise<void>;
  leave: () => Promise<void>;
  toggleAudio: () => void;
  toggleCamera: () => void;
  switchCamera: () => void;
}

export function useDailyCall(): UseDailyCall {
  const callRef = useRef<DailyCall | null>(null);
  const [callState, setCallState] = useState<CallState>('idle');
  const [localParticipant, setLocalParticipant] = useState<DailyParticipant | null>(null);
  const [remoteParticipant, setRemoteParticipant] = useState<DailyParticipant | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const syncParticipants = useCallback((call: DailyCall) => {
    const participants = call.participants();
    setLocalParticipant(participants.local ?? null);
    const remote = Object.values(participants).find((p) => !p.local) ?? null;
    setRemoteParticipant(remote);
    setIsAudioMuted(!call.localAudio());
    setIsCameraOff(!call.localVideo());
  }, []);

  const join = useCallback(async (roomUrl: string, token: string) => {
    if (callRef.current) return;
    const call = Daily.createCallObject();
    callRef.current = call;
    setCallState('joining');

    const onUpdate = (_e?: DailyEventObjectParticipant) => syncParticipants(call);
    call.on('joined-meeting', () => { setCallState('joined'); syncParticipants(call); });
    call.on('participant-joined', onUpdate);
    call.on('participant-updated', onUpdate);
    call.on('participant-left', () => setRemoteParticipant(null));
    call.on('error', (e: any) => { setErrorMessage(e?.errorMsg ?? 'Call error'); setCallState('error'); });

    try {
      await call.join({ url: roomUrl, token });
    } catch (err: any) {
      setErrorMessage(err?.message ?? 'Failed to join call');
      setCallState('error');
    }
  }, [syncParticipants]);

  const teardown = useCallback(async (call: DailyCall) => {
    // Remove all listeners we registered, swallow any per-listener errors.
    try {
      (call as any).off('joined-meeting');
      (call as any).off('participant-joined');
      (call as any).off('participant-updated');
      (call as any).off('participant-left');
      (call as any).off('error');
    } catch { /* SDK may be mid-teardown */ }
    try { await call.leave(); } catch { /* already gone is fine */ }
    try { await call.destroy(); } catch { /* idempotent */ }
  }, []);

  const leave = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;
    callRef.current = null;
    await teardown(call);
    setCallState('idle');
  }, [teardown]);

  const toggleAudio = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    const enabled = call.localAudio();
    call.setLocalAudio(!enabled);
    setIsAudioMuted(enabled); // muted = previously enabled (now off)
  }, []);

  const toggleCamera = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    const enabled = call.localVideo();
    call.setLocalVideo(!enabled);
    setIsCameraOff(enabled); // off = previously enabled (now off)
  }, []);

  const switchCamera = useCallback(() => {
    callRef.current?.cycleCamera();
  }, []);

  useEffect(() => {
    return () => {
      const call = callRef.current;
      if (!call) return;
      callRef.current = null;
      // Fire-and-forget on unmount; swallow rejections.
      teardown(call).catch(() => {});
    };
  }, [teardown]);

  return {
    callState, localParticipant, remoteParticipant, isAudioMuted, isCameraOff, errorMessage,
    join, leave, toggleAudio, toggleCamera, switchCamera,
  };
}
