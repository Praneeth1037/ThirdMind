"use client";
import { useEffect, useRef } from "react";
import { Captions, Mic, Sparkles } from "lucide-react";
import type { PublicRoom } from "@/lib/types";
import { captionSegments, type PlaybackCaption } from "@/lib/captions";

export function LiveCaptions({
  id,
  room,
  localId,
  localName,
  draft,
  draftFinal,
  listening,
  playback,
}: {
  id: string;
  room: PublicRoom;
  localId: string;
  localName: string;
  draft: string;
  draftFinal: boolean;
  listening: boolean;
  playback: PlaybackCaption | null;
}) {
  const end = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const lines = room.messages
    .filter((message) => message.kind === "ai" || message.source === "voice")
    .slice(-8);
  const draftInChat =
    draftFinal &&
    room.messages.some(
      (message) =>
        message.senderId === localId &&
        message.source === "voice" &&
        message.content === draft,
    );
  const showDraft = Boolean(draft && !draftInChat);
  const lastMessageId = room.messages.at(-1)?.id;
  useEffect(() => {
    const container = end.current?.parentElement;
    if (container) container.scrollTop = container.scrollHeight;
  }, [draft, lines.length, lastMessageId, room.active?.messageId]);
  useEffect(() => {
    const container = log.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      container.scrollTop = container.scrollHeight;
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const container = log.current;
    const word = container?.querySelector(".caption-current-word");
    if (!container || !word || playback?.state !== "speaking") return;
    const viewport = container.getBoundingClientRect(),
      bounds = word.getBoundingClientRect();
    if (bounds.top < viewport.top || bounds.bottom > viewport.bottom)
      container.scrollTop +=
        bounds.top - viewport.top - container.clientHeight / 3;
  }, [playback?.messageId, playback?.charIndex, playback?.state]);
  return (
    <section id={id} className="live-captions" aria-label="Live captions">
      <div className="captions-heading">
        <h3>
          <Captions size={14} /> Live transcript
        </h3>
        <span>{listening ? "Updating as you speak" : "Speech transcript"}</span>
      </div>
      <div
        ref={log}
        className="caption-log"
        role="log"
        aria-label="Speech transcript"
        aria-live="off"
      >
        {!lines.length && !showDraft && (
          <p className="caption-empty">
            {listening
              ? "Start speaking. Your words will appear here as they are recognized."
              : "Enable Voice Minds to see your speech here. Mind replies appear here too."}
          </p>
        )}
        {lines.map((message) => {
          const active =
            playback?.messageId === message.id && playback.state === "speaking";
          const words =
            active && playback.hasWordTiming
              ? captionSegments(
                  message.content,
                  playback.charIndex,
                  playback.charLength,
                )
              : null;
          return (
            <div
              key={message.id}
              className={`caption-entry ${message.kind === "ai" ? "caption-ai" : "caption-human"}`}
              data-speaker={message.senderName}
              data-final="true"
            >
              <div className="caption-meta">
                {message.kind === "ai" ? (
                  <Sparkles size={11} />
                ) : (
                  <Mic size={11} />
                )}
                <strong>
                  {message.senderName}
                  {message.senderId === localId ? " (you)" : ""}
                </strong>
                <span>
                  {active
                    ? "Speaking"
                    : playback?.messageId === message.id &&
                        playback.state === "stopped"
                      ? "Interrupted"
                      : playback?.messageId === message.id &&
                          playback.state === "error"
                        ? "Text only"
                        : message.kind === "ai"
                          ? "AI response"
                          : "Final"}
                </span>
              </div>
              <p>
                {words ? (
                  <>
                    {words.before}
                    <mark className="caption-current-word" aria-current="true">
                      {words.current}
                    </mark>
                    {words.after}
                  </>
                ) : (
                  message.content
                )}
              </p>
            </div>
          );
        })}
        {showDraft && (
          <div
            className={`caption-entry caption-human ${draftFinal ? "caption-finalizing" : "caption-interim"}`}
            data-speaker={localName}
            data-final={draftFinal ? "true" : "false"}
          >
            <div className="caption-meta">
              <Mic size={11} />
              <strong>{localName} (you)</strong>
              <span>
                {draftFinal
                  ? "Sharing…"
                  : listening
                    ? "Live draft"
                    : "Draft · paused"}
              </span>
            </div>
            <p>
              {draft}
              {listening && !draftFinal && (
                <span className="caption-caret" aria-hidden="true" />
              )}
            </p>
          </div>
        )}
        <div ref={end} />
      </div>
      <p className="caption-note">
        Draft words can change and are visible only to you. Final lines are
        saved in the room chat. Word highlighting follows your browser’s speech
        timing when available.
      </p>
    </section>
  );
}
