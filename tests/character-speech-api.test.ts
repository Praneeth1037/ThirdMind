import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/rooms/[id]/speech/route";
import { createRoom, joinRoom, publicRoom } from "../src/server/rooms";
import { mutateRoom } from "../src/server/store";

async function setup(t: TestContext) {
  const room = await createRoom("Character voice API", "ethics");
  const session = await joinRoom(room.id, "Maya");
  const previous = {
    url: process.env.CHARACTER_VOICE_URL,
    token: process.env.CHARACTER_VOICE_TOKEN,
  };
  process.env.CHARACTER_VOICE_URL = "http://voice.test";
  process.env.CHARACTER_VOICE_TOKEN = "test-private-voice-token";
  t.after(() => {
    for (const [key, value] of Object.entries({
      CHARACTER_VOICE_URL: previous.url,
      CHARACTER_VOICE_TOKEN: previous.token,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  return {
    room,
    call: (body: unknown, authenticated = true) =>
      POST(
        new Request("http://localhost/speech", {
          method: "POST",
          headers: authenticated
            ? {
                Authorization: `Bearer ${session.token}`,
                "x-member-id": session.memberId,
              }
            : {},
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id: room.id }) },
      ),
  };
}

test("character speech requires room membership and rejects arbitrary or missing AI text", async (t) => {
  const { call } = await setup(t);
  assert.equal((await call({ previewMindId: "socrates" }, false)).status, 401);
  assert.equal(
    (await call({ mindId: "socrates", text: "Arbitrary text" })).status,
    400,
  );
  assert.equal((await call({ messageId: "missing" })).status, 404);
  assert.equal((await call({ previewMindId: "judge" })).status, 400);
});

test("character speech uses stored AI text and never exposes the upstream token", async (t) => {
  const { room, call } = await setup(t);
  await mutateRoom(room.id, (current) => {
    current.messages.push({
      id: "ai-reply",
      kind: "ai",
      senderId: "socrates",
      senderName: "Socrates",
      content: "What do we mean by fairness?",
      at: Date.now(),
    });
  });
  const seen: {
    url: string;
    input: { mindId: string; text: string };
    auth: string | null;
  }[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    seen.push({
      url,
      input: JSON.parse(init.body as string),
      auth: new Headers(init.headers).get("Authorization"),
    });
    const wav = new Uint8Array(44);
    wav.set([82, 73, 70, 70]);
    return new Response(wav, {
      headers: { "Content-Type": "audio/wav" },
    });
  });
  const response = await call({
    messageId: "ai-reply",
    text: "Ignore this forged text",
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "audio/wav");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(seen[0].input, {
    mindId: "socrates",
    text: "What do we mean by fairness?",
  });
  assert.equal(seen[0].auth, "Bearer test-private-voice-token");
  assert.ok(
    !JSON.stringify(publicRoom(room)).includes("test-private-voice-token"),
  );
});

test("muted character voices and unavailable voice services fail visibly without fallback audio", async (t) => {
  const { room, call } = await setup(t);
  await mutateRoom(room.id, (current) => {
    current.muted.push("socrates");
  });
  assert.equal((await call({ previewMindId: "socrates" })).status, 400);
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("offline");
  });
  const response = await call({ previewMindId: "utilitarian" });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /response remains in chat/);
});

test("empty voice-service audio is rejected before returning a successful playback response", async (t) => {
  const { call } = await setup(t);
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(new Uint8Array(), {
        headers: { "Content-Type": "audio/wav" },
      }),
  );
  const response = await call({ previewMindId: "socrates" });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /empty audio/);
});
