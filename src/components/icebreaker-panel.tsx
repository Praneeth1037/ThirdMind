"use client";

import { useEffect, useState } from "react";
import { Loader2, Pause, Play, Sparkles, Users } from "lucide-react";
import type { PublicRoom, Session } from "@/lib/types";

export function IcebreakerPanel({
  room,
  session,
  participantsInCall,
  onRoomUpdate,
}: {
  room: PublicRoom;
  session: Session;
  participantsInCall: number;
  onRoomUpdate: (room: PublicRoom) => void;
}) {
  const [mode, setMode] = useState<"subtle" | "balanced" | "active">(
    "balanced",
  );
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(0);
  const [dismissedPrompt, setDismissedPrompt] = useState("");
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

  const latestPrompt = [...room.messages]
    .reverse()
    .find((message) => message.senderId === "icebreaker");
  const remaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  async function suggestPrompt() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/rooms/${room.id}/icebreaker`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "x-member-id": session.memberId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onRoomUpdate(data.room);
      setDismissedPrompt("");
      if (data.fallback)
        setError(
          "Using a ready-to-go conversation starter while AI is unavailable.",
        );
      setCooldownUntil(Date.now() + 10000);
      setNow(Date.now());
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not prepare a conversation prompt.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="icebreaker-panel" aria-label="Ice Breaker facilitator">
      <div className="icebreaker-panel-heading">
        <div className="icebreaker-panel-title">
          <span className="icebreaker-icon">
            <Sparkles size={15} />
          </span>
          <div>
            <strong>Ice Breaker</strong>
            <span>On-screen prompts · group themes and shared chat only</span>
          </div>
        </div>
        <div className="icebreaker-panel-controls">
          <label>
            Prompt style
            <select
              value={mode}
              onChange={(event) => {
                const value = event.target.value;
                if (
                  value === "subtle" ||
                  value === "balanced" ||
                  value === "active"
                )
                  setMode(value);
              }}
              aria-label="Ice Breaker prompt style"
            >
              <option value="subtle">Subtle</option>
              <option value="balanced">Balanced</option>
              <option value="active">Active</option>
            </select>
          </label>
          <button
            className="icebreaker-pause"
            type="button"
            aria-pressed={paused}
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
      </div>
      <div className="icebreaker-prompt">
        {latestPrompt && latestPrompt.id !== dismissedPrompt ? (
          <>
            <p>{latestPrompt.content}</p>
            <button
              className="icebreaker-dismiss"
              type="button"
              onClick={() => setDismissedPrompt(latestPrompt.id)}
              aria-label="Dismiss this conversation prompt"
            >
              Dismiss
            </button>
          </>
        ) : (
          <p>
            {paused
              ? "Prompts are paused for you. The group can still continue chatting or calling."
              : participantsInCall < 2
                ? "Invite people and join the call together. Prompts are ready once at least two participants are in the call."
                : "Need a gentle nudge? Ask for an optional question based on shared interests."}
          </p>
        )}
        <button
          className="icebreaker-suggest"
          type="button"
          onClick={suggestPrompt}
          disabled={paused || participantsInCall < 2 || busy || remaining > 0}
        >
          {busy ? (
            <Loader2 size={14} className="spin" />
          ) : (
            <Sparkles size={14} />
          )}
          {busy
            ? "Preparing…"
            : remaining
              ? `Another in ${remaining}s`
              : latestPrompt && latestPrompt.id !== dismissedPrompt
                ? "Show another"
                : "Suggest a topic"}
        </button>
      </div>
      <div className="icebreaker-room-count">
        <Users size={13} />
        {room.members.length} / 10 participants
        <span>·</span>
        prompts are always participant-requested
      </div>
      {error && (
        <p className="icebreaker-error" role="status">
          {error}
        </p>
      )}
    </section>
  );
}
