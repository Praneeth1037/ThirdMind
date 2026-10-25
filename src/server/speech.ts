import "server-only";
import { speechChunks } from "@/lib/speech-chunks";
import { combineWav } from "./wav";
import { spokenText } from "@/lib/spoken-text";

const voices: Record<string, string> = {
  socrates: "troy",
  utilitarian: "daniel",
  kantian: "austin",
  feynman: "austin",
  judge: "diana",
  mediator: "autumn",
  doctor: "hannah",
  medical_ethicist: "daniel",
  patient_advocate: "autumn",
  architect: "troy",
  security: "diana",
  devils_advocate: "hannah",
};
const pending = new Map<string, Promise<Uint8Array<ArrayBuffer>>>();
const cache = new Map<
  string,
  { audio: Uint8Array<ArrayBuffer>; until: number }
>();

export const naturalSpeechConfigured = () =>
  Boolean(
    (process.env.CHARACTER_VOICE_URL && process.env.CHARACTER_VOICE_TOKEN) ||
    (process.env.GROQ_API_KEY && process.env.GROQ_TTS_ENABLED !== "false"),
  );

export async function groqSpeech(
  text: string,
  mindId: string,
  signal: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  const key = `${mindId}:${text}`;
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return cached.audio;
  const existing = pending.get(key);
  if (existing) return existing;
  const generation = (async () => {
    const files: Uint8Array[] = [];
    // Orpheus interprets bracketed performance directions. Remove them so a
    // quoted instruction can never turn a conversational reply into singing.
    const conversationalText = spokenText(text)
      .replace(/\[[^\]]{0,120}\]/g, "")
      .trim();
    for (const input of speechChunks(conversationalText, 190)) {
      const response = await fetch(
        "https://api.groq.com/openai/v1/audio/speech",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model:
              process.env.GROQ_TTS_MODEL || "canopylabs/orpheus-v1-english",
            input,
            voice: voices[mindId] ?? "troy",
            response_format: "wav",
          }),
          signal,
          cache: "no-store",
        },
      );
      if (!response.ok) {
        const problem = (await response.json().catch(() => null)) as {
          error?: { code?: string; message?: string };
        } | null;
        const requiresTerms = /terms|agreement|accept.*model/i.test(
          `${problem?.error?.code ?? ""} ${problem?.error?.message ?? ""}`,
        );
        throw new Error(
          `Speech service returned ${response.status}.${requiresTerms ? " Model terms require account-owner acceptance." : ""}`,
        );
      }
      files.push(new Uint8Array(await response.arrayBuffer()));
    }
    const audio = combineWav(files);
    if (cache.size >= 12) cache.delete(cache.keys().next().value!);
    cache.set(key, { audio, until: Date.now() + 120000 });
    return audio;
  })();
  pending.set(key, generation);
  try {
    return await generation;
  } finally {
    pending.delete(key);
  }
}
