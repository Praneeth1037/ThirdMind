import type { TTSProvider } from "./media-providers";
import type { SpeechProgress } from "./captions";

type LoadSpeech = (
  mindId: string,
  messageId: string | undefined,
  signal: AbortSignal,
) => Promise<Blob>;

export class CharacterTTSProvider implements TTSProvider {
  private controller: AbortController | null = null;
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private finish: (() => void) | null = null;
  private reportStopped: (() => void) | null = null;

  constructor(private loadSpeech: LoadSpeech) {}

  async speak(
    _text: string,
    mindId: string,
    onProgress?: (progress: SpeechProgress) => void,
    messageId?: string,
  ) {
    this.stop();
    const controller = new AbortController();
    this.controller = controller;
    const report = (state: SpeechProgress["state"]) =>
      onProgress?.({
        state,
        charIndex: 0,
        charLength: 0,
        hasWordTiming: false,
      });
    report("starting");
    this.reportStopped = () => report("stopped");
    try {
      const blob = await this.loadSpeech(mindId, messageId, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.preload = "auto";
      this.audio = audio;
      this.objectUrl = url;
      await new Promise<void>((resolve, reject) => {
        let started = false;
        const timeout = setTimeout(
          () =>
            fail(
              "Your browser did not start voice playback. Click Speak again and check your audio output.",
            ),
          10000,
        );
        const cleanup = () => {
          clearTimeout(timeout);
          audio.onplaying = audio.onended = audio.onerror = null;
          audio.pause();
          audio.removeAttribute("src");
          audio.load();
          URL.revokeObjectURL(url);
          if (this.audio === audio) {
            this.audio = null;
            this.objectUrl = null;
            this.finish = null;
            this.controller = null;
            this.reportStopped = null;
          }
        };
        const done = (state: "finished" | "stopped") => {
          cleanup();
          report(state);
          resolve();
        };
        const fail = (message: string) => {
          cleanup();
          report("error");
          reject(new Error(message));
        };
        this.finish = () => done("stopped");
        audio.onplaying = () => {
          started = true;
          clearTimeout(timeout);
          report("speaking");
        };
        audio.onended = () => done("finished");
        audio.onerror = () =>
          fail(
            "Natural voice playback failed. Your response remains available in chat.",
          );
        void audio.play().catch(() => {
          if (!controller.signal.aborted && this.audio === audio && !started)
            fail(
              "Your browser blocked voice playback. Click Speak again or check your output device; the response remains in chat.",
            );
        });
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      if (this.controller === controller) this.controller = null;
      this.reportStopped = null;
      report("error");
      throw error;
    }
  }

  stop() {
    this.controller?.abort();
    this.controller = null;
    if (this.finish) this.finish();
    else this.reportStopped?.();
    this.reportStopped = null;
    this.finish = null;
    this.audio?.pause();
    this.audio = null;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }
}
