import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Message, Room } from "../src/lib/types";
import {
  claimTurn,
  compactHistory,
  completeGeneration,
  enqueueInvocation,
  interrupt,
} from "../src/lib/turn-manager";
import { createRoom } from "../src/server/rooms";
import { loadRoom, mutateRoom } from "../src/server/store";
import { buildPrompt, type LLMProvider } from "../src/server/providers";
import { runNextTurn } from "../src/server/engine";
const human = (content: string): Message => ({
  id: randomUUID(),
  senderId: "human",
  senderName: "Maya",
  kind: "human",
  content,
  at: Date.now(),
});
const reply = (mind = "socrates"): Message => ({
  ...human("A generated perspective."),
  senderId: mind,
  senderName: mind,
  kind: "ai",
});
const room = (): Room => ({
  id: randomUUID(),
  name: "Ethics",
  scenario: "ethics",
  createdAt: Date.now(),
  expiresAt: Date.now() + 86400000,
  members: [],
  minds: ["socrates", "utilitarian", "judge"],
  muted: [],
  messages: [],
  summary: "",
  queue: [],
  active: null,
  humanSpeaking: {},
  revision: 0,
  rateLimits: {},
});
test("human speaking blocks AI generation", () => {
  const r = room();
  enqueueInvocation(r, human("@Socrates respond."));
  interrupt(r, "human", true);
  enqueueInvocation(r, human("@Judge evaluate this."));
  assert.equal(claimTurn(r, "browser"), null);
  assert.equal(r.queue.length, 1);
});
test("speech activity renewals preserve explicit requests queued while a human finishes", () => {
  const r = room();
  interrupt(r, "human", true, 1000);
  enqueueInvocation(r, human("Socrates, speak."));
  interrupt(r, "human", true, 2000);
  assert.equal(r.queue.length, 1);
  assert.equal(claimTurn(r, "browser", 3000), null);
  interrupt(r, "human", false, 4000);
  assert.equal(claimTurn(r, "browser", 4000)?.mindId, "socrates");
});
test("only one AI can claim the floor, with sequential queued requests", () => {
  const r = room();
  enqueueInvocation(r, human("@Socrates respond."));
  enqueueInvocation(r, human("@Utilitarian respond."));
  const first = claimTurn(r, "browser")!;
  assert.equal(first.mindId, "socrates");
  assert.equal(claimTurn(r, "other"), null);
  assert.equal(completeGeneration(r, first.id, reply()), true);
  assert.equal(claimTurn(r, "other"), null);
  r.active = null;
  assert.equal(claimTurn(r, "browser")?.mindId, "utilitarian");
});
test("human interruption discards late output and cancels debate without resuming", () => {
  const r = room();
  enqueueInvocation(r, human("Socrates and Bentham, debate for four turns."));
  const first = claimTurn(r, "browser")!;
  interrupt(r, "human", true);
  assert.equal(r.active, null);
  assert.equal(r.queue.length, 0);
  assert.equal(completeGeneration(r, first.id, reply()), false);
  interrupt(r, "human", false);
  assert.equal(claimTurn(r, "browser"), null);
  assert.equal(r.messages.length, 0);
});
test("debate produces exactly four sequential turns then stops", () => {
  const r = room();
  enqueueInvocation(r, human("Socrates and Bentham debate for four turns."));
  const sequence: string[] = [];
  while (r.queue.length) {
    const job = claimTurn(r, "browser")!;
    sequence.push(job.mindId);
    assert.equal(claimTurn(r, "browser"), null);
    assert.equal(completeGeneration(r, job.id, reply(job.mindId)), true);
    r.active = null;
  }
  assert.deepEqual(sequence, [
    "utilitarian",
    "socrates",
    "utilitarian",
    "socrates",
  ]);
  assert.equal(claimTurn(r, "browser"), null);
  assert.equal(r.messages.length, 4);
});
test("AI output never becomes an invocation", () => {
  const r = room();
  enqueueInvocation(r, { ...reply(), content: "@Judge evaluate this." });
  assert.equal(r.queue.length, 0);
});
test("the requesting student owns playback even when a different browser drives generation", () => {
  const r = room();
  r.members = [
    { id: "human", name: "Maya", tokenHash: "test", joinedAt: 0, lastSeen: 0 },
  ];
  enqueueInvocation(r, human("@Socrates respond."));
  claimTurn(r, "other-browser");
  assert.equal(r.active?.ownerId, "human");
});
test("expired generation is not replayed and cannot commit late output", () => {
  const r = room();
  enqueueInvocation(r, human("@Socrates respond."));
  const first = claimTurn(r, "browser", 1000)!;
  assert.equal(completeGeneration(r, first.id, reply(), 47000), false);
  assert.equal(claimTurn(r, "browser", 47000), null);
  assert.equal(r.messages.length, 0);
});
test("rolling summary and recent context stay bounded", () => {
  const r = room();
  r.messages = Array.from({ length: 90 }, (_, i) =>
    human(`${i}: ${"word ".repeat(500)}`),
  );
  compactHistory(r);
  assert.equal(r.messages.length, 40);
  assert.ok(r.summary.length <= 6000);
  const job = {
    id: "job",
    mindId: "judge",
    requestId: "req",
    requestedBy: "human",
    prompt: "evaluate",
    debate: false,
  };
  assert.ok(buildPrompt(r, job).context.length <= 26000);
});
test("Judge sees shared Socrates output but never inherits the Socrates system prompt", () => {
  const r = room();
  r.messages.push({
    ...reply("socrates"),
    content: "What principle makes that justified?",
  });
  const base = {
    id: "job",
    requestId: "req",
    requestedBy: "human",
    prompt: "evaluate",
    debate: false,
  };
  const socrates = buildPrompt(r, { ...base, mindId: "socrates" });
  const judge = buildPrompt(r, { ...base, mindId: "judge" });
  assert.match(judge.context, /What principle/);
  assert.match(judge.system, /Remain neutral/);
  assert.doesNotMatch(judge.system, /Use Socratic questioning/);
  assert.match(socrates.system, /Use Socratic questioning/);
});
test("concurrent room mutations preserve all messages", async () => {
  const r = await createRoom("Concurrent test", "blank");
  await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      mutateRoom(r.id, (r) => r.messages.push(human(`Message ${i}`))),
    ),
  );
  assert.equal((await loadRoom(r.id))?.messages.length, 10);
});
test("no invocation means no provider calls", async () => {
  const r = await createRoom("Silent test", "ethics");
  let calls = 0;
  const provider: LLMProvider = {
    generate: async () => {
      calls++;
      return { text: "response", demo: false };
    },
  };
  await mutateRoom(r.id, (r) => enqueueInvocation(r, human("I disagree.")));
  await runNextTurn(r.id, "browser", provider);
  assert.equal(calls, 0);
});
test("multiple browser ticks generate only once", async () => {
  const r = await createRoom("Concurrency", "ethics");
  await mutateRoom(r.id, (r) =>
    enqueueInvocation(r, human("@Socrates respond.")),
  );
  let calls = 0;
  const provider: LLMProvider = {
    generate: async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 25));
      return { text: "What do you mean?", demo: false };
    },
  };
  await Promise.all([
    runNextTurn(r.id, "one", provider),
    runNextTurn(r.id, "two", provider),
  ]);
  assert.equal(calls, 1);
  assert.equal(
    (await loadRoom(r.id))?.messages.filter((m) => m.kind === "ai").length,
    1,
  );
});
test("provider failure leaves human conversation intact and stops its failed debate", async () => {
  const r = await createRoom("Failure", "ethics");
  await mutateRoom(r.id, (r) =>
    enqueueInvocation(
      r,
      human("@Socrates and @Utilitarian debate for four turns."),
    ),
  );
  const result = await runNextTurn(r.id, "browser", {
    generate: async () => {
      throw new Error("Provider unavailable");
    },
  });
  assert.equal(result.active, null);
  assert.equal(result.queue.length, 0);
  assert.equal(result.messages.filter((m) => m.kind === "human").length, 2);
  assert.match(result.messages.at(-1)!.content, /temporarily unavailable/);
});

test("call playback waits for every listener before the next AI takes the floor", async () => {
  const { finishTurn } = await import("../src/lib/turn-manager");
  const r = room();
  r.members = ["owner", "friend"].map((id) => ({
    id,
    name: id,
    tokenHash: "test",
    joinedAt: 1000,
    lastSeen: 1000,
    inCall: true,
  }));
  enqueueInvocation(r, { ...human("@Socrates respond."), senderId: "owner" });
  enqueueInvocation(r, { ...human("@Bentham respond."), senderId: "owner" });
  const job = claimTurn(r, "owner", 1000)!;
  completeGeneration(r, job.id, reply(), 1500);
  finishTurn(r, "owner", job.id, 2000);
  assert.equal(r.active?.id, job.id);
  assert.equal(claimTurn(r, "owner", 2100), null);
  finishTurn(r, "not-a-listener", job.id, 2200);
  assert.equal(r.active?.id, job.id);
  finishTurn(r, "friend", job.id, 2300);
  assert.equal(r.active, null);
  assert.equal(claimTurn(r, "owner", 2400)?.mindId, "utilitarian");
});

test("leaving a call releases its playback obligation and text-only observers never hold the floor", async () => {
  const { finishTurn, callPresence } = await import("../src/lib/turn-manager");
  const r = room();
  r.members = ["owner", "friend", "observer"].map((id) => ({
    id,
    name: id,
    tokenHash: "test",
    joinedAt: 1000,
    lastSeen: 1000,
    inCall: id !== "observer",
  }));
  enqueueInvocation(r, { ...human("@Socrates respond."), senderId: "owner" });
  const job = claimTurn(r, "owner", 1000)!;
  assert.deepEqual(r.active?.listeners, ["owner", "friend"]);
  completeGeneration(r, job.id, reply(), 1500);
  finishTurn(r, "owner", job.id, 2000);
  callPresence(r, "friend", false);
  assert.equal(r.active, null);
});
