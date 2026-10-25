import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { Room, Member, PublicRoom, Session } from "@/lib/types";
import { loadRoom, mutateRoom, redisConfigured, saveNewRoom } from "./store";
import { getMind } from "@/lib/minds";
import { getScenario } from "@/lib/scenarios";
import { naturalSpeechConfigured } from "./speech";
import { MAX_ICEBREAKER_PARTICIPANTS } from "@/lib/icebreaker";

export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function authorize(room: Room, request: Request): Member {
  const token =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const id = request.headers.get("x-member-id");
  const member = room.members.find((m) => m.id === id);
  if (
    !token ||
    !member ||
    !timingSafeEqual(
      Buffer.from(member.tokenHash, "hex"),
      Buffer.from(hash(token), "hex"),
    )
  )
    throw new HttpError("Please join this room first.", 401);
  return member;
}
export async function authenticatedRoom(id: string, request: Request) {
  const room = await loadRoom(id);
  if (!room)
    throw new HttpError("This room has expired or does not exist.", 404);
  return { room, member: authorize(room, request) };
}
export const demoEnabled = () =>
  process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
  (process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DEMO_MODE !== "false");
export function publicRoom(room: Room): PublicRoom {
  const provider = process.env.LLM_PROVIDER ?? "groq";
  const configured =
    provider === "gemini"
      ? Boolean(process.env.GEMINI_API_KEY)
      : Boolean(process.env.GROQ_API_KEY);
  const { rateLimits: _, members, ...rest } = room;
  void _;
  return {
    ...rest,
    messages: rest.messages.map((message) =>
      message.kind === "ai"
        ? {
            ...message,
            senderName:
              getMind(message.senderId)?.displayName ?? message.senderName,
          }
        : message,
    ),
    members: members.map(({ tokenHash: _, icebreakerProfile, ...member }) => {
      void _;
      return {
        ...member,
        ...(room.icebreaker
          ? { icebreakerProfileComplete: Boolean(icebreakerProfile) }
          : {}),
      };
    }),
    config: {
      ai: configured
        ? provider
        : demoEnabled()
          ? "scripted demo"
          : "unconfigured",
      livekit: Boolean(
        process.env.LIVEKIT_URL &&
        process.env.LIVEKIT_API_KEY &&
        process.env.LIVEKIT_API_SECRET,
      ),
      stt: Boolean(process.env.GROQ_API_KEY),
      tts: naturalSpeechConfigured() ? "character" : "browser",
      storage: redisConfigured ? "redis" : "local memory",
    },
  };
}
export async function createRoom(
  name: string,
  scenario: Room["scenario"],
  initialMind?: string,
  icebreaker = false,
) {
  const id = `${
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 28)
      .replace(/-$/, "") || "room"
  }-${randomBytes(12).toString("hex")}`;
  const now = Date.now();
  const room: Room = {
    id,
    name,
    scenario,
    createdAt: now,
    expiresAt: now + 86400000,
    members: [],
    minds: [...(getScenario(scenario)?.minds ?? [])],
    muted: [],
    messages: [],
    summary: "",
    queue: [],
    active: null,
    humanSpeaking: {},
    icebreaker,
    revision: 0,
    rateLimits: {},
  };
  if (initialMind && !room.minds.includes(initialMind))
    room.minds.push(initialMind);
  if (scenario !== "blank") {
    const lines = getScenario(scenario)?.messages ?? [];
    room.messages = lines.map(([senderName, content], i) => ({
      id: randomUUID(),
      senderId: "example",
      senderName: `${senderName} · example`,
      kind: "human",
      content,
      at: now - (lines.length - i) * 60000,
      demo: true,
    }));
  }
  await saveNewRoom(room);
  return room;
}
export async function joinRoom(
  id: string,
  name: string,
  icebreakerProfile?: Member["icebreakerProfile"],
): Promise<Session> {
  const token = randomBytes(32).toString("base64url");
  const member: Member = {
    id: randomUUID(),
    name,
    tokenHash: hash(token),
    joinedAt: Date.now(),
    lastSeen: Date.now(),
  };
  await mutateRoom(id, (room) => {
    const capacity = room.icebreaker ? MAX_ICEBREAKER_PARTICIPANTS : 30;
    if (room.members.length >= capacity)
      throw new HttpError(
        `This room has reached its ${capacity}-person limit.`,
        409,
      );
    if (room.icebreaker && !icebreakerProfile)
      throw new HttpError(
        "Complete the short Ice Breaker survey before joining this room.",
      );
    if (!room.icebreaker && icebreakerProfile)
      throw new HttpError("This is not an Ice Breaker room.");
    member.icebreakerProfile = icebreakerProfile;
    room.members.push(member);
  });
  return { roomId: id, memberId: member.id, token, name };
}
