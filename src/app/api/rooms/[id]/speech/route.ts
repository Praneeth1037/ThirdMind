import { z } from "zod";
import { api, readJson } from "@/server/http";
import { authenticatedRoom, HttpError } from "@/server/rooms";
import { rateLimit } from "@/server/store";
import { characterVoice, VOICE_PREVIEW } from "@/lib/character-voices";
import { groqSpeech } from "@/server/speech";

export const maxDuration = 60;
const schema = z.union([
  z.object({ messageId: z.string().min(1) }),
  z.object({ previewMindId: z.string().min(1) }),
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    const { id } = await params;
    const { room, member } = await authenticatedRoom(id, request);
    await rateLimit(`speech:${id}:${member.id}`, 30);
    const input = schema.parse(await readJson(request));
    const message =
      "messageId" in input
        ? room.messages.find((m) => m.id === input.messageId && m.kind === "ai")
        : undefined;
    if ("messageId" in input && !message)
      throw new HttpError("This AI response is no longer available.", 404);
    const mindId =
      message?.senderId ??
      ("previewMindId" in input ? input.previewMindId : "");
    if (
      !room.minds.includes(mindId) ||
      room.muted.includes(mindId) ||
      !characterVoice(mindId)
    )
      throw new HttpError(
        "Invite and unmute this Mind before using its voice.",
      );
    const url = process.env.CHARACTER_VOICE_URL;
    const token = process.env.CHARACTER_VOICE_TOKEN;
    if (
      (!url || !token) &&
      process.env.GROQ_API_KEY &&
      process.env.GROQ_TTS_ENABLED !== "false"
    ) {
      try {
        const audio = await groqSpeech(
          message?.content ?? VOICE_PREVIEW,
          mindId,
          AbortSignal.any([request.signal, AbortSignal.timeout(45000)]),
        );
        return new Response(audio, {
          headers: {
            "Content-Type": "audio/wav",
            "Content-Length": String(audio.byteLength),
            "Cache-Control": "no-store",
            "X-Voice-Mode": "character",
            "X-Character-Voice": `groq:${mindId}`,
          },
        });
      } catch (error) {
        console.error("Cloud speech failed", {
          status:
            error instanceof Error
              ? (/returned (\d{3})/.exec(error.message)?.[1] ?? "unknown")
              : "unknown",
          issue:
            error instanceof Error && /Model terms/.test(error.message)
              ? "model-terms-required"
              : error instanceof Error &&
                  /speech audio|speech format/.test(error.message)
                ? "audio-format"
                : "request-failed",
        });
        if (error instanceof Error && /Model terms/.test(error.message))
          throw new HttpError(
            "Natural voices need the account owner to review and accept the Orpheus model terms in Groq Console. Device voices remain available.",
            503,
          );
        throw new HttpError(
          "Natural speech is temporarily unavailable. Please use device voice playback or try again.",
          503,
        );
      }
    }
    if (!url || !token)
      throw new HttpError(
        "Natural voices are not configured. Start the character voice service or use device voices.",
        503,
      );
    let upstream: Response;
    try {
      upstream = await fetch(`${url.replace(/\/$/, "")}/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mindId,
          text: message?.content ?? VOICE_PREVIEW,
        }),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(45000)]),
        cache: "no-store",
      });
    } catch {
      throw new HttpError(
        "Natural voice playback is unavailable. Start the character voice service; your response remains in chat.",
        503,
      );
    }
    if (
      !upstream.ok ||
      !upstream.headers.get("Content-Type")?.startsWith("audio/")
    )
      throw new HttpError(
        "Natural voices are busy or unavailable. Please try again; your response remains in chat.",
        503,
      );
    // Finish reading before returning: the incoming request's abort signal is
    // tied to its lifetime and must not cancel an audio stream after headers.
    let wav: ArrayBuffer;
    try {
      wav = await upstream.arrayBuffer();
    } catch {
      throw new HttpError(
        "Natural voice playback could not finish loading. Your response remains in chat.",
        503,
      );
    }
    if (
      wav.byteLength < 44 ||
      new TextDecoder().decode(wav.slice(0, 4)) !== "RIFF"
    )
      throw new HttpError(
        "The voice service returned empty audio. Please try again; your response remains in chat.",
        503,
      );
    return new Response(wav, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(wav.byteLength),
        "Cache-Control": "no-store",
        "X-Voice-Mode": "character",
        "X-Character-Voice": characterVoice(mindId)!.voice,
      },
    });
  });
}
