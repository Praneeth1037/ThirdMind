"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Markdown from "react-markdown";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  CornerDownLeft,
  Headphones,
  Link as LinkIcon,
  Loader2,
  MessageCircle,
  Mic,
  Plus,
  ShieldCheck,
  Sparkles,
  Square,
  Users,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { MINDS, getMind } from "@/lib/minds";
import type { PublicRoom, Session } from "@/lib/types";
import {
  BrowserTTSProvider,
  MockAvatarProvider,
  type TTSProvider,
} from "@/lib/media-providers";
import type { PlaybackCaption } from "@/lib/captions";
import { Sidebar } from "./sidebar";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { HumanAvatar, MindAvatar } from "./avatar";
import { EntryDialog } from "./entry-dialog";
import { MindLibrary } from "./mind-library";
import { Modal } from "./modal";
import { CallPanel, mindStatus } from "./call-panel";
import { MindSpeakButton } from "./mind-speak-button";
import { CharacterTTSProvider } from "@/lib/character-tts-provider";
import { characterVoice, VOICE_PREVIEW } from "@/lib/character-voices";
import { getScenario } from "@/lib/scenarios";
import { getMindPortrait } from "@/lib/mind-portraits";
import { IcebreakerPanel } from "./icebreaker-panel";

function ActiveMindAvatar({
  id,
  status,
}: {
  id: string;
  status: ReturnType<typeof mindStatus>;
}) {
  const [state, setState] = useState(status);
  useEffect(() => {
    const provider = new MockAvatarProvider(setState);
    if (status === "THINKING") provider.start();
    else if (status === "SPEAKING") provider.speak();
    else provider.stop();
    return () => provider.destroy();
  }, [status]);
  return (
    <MindAvatar
      id={id}
      size={52}
      status={status === "MUTED" || status === "REQUESTED" ? status : state}
    />
  );
}
const subscribeSession = (notify: () => void) => {
  window.addEventListener("thirdmind:session", notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener("thirdmind:session", notify);
    window.removeEventListener("storage", notify);
  };
};
const serverSession = () => undefined;
export function RoomClient({
  id,
  invited = false,
  icebreakerInvite = false,
}: {
  id: string;
  invited?: boolean;
  icebreakerInvite?: boolean;
}) {
  const [inviteAccepted, setInviteAccepted] = useState(false);
  const [roomView, setRoomView] = useState<"call" | "chat">("chat");
  const chatScroll = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const serialized = useSyncExternalStore(
    subscribeSession,
    () => sessionStorage.getItem(`thirdmind:${id}`),
    serverSession,
  );
  const session = useMemo<Session | null | undefined>(() => {
    if (serialized === undefined) return undefined;
    try {
      return serialized ? JSON.parse(serialized) : null;
    } catch {
      return null;
    }
  }, [serialized]);
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [source, setSource] = useState<"text" | "voice">("text");
  const [sending, setSending] = useState(false);
  const [library, setLibrary] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [entry, setEntry] = useState(false);
  const [people, setPeople] = useState(false);
  const [help, setHelp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [call, setCall] = useState<{ token: string; url: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [voice, setVoice] = useState(false);
  const [pendingSpeech, setPendingSpeech] = useState<string[]>([]);
  const pendingSpeechRef = useRef(new Set<string>());
  const [playbackCaption, setPlaybackCaption] =
    useState<PlaybackCaption | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [online, setOnline] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const ticking = useRef(false);
  const speakingId = useRef<string | null>(null);
  const tts = useRef<BrowserTTSProvider | null>(null);
  const characterTTS = useRef<CharacterTTSProvider | null>(null);
  const speechContext = useRef<{
    session: Session | null;
    room: PublicRoom | null;
  }>({ session: null, room: null });
  const recorder = useRef<MediaRecorder | null>(null);
  const recordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordHeartbeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceRef = useRef(false);
  const mounted = useRef(true);
  const activityUpdates = useRef<Promise<void>>(Promise.resolve());
  const stopPlayback = useCallback(() => {
    tts.current?.stop();
    characterTTS.current?.stop();
  }, []);
  useEffect(() => {
    speechContext.current = { session: session ?? null, room };
  }, [session, room]);
  useEffect(() => {
    mounted.current = true;
    tts.current = new BrowserTTSProvider();
    characterTTS.current = new CharacterTTSProvider(
      async (mindId, messageId, signal) => {
        const current = speechContext.current.session;
        if (!current)
          throw new Error(
            "Please join the conversation before using voice playback.",
          );
        const response = await fetch(`/api/rooms/${id}/speech`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${current.token}`,
            "x-member-id": current.memberId,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            messageId ? { messageId } : { previewMindId: mindId },
          ),
          signal,
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(
            error.error ??
              "Natural voice playback is unavailable. Your reply remains in chat.",
          );
        }
        return response.blob();
      },
    );
    return () => {
      mounted.current = false;
      stopPlayback();
      if (recordTimer.current) clearTimeout(recordTimer.current);
      if (recordHeartbeat.current) clearInterval(recordHeartbeat.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
    };
  }, [id, stopPlayback]);
  const updateRoom = useCallback((next: PublicRoom) => {
    setNow(Date.now());
    setRoom((current) =>
      !current || next.revision >= current.revision ? next : current,
    );
  }, []);
  const request = useCallback(
    async (path = "", body?: unknown) => {
      if (!session) throw new Error("Please join the room first.");
      const response = await fetch(`/api/rooms/${id}${path}`, {
        method: body !== undefined ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "x-member-id": session.memberId,
          ...(body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
        },
        body:
          body === undefined
            ? undefined
            : body instanceof FormData
              ? body
              : JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Could not connect to the room.");
      return data;
    },
    [id, session],
  );
  const action = useCallback(
    async (body: unknown) => {
      const result = await request("", body);
      updateRoom(result);
      return result as PublicRoom;
    },
    [request, updateRoom],
  );
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await request();
        if (!cancelled) {
          updateRoom(next);
          setOnline(true);
        }
      } catch (e) {
        if (!cancelled) {
          setOnline(false);
          setError(e instanceof Error ? e.message : "Connection lost.");
        }
      }
    };
    void refresh();
    const poll = setInterval(refresh, 1200);
    const heartbeat = setInterval(() => {
      void action({ action: "heartbeat" }).catch(() => {});
    }, 20000);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(heartbeat);
    };
  }, [session, request, action, updateRoom]);
  useEffect(() => {
    const chat = chatScroll.current;
    if (chat) chat.scrollTop = chat.scrollHeight;
  }, [room?.messages.length, room?.active?.state, roomView]);
  useEffect(() => {
    if (!room || ticking.current || !session) return;
    const active = room.active;
    if (
      (!active && room.queue.length) ||
      (active && active.leaseUntil < Date.now())
    ) {
      ticking.current = true;
      const kickoff = setTimeout(() => {
        void action({ action: "tick" })
          .catch((e) => setError(e.message))
          .finally(() => {
            ticking.current = false;
          });
      }, 0);
      return () => {
        clearTimeout(kickoff);
        ticking.current = false;
      };
    }
  }, [room, session, action]);
  useEffect(() => {
    const active = room?.active;
    if (!active || active.state !== "AI_SPEAKING") {
      if (speakingId.current) {
        stopPlayback();
        speakingId.current = null;
      }
      return;
    }
    if (
      speakingId.current === active.id ||
      (active.ownerId !== session?.memberId && !call)
    )
      return;
    const message = room.messages.find((m) => m.id === active.messageId);
    if (!message) return;
    speakingId.current = active.id;
    const provider: TTSProvider | null =
      room.config.tts === "character" ? characterTTS.current : tts.current;
    const playback = voiceRef.current
      ? provider?.speak(
          message.content,
          active.mindId,
          (progress) => {
            if (mounted.current)
              setPlaybackCaption({ messageId: message.id, ...progress });
          },
          message.id,
        )
      : new Promise<void>((resolve) => setTimeout(resolve, 1100));
    void Promise.resolve(playback)
      .catch(async (error) => {
        if (!mounted.current || speakingId.current !== active.id) return;
        if (room.config.tts === "character" && tts.current) {
          setError(
            "Natural speech is temporarily unavailable. Using a device speaking voice for this reply.",
          );
          try {
            await tts.current.speak(
              message.content,
              active.mindId,
              (progress) => {
                if (mounted.current)
                  setPlaybackCaption({ messageId: message.id, ...progress });
              },
            );
            return;
          } catch (fallbackError) {
            error = fallbackError;
          }
        }
        setError(
          error instanceof Error
            ? error.message
            : "Speech playback failed. You can still read the response in chat.",
        );
      })
      .finally(() => {
        // Each listener acknowledges playback; the server holds the floor until
        // everyone has finished, even when devices use different voice speeds.
        if (mounted.current && speakingId.current === active.id)
          void action({ action: "finish", turnId: active.id }).catch(() => {});
      });
  }, [room, session, action, stopPlayback, call]);
  const humanActivity = useCallback(
    (speaking: boolean) => {
      if (speaking) {
        stopPlayback();
        speakingId.current = null;
      }
      activityUpdates.current = activityUpdates.current
        .then(async () => {
          await action({ action: "interrupt", speaking });
        })
        .catch(() => {});
    },
    [action, stopPlayback],
  );
  const voiceTranscript = useCallback(
    async (text: string) => {
      // Recognition finalization is an utterance boundary; queue after releasing this speaker's floor.
      const publish = activityUpdates.current.then(async () => {
        await action({ action: "interrupt", speaking: false });
        await action({
          action: "message",
          content: text,
          source: "voice",
          clientId: crypto.randomUUID(),
        });
      });
      activityUpdates.current = publish.catch(() => {});
      await publish;
    },
    [action],
  );
  const enableVoicePlayback = useCallback(() => {
    voiceRef.current = true;
    setVoice(true);
  }, []);
  const speakMind = (mindId: string) => {
    const mind = getMind(mindId);
    if (
      !room ||
      !mind ||
      !room.minds.includes(mindId) ||
      mindStatus(room, mindId) !== "LISTENING" ||
      pendingSpeechRef.current.has(mindId)
    )
      return;
    pendingSpeechRef.current.add(mindId);
    setPendingSpeech([...pendingSpeechRef.current]);
    enableVoicePlayback();
    setError("");
    void action({
      action: "message",
      content: `@${mind.displayName}, speak about our conversation.`,
      source: "text",
      clientId: crypto.randomUUID(),
    })
      .catch((error) => {
        if (mounted.current)
          setError(
            error instanceof Error
              ? error.message
              : "Could not ask this Mind to speak.",
          );
      })
      .finally(() => {
        pendingSpeechRef.current.delete(mindId);
        if (mounted.current) setPendingSpeech([...pendingSpeechRef.current]);
      });
  };
  const testSpeaker = useCallback(async () => {
    if (!tts.current)
      throw new Error(
        "Voice playback is not ready. Please refresh and try again.",
      );
    const current = speechContext.current.room;
    const mindId =
      current?.minds.find((id) => !current.muted.includes(id)) ?? "socrates";
    const provider =
      current?.config.tts === "character" ? characterTTS.current : tts.current;
    await provider?.speak(VOICE_PREVIEW, mindId);
  }, []);
  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    try {
      await action({
        action: "message",
        content: text,
        source,
        clientId: crypto.randomUUID(),
      });
      setDraft("");
      setSource("text");
      composer.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Message failed.");
    } finally {
      setSending(false);
    }
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/room/${id}?invite=1${room?.icebreaker ? "&icebreaker=1" : ""}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(
        `Copy this invite link: ${window.location.origin}/room/${id}?invite=1`,
      );
    }
  }
  async function startCall() {
    setConnecting(true);
    setError("");
    try {
      const connection = await request("/token", {});
      await action({ action: "call", joined: true });
      setCall(connection);
      setRoomView("call");
      enableVoicePlayback();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the call.");
    } finally {
      setConnecting(false);
    }
  }
  async function record() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    if (!room?.config.stt) {
      setError(
        "Voice transcription needs GROQ_API_KEY. Text mentions are ready to use.",
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(
        "This browser cannot record audio. Use text mentions or try a supported browser over HTTPS.",
      );
      return;
    }
    setError("");
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recording = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = recording;
      const chunks: BlobPart[] = [];
      recording.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recording.onstop = async () => {
        stream?.getTracks().forEach((track) => track.stop());
        if (recordTimer.current) clearTimeout(recordTimer.current);
        if (recordHeartbeat.current) clearInterval(recordHeartbeat.current);
        if (!mounted.current) return;
        setRecording(false);
        setTranscribing(true);
        humanActivity(false);
        try {
          const body = new FormData();
          const type = recording.mimeType || "audio/webm";
          body.append(
            "file",
            new Blob(chunks, { type }),
            type.includes("mp4") ? "voice.mp4" : "voice.webm",
          );
          const result = await request("/transcribe", body);
          if (mounted.current) {
            setDraft(result.text);
            setSource("voice");
            composer.current?.focus();
          }
        } catch (e) {
          if (mounted.current)
            setError(e instanceof Error ? e.message : "Transcription failed.");
        } finally {
          if (mounted.current) setTranscribing(false);
        }
      };
      recording.start();
      setRecording(true);
      humanActivity(true);
      recordHeartbeat.current = setInterval(() => humanActivity(true), 3000);
      recordTimer.current = setTimeout(() => {
        if (recording.state === "recording") recording.stop();
      }, 20000);
    } catch (e) {
      stream?.getTracks().forEach((track) => track.stop());
      setError(
        e instanceof Error
          ? e.message
          : "Microphone permission is needed to record.",
      );
    }
  }
  async function leave() {
    stopPlayback();
    try {
      await action({ action: "leave" });
    } catch {}
    sessionStorage.removeItem(`thirdmind:${id}`);
    router.push("/");
  }
  const suggest = draft.match(/@([a-z]*)$/i);
  const suggested =
    room && suggest
      ? MINDS.filter(
          (m) =>
            room.minds.includes(m.id) &&
            m.displayName.toLowerCase().startsWith(suggest[1].toLowerCase()),
        )
      : [];
  const activeMembers =
    room?.members.filter((m) => now - m.lastSeen < 60000) ?? [];
  if (session === undefined)
    return (
      <main className="empty-page">
        <Brand />
        <Loader2 className="spin" />
        <p>Finding your conversation…</p>
      </main>
    );
  if (!session || (invited && !inviteAccepted))
    return (
      <main className="empty-page join-page">
        <div className="join-navigation">
          <Brand />
          <ThemeToggle />
        </div>
        {session ? (
          <section className="join-card">
            <h1>Join this room.</h1>
            <p>
              Welcome back, {session.name}. Open the group chat, then join the
              call when you’re ready.
            </p>
            <button
              className="button primary full"
              onClick={() => {
                setInviteAccepted(true);
                router.replace(`/room/${id}`);
              }}
            >
              Join room <ArrowRight size={17} />
            </button>
          </section>
        ) : (
          <EntryDialog
            mode="join"
            roomId={id}
            icebreaker={icebreakerInvite}
            inline
            onClose={() => {
              setInviteAccepted(true);
              const value = sessionStorage.getItem(`thirdmind:${id}`);
              if (value) window.dispatchEvent(new Event("thirdmind:session"));
              else router.push("/");
            }}
          />
        )}
      </main>
    );
  if (!room)
    return (
      <main className="empty-page">
        <Brand />
        {error ? (
          <>
            <p className="error" role="alert">
              {error}
            </p>
            <button
              className="button secondary"
              onClick={() => router.push("/")}
            >
              Back to campus
            </button>
          </>
        ) : (
          <>
            <Loader2 className="spin" />
            <p>Opening the room…</p>
          </>
        )}
      </main>
    );
  const roomScenario = getScenario(room.scenario);
  const scenarioTitle = room.icebreaker
    ? "A small group conversation, with optional prompts when you want them."
    : (roomScenario?.tagline ?? "Your group. Your conversation.");
  const participantsInCall = activeMembers.filter(
    (member) => member.inCall,
  ).length;
  return (
    <div
      className={`app-shell room-shell ${call ? "room-in-call" : ""} ${room.scenario !== "blank" ? "has-scenario" : ""}`}
    >
      <Sidebar
        name={session.name}
        roomName={room.name}
        onCreate={() => setEntry(true)}
        onLibrary={() => setLibrary(true)}
      />
      <main className="room-main">
        <header className="page-topbar">
          <span>
            <Link href="/">Your spaces</Link>
            <ChevronRight size={12} />
            {room.name}
          </span>
          <button className="topbar-help" onClick={() => setHelp(true)}>
            <CircleHelp size={15} /> How it works
          </button>
        </header>
        <div className="room-heading">
          {roomScenario && !call && (
            <div className="room-scene-cover" aria-hidden="true">
              <Image
                src={roomScenario.image}
                alt=""
                fill
                sizes="(max-width: 720px) 100vw, 900px"
                style={{ objectFit: "cover" }}
              />
            </div>
          )}
          <div>
            <p className="eyebrow">
              <span className="privacy-dot" />
              {online ? "THE CONVERSATION IS YOURS" : "RECONNECTING"}
            </p>
            <h1>
              {room.name}
              <span className="room-title-dot">.</span>
            </h1>
            <p>{scenarioTitle}</p>
          </div>
          <div className="room-header-actions">
            <ThemeToggle />
            <button
              className="button secondary"
              aria-label={copied ? "Copied" : "Invite friends"}
              onClick={copyInvite}
            >
              {copied ? <Check size={16} /> : <LinkIcon size={16} />}
              <span>{copied ? "Copied" : "Invite friends"}</span>
            </button>
            <button
              className="button primary"
              aria-label={
                connecting
                  ? "Connecting"
                  : call
                    ? "In call"
                    : activeMembers.some(
                          (member) =>
                            member.inCall && member.id !== session.memberId,
                        )
                      ? "Join call"
                      : "Start call"
              }
              disabled={connecting || Boolean(call)}
              onClick={startCall}
            >
              {connecting ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Video size={17} />
              )}
              <span>
                {call
                  ? "In call"
                  : activeMembers.some(
                        (member) =>
                          member.inCall && member.id !== session.memberId,
                      )
                    ? "Join call"
                    : "Start call"}
              </span>
            </button>
          </div>
        </div>
        <div className="room-tabs">
          {call && (
            <button
              className={roomView === "call" ? "selected" : ""}
              onClick={() => setRoomView("call")}
              aria-pressed={roomView === "call"}
            >
              <Video size={16} /> Call &amp; transcript
            </button>
          )}
          <button
            className={!call || roomView === "chat" ? "selected" : ""}
            onClick={() => setRoomView("chat")}
            aria-pressed={!call || roomView === "chat"}
          >
            <MessageCircle size={16} /> Group chat
          </button>
          {call && (
            <button onClick={() => setMobilePanel(true)}>
              <Sparkles size={16} /> Minds
            </button>
          )}
          <button onClick={() => setPeople(true)}>
            <Users size={16} /> People <span>{activeMembers.length}</span>
          </button>
          <div className="room-tab-meta">
            <ShieldCheck size={13} /> Invite-only · expires in 24h
          </div>
        </div>
        {room.icebreaker && (
          <IcebreakerPanel
            room={room}
            session={session}
            participantsInCall={participantsInCall}
            onRoomUpdate={updateRoom}
          />
        )}
        {error && (
          <div className="room-error" role="alert">
            <span>{error}</span>
            <button
              className="icon-button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div
          className="conversation-workspace"
          data-view={call ? roomView : "chat"}
        >
          {call && (
            <CallPanel
              connection={call}
              room={room}
              onLeave={() => {
                stopPlayback();
                setCall(null);
                void action({ action: "call", joined: false }).catch(() => {});
                humanActivity(false);
              }}
              onError={setError}
              onHumanActivity={humanActivity}
              onTranscript={voiceTranscript}
              onVoiceEnabled={enableVoicePlayback}
              onTestSpeaker={testSpeaker}
              playbackCaption={playbackCaption}
              onSpeakMind={speakMind}
              pendingSpeech={pendingSpeech}
              onAddMind={() => setLibrary(true)}
              readAloud={voice}
              onToggleReadAloud={() => {
                voiceRef.current = !voice;
                setVoice(!voice);
                if (voice) stopPlayback();
              }}
              onStopAI={() => {
                stopPlayback();
                void action({ action: "stop" }).catch((error) =>
                  setError(error.message),
                );
              }}
            />
          )}
          <section className="conversation-chat" aria-label="Group chat">
            {call && (
              <div className="ongoing-call-note">
                <span className="privacy-dot" /> Your call is still connected.
                <button onClick={() => setRoomView("call")}>
                  Back to call <Video size={14} />
                </button>
              </div>
            )}
            <div className="chat-scroll" ref={chatScroll}>
              <div className="room-welcome">
                <div className="welcome-emblem">
                  <BookOpen size={23} />
                  <Sparkles size={13} />
                </div>
                <h2>This is where good ideas meet.</h2>
                <p>
                  Your people bring the conversation. Your Minds bring a
                  different angle.
                  <br />
                  They’ll listen quietly until you <span>@mention</span> them.
                </p>
                <div>
                  <span className="welcome-pill">
                    <ShieldCheck size={12} /> Human-led, always
                  </span>
                  <span className="welcome-pill">
                    <Headphones size={12} /> Listening, not interrupting
                  </span>
                </div>
              </div>
              <div className="date-divider">
                <span />
                {new Date(room.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                })}
                <span />
              </div>
              {room.messages.map((message, index) =>
                message.kind === "system" ? (
                  <div className="system-message" key={message.id}>
                    <CircleHelp size={14} />
                    {message.content}
                  </div>
                ) : (
                  <div
                    className={`chat-message ${message.kind === "ai" ? "ai-message" : ""}`}
                    key={message.id}
                  >
                    {message.kind === "ai" ? (
                      <MindAvatar id={message.senderId} size={37} />
                    ) : (
                      <HumanAvatar
                        name={message.senderName}
                        size={37}
                        index={index}
                      />
                    )}
                    <div className="message-body">
                      <div className="message-meta">
                        <strong>{message.senderName}</strong>
                        {message.kind === "ai" && (
                          <span className="ai-badge">AI PERSPECTIVE</span>
                        )}
                        <time dateTime={new Date(message.at).toISOString()}>
                          {new Date(message.at).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </time>
                        {message.demo && (
                          <span className="demo-message-label">
                            {message.kind === "ai"
                              ? "SCRIPTED DEMO"
                              : "SCENARIO EXAMPLE"}
                          </span>
                        )}
                        {message.source === "voice" && (
                          <span className="demo-message-label">
                            <Mic size={11} /> TRANSCRIBED
                          </span>
                        )}
                      </div>
                      {message.kind === "ai" ? (
                        <div className="ai-message-content">
                          <Markdown skipHtml>{message.content}</Markdown>
                        </div>
                      ) : (
                        <p>
                          {message.content
                            .split(
                              /(@[A-Za-z]+(?: Ethicist| Advocate| Engineer)?)/g,
                            )
                            .map((piece, i) =>
                              piece.startsWith("@") ? (
                                <mark key={i}>{piece}</mark>
                              ) : (
                                piece
                              ),
                            )}
                        </p>
                      )}
                      {message.senderId === "doctor" && (
                        <small className="medical-note">
                          Educational discussion only — not medical advice.
                        </small>
                      )}
                    </div>
                  </div>
                ),
              )}
              {room.active?.state === "AI_GENERATING" && (
                <div className="chat-message generating">
                  <MindAvatar
                    id={room.active.mindId}
                    size={37}
                    status="THINKING"
                  />
                  <div>
                    <strong>{getMind(room.active.mindId)?.displayName}</strong>
                    <span className="typing-dots">
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
            <div className="composer-area">
              <div className="chat-hints">
                {room.minds.length > 0 ? (
                  <>
                    <Sparkles size={14} />
                    <span>A new angle is one mention away.</span>
                    {room.minds.slice(0, 2).map((id) => (
                      <button
                        key={id}
                        onClick={() => {
                          setDraft(
                            `@${getMind(id)?.displayName} ${id === "socrates" ? "challenge that." : room.scenario === "study" ? "help us find a plan that fits everyone." : "what do you think?"}`,
                          );
                          composer.current?.focus();
                        }}
                      >
                        @{getMind(id)?.displayName}
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Invite a Mind for a fresh perspective.</span>
                    <button onClick={() => setLibrary(true)}>+ Add Mind</button>
                  </>
                )}
              </div>
              <div className={`composer ${recording ? "recording" : ""}`}>
                {suggested.length > 0 && (
                  <div className="mention-suggestions">
                    {suggested.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setDraft(
                            draft.replace(/@[a-z]*$/i, `@${m.displayName} `),
                          );
                          composer.current?.focus();
                        }}
                      >
                        <MindAvatar id={m.id} size={28} />
                        <strong>{m.displayName}</strong>
                        <span>{m.description}</span>
                      </button>
                    ))}
                  </div>
                )}
                {source === "voice" && (
                  <div className="transcript-review">
                    <Mic size={12} /> Review your transcript, then send to the
                    group.
                  </div>
                )}
                <textarea
                  ref={composer}
                  aria-label="Message the group"
                  rows={2}
                  placeholder={
                    recording
                      ? "Recording… click the stop button when you’re done."
                      : `Message your group, or @mention a Mind…`
                  }
                  value={draft}
                  maxLength={3000}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setSource("text");
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
                <div className="composer-toolbar">
                  <div>
                    <button
                      className="icon-button"
                      title={
                        recording ? "Stop recording" : "Record a voice message"
                      }
                      aria-label={
                        recording ? "Stop recording" : "Record voice message"
                      }
                      disabled={transcribing}
                      onClick={record}
                    >
                      {transcribing ? (
                        <Loader2 size={17} className="spin" />
                      ) : recording ? (
                        <Square size={16} />
                      ) : (
                        <Mic size={18} />
                      )}
                    </button>
                    <button
                      className="icon-button mention-button"
                      aria-label="Mention a Mind"
                      onClick={() => {
                        setDraft(draft + "@");
                        composer.current?.focus();
                      }}
                    >
                      @
                    </button>
                    <span className="composer-note">
                      {recording
                        ? "Recording · max 20s"
                        : transcribing
                          ? "Transcribing…"
                          : "A thought, a question, a different take."}
                    </span>
                  </div>
                  <div>
                    <span className="enter-hint">
                      <CornerDownLeft size={12} /> to send
                    </span>
                    <button
                      className="send-button"
                      aria-label="Send message"
                      disabled={!draft.trim() || sending || recording}
                      onClick={send}
                    >
                      {sending ? (
                        <Loader2 size={17} className="spin" />
                      ) : (
                        <ArrowRight size={20} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <div className="composer-footer">
                <span>
                  <span className="privacy-dot" />
                  {room.active
                    ? `${getMind(room.active.mindId)?.displayName} ${room.active.state === "AI_GENERATING" ? "is thinking" : "has the floor"}`
                    : `${room.minds.filter((id) => !room.muted.includes(id)).length} Minds listening. The floor is yours.`}
                </span>
                <span>
                  {room.config.ai === "scripted demo"
                    ? "Scripted demo · connect Groq for live AI"
                    : room.config.ai === "unconfigured"
                      ? "AI provider not configured"
                      : "AI perspectives"}
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>
      <aside className="room-minds-panel">
        <div className="minds-panel-title">
          <div>
            <span className="eyebrow">A LITTLE EXTRA PERSPECTIVE</span>
            <h2>
              In this conversation<span>{room.minds.length}</span>
            </h2>
          </div>
          <button
            className="icon-button"
            onClick={() => setLibrary(true)}
            aria-label="Add a Mind"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="human-presence">
          <div className="avatar-stack">
            {activeMembers.slice(0, 4).map((m, i) => (
              <HumanAvatar key={m.id} name={m.name} index={i} size={28} />
            ))}
          </div>
          <button onClick={() => setPeople(true)}>
            {activeMembers.length}{" "}
            {activeMembers.length === 1 ? "person" : "people"} here{" "}
            <ChevronDown size={13} />
          </button>
          <button
            className="icon-button"
            onClick={copyInvite}
            aria-label="Copy invite link"
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="panel-divider">
          <span>YOUR MINDS</span>
          <span>INVITED BY YOU</span>
        </div>
        <div className="room-mind-list">
          {room.minds.map((id) => {
            const mind = getMind(id)!;
            const status = mindStatus(room, id);
            return (
              <div
                className={`room-mind-card ${status.toLowerCase()}`}
                key={id}
                style={{ "--mind-color": mind.color } as CSSProperties}
              >
                <div className="room-mind-portrait">
                  <Image
                    src={getMindPortrait(id)!.src}
                    alt={`${mind.displayName} AI character`}
                    fill
                    sizes="300px"
                    style={{
                      objectFit: "cover",
                      objectPosition: getMindPortrait(id)!.focus,
                    }}
                  />
                </div>
                <div className="room-mind-top">
                  <ActiveMindAvatar id={id} status={status} />
                  <div>
                    <h3>{mind.displayName}</h3>
                    <span className={`status status-${status.toLowerCase()}`}>
                      <i />
                      {status === "LISTENING"
                        ? "Quietly listening"
                        : status === "THINKING"
                          ? "Thinking it through…"
                          : status === "SPEAKING"
                            ? "Has the floor"
                            : status === "REQUESTED"
                              ? "Waiting for a turn"
                              : "Muted"}
                    </span>
                  </div>
                  <button
                    className="icon-button mind-remove"
                    aria-label={`Remove ${mind.displayName}`}
                    title={`Remove ${mind.displayName}`}
                    onClick={() =>
                      void action({
                        action: "mind",
                        mindId: id,
                        operation: "remove",
                      }).catch((e) => setError(e.message))
                    }
                  >
                    <X size={14} />
                  </button>
                </div>
                <p>{mind.description}</p>
                {room.config.tts === "character" && (
                  <small className="character-voice-label">
                    {characterVoice(id)?.label}
                  </small>
                )}
                <div className="mind-card-actions">
                  <button
                    onClick={() => {
                      setDraft(`@${mind.displayName} `);
                      composer.current?.focus();
                    }}
                    disabled={status === "MUTED"}
                  >
                    Ask {mind.displayName} <ArrowUpRight size={13} />
                  </button>
                  <MindSpeakButton
                    mindId={id}
                    status={status}
                    pending={pendingSpeech.includes(id)}
                    onSpeak={speakMind}
                  />
                  <button
                    className="icon-button"
                    aria-label={`${status === "MUTED" ? "Unmute" : "Mute"} ${mind.displayName}`}
                    onClick={() =>
                      void action({
                        action: "mind",
                        mindId: id,
                        operation: status === "MUTED" ? "unmute" : "mute",
                      }).catch((e) => setError(e.message))
                    }
                  >
                    {status === "MUTED" ? (
                      <VolumeX size={14} />
                    ) : (
                      <Headphones size={14} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <button className="add-mind-button" onClick={() => setLibrary(true)}>
          <Plus size={17} /> Invite another Mind{" "}
          <span>{MINDS.length} to discover</span>
        </button>
        {room.minds.length >= 2 && (
          <button
            className="debate-button"
            onClick={() => {
              setDraft(
                `@${getMind(room.minds[0])?.displayName} and @${getMind(room.minds[1])?.displayName}, debate this for four turns.`,
              );
              composer.current?.focus();
            }}
          >
            <Sparkles size={14} />
            <div>
              Two minds. Different angles.
              <small>Ask for a four-turn exchange</small>
            </div>
            <ChevronRight size={15} />
          </button>
        )}
        {(room.active || room.queue.length > 0) && (
          <button
            className="button secondary full stop-button"
            onClick={() => {
              stopPlayback();
              void action({ action: "stop" }).catch((e) => setError(e.message));
            }}
          >
            <Square size={13} /> Stop AI turn
            {room.queue.length > 0 && ` · ${room.queue.length} queued`}
          </button>
        )}
        <div className="room-panel-bottom">
          <div className="voice-setting">
            <Volume2 size={16} />
            <div>
              Read responses aloud
              <small>
                {room.config.tts === "character"
                  ? "Natural character voices · AI generated"
                  : "Device voice · on this device"}
              </small>
            </div>
            <button
              role="switch"
              aria-checked={voice}
              aria-label="Read AI responses aloud"
              className={`toggle ${voice ? "on" : ""}`}
              onClick={() => {
                voiceRef.current = !voice;
                setVoice(!voice);
                if (voice) stopPlayback();
              }}
            >
              <span />
            </button>
          </div>
          <div className="room-quiet-note">
            <ShieldCheck size={16} />
            <p>
              <strong>Your conversation comes first.</strong>Minds speak only
              when invited. You can interrupt or remove them anytime.
            </p>
          </div>
          <button className="leave-room" onClick={leave}>
            <ArrowLeft size={14} /> Leave conversation
          </button>
        </div>
      </aside>
      <button className="mobile-minds" onClick={() => setMobilePanel(true)}>
        <Sparkles size={16} /> Minds <Plus size={14} />
      </button>
      {mobilePanel && (
        <Modal
          title="In this conversation."
          description="A fresh perspective, only when you ask."
          onClose={() => setMobilePanel(false)}
        >
          <div className="mobile-mind-list">
            {room.minds.map((id) => (
              <div className="mobile-mind-row" key={id}>
                <MindAvatar id={id} size={44} status={mindStatus(room, id)} />
                <div>
                  <strong>{getMind(id)?.displayName}</strong>
                  <small>{mindStatus(room, id)}</small>
                  {room.config.tts === "character" && (
                    <small className="character-voice-label">
                      {characterVoice(id)?.label}
                    </small>
                  )}
                  <button
                    onClick={() => {
                      setDraft(`@${getMind(id)?.displayName} `);
                      setMobilePanel(false);
                      composer.current?.focus();
                    }}
                  >
                    Ask this Mind <ArrowUpRight size={12} />
                  </button>
                  <MindSpeakButton
                    mindId={id}
                    status={mindStatus(room, id)}
                    pending={pendingSpeech.includes(id)}
                    onSpeak={speakMind}
                  />
                </div>
                <button
                  className="icon-button"
                  aria-label={`${room.muted.includes(id) ? "Unmute" : "Mute"} ${getMind(id)?.displayName}`}
                  onClick={() =>
                    void action({
                      action: "mind",
                      mindId: id,
                      operation: room.muted.includes(id) ? "unmute" : "mute",
                    }).catch((e) => setError(e.message))
                  }
                >
                  {room.muted.includes(id) ? (
                    <VolumeX size={16} />
                  ) : (
                    <Headphones size={16} />
                  )}
                </button>
                <button
                  className="icon-button"
                  aria-label={`Remove ${getMind(id)?.displayName}`}
                  onClick={() =>
                    void action({
                      action: "mind",
                      mindId: id,
                      operation: "remove",
                    }).catch((e) => setError(e.message))
                  }
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="button primary full"
            onClick={() => {
              setMobilePanel(false);
              setLibrary(true);
            }}
          >
            <Plus size={16} /> Discover Minds
          </button>
          {(room.active || room.queue.length > 0) && (
            <button
              className="button secondary full stop-button"
              onClick={() =>
                void action({ action: "stop" }).catch((e) =>
                  setError(e.message),
                )
              }
            >
              <Square size={13} /> Stop AI turn
            </button>
          )}
          <div className="voice-setting">
            <Volume2 size={16} />
            <div>
              Read responses aloud
              <small>
                {room.config.tts === "character"
                  ? "Natural character voices · AI generated"
                  : "On the device handling the turn"}
              </small>
            </div>
            <button
              role="switch"
              aria-checked={voice}
              aria-label="Read AI responses aloud"
              className={`toggle ${voice ? "on" : ""}`}
              onClick={() => {
                voiceRef.current = !voice;
                setVoice(!voice);
                if (voice) stopPlayback();
              }}
            >
              <span />
            </button>
          </div>
          <button className="leave-room" onClick={leave}>
            <ArrowLeft size={14} /> Leave conversation
          </button>
        </Modal>
      )}
      {library && (
        <MindLibrary
          added={room.minds}
          onClose={() => setLibrary(false)}
          onAdd={async (mindId) => {
            await action({ action: "mind", mindId, operation: "add" });
          }}
        />
      )}
      {entry && (
        <EntryDialog scenario="blank" onClose={() => setEntry(false)} />
      )}
      {people && (
        <Modal
          title="The people in this conversation."
          description="Share your room link to bring your friends into the discussion."
          onClose={() => setPeople(false)}
        >
          <div className="people-list">
            {room.members.map((member, i) => (
              <div key={member.id}>
                <HumanAvatar name={member.name} index={i} />
                <strong>
                  {member.name}
                  {member.id === session.memberId ? " (you)" : ""}
                </strong>
                <span>
                  {now - member.lastSeen < 60000 ? "Here now" : "Away"}
                </span>
              </div>
            ))}
          </div>
          <button className="button primary full" onClick={copyInvite}>
            {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
            {copied ? "Copied invite" : "Copy invite link"}
          </button>
        </Modal>
      )}
      {help && (
        <Modal
          title="Your people. A few extra minds."
          onClose={() => setHelp(false)}
        >
          <div className="help-content">
            <p>
              Chat with your friends as usual. Your invited Minds stay quiet
              until you address them.
            </p>
            <code>@Socrates challenge that.</code>
            <code>@Bentham what do you think?</code>
            <p>
              Ask two Minds to debate for four turns. They take turns, then
              stop. The stop button and human speech in a call return the floor
              to you.
            </p>
            <p>
              In a call, click Enable Voice Minds and say “Socrates, speak.”
              This shares your microphone transcripts with the room using your
              browser’s speech service and enables read-aloud. Invite and unmute
              Socrates first. Muting your microphone pauses recognition. You can
              also record a reviewed voice clip with Groq configured.
            </p>
            <p>
              Room text and call transcripts share context. Browser voice plays
              on the device handling the turn; use headphones. Historical
              perspectives are simulations.
            </p>
            <p className="form-note">
              Room text expires after 24 hours. ThirdMind does not store raw
              audio or video. AI requests send bounded context to your
              configured provider.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
