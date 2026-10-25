"use client";
import { useState } from "react";
import { ArrowRight, Link as LinkIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { IcebreakerProfile, Session } from "@/lib/types";
import { getMind } from "@/lib/minds";
import { Modal } from "./modal";
import { scenarioRoomName, type ScenarioId } from "@/lib/scenarios";
export function storeSession(session: Session) {
  sessionStorage.setItem(
    `thirdmind:${session.roomId}`,
    JSON.stringify(session),
  );
  localStorage.setItem("thirdmind:name", session.name);
  window.dispatchEvent(new Event("thirdmind:session"));
}
export function EntryDialog({
  mode = "create",
  scenario = "ethics",
  roomId,
  initialMind,
  icebreaker = false,
  onClose,
  inline = false,
}: {
  mode?: "create" | "join";
  inline?: boolean;
  scenario?: ScenarioId;
  roomId?: string;
  initialMind?: string;
  icebreaker?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(() =>
    typeof window !== "undefined"
      ? (localStorage.getItem("thirdmind:name") ?? "")
      : "",
  );
  const [roomName, setRoomName] = useState(
    icebreaker ? "Ice Breaker room" : scenarioRoomName(scenario),
  );
  const [interests, setInterests] = useState("");
  const [topicsToAvoid, setTopicsToAvoid] = useState("");
  const [style, setStyle] = useState<IcebreakerProfile["style"]>("curious");
  const [participation, setParticipation] =
    useState<IcebreakerProfile["participation"]>("mix");
  const [invite, setInvite] = useState(roomId ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const icebreakerFlow =
    icebreaker ||
    (mode === "join" && /(?:\?|&)icebreaker=1(?:&|$)/.test(invite));
  function surveyProfile(): IcebreakerProfile {
    const parseTopics = (value: string, limit: number, label: string) => {
      const topics = value
        .split(",")
        .map((topic) => topic.trim())
        .filter(Boolean);
      if (topics.length > limit)
        throw new Error(`Enter up to ${limit} ${label}, separated by commas.`);
      return topics;
    };
    return {
      interests: parseTopics(interests, 8, "interests"),
      topicsToAvoid: parseTopics(topicsToAvoid, 5, "topics to skip"),
      style,
      participation,
    };
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const profile = icebreakerFlow ? surveyProfile() : undefined;
      let id = invite;
      if (mode === "join") {
        try {
          id = new URL(invite).pathname.split("/room/")[1] ?? "";
        } catch {
          id = invite.trim();
        }
        if (!/^[a-z0-9-]{1,80}$/.test(id))
          throw new Error("Paste a ThirdMind invite link or room ID.");
      }
      const response = await fetch(
        mode === "create" ? "/api/rooms" : `/api/rooms/${id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(mode === "create"
              ? { name: roomName, displayName: name, scenario, initialMind }
              : { action: "join", name }),
            ...(icebreakerFlow && mode === "create"
              ? { icebreaker: true, icebreakerProfile: profile }
              : {}),
            ...(icebreakerFlow && mode === "join"
              ? { icebreakerProfile: profile }
              : {}),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      storeSession(data.session);
      router.push(`/room/${data.session.roomId}`);
      router.refresh();
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not open the room.",
      );
    } finally {
      setBusy(false);
    }
  }
  const form = (
    <form onSubmit={submit} className="entry-form">
      <label>
        Your display name
        <input
          autoFocus
          autoComplete="nickname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What should we call you?"
          required
          maxLength={32}
        />
      </label>
      {mode === "create" ? (
        <label>
          Conversation name
          <input
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="e.g. Late-night study club"
            required
            maxLength={64}
          />
        </label>
      ) : (
        !roomId && (
          <label>
            Invite link
            <span className="input-icon">
              <LinkIcon size={17} />
              <input
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                placeholder="Paste your room link"
                required
              />
            </span>
          </label>
        )
      )}
      {icebreakerFlow && (
        <div className="icebreaker-survey">
          <p className="form-note">
            This optional survey is stored privately with the room until it
            expires. When you request a prompt, the AI may receive aggregate
            topics and preferences plus recent room-chat messages, not raw
            survey answers. This feature does not analyze call audio.
          </p>
          <label>
            <span className="icebreaker-field-label">
              Interests <small>(optional, comma-separated)</small>
            </span>
            <input
              value={interests}
              onChange={(event) => setInterests(event.target.value)}
              placeholder="Music, travel, films"
              maxLength={240}
            />
          </label>
          <label>
            <span className="icebreaker-field-label">
              Topics you would rather skip <small>(optional)</small>
            </span>
            <input
              value={topicsToAvoid}
              onChange={(event) => setTopicsToAvoid(event.target.value)}
              placeholder="Add any topics to avoid"
              maxLength={150}
            />
          </label>
          <div className="icebreaker-survey-prefs">
            <label>
              Conversation style
              <select
                value={style}
                onChange={(event) =>
                  setStyle(event.target.value as IcebreakerProfile["style"])
                }
              >
                <option value="casual">Casual</option>
                <option value="funny">Funny</option>
                <option value="curious">Curious</option>
                <option value="thoughtful">Thoughtful</option>
              </select>
            </label>
            <label>
              I enjoy
              <select
                value={participation}
                onChange={(event) =>
                  setParticipation(
                    event.target.value as IcebreakerProfile["participation"],
                  )
                }
              >
                <option value="mix">A mix of listening and sharing</option>
                <option value="answer">Answering questions</option>
                <option value="ask">Asking questions</option>
                <option value="stories">Sharing stories</option>
              </select>
            </label>
          </div>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {initialMind && (
        <p className="form-note">
          {getMind(initialMind)?.displayName} will join as a quiet listener.
        </p>
      )}
      <button className="button primary full" disabled={busy}>
        {busy
          ? "Opening your room…"
          : mode === "create"
            ? "Create conversation"
            : "Join room"}
        <ArrowRight size={17} />
      </button>
      <p className="form-note">
        Invite links grant room access. Rooms expire after 24 hours.
      </p>
    </form>
  );
  if (inline)
    return (
      <section className="join-card">
        <h1>Join this room.</h1>
        <p>
          Join the group chat first. You can join the call whenever you’re
          ready.
        </p>
        {form}
      </section>
    );
  return (
    <Modal
      title={
        mode === "create"
          ? icebreakerFlow
            ? "Meet new people. Find a way into the conversation."
            : "Make room for a good conversation."
          : "You’re invited."
      }
      description={
        mode === "create"
          ? icebreakerFlow
            ? "Join a small group, share only what you choose, and use optional prompts when you want them."
            : "Bring your people. Invite a fresh perspective when you need one."
          : "Pick a name so your friends know it’s you."
      }
      onClose={onClose}
    >
      {form}
    </Modal>
  );
}
