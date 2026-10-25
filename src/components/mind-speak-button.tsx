"use client";

import { Loader2, Volume2 } from "lucide-react";
import { getMind } from "@/lib/minds";
import type { MindStatus } from "@/lib/types";

export type MindSpeechControls = {
  onSpeakMind: (mindId: string) => void;
  pendingSpeech: string[];
};

export function MindSpeakButton({
  mindId,
  status,
  pending = false,
  onSpeak,
}: {
  mindId: string;
  status: MindStatus;
  pending?: boolean;
  onSpeak: (mindId: string) => void;
}) {
  const name = getMind(mindId)?.displayName ?? "Mind";
  const label =
    status === "MUTED"
      ? "Muted"
      : status === "SPEAKING"
        ? "Speaking…"
        : status === "THINKING"
          ? "Thinking…"
          : status === "REQUESTED"
            ? "Queued"
            : pending
              ? "Requesting…"
              : "Speak";
  const waiting = pending || status === "THINKING" || status === "REQUESTED";
  return (
    <button
      className="mind-speak-button"
      aria-label={`${label === "Speak" ? "Speak" : label.replace("…", "")} ${name}`}
      aria-busy={waiting}
      disabled={pending || status !== "LISTENING"}
      title={
        status === "MUTED"
          ? `Unmute ${name} to ask it to speak`
          : `Ask ${name} to respond aloud to the conversation`
      }
      onClick={() => onSpeak(mindId)}
    >
      {waiting ? <Loader2 size={14} className="spin" /> : <Volume2 size={14} />}
      {label}
    </button>
  );
}
