"use client";
import { useState } from "react";
import { ArrowRight, Link as LinkIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Session } from "@/lib/types";
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
  onClose,
  inline = false,
}: {
  mode?: "create" | "join";
  inline?: boolean;
  scenario?: ScenarioId;
  roomId?: string;
  initialMind?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(() =>
    typeof window !== "undefined"
      ? (localStorage.getItem("thirdmind:name") ?? "")
      : "",
  );
  const [roomName, setRoomName] = useState(scenarioRoomName(scenario));
  const [invite, setInvite] = useState(roomId ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
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
          body: JSON.stringify(
            mode === "create"
              ? { name: roomName, displayName: name, scenario, initialMind }
              : { action: "join", name },
          ),
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
          ? "Make room for a good conversation."
          : "You’re invited."
      }
      description={
        mode === "create"
          ? "Bring your people. Invite a fresh perspective when you need one."
          : "Pick a name so your friends know it’s you."
      }
      onClose={onClose}
    >
      {form}
    </Modal>
  );
}
