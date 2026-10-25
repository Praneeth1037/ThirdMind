import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { createHash, timingSafeEqual } from "node:crypto";
import { KokoroTTS } from "kokoro-js";
import { z } from "zod";
import { characterVoice, VOICE_PREVIEW } from "../src/lib/character-voices";
import { speechChunks } from "../src/lib/speech-chunks";
import { spokenText } from "../src/lib/spoken-text";

async function main() {
  if (existsSync(".env.local")) process.loadEnvFile?.(".env.local");
  const token = process.env.CHARACTER_VOICE_TOKEN;
  if (!token)
    throw new Error(
      "Set CHARACTER_VOICE_TOKEN in .env.local before starting character voices.",
    );
  console.log("Loading the local neural speech model…");
  const tts = await KokoroTTS.from_pretrained(
    "onnx-community/Kokoro-82M-v1.0-ONNX",
    { dtype: "q8", device: "cpu" },
  );
  // Prime the model before marking the service ready; no user's speech is recorded.
  await tts.generate(VOICE_PREVIEW, { voice: "bm_fable", speed: 0.9 });
  const cache = new Map<string, Buffer>();
  let queue = Promise.resolve();
  let pending = 0;
  const expected = createHash("sha256").update(token).digest();
  const schema = z.object({
    mindId: z.string(),
    text: z.string().trim().min(1).max(3000),
  });
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const supplied = createHash("sha256")
      .update(request.headers.authorization?.replace(/^Bearer /, "") ?? "")
      .digest();
    if (!timingSafeEqual(expected, supplied)) {
      response.writeHead(401).end();
      return;
    }
    if (request.method === "GET" && request.url === "/health") {
      response
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify({ ready: true, provider: "kokoro" }));
      return;
    }
    if (request.method !== "POST" || request.url !== "/speech") {
      response.writeHead(404).end();
      return;
    }
    try {
      let body = "";
      for await (const chunk of request) {
        body += chunk.toString();
        if (body.length > 14000) {
          response.writeHead(413).end();
          return;
        }
      }
      const input = schema.parse(JSON.parse(body));
      const profile = characterVoice(input.mindId);
      if (!profile) {
        response.writeHead(400).end();
        return;
      }
      const key = createHash("sha256")
        .update(`${profile.voice}:${profile.speed}:${input.text}`)
        .digest("hex");
      const send = (wav: Buffer) => {
        if (!response.destroyed)
          response
            .writeHead(200, {
              "Content-Type": "audio/wav",
              "Content-Length": wav.length,
              "X-Character-Voice": profile.voice,
            })
            .end(wav);
      };
      const cached = cache.get(key);
      if (cached) {
        send(cached);
        return;
      }
      if (pending >= 4) {
        response.writeHead(503).end();
        return;
      }
      pending++;
      const generate = queue.then(async () => {
        if (response.destroyed) return;
        // Sentence chunks prevent the model's 512-token input limit from silently truncating long replies.
        const parts: Float32Array[] = [];
        for (const text of speechChunks(spokenText(input.text))) {
          const audio = await tts.generate(text.trim(), {
            voice: profile.voice,
            speed: profile.speed,
          });
          parts.push(audio.audio);
        }
        const samples = parts.reduce((n, part) => n + part.length, 0);
        const wav = Buffer.alloc(44 + samples * 2);
        wav.write("RIFF");
        wav.writeUInt32LE(wav.length - 8, 4);
        wav.write("WAVEfmt ", 8);
        wav.writeUInt32LE(16, 16);
        wav.writeUInt16LE(1, 20);
        wav.writeUInt16LE(1, 22);
        wav.writeUInt32LE(24000, 24);
        wav.writeUInt32LE(48000, 28);
        wav.writeUInt16LE(2, 32);
        wav.writeUInt16LE(16, 34);
        wav.write("data", 36);
        wav.writeUInt32LE(samples * 2, 40);
        let offset = 44;
        for (const part of parts)
          for (const sample of part) {
            wav.writeInt16LE(
              Math.round(Math.max(-1, Math.min(1, sample)) * 32767),
              offset,
            );
            offset += 2;
          }
        if (cache.size >= 20) cache.delete(cache.keys().next().value!);
        cache.set(key, wav);
        send(wav);
      });
      queue = generate
        .catch(() => {})
        .finally(() => {
          pending--;
        });
      await generate;
    } catch (error) {
      if (!response.headersSent)
        response
          .writeHead(
            error instanceof z.ZodError || error instanceof SyntaxError
              ? 400
              : 500,
          )
          .end();
      console.error(
        "Character speech request failed:",
        error instanceof Error ? error.name : "Error",
      );
    }
  });
  const port = Number(process.env.CHARACTER_VOICE_PORT || 7891);
  server.listen(port, "127.0.0.1", () =>
    console.log(`Natural character voices ready on 127.0.0.1:${port}`),
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Voice server failed");
  process.exitCode = 1;
});
