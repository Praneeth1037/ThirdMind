import { z } from "zod";
import { getMind } from "@/lib/minds";
import {
  compactHistory,
  enqueueInvocation,
  interrupt,
  finishTurn,
  callPresence,
} from "@/lib/turn-manager";
import { api, json, readJson } from "@/server/http";
import {
  authenticatedRoom,
  authorize,
  HttpError,
  joinRoom,
  publicRoom,
} from "@/server/rooms";
import { mutateRoom, rateLimit } from "@/server/store";
import { runNextTurn } from "@/server/engine";
import { icebreakerProfileSchema } from "@/lib/icebreaker";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("join"),
    name: z.string().trim().min(1).max(32),
    icebreakerProfile: icebreakerProfileSchema.optional(),
  }),
  z.object({
    action: z.literal("message"),
    content: z.string().trim().min(1).max(3000),
    source: z.enum(["text", "voice"]).default("text"),
    clientId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("mind"),
    mindId: z.string(),
    operation: z.enum(["add", "remove", "mute", "unmute"]),
  }),
  z.object({ action: z.literal("interrupt"), speaking: z.boolean() }),
  z.object({ action: z.literal("finish"), turnId: z.string() }),
  z.object({ action: z.literal("tick") }),
  z.object({ action: z.literal("heartbeat") }),
  z.object({ action: z.literal("leave") }),
  z.object({ action: z.literal("stop") }),
  z.object({ action: z.literal("call"), joined: z.boolean() }),
]);
export async function GET(request: Request, context: Context) {
  return api(async () => {
    const { id } = await context.params;
    const { room } = await authenticatedRoom(id, request);
    return json(publicRoom(room));
  });
}
export async function POST(request: Request, context: Context) {
  return api(async () => {
    const { id } = await context.params;
    const input = schema.parse(await readJson(request));
    if (input.action === "join") {
      await rateLimit(`join:${id}`, 40);
      const session = await joinRoom(id, input.name, input.icebreakerProfile);
      return json({ session });
    }
    const { member } = await authenticatedRoom(id, request);
    if (input.action === "tick")
      return json(publicRoom(await runNextTurn(id, member.id)));
    if (input.action === "message")
      await rateLimit(
        `message:${id}:${member.id}`,
        input.source === "voice" ? 90 : 30,
      );
    if (input.action === "mind") {
      if (!getMind(input.mindId)) throw new HttpError("Unknown Mind.");
      await rateLimit(`minds:${id}:${member.id}`, 30);
    }
    const { room } = await mutateRoom(id, (room) => {
      const current = authorize(room, request);
      current.lastSeen = Date.now();
      switch (input.action) {
        case "message": {
          if (room.messages.some((m) => m.id === input.clientId)) break;
          const message = {
            id: input.clientId,
            senderId: current.id,
            senderName: current.name,
            kind: "human" as const,
            content: input.content,
            at: Date.now(),
            source: input.source,
          };
          enqueueInvocation(room, message);
          room.messages.push(message);
          compactHistory(room);
          break;
        }
        case "mind": {
          const mindId = input.mindId;
          if (input.operation === "add" && !room.minds.includes(mindId))
            room.minds.push(mindId);
          if (input.operation === "remove")
            room.minds = room.minds.filter((id) => id !== mindId);
          if (input.operation === "mute" && !room.muted.includes(mindId))
            room.muted.push(mindId);
          if (input.operation === "unmute" || input.operation === "remove")
            room.muted = room.muted.filter((id) => id !== mindId);
          if (input.operation === "remove" || input.operation === "mute") {
            room.queue = room.queue.filter((job) => job.mindId !== mindId);
            if (room.active?.mindId === mindId) room.active = null;
          }
          break;
        }
        case "interrupt":
          interrupt(room, current.id, input.speaking);
          break;
        case "stop":
          room.active = null;
          room.queue = [];
          break;
        case "finish":
          finishTurn(room, current.id, input.turnId);
          break;
        case "call":
          callPresence(room, current.id, input.joined);
          break;
        case "heartbeat":
          break;
        case "leave":
          room.members = room.members.filter((m) => m.id !== current.id);
          delete room.humanSpeaking[current.id];
          if (room.active?.ownerId === current.id) room.active = null;
          break;
      }
      // Opportunistic cleanup; no recording or permanent history.
      room.humanSpeaking = Object.fromEntries(
        Object.entries(room.humanSpeaking).filter(
          ([, until]) => until > Date.now(),
        ),
      );
    });
    return json(publicRoom(room));
  });
}
