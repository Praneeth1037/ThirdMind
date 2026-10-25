import { test } from "node:test";
import assert from "node:assert/strict";
import { CHARACTER_VOICES, characterVoice } from "../src/lib/character-voices";
import { MINDS } from "../src/lib/minds";
import { speechChunks } from "../src/lib/speech-chunks";
import {
  claimTurn,
  completeGeneration,
  enqueueInvocation,
} from "../src/lib/turn-manager";
import { createRoom } from "../src/server/rooms";

test("every invited character has its own conversational neural voice and bounded delivery speed", () => {
  assert.equal(Object.keys(CHARACTER_VOICES).length, MINDS.length);
  assert.equal(
    new Set(MINDS.map((mind) => characterVoice(mind.id)?.voice)).size,
    MINDS.length,
  );
  for (const mind of MINDS) {
    const profile = characterVoice(mind.id);
    assert.ok(profile?.voice);
    assert.ok(profile.speed >= 0.85 && profile.speed <= 1.1);
    assert.doesNotMatch(profile.voice, /santa|sing|music/i);
  }
  assert.equal(characterVoice("bentham"), characterVoice("utilitarian"));
  assert.equal(characterVoice("unknown"), undefined);
});

test("Socrates and Bentham use distinct male character voices with natural pacing", () => {
  assert.equal(characterVoice("socrates")?.voice, "bm_fable");
  assert.equal(characterVoice("utilitarian")?.voice, "bm_george");
  assert.notEqual(
    characterVoice("socrates")?.speed,
    characterVoice("utilitarian")?.speed,
  );
});

test("neural speech chunking preserves punctuation, adjacent sentences and every word in long replies", () => {
  for (const text of [
    "Hello.World!Why?Because.",
    "A thought... another thought?!",
    "A long sentence ".repeat(100),
    "x".repeat(1000),
    "",
    "What matters most to you?",
  ]) {
    const chunks = speechChunks(text);
    assert.ok(
      chunks.every((chunk) => chunk.length <= 300 && chunk.trim().length > 0),
    );
    assert.equal(chunks.join("").replace(/\s/gu, ""), text.replace(/\s/gu, ""));
  }
});

test("playback leases include neural startup and long speech without permitting overlapping turns", async () => {
  const room = await createRoom("Neural lease", "ethics");
  const message = {
    id: "request",
    senderId: "human",
    senderName: "Maya",
    kind: "human" as const,
    content: "@Socrates speak.",
    at: 1000,
  };
  enqueueInvocation(room, message);
  const job = claimTurn(room, "human", 1000)!;
  completeGeneration(
    room,
    job.id,
    {
      ...message,
      id: "reply",
      senderId: "socrates",
      kind: "ai",
      content: "Thoughtful words. ".repeat(80),
    },
    2000,
  );
  assert.ok(room.active!.leaseUntil > 2000 + 35000);
  assert.equal(claimTurn(room, "other", 3000), null);
});
