import { useCallback, useEffect, useRef, useState } from 'react';
import Daily, {
  DailyCall, DailyEventObjectParticipant, DailyParticipant,
} from '@daily-co/react-native-daily-js';
import { type CallMessage, parseCallMessage } from '@/lib/video/callMessages';

export type CallState = 'idle' | 'joining' | 'joined' | 'error';

/** Daily's reading of this phone's connection; only `warning` and `bad` are worth telling the user. */
export type NetworkState = 'good' | 'warning' | 'bad' | 'unknown';

export interface UseDailyCall {
  callState: CallState;
  localParticipant: DailyParticipant | null;
  remoteParticipant: DailyParticipant | null;
  isAudioMuted: boolean;
  isCameraOff: boolean;
  errorMessage: string | null;
  networkState: NetworkState;
  /** Sends a message to the other person (drawing, chat). */
  sendMessage: (message: CallMessage) => void;
  /** Listens to the other person's messages; returns the way to stop. */
  onMessage: (listener: (message: CallMessage) => void) => () => void;
  /** Live captions: the last line said, and whether the transcription is running. */
  transcribing: boolean;
  caption: { id: string; text: string; mine: boolean } | null;
  startCaptions: (language?: string) => boolean;
  stopCaptions: () => void;
  captionsError: boolean;
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
  const [networkState, setNetworkState] = useState<NetworkState>('unknown');
  const listeners = useRef(new Set<(message: CallMessage) => void>());
  const [transcribing, setTranscribing] = useState(false);
  const [caption, setCaption] = useState<{ id: string; text: string; mine: boolean } | null>(null);
  const [captionsError, setCaptionsError] = useState(false);

  const syncParticipants = useCallback((call: DailyCall) => {
    const participants = call.participants();
    setLocalParticipant(participants.local ?? null);
    const remote = Object.values(participants).find((p) => !p.local) ?? null;
    setRemoteParticipant(remote);
    setIsAudioMuted(!call.localAudio());
    setIsCameraOff(!call.localVideo());
  }, []);

  const teardown = useCallback(async (call: DailyCall) => {
    // Remove all listeners we registered, swallow any per-listener errors.
    try {
      (call as any).off('joined-meeting');
      (call as any).off('participant-joined');
      (call as any).off('participant-updated');
      (call as any).off('participant-left');
      (call as any).off('network-quality-change');
      (call as any).off('app-message');
      (call as any).off('transcription-started');
      (call as any).off('transcription-stopped');
      (call as any).off('transcription-message');
      (call as any).off('transcription-error');
      (call as any).off('error');
    } catch { /* SDK may be mid-teardown */ }
    try { await call.leave(); } catch { /* already gone is fine */ }
    try { await call.destroy(); } catch { /* idempotent */ }
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
    call.on('app-message', (e: { data?: unknown }) => {
      const message = parseCallMessage(e?.data);
      if (message) listeners.current.forEach((fn) => fn(message));
    });
    call.on('transcription-started', () => { setTranscribing(true); setCaptionsError(false); });
    call.on('transcription-stopped', () => { setTranscribing(false); setCaption(null); });
    call.on('transcription-error', () => { setTranscribing(false); setCaptionsError(true); });
    call.on('transcription-message', (e: { participantId?: string; text?: string; timestamp?: Date | string }) => {
      const text = (e?.text ?? '').trim();
      if (!text) return;
      const local = call.participants().local?.session_id;
      setCaption({ id: `${e?.participantId ?? ''}:${String(e?.timestamp ?? Date.now())}`, text, mine: e?.participantId === local });
    });
    call.on('network-quality-change', (e: { networkState?: NetworkState }) => setNetworkState(e?.networkState ?? 'unknown'));
    call.on('error', (e: any) => {
      setErrorMessage(e?.errorMsg ?? 'Call error');
      setCallState('error');
      // Clear the ref so a subsequent join() (e.g. a "Retry" button) isn't
      // blocked by the guard above — without this the call object from the
      // failed attempt stays wedged in callRef forever.
      callRef.current = null;
      teardown(call).catch(() => {});
    });

    try {
      await call.join({ url: roomUrl, token });
    } catch (err: any) {
      setErrorMessage(err?.message ?? 'Failed to join call');
      setCallState('error');
      callRef.current = null;
      teardown(call).catch(() => {});
    }
  }, [syncParticipants, teardown]);

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

  const sendMessage = useCallback((message: CallMessage) => {
    try { callRef.current?.sendAppMessage(message, '*'); } catch { /* the call is closing */ }
  }, []);

  const onMessage = useCallback((listener: (message: CallMessage) => void) => {
    listeners.current.add(listener);
    return () => { listeners.current.delete(listener); };
  }, []);

  // Daily transcribes the whole room once started, so it is the first one to ask who starts it.
  // False when there is no call to start it on (the screen says captions are not available).
  const startCaptions = useCallback((language?: string) => {
    const call = callRef.current;
    if (!call) return false;
    setCaptionsError(false);
    try { call.startTranscription(language ? { language } : undefined); return true; } catch { setCaptionsError(true); return false; }
  }, []);

  const stopCaptions = useCallback(() => {
    try { callRef.current?.stopTranscription(); } catch { /* already stopped */ }
    setTranscribing(false);
    setCaption(null);
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
    callState, localParticipant, remoteParticipant, isAudioMuted, isCameraOff, errorMessage, networkState,
    sendMessage, onMessage, transcribing, caption, startCaptions, stopCaptions, captionsError,
    join, leave, toggleAudio, toggleCamera, switchCamera,
  };
}
