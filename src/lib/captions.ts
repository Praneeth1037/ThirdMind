export type SpeechProgress = {
  state: "starting" | "speaking" | "finished" | "stopped" | "error";
  charIndex: number;
  charLength: number;
  hasWordTiming: boolean;
};
export type PlaybackCaption = SpeechProgress & { messageId: string };

// Browser speech events index the original utterance. Never invent timing if none is supplied.
export function captionSegments(
  text: string,
  charIndex: number,
  charLength = 0,
) {
  if (!Number.isFinite(charIndex) || charIndex < 0 || charIndex >= text.length)
    return { before: text, current: "", after: "" };
  const index = Math.trunc(charIndex);
  const tail = text.slice(index);
  const leading = /^\s*/u.exec(tail)?.[0].length ?? 0;
  const start = index + leading;
  const length =
    Number.isFinite(charLength) && charLength > 0
      ? Math.trunc(charLength)
      : (/^\S+/u.exec(text.slice(start))?.[0].length ?? 0);
  return {
    before: text.slice(0, start),
    current: text.slice(start, start + length),
    after: text.slice(start + length),
  };
}
