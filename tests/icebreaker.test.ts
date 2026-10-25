import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fallbackIcebreakerPrompt,
  icebreakerProfileSchema,
  sharedIcebreakerInterests,
} from "../src/lib/icebreaker";
import {
  authenticatedRoom,
  createRoom,
  joinRoom,
  publicRoom,
} from "../src/server/rooms";

const profile = (interests: string[], topicsToAvoid: string[] = []) => ({
  interests,
  topicsToAvoid,
  style: "curious" as const,
  participation: "mix" as const,
});

test("shared-interest map only returns topics shared by multiple participants", () => {
  assert.deepEqual(
    sharedIcebreakerInterests([
      profile(["Travel", "Films", "private hobby"]),
      profile(["travel", "Music"]),
      profile(["Music"]),
    ]),
    ["Music", "Travel"],
  );
});

test("an avoided topic is excluded from the shared-interest map", () => {
  assert.deepEqual(
    sharedIcebreakerInterests([
      profile(["Travel"]),
      profile(["Travel"], ["travel"]),
    ]),
    [],
  );
});

test("fallback conversation prompts are available without an AI service", () => {
  assert.match(fallbackIcebreakerPrompt(["Travel"]), /travel/i);
  assert.match(fallbackIcebreakerPrompt([]), /curious to learn/i);
  assert.notEqual(
    fallbackIcebreakerPrompt(
      [],
      ["What is something you have been curious to learn or try lately?"],
    ),
    "What is something you have been curious to learn or try lately?",
  );
});

test("survey validation applies defaults and limits the number of topics", () => {
  assert.deepEqual(icebreakerProfileSchema.parse({ interests: ["Travel"] }), {
    interests: ["Travel"],
    topicsToAvoid: [],
    style: "curious",
    participation: "mix",
  });
  assert.throws(() =>
    icebreakerProfileSchema.parse({
      interests: Array.from({ length: 9 }, (_, index) => `Topic ${index}`),
    }),
  );
});

test("Ice Breaker rooms require a survey and enforce their 10-person capacity", async () => {
  const room = await createRoom("Capacity test", "blank", undefined, true);
  await assert.rejects(() => joinRoom(room.id, "No survey"), /survey/);

  for (let index = 0; index < 10; index++)
    await joinRoom(room.id, `Participant ${index + 1}`, profile(["Travel"]));

  await assert.rejects(
    () => joinRoom(room.id, "Participant 11", profile(["Travel"])),
    /10-person limit/,
  );
});

test("public room payloads do not expose private survey answers", async () => {
  const room = await createRoom("Privacy test", "blank", undefined, true);
  const session = await joinRoom(
    room.id,
    "Maya",
    profile(["non-shared private interest"], ["private boundary"]),
  );
  const { room: saved } = await authenticatedRoom(
    room.id,
    new Request("http://localhost", {
      headers: {
        "x-member-id": session.memberId,
        Authorization: `Bearer ${session.token}`,
      },
    }),
  );
  const payload = JSON.stringify(publicRoom(saved));
  assert.match(payload, /icebreakerProfileComplete/);
  assert.doesNotMatch(payload, /non-shared private interest|private boundary/);
});
