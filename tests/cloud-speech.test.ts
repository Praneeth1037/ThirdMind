import { test } from "node:test";
import assert from "node:assert/strict";
import { combineWav } from "../src/server/wav";
import { groqSpeech } from "../src/server/speech";

function wav(samples: number[]) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF");
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(24000, 24);
  buffer.writeUInt32LE(48000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) =>
    buffer.writeInt16LE(sample, 44 + index * 2),
  );
  return buffer;
}
test("cloud speech joins complete WAV segments without losing spoken audio", () => {
  const result = Buffer.from(combineWav([wav([1, 2]), wav([3, 4, 5])]));
  assert.equal(result.toString("ascii", 0, 4), "RIFF");
  assert.equal(result.readUInt32LE(40), 10);
  assert.equal(result.length, 54);
  assert.deepEqual(
    [...Array(5)].map((_, i) => result.readInt16LE(44 + i * 2)),
    [1, 2, 3, 4, 5],
  );
  assert.throws(() => combineWav([new Uint8Array()]), /Invalid/);
  const truncated = wav([1, 2]).subarray(0, 45);
  assert.throws(() => combineWav([truncated]), /Incomplete/);
});
test("Groq speech uses short conversational chunks and strips performance directions", async (t) => {
  const requests: { input: string; voice: string }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(init.body as string));
      return new Response(wav([100, -100]), {
        headers: { "Content-Type": "audio/wav" },
      });
    },
  );
  const audio = await groqSpeech(
    "[singsong] " + "Please consider this choice carefully. ".repeat(12),
    "socrates",
    new AbortController().signal,
  );
  assert.ok(audio.length > 44);
  assert.ok(requests.length > 1);
  assert.ok(
    requests.every(
      (item) =>
        item.input.length <= 190 &&
        !item.input.includes("singsong") &&
        item.voice === "troy",
    ),
  );
});

test("Groq speech identifies account-required model terms without accepting them", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      {
        error: {
          code: "model_terms_required",
          message: "Accept the model terms in your account.",
        },
      },
      { status: 400 },
    ),
  );
  await assert.rejects(
    groqSpeech(
      "A separate voice activation test.",
      "utilitarian",
      new AbortController().signal,
    ),
    /Model terms require account-owner acceptance/,
  );
});
