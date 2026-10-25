import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GroqProvider,
  GeminiProvider,
  type Prompt,
} from "../src/server/providers";
const prompt: Prompt = {
  system: "Judge perspective",
  context: "Maya and Alex are discussing ethics.",
  request: "Evaluate this.",
  mindId: "judge",
  scenario: "ethics",
};
test("Groq checks account model availability, keeps credentials in headers, and uses only current persona", async () => {
  const original = fetch,
    oldKey = process.env.GROQ_API_KEY,
    oldModel = process.env.GROQ_MODEL;
  process.env.GROQ_API_KEY = "test-key-for-unit-test";
  process.env.GROQ_MODEL = "available-test-model";
  const requests: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    return Response.json(
      url.endsWith("/models")
        ? { data: [{ id: "available-test-model", active: true }] }
        : {
            choices: [
              { message: { content: "There are two competing claims." } },
            ],
          },
    );
  };
  try {
    assert.equal((await new GroqProvider().generate(prompt)).demo, false);
    assert.equal(requests.length, 2);
    const body = JSON.parse(requests[1].init!.body as string);
    assert.equal(body.model, "available-test-model");
    assert.deepEqual(body.messages[0], {
      role: "system",
      content: prompt.system,
    });
    assert.ok(!requests[1].url.includes("test-key"));
    assert.equal(
      (requests[1].init!.headers as Record<string, string>).Authorization,
      "Bearer test-key-for-unit-test",
    );
  } finally {
    globalThis.fetch = original;
    if (oldKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.GROQ_MODEL;
    else process.env.GROQ_MODEL = oldModel;
  }
});
test("Gemini uses a server key and supported REST request shape", async () => {
  const original = fetch,
    oldKey = process.env.GEMINI_API_KEY,
    oldModel = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = "test-gemini-key";
  process.env.GEMINI_MODEL = "gemini-test";
  globalThis.fetch = async (input, init) => {
    assert.match(String(input), /models\/gemini-test:generateContent$/);
    const body = JSON.parse(init!.body as string);
    assert.equal(body.systemInstruction.parts[0].text, prompt.system);
    assert.equal(
      (init!.headers as Record<string, string>)["x-goog-api-key"],
      "test-gemini-key",
    );
    return Response.json({
      candidates: [
        { content: { parts: [{ text: "A balanced perspective." }] } },
      ],
    });
  };
  try {
    assert.equal(
      (await new GeminiProvider().generate(prompt)).text,
      "A balanced perspective.",
    );
  } finally {
    globalThis.fetch = original;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = oldModel;
  }
});

test("Groq discovers a current conversational model when legacy Llama models are unavailable", async (t) => {
  const oldKey = process.env.GROQ_API_KEY,
    oldModel = process.env.GROQ_MODEL;
  process.env.GROQ_API_KEY = "new-account-model-discovery";
  delete process.env.GROQ_MODEL;
  t.after(() => {
    if (oldKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.GROQ_MODEL;
    else process.env.GROQ_MODEL = oldModel;
  });
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (url.endsWith("/models"))
      return Response.json({
        data: [
          { id: "whisper-large-v3-turbo" },
          { id: "openai/gpt-oss-20b" },
          { id: "canopylabs/orpheus-v1-english" },
        ],
      });
    const body = JSON.parse(init.body as string);
    assert.equal(body.model, "openai/gpt-oss-20b");
    assert.equal(body.reasoning_effort, "low");
    assert.ok(body.max_completion_tokens >= 1024);
    return Response.json({
      choices: [
        { message: { content: "Check authorization at the server boundary." } },
      ],
    });
  });
  assert.equal((await new GroqProvider().generate(prompt)).demo, false);
});
