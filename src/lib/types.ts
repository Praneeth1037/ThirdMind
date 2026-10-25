import type { ScenarioId } from "./scenarios";
export type MindStatus =
  "LISTENING" | "REQUESTED" | "THINKING" | "SPEAKING" | "MUTED";
export type Message = {
  id: string;
  senderId: string;
  senderName: string;
  kind: "human" | "ai" | "system";
  content: string;
  at: number;
  source?: "text" | "voice";
  demo?: boolean;
};
export type Member = {
  id: string;
  name: string;
  tokenHash: string;
  joinedAt: number;
  lastSeen: number;
  inCall?: boolean;
};
export type Job = {
  id: string;
  mindId: string;
  requestId: string;
  requestedBy: string;
  prompt: string;
  debate: boolean;
};
export type ActiveTurn = Job & {
  leaseUntil: number;
  state: "AI_GENERATING" | "AI_SPEAKING";
  ownerId: string;
  messageId?: string;
  listeners?: string[];
  finishedBy?: string[];
};
export type Room = {
  id: string;
  name: string;
  scenario: ScenarioId;
  createdAt: number;
  expiresAt: number;
  members: Member[];
  minds: string[];
  muted: string[];
  messages: Message[];
  summary: string;
  queue: Job[];
  active: ActiveTurn | null;
  humanSpeaking: Record<string, number>;
  revision: number;
  rateLimits: Record<string, { since: number; count: number }>;
};
export type PublicRoom = Omit<Room, "members" | "rateLimits"> & {
  members: Omit<Member, "tokenHash">[];
  config: {
    ai: string;
    livekit: boolean;
    stt: boolean;
    storage: string;
    tts?: "character" | "browser";
  };
};
export type Session = {
  roomId: string;
  memberId: string;
  token: string;
  name: string;
};
