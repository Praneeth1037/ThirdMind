type SpeakingVoice = Pick<SpeechSynthesisVoice, "name" | "lang" | "default">;

// Platform voice lists contain musical, animal, and sound-effect voices too.
const novelty =
  /\b(?:albert|bad\s*news|bahh|bells|boing|bubbles|cellos|deranged|good\s*news|hysterical|jester|junior|organ|superstar|trinoids|whisper|wobble|zarvox)\b/i;
// Use known conversational voices for every Mind. An unknown default voice may
// itself be musical, so it must never be used as an unchecked fallback.
const conversational =
  /\b(?:aaron|alex|aria|ava|daniel|david|eddy|emma|eric|flo|george|guy|hazel|jenny|joanna|karen|mark|moira|rishi|ryan|samantha|susan|tessa|zira)\b|google (?:us|uk) english/i;

export function selectSpeakingVoice<T extends SpeakingVoice>(
  voices: readonly T[],
  mindId: string,
): T | undefined {
  const speaking = voices.filter(
    (voice) =>
      /^en(?:[-_]|$)/i.test(voice.lang) &&
      !novelty.test(voice.name) &&
      conversational.test(voice.name),
  );
  const preferred =
    mindId === "utilitarian" || mindId === "bentham"
      ? [
          /\bdaniel\b/i,
          /\bgeorge\b/i,
          /\bryan\b/i,
          /google uk english male/i,
          /\balex\b/i,
          /\bdavid\b/i,
          /\bsamantha\b/i,
        ]
      : mindId === "socrates" ||
          mindId === "feynman" ||
          mindId === "medical_ethicist" ||
          mindId === "architect" ||
          mindId === "kantian"
        ? [
            /\beddy.*english.*united states/i,
            /google uk english male/i,
            /\balex\b/i,
            /\baaron\b/i,
            /\bdaniel\b/i,
            /\bdavid\b/i,
            /\bsamantha\b/i,
          ]
        : [
            /\balex\b/i,
            /\baaron\b/i,
            /\bsamantha\b/i,
            /\bdaniel\b/i,
            /google us english/i,
          ];
  for (const name of preferred) {
    const voice = speaking.find((voice) => name.test(voice.name));
    if (voice) return voice;
  }
  return (
    speaking.find((voice) => voice.default) ??
    [...speaking].sort((a, b) => a.name.localeCompare(b.name))[0]
  );
}

export async function loadSpeakingVoices(
  synthesis: Pick<
    SpeechSynthesis,
    "getVoices" | "addEventListener" | "removeEventListener"
  >,
  timeoutMs = 1500,
): Promise<SpeechSynthesisVoice[]> {
  const voices = synthesis.getVoices();
  if (voices.length) return voices;
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timeout);
      synthesis.removeEventListener("voiceschanged", changed);
      resolve(synthesis.getVoices());
    };
    const changed = () => {
      if (synthesis.getVoices().length) finish();
    };
    const timeout = setTimeout(finish, timeoutMs);
    synthesis.addEventListener("voiceschanged", changed);
    changed();
  });
}
