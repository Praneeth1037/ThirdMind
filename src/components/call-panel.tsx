"use client";
import { useEffect } from "react";
import Image from "next/image";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  TrackToggle,
  DisconnectButton,
  useTracks,
  useSpeakingParticipants,
  useLocalParticipant,
  StartAudio,
  useConnectionState,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import {
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
  Plus,
  Volume2,
  VolumeX,
  Square,
} from "lucide-react";
import { getMind } from "@/lib/minds";
import type { PublicRoom, MindStatus } from "@/lib/types";
import { VoiceMinds, type VoiceMindCallbacks } from "./voice-minds";
import type { PlaybackCaption } from "@/lib/captions";
import { MindSpeakButton, type MindSpeechControls } from "./mind-speak-button";
import { getMindPortrait } from "@/lib/mind-portraits";
export function mindStatus(room: PublicRoom, id: string): MindStatus {
  if (room.muted.includes(id)) return "MUTED";
  if (room.active?.mindId === id)
    return room.active.state === "AI_GENERATING" ? "THINKING" : "SPEAKING";
  if (room.queue.some((j) => j.mindId === id)) return "REQUESTED";
  return "LISTENING";
}
function CallContents({
  room,
  onHumanActivity,
  onTranscript,
  onVoiceEnabled,
  onTestSpeaker,
  playbackCaption,
  onSpeakMind,
  pendingSpeech,
  onAddMind,
  readAloud,
  onToggleReadAloud,
  onStopAI,
}: {
  room: PublicRoom;
  playbackCaption?: PlaybackCaption | null;
  onAddMind: () => void;
  readAloud: boolean;
  onToggleReadAloud: () => void;
  onStopAI: () => void;
} & VoiceMindCallbacks &
  MindSpeechControls) {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ]);
  const speakers = useSpeakingParticipants();
  const connection = useConnectionState();
  const { isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const humanSpeaking = speakers.length > 0;
  useEffect(() => {
    if (!humanSpeaking) return;
    onHumanActivity(true);
    const timer = setInterval(() => onHumanActivity(true), 3000);
    return () => {
      clearInterval(timer);
      onHumanActivity(false);
    };
  }, [humanSpeaking, onHumanActivity]);
  return (
    <>
      <div className="call-status">
        <span className="privacy-dot" />
        {connection === ConnectionState.Connected
          ? "In the conversation"
          : connection === "reconnecting"
            ? "Reconnecting…"
            : "Connecting to the room…"}
        <button
          className="call-read-aloud"
          role="switch"
          aria-label="Read AI responses aloud"
          aria-checked={readAloud}
          onClick={onToggleReadAloud}
        >
          {readAloud ? <Volume2 size={14} /> : <VolumeX size={14} />} AI audio{" "}
          {readAloud ? "on" : "off"}
        </button>
        <button className="call-add-mind" onClick={onAddMind}>
          <Plus size={14} /> Add AI
        </button>
      </div>
      <VoiceMinds
        room={room}
        onTranscript={onTranscript}
        onVoiceEnabled={onVoiceEnabled}
        onTestSpeaker={onTestSpeaker}
        onHumanActivity={onHumanActivity}
        playbackCaption={playbackCaption}
      />
      <div className="call-grid">
        <GridLayout tracks={tracks} style={{ height: 220 }}>
          <ParticipantTile />
        </GridLayout>
        <div className="call-minds">
          {room.minds.map((id) => (
            <div
              className={`call-mind ${mindStatus(room, id).toLowerCase()}`}
              key={id}
            >
              <Image
                src={getMindPortrait(id)!.src}
                alt={`${getMind(id)?.displayName} AI portrait`}
                fill
                sizes="(max-width: 720px) 45vw, 350px"
                style={{
                  objectFit: "cover",
                  objectPosition: getMindPortrait(id)!.focus,
                }}
              />
              <div className="call-mind-info">
                <strong>{getMind(id)?.displayName}</strong>
                <small>
                  {mindStatus(room, id) === "LISTENING"
                    ? "Ready when you are"
                    : mindStatus(room, id) === "SPEAKING"
                      ? "Speaking"
                      : mindStatus(room, id) === "THINKING"
                        ? "Thinking…"
                        : mindStatus(room, id) === "MUTED"
                          ? "Muted"
                          : "Queued"}
                </small>
              </div>
              <MindSpeakButton
                mindId={id}
                status={mindStatus(room, id)}
                pending={pendingSpeech.includes(id)}
                onSpeak={onSpeakMind}
              />
            </div>
          ))}
        </div>
      </div>
      <RoomAudioRenderer />
      <StartAudio label="Enable room audio" />
      <div className="call-controls">
        <TrackToggle source={Track.Source.Microphone} showIcon={false}>
          {isMicrophoneEnabled ? <Mic size={17} /> : <MicOff size={17} />}
          <span>{isMicrophoneEnabled ? "Mute" : "Unmute"}</span>
        </TrackToggle>
        <TrackToggle source={Track.Source.Camera} showIcon={false}>
          {isCameraEnabled ? <Video size={17} /> : <VideoOff size={17} />}
          <span>{isCameraEnabled ? "Camera off" : "Camera on"}</span>
        </TrackToggle>
        <DisconnectButton>
          <PhoneOff size={17} /> Leave call
        </DisconnectButton>
        {(room.active || room.queue.length > 0) && (
          <button onClick={onStopAI} aria-label="Stop AI turn">
            <Square size={15} /> Stop AI
          </button>
        )}
      </div>
    </>
  );
}
export function CallPanel({
  connection,
  room,
  onLeave,
  onError,
  onHumanActivity,
  onTranscript,
  onVoiceEnabled,
  onTestSpeaker,
  playbackCaption,
  onSpeakMind,
  pendingSpeech,
  onAddMind,
  readAloud,
  onToggleReadAloud,
  onStopAI,
}: {
  connection: { token: string; url: string };
  room: PublicRoom;
  onLeave: () => void;
  onError: (message: string) => void;
  playbackCaption?: PlaybackCaption | null;
  onAddMind: () => void;
  readAloud: boolean;
  onToggleReadAloud: () => void;
  onStopAI: () => void;
} & VoiceMindCallbacks &
  MindSpeechControls) {
  return (
    <div className="call-panel">
      <LiveKitRoom
        className="call-layout"
        serverUrl={connection.url}
        token={connection.token}
        connect
        audio={false}
        video={false}
        onDisconnected={onLeave}
        onError={(error) => onError(`Call: ${error.message}`)}
      >
        <CallContents
          room={room}
          onHumanActivity={onHumanActivity}
          onTranscript={onTranscript}
          onVoiceEnabled={onVoiceEnabled}
          onTestSpeaker={onTestSpeaker}
          playbackCaption={playbackCaption}
          onSpeakMind={onSpeakMind}
          pendingSpeech={pendingSpeech}
          onAddMind={onAddMind}
          readAloud={readAloud}
          onToggleReadAloud={onToggleReadAloud}
          onStopAI={onStopAI}
        />
      </LiveKitRoom>
    </div>
  );
}
