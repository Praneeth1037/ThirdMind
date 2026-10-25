import type { SpeechProgress } from "./captions";
import { loadSpeakingVoices, selectSpeakingVoice } from "./voice-selection";
import { spokenText } from "./spoken-text";
export interface TTSProvider {
  speak(
    text: string,
    voiceId: string,
    onProgress?: (progress: SpeechProgress) => void,
    messageId?: string,
  ): Promise<void>;
  stop(): void;
}
export class BrowserTTSProvider implements TTSProvider {
  private finish: (() => void) | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private startTimeout: ReturnType<typeof setTimeout> | null = null;
  private requestId = 0;
  async speak(
    text: string,
    voiceId: string,
    onProgress?: (progress: SpeechProgress) => void,
  ) {
    this.stop();
    const requestId = this.requestId;
    if (typeof window === "undefined" || !("speechSynthesis" in window))
      throw new Error(
        "This browser cannot read responses aloud. The response is still available in chat.",
      );
    const availableVoices = await loadSpeakingVoices(speechSynthesis);
    if (requestId !== this.requestId) return;
    const voice = selectSpeakingVoice(availableVoices, voiceId);
    if (!voice)
      throw new Error(
        "No standard English speaking voice is available. Choose a regular English voice in your device settings; the response remains in chat.",
      );
    return new Promise<void>((resolve, reject) => {
      let progress: SpeechProgress = {
        state: "starting",
        charIndex: 0,
        charLength: 0,
        hasWordTiming: false,
      };
      const report = (patch: Partial<SpeechProgress>) => {
        progress = { ...progress, ...patch };
        onProgress?.(progress);
      };
      report({ state: "starting" });
      const speech = spokenText(text);
      const utterance = new SpeechSynthesisUtterance(speech);
      this.utterance = utterance;
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = 0.98;
      utterance.pitch = 1;
      const cleanup = () => {
        if (this.startTimeout) clearTimeout(this.startTimeout);
        this.startTimeout = null;
        this.finish = null;
        this.utterance = null;
        utterance.onstart = utterance.onend = utterance.onerror = null;
        utterance.onboundary = null;
      };
      const done = (stopped = false) => {
        cleanup();
        report({ state: stopped ? "stopped" : "finished" });
        resolve();
      };
      const fail = (message: string) => {
        cleanup();
        report({ state: "error" });
        reject(new Error(message));
      };
      this.finish = () => done(true);
      utterance.onstart = () => {
        if (this.startTimeout) clearTimeout(this.startTimeout);
        this.startTimeout = null;
        report({ state: "speaking" });
      };
      utterance.onboundary = (event) => {
        // Formatting removal changes character offsets. Keep the full caption
        // rather than highlighting the wrong word in the original message.
        if (speech !== text) return;
        if (event.name === "sentence" || !Number.isFinite(event.charIndex))
          return;
        report({
          state: "speaking",
          charIndex: event.charIndex,
          charLength: event.charLength ?? 0,
          hasWordTiming: true,
        });
      };
      utterance.onend = () => done();
      utterance.onerror = (event) => {
        if (event.error === "canceled" || event.error === "interrupted") done();
        else
          fail(
            `Your browser could not play the response (${event.error}). Check the output device and try Test speaker. The text remains in chat.`,
          );
      };
      this.startTimeout = setTimeout(() => {
        fail(
          "Your browser did not start speech playback. Click Test speaker, check the output device, and try again.",
        );
        speechSynthesis.cancel();
      }, 5000);
      speechSynthesis.resume();
      speechSynthesis.speak(utterance);
    });
  }
  stop() {
    this.requestId++;
    this.finish?.();
    if (this.startTimeout) clearTimeout(this.startTimeout);
    this.startTimeout = null;
    if (this.utterance)
      this.utterance.onstart =
        this.utterance.onend =
        this.utterance.onerror =
        this.utterance.onboundary =
          null;
    this.utterance = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window)
      speechSynthesis.cancel();
    this.finish = null;
  }
}
export interface AvatarProvider {
  initialize(): void;
  start(): void;
  speak(): void;
  stop(): void;
  destroy(): void;
}
export class MockAvatarProvider implements AvatarProvider {
  constructor(
    private change: (state: "LISTENING" | "THINKING" | "SPEAKING") => void,
  ) {}
  initialize() {
    this.change("LISTENING");
  }
  start() {
    this.change("THINKING");
  }
  speak() {
    this.change("SPEAKING");
  }
  stop() {
    this.change("LISTENING");
  }
  destroy() {
    this.stop();
  }
}
