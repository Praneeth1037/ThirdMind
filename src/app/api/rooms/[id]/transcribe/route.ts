import { api, json } from "@/server/http";
import { authenticatedRoom, HttpError } from "@/server/rooms";
import { rateLimit } from "@/server/store";
export const maxDuration = 30;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    const { id } = await params;
    const { member } = await authenticatedRoom(id, request);
    await rateLimit(`stt:${id}:${member.id}`, 10);
    const key = process.env.GROQ_API_KEY;
    if (!key)
      throw new HttpError(
        "Voice transcription needs GROQ_API_KEY. You can still invite Minds with text mentions.",
        503,
      );
    if (Number(request.headers.get("content-length") ?? 0) > 5_000_000)
      throw new HttpError("Audio exceeds the 5 MB limit.", 413);
    const input = await request.formData();
    const file = input.get("file");
    if (
      !(file instanceof File) ||
      file.size > 4_500_000 ||
      !file.size ||
      !/^audio\/(webm|mp4|ogg|wav|mpeg)/.test(file.type)
    )
      throw new HttpError("Record an audio clip under 4.5 MB.");
    const body = new FormData();
    body.append("file", file);
    body.append(
      "model",
      process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo",
    );
    body.append("response_format", "json");
    const response = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body,
        signal: AbortSignal.timeout(22000),
      },
    );
    if (!response.ok)
      throw new HttpError(
        "Transcription is temporarily unavailable. Please use text.",
        502,
      );
    const result = (await response.json()) as { text?: string };
    return json({ text: result.text?.trim().slice(0, 3000) ?? "" });
  });
}
