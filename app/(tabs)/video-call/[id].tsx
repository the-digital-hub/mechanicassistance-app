import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MediaStream } from '@daily-co/react-native-webrtc';
import { CallChatSheet } from '@/components/video/CallChatSheet';
import { CallControls } from '@/components/video/CallControls';
import { CaptionsBar } from '@/components/video/CaptionsBar';
import { DraggablePip, PIP_SIZES, type PipCorner, pipSize } from '@/components/video/DraggablePip';
import { DrawOverlay } from '@/components/video/DrawOverlay';
import { lockLandscape, lockPortrait } from '@/lib/orientation';
import { appAlert } from '@/lib/ui/appAlert';
import { type ChatLine, type Stroke, applyDraw } from '@/lib/video/callMessages';
import { CallTopBar, VC, type CallStatus } from '@/components/video/CallTopBar';
import { VideoTile } from '@/components/video/VideoTile';
import { ExtendCallSheet } from '@/components/video/ExtendCallSheet';
import { CallTimeAddedToast } from '@/components/video/CallTimeAddedToast';
import { ExtensionRequestPanel } from '@/components/video/ExtensionRequestPanel';
import { CallTimeWarningBanner } from '@/components/video/CallTimeWarningBanner';
import { WARN_BEFORE_SECONDS } from '@/components/appointments/VideoCallTimerCard';
import { ObdCallSheet } from '@/components/video/ObdCallSheet';
import { useRequestObd } from '@/components/video/RequestObdPanel';
import { useUser } from '@/context/UserContext';
import { useDailyCall } from '@/lib/video/useDailyCall';
import { goBackOr } from '@/lib/navigation/goBackOr';
import { videoCallDAO } from '@/lib/dao/VideoCallDAO';
import { contractedSeconds } from '@/lib/video/callLength';
import { useElapsedSeconds } from '@/hooks/useElapsedSeconds';
import { useVideoCallState } from '@/hooks/useVideoCallState';

const K = 'appointments.videoCall.live';
/** How long the "less than 5 minutes" banner stays up. */
const WARN_BANNER_MS = 8000;

export default function VideoCallScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id, roomUrl, token, expiry } = useLocalSearchParams();
  const router = useRouter();
  const appointmentId = Array.isArray(id) ? id[0] : id || '';
  const appointmentHref = { pathname: '/appointments/[id]' as const, params: { id: appointmentId } };
  const urlStr = Array.isArray(roomUrl) ? roomUrl[0] : roomUrl || '';
  const tokenStr = Array.isArray(token) ? token[0] : token || '';
  const { user } = useUser();
  // Only the vehicle owner buys extra time; the mechanic's timer follows it.
  const isOwner = user?.role === 'user';
  const [extendOpen, setExtendOpen] = useState(false);
  // Tap the small picture to see yourself big (and the other person small), and back.
  const [swapped, setSwapped] = useState(false);
  // The small picture can be dragged to another corner and made bigger or smaller.
  const [pipCorner, setPipCorner] = useState<PipCorner>('tr');
  const [pipSizeIndex, setPipSizeIndex] = useState(1);
  const [stageSize, setStageSize] = useState({ w: 360, h: 560 });
  const { width: winW, height: winH } = useWindowDimensions();
  const landscape = winW > winH;
  const [turned, setTurned] = useState(false);
  // The technician's markings on the owner's camera, the chat, and the captions.
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drawMode, setDrawMode] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLines, setChatLines] = useState<ChatLine[]>([]);
  const [unread, setUnread] = useState(0);
  const chatOpenRef = useRef(false);
  chatOpenRef.current = chatOpen;
  const iStartedCaptions = useRef(false);
  // Bumped after the owner asks for extra time, so the "waiting for the technician" panel loads it.
  const [extensionSent, setExtensionSent] = useState(0);
  // The owner's OBD scanner report (the appointment id is the request id).
  const obd = useRequestObd(appointmentId || undefined);
  const [obdOpen, setObdOpen] = useState(false);
  const obdHasCodes = (obd.report?.codeCount ?? 0) > 0;
  // The mechanic only gets the button when there is something to read; the
  // owner also uses it to send a report mid-call.
  const showObd = !!obd.report && (isOwner || obd.report.status !== 'none');
  // How long the call may run (base + extensions) and when the room closes,
  // refreshed when either side extends it (video_call_update "extended").
  const { state: callTime, reload: reloadCallTime } = useVideoCallState(appointmentId || undefined, !!appointmentId);
  const limitSeconds = contractedSeconds(callTime);
  const expiryTs = callTime?.roomExpiryUnixSec ?? Number(Array.isArray(expiry) ? expiry[0] : expiry || 0);

  const {
    callState, localParticipant, remoteParticipant, isAudioMuted, isCameraOff, errorMessage, networkState,
    sendMessage, onMessage, transcribing, caption, startCaptions, stopCaptions, captionsError,
    join, leave, toggleAudio, toggleCamera, switchCamera,
  } = useDailyCall();

  const calcTimeLeft = (ts: number) =>
    ts > 0 ? Math.max(0, ts - Math.floor(Date.now() / 1000)) : 5 * 60;

  const [timeLeft, setTimeLeft] = useState<number>(() => calcTimeLeft(expiryTs));

  useEffect(() => {
    if (urlStr) join(urlStr, tokenStr);
  }, [urlStr, tokenStr, join]);

  // What the other phone sends: markings, chat lines.
  useEffect(() => {
    if (!onMessage) return undefined;
    return onMessage((message) => {
      if (message.t === 'draw') {
        setStrokes((prev) => applyDraw(prev, message));
        // The owner's own camera has to be the big picture to see the technician's markings.
        if (isOwner) setSwapped(true);
      } else if (message.t === 'clear') {
        setStrokes([]);
      } else if (message.t === 'chat') {
        setChatLines((prev) => (prev.some((l) => l.id === message.id) ? prev : [...prev, { id: message.id, text: message.text, mine: false, at: Date.now() }]));
        if (!chatOpenRef.current) setUnread((n) => n + 1);
      }
    });
  }, [onMessage, isOwner]);

  const sendChat = (text: string) => {
    const id = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    sendMessage?.({ t: 'chat', id, text });
    setChatLines((prev) => [...prev, { id, text, mine: true, at: Date.now() }]);
  };
  const clearDrawing = () => {
    sendMessage?.({ t: 'clear' });
    setStrokes([]);
  };

  // Captions: whoever turns them on starts the transcription for the whole room, after agreeing it is
  // heard by both; the other phone is told when they begin.
  const toggleCaptions = () => {
    if (transcribing) {
      stopCaptions?.();
      return;
    }
    appAlert(t(`${K}.captionsConsentTitle`), t(`${K}.captionsConsentBody`), [
      { text: t(`${K}.captionsCancel`), style: 'cancel' },
      {
        text: t(`${K}.captionsStart`),
        onPress: () => {
          iStartedCaptions.current = true;
          if (!startCaptions?.()) appAlert(t(`${K}.captionsUnavailableTitle`), t(`${K}.captionsUnavailableBody`));
        },
      },
    ]);
  };
  useEffect(() => {
    if (!transcribing) {
      iStartedCaptions.current = false;
      return;
    }
    if (!iStartedCaptions.current) appAlert(t(`${K}.captionsOnTitle`), t(`${K}.captionsOnBody`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcribing]);
  useEffect(() => {
    if (captionsError) appAlert(t(`${K}.captionsUnavailableTitle`), t(`${K}.captionsUnavailableBody`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captionsError]);

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

  // "Less than 5 minutes left", shown once when the session enters its last
  // minutes and hidden after a few seconds. An extension pushes the time back
  // over the threshold, which re-arms it for the new last minutes.
  const [warnVisible, setWarnVisible] = useState(false);
  const warned = useRef(false);
  const inLastMinutes = startedAtMs !== null && remaining > 0 && remaining <= WARN_BEFORE_SECONDS;
  useEffect(() => {
    if (remaining > WARN_BEFORE_SECONDS) {
      warned.current = false;
      setWarnVisible(false);
    } else if (inLastMinutes && !warned.current) {
      warned.current = true;
      setWarnVisible(true);
    }
  }, [inLastMinutes, remaining]);
  useEffect(() => {
    if (!warnVisible) return;
    const timer = setTimeout(() => setWarnVisible(false), WARN_BANNER_MS);
    return () => clearTimeout(timer);
  }, [warnVisible]);

  // The camera can be held sideways: the call turns the screen, and always goes back upright.
  const toggleTurn = () => {
    if (turned) lockPortrait();
    else lockLandscape();
    setTurned((v) => !v);
  };
  useEffect(() => () => lockPortrait(), []);

  // The tool buttons sit under the small picture (a column), or beside it when the screen is sideways.
  const pip = pipSize(pipSizeIndex);
  const toolsPlacement = landscape
    ? { top: 14, right: pipCorner === 'tr' ? 14 + pip.w + 10 : 14, flexDirection: 'row' as const }
    : { top: pipCorner === 'tr' ? 14 + pip.h + 12 : 14, right: 14 };

  const handleHangUp = async () => {
    await leave();
    // Back to the appointment, not to the lobby (rejoining from there is one tap
    // away on the detail) and not to whatever tab happened to be underneath.
    router.navigate(appointmentHref, { withAnchor: true });
  };

  // The call ends when the timer reaches zero: the server finishes it and the
  // room ejects both sides at that moment, so this phone leaves right then.
  // Extra time has to be bought before zero; it raises limitSeconds.
  const autoLeft = useRef(false);
  const timeOver = startedAtMs !== null && elapsed >= limitSeconds;
  useEffect(() => {
    if (!timeOver || autoLeft.current) return;
    autoLeft.current = true;
    void handleHangUp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeOver]);

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
      {/* Just below the top bar: "the owner added N minutes". */}
      <CallTimeAddedToast appointmentId={appointmentId || undefined} variant="dark" top={insets.top + 64} />
      {/* Extra time asked by the owner, waiting for the technician's answer. */}
      {!!appointmentId && <ExtensionRequestPanel appointmentId={appointmentId} isOwner={isOwner} top={insets.top + 112} refreshKey={extensionSent} />}
      <CallTimeWarningBanner
        visible={warnVisible}
        isOwner={isOwner}
        top={insets.top + 64}
        onPress={() => {
          setWarnVisible(false);
          setExtendOpen(true);
        }}
        onDismiss={() => setWarnVisible(false)}
      />
      <CallChatSheet visible={chatOpen} lines={chatLines} onSend={sendChat} onClose={() => setChatOpen(false)} />
      <ObdCallSheet
        visible={obdOpen}
        requestId={appointmentId}
        role={isOwner ? 'owner' : 'mechanic'}
        state={obd}
        onClose={() => setObdOpen(false)}
      />
      {isOwner && (
        <ExtendCallSheet
          visible={extendOpen}
          appointmentId={appointmentId}
          onClose={() => setExtendOpen(false)}
          onExtended={() => {
            reloadCallTime();
            setExtensionSent((n) => n + 1);
          }}
        />
      )}

      <LinearGradient
        colors={[VC.navy2, '#2A3550']}
        style={styles.stage}
        onLayout={(e) => setStageSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {callState !== 'joined' && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={VC.cyan} />
            <Text style={styles.loadingText}>{t(`${K}.connecting`)}</Text>
          </View>
        )}
        {remoteParticipant ? (
          swapped ? (
            <VideoTile stream={localStream} name={t(`${K}.you`)} isCameraOff={isCameraOff} isLocal />
          ) : (
            <VideoTile
              stream={remoteStream}
              name={remoteParticipant.user_name || t(`${K}.participant`)}
              isCameraOff={remoteParticipant.tracks?.video?.state !== 'playable'}
              isLocal={false}
            />
          )
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
        {showObd && callState === 'joined' && (
          <TouchableOpacity
            style={[styles.obd, { top: isOwner ? 58 : 14 }]}
            onPress={() => setObdOpen(true)}
            activeOpacity={0.85}
            testID="call-obd"
            accessibilityRole="button"
          >
            <Ionicons name="speedometer-outline" size={16} color="#FFFFFF" />
            <Text style={styles.addTimeText}>
              {obdHasCodes ? t(`${K}.obdCodes`, { count: obd.report?.codeCount ?? 0 }) : t(`${K}.obd`)}
            </Text>
          </TouchableOpacity>
        )}
        {/* The owner's camera is the picture the markings belong to. */}
        {(() => {
          const ownerFeedBig = !!remoteParticipant && (isOwner ? swapped : !swapped);
          return ownerFeedBig && (strokes.length > 0 || (!isOwner && drawMode)) ? (
            <DrawOverlay
              strokes={strokes}
              editable={!isOwner && drawMode}
              onStroke={(id, pts, end) => sendMessage?.({ t: 'draw', id, pts, end })}
              onLocalStroke={(id, pts) => setStrokes((prev) => applyDraw(prev, { t: 'draw', id, pts }))}
            />
          ) : null;
        })()}
        {transcribing && <CaptionsBar caption={caption ?? null} />}
        {callState === 'joined' && (
          <View style={[styles.tools, toolsPlacement]} pointerEvents="box-none">
            <TouchableOpacity style={[styles.tool, turned && styles.toolOn]} onPress={toggleTurn} accessibilityRole="button" accessibilityLabel={t(`${K}.rotate`)} testID="call-rotate">
              <Ionicons name={turned ? 'phone-portrait-outline' : 'phone-landscape-outline'} size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.tool} onPress={() => { setChatOpen(true); setUnread(0); }} accessibilityRole="button" accessibilityLabel={t(`${K}.chat.title`)} testID="call-chat">
              <Ionicons name="chatbubble-ellipses-outline" size={20} color="#FFFFFF" />
              {unread > 0 && (
                <View style={styles.toolBadge}><Text style={styles.toolBadgeText}>{unread > 9 ? '9+' : unread}</Text></View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tool, transcribing && styles.toolOn]} onPress={toggleCaptions} accessibilityRole="button" accessibilityLabel={t(`${K}.captions`)} testID="call-captions">
              <Ionicons name="text-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            {!isOwner && (
              <TouchableOpacity style={[styles.tool, drawMode && styles.toolOn]} onPress={() => setDrawMode((v) => !v)} accessibilityRole="button" accessibilityLabel={t(`${K}.draw`)} testID="call-draw">
                <Ionicons name="brush-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            {!isOwner && strokes.length > 0 && (
              <TouchableOpacity style={styles.tool} onPress={clearDrawing} accessibilityRole="button" accessibilityLabel={t(`${K}.clearDrawing`)} testID="call-clear-draw">
                <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        )}
        {(networkState === 'warning' || networkState === 'bad') && callState === 'joined' && (
          <View style={[styles.network, networkState === 'bad' && styles.networkBad]} testID="call-network">
            <Ionicons name="cellular-outline" size={14} color="#FFFFFF" />
            <Text style={styles.addTimeText}>{t(networkState === 'bad' ? `${K}.networkBad` : `${K}.networkWeak`)}</Text>
          </View>
        )}
        <DraggablePip
          stage={stageSize}
          corner={pipCorner}
          sizeIndex={pipSizeIndex}
          onCornerChange={setPipCorner}
          onResize={() => setPipSizeIndex((i) => (i + 1) % PIP_SIZES.length)}
          onTap={() => remoteParticipant && setSwapped((v) => !v)}
          resizeLabel={t(`${K}.resizePip`)}
          swapLabel={t(`${K}.swapView`)}
        >
          {remoteParticipant && swapped ? (
            <VideoTile
              stream={remoteStream}
              name={remoteParticipant.user_name || t(`${K}.participant`)}
              isCameraOff={remoteParticipant.tracks?.video?.state !== 'playable'}
              isLocal={false}
            />
          ) : (
            <VideoTile stream={localStream} name={t(`${K}.you`)} isCameraOff={isCameraOff} isLocal />
          )}
        </DraggablePip>
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
  addTime: {
    position: 'absolute', top: 14, left: 14, zIndex: 3, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, backgroundColor: 'rgba(30,86,227,0.9)',
  },
  obd: {
    position: 'absolute', left: 14, zIndex: 3, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, backgroundColor: 'rgba(15,23,41,0.75)',
    borderWidth: 1, borderColor: 'rgba(92,214,242,0.6)',
  },
  tools: { position: 'absolute', zIndex: 3, gap: 10 },
  tool: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(15,23,41,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  toolOn: { backgroundColor: 'rgba(30,86,227,0.95)', borderColor: 'rgba(255,255,255,0.4)' },
  toolBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  toolBadgeText: { fontFamily: 'Outfit_700Bold', fontSize: 12, color: '#FFFFFF' },
  network: {
    position: 'absolute', alignSelf: 'center', top: 14, zIndex: 3, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, backgroundColor: 'rgba(194,106,10,0.92)',
  },
  networkBad: { backgroundColor: 'rgba(229,62,62,0.92)' },
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
