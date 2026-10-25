"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { Captions, Mic, MicOff, Volume2, Loader2 } from "lucide-react";
import type { PublicRoom } from "@/lib/types";
import {
  browserRecognition,
  BrowserSpeechRecognitionProvider,
} from "@/lib/speech-recognition";
import { routeMention } from "@/lib/mention-router";
import { getMind } from "@/lib/minds";
import type { PlaybackCaption } from "@/lib/captions";
import { LiveCaptions } from "./live-captions";

export type VoiceMindCallbacks = {
  onTranscript: (text: string) => Promise<void>;
  onVoiceEnabled: () => void;
  onTestSpeaker: () => Promise<void>;
  onHumanActivity: (speaking: boolean) => void;
};
export function VoiceMinds({
  room,
  onTranscript,
  onVoiceEnabled,
  onTestSpeaker,
  onHumanActivity,
  playbackCaption = null,
}: {
  room: PublicRoom;
  playbackCaption?: PlaybackCaption | null;
} & VoiceMindCallbacks) {
  const { localParticipant, isMicrophoneEnabled, microphoneTrack } =
    useLocalParticipant();
  const inputTrack = microphoneTrack?.track?.mediaStreamTrack;
  const [enabled, setEnabled] = useState(false);
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState("off");
  const [error, setError] = useState("");
  const [heard, setHeard] = useState("");
  const [heardFinal, setHeardFinal] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const captionsId = useId();
  const [feedback, setFeedback] = useState("");
  const [testing, setTesting] = useState(false);
  const provider = useRef<BrowserSpeechRecognitionProvider | null>(null);
  const submit = useRef(Promise.resolve());
  const roomRef = useRef(room);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  const aiSpeaking = room.active?.state === "AI_SPEAKING";
  const handleTranscript = useCallback(
    (text: string, final: boolean) => {
      setHeard(text);
      setHeardFinal(final);
      if (!final) return;
      const current = roomRef.current;
      const invocation = routeMention(
        text,
        current.minds.filter((id) => !current.muted.includes(id)),
      );
      const addressed = routeMention(text);
      setFeedback(
        invocation.explicitInvocation
          ? "Request sent to the addressed Mind."
          : addressed.explicitInvocation
            ? "The addressed Mind is not invited or is muted. Invite or unmute it in the Minds panel."
            : "Shared with the group. Minds stay quiet until addressed.",
      );
      // Serialize speech uploads so room context follows the speaker's actual order.
      submit.current = submit.current
        .then(() => onTranscript(text))
        .catch((error) => {
          setError(
            error instanceof Error
              ? error.message
              : "Could not share the transcript.",
          );
        });
    },
    [onTranscript],
  );
  useEffect(() => {
    if (
      !enabled ||
      !isMicrophoneEnabled ||
      !inputTrack ||
      aiSpeaking ||
      testing
    )
      return;
    const Constructor = browserRecognition();
    if (!Constructor) return;
    const recognition = new BrowserSpeechRecognitionProvider(
      Constructor,
      {
        onTranscript: handleTranscript,
        onStatus: setStatus,
        onSpeech: onHumanActivity,
        onError: (message) => {
          setError(message);
          setEnabled(false);
          onHumanActivity(false);
        },
      },
      inputTrack,
    );
    provider.current = recognition;
    recognition.start();
    return () => {
      recognition.stop();
      provider.current = null;
      onHumanActivity(false);
    };
  }, [
    enabled,
    isMicrophoneEnabled,
    aiSpeaking,
    testing,
    handleTranscript,
    onHumanActivity,
    inputTrack,
  ]);
  async function toggle() {
    if (enabled) {
      provider.current?.stop();
      setEnabled(false);
      setStatus("off");
      onHumanActivity(false);
      return;
    }
    if (!browserRecognition()) {
      setError(
        "This browser does not support live speech recognition. Try Chrome or Safari, or @mention a Mind in chat.",
      );
      return;
    }
    setStarting(true);
    setError("");
    setHeard("");
    setFeedback("");
    try {
      await localParticipant.setMicrophoneEnabled(true);
      onVoiceEnabled();
      setEnabled(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Allow microphone access to enable Voice Minds.",
      );
    } finally {
      setStarting(false);
    }
  }
  const label = !enabled
    ? "Voice input off"
    : !isMicrophoneEnabled
      ? "Microphone muted · voice paused"
      : aiSpeaking || testing
        ? "Speaker active · recognition paused to prevent echo"
        : status === "listening"
          ? "Listening for your speech"
          : "Connecting to browser speech service…";
  const exampleMind =
    getMind(room.minds.find((id) => !room.muted.includes(id)) ?? "socrates")
      ?.displayName ?? "Socrates";
  return (
    <section
      className={`voice-minds ${enabled ? "enabled" : ""}`}
      aria-label="Voice Minds controls"
    >
      <div className="voice-minds-heading">
        <div>
          <strong>
            <span
              className={
                enabled &&
                isMicrophoneEnabled &&
                !aiSpeaking &&
                !testing &&
                status === "listening"
                  ? "privacy-dot"
                  : "voice-off-dot"
              }
            />
            {label}
          </strong>
          <p>
            {room.minds.filter((id) => !room.muted.includes(id)).length ? (
              enabled ? (
                <>
                  Say <b>“{exampleMind}, speak”</b> or{" "}
                  <b>“{exampleMind}, what do you think?”</b>
                </>
              ) : (
                "Click a Mind’s Speak button, or enable voice input to address it aloud."
              )
            ) : (
              "Invite and unmute a Mind in the Minds panel before addressing it."
            )}
          </p>
        </div>
        <div className="voice-minds-buttons">
          <button
            className={`icon-button ${showCaptions ? "captions-on" : ""}`}
            aria-label={
              showCaptions ? "Hide live captions" : "Show live captions"
            }
            aria-controls={captionsId}
            aria-pressed={showCaptions}
            title="Live captions"
            onClick={() => setShowCaptions(!showCaptions)}
          >
            <Captions size={17} />
          </button>
          <button
            className="button secondary"
            disabled={starting}
            onClick={toggle}
            aria-label={enabled ? "Disable Voice Minds" : "Enable Voice Minds"}
          >
            {starting ? (
              <Loader2 size={14} className="spin" />
            ) : enabled ? (
              <Mic size={14} />
            ) : (
              <MicOff size={14} />
            )}{" "}
            {enabled ? "Voice Minds on" : "Enable Voice Minds"}
          </button>
          <button
            className="icon-button"
            disabled={testing || Boolean(room.active)}
            title="Test speaker"
            aria-label="Test speaker"
            onClick={async () => {
              setTesting(true);
              setError("");
              try {
                await onTestSpeaker();
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Speech playback failed.",
                );
              } finally {
                setTesting(false);
              }
            }}
          >
            <Volume2 size={16} />
          </button>
        </div>
      </div>
      <p className="voice-disclosure">
        Voice input shares final transcripts with this room. Your browser may
        process audio through its speech service. Headphones help prevent echo.
        {room.config.ai === "scripted demo" &&
          " Replies are scripted demo samples until an AI key is configured."}
      </p>
      {showCaptions && (
        <LiveCaptions
          id={captionsId}
          room={room}
          localId={localParticipant.identity}
          localName={localParticipant.name || "You"}
          draft={heard}
          draftFinal={heardFinal}
          listening={
            enabled &&
            isMicrophoneEnabled &&
            status === "listening" &&
            !aiSpeaking &&
            !testing
          }
          playback={playbackCaption}
        />
      )}
      {feedback && (
        <p className="caption-feedback" aria-live="polite">
          {feedback}
        </p>
      )}
      {error && (
        <p className="voice-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
