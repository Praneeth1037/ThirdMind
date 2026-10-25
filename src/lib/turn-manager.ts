import { randomUUID } from "node:crypto";
import { routeMention } from "./mention-router";
import type { Room, Message, Job } from "./types";

export function compactHistory(room: Room) {
  if (room.messages.length > 60) {
    const older = room.messages.splice(0, room.messages.length - 40);
    const extract = older
      .filter((m) => m.kind !== "system")
      .map((m) => `${m.senderName}: ${m.content.slice(0, 240)}`)
      .join("\n");
    room.summary = (room.summary + "\n" + extract).slice(-6000);
  }
}
export function enqueueInvocation(room: Room, message: Message) {
  if (message.kind !== "human") return;
  const route = routeMention(
    message.content,
    room.minds.filter((id) => !room.muted.includes(id)),
  );
  if (!route.explicitInvocation) return;
  if (room.queue.length + route.turns > 12)
    throw new Error(
      "The Minds have a full queue. Let them finish or stop the current turn.",
    );
  const targets = [...route.targetMinds];
  if (route.intent === "debate" && targets.includes("utilitarian"))
    targets.sort((a) => (a === "utilitarian" ? -1 : 1));
  for (let i = 0; i < route.turns; i++)
    room.queue.push({
      id: randomUUID(),
      mindId: targets[i % targets.length],
      requestId: message.id,
      requestedBy: message.senderId,
      prompt: message.content,
      debate: route.intent === "debate",
    });
}
export function humanIsSpeaking(room: Room, now = Date.now()) {
  return Object.values(room.humanSpeaking).some((until) => until > now);
}
export function interrupt(
  room: Room,
  memberId: string,
  speaking: boolean,
  now = Date.now(),
) {
  if (speaking) {
    const alreadySpeaking = humanIsSpeaking(room, now);
    room.humanSpeaking[memberId] = now + 8000;
    // Renewals must not delete an explicit request queued while a human finishes speaking.
    if (!alreadySpeaking || room.active) {
      room.active = null;
      room.queue = [];
    }
  } else delete room.humanSpeaking[memberId];
}
export function claimTurn(
  room: Room,
  ownerId: string,
  now = Date.now(),
): Job | null {
  if (room.active && room.active.leaseUntil <= now) {
    // Abandon an expired generation; never replay it automatically.
    room.active = null;
  }
  if (room.active || humanIsSpeaking(room, now)) return null;
  const job = room.queue.shift();
  if (!job) return null;
  // The requesting student's device owns playback, even if another browser drives the tick.
  const playbackOwner = room.members.some((m) => m.id === job.requestedBy)
    ? job.requestedBy
    : ownerId;
  room.active = {
    ...job,
    ownerId: playbackOwner,
    state: "AI_GENERATING",
    leaseUntil: now + 45000,
    listeners: [
      ...new Set([
        playbackOwner,
        ...room.members
          .filter((member) => member.inCall && member.lastSeen > now - 60000)
          .map((member) => member.id),
      ]),
    ],
    finishedBy: [],
  };
  return job;
}

export function finishTurn(
  room: Room,
  memberId: string,
  turnId: string,
  now = Date.now(),
) {
  const active = room.active;
  if (!active || active.id !== turnId || active.state !== "AI_SPEAKING") return;
  const listeners = active.listeners ?? [active.ownerId];
  if (!listeners.includes(memberId)) return;
  active.finishedBy = [...new Set([...(active.finishedBy ?? []), memberId])];
  const waiting = listeners.filter((id) => {
    if (id === active.ownerId) return true;
    const member = room.members.find((member) => member.id === id);
    return Boolean(member?.inCall && member.lastSeen > now - 60000);
  });
  if (waiting.every((id) => active.finishedBy!.includes(id)))
    room.active = null;
}

export function callPresence(room: Room, memberId: string, joined: boolean) {
  const member = room.members.find((member) => member.id === memberId);
  if (member) member.inCall = joined;
  const active = room.active;
  if (
    !joined &&
    active?.state === "AI_SPEAKING" &&
    active.listeners?.includes(memberId)
  ) {
    active.listeners = active.listeners.filter((id) => id !== memberId);
    if (active.listeners.every((id) => active.finishedBy?.includes(id)))
      room.active = null;
  }
}
export function completeGeneration(
  room: Room,
  jobId: string,
  message: Message,
  now = Date.now(),
) {
  if (
    room.active?.id !== jobId ||
    room.active.state !== "AI_GENERATING" ||
    room.active.leaseUntil <= now ||
    humanIsSpeaking(room, now)
  )
    return false;
  room.messages.push(message);
  room.active.state = "AI_SPEAKING";
  room.active.messageId = message.id;
  // Include neural synthesis startup and the response length in the playback lease.
  room.active.leaseUntil =
    now +
    Math.min(180000, Math.max(35000, 20000 + message.content.length * 100));
  compactHistory(room);
  return true;
}
