// A small structural type keeps prefixed Web Speech implementations behind one boundary.
export type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};
export type RecognitionError = { error: string };
export interface RecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionError) => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  start(audioTrack?: MediaStreamTrack): void;
  abort(): void;
}
export type RecognitionConstructor = new () => RecognitionInstance;
export function browserRecognition(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const browser = window as typeof window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition ?? null;
}
type Callbacks = {
  onTranscript: (text: string, final: boolean) => void;
  onStatus: (status: "starting" | "listening" | "reconnecting" | "off") => void;
  onError: (message: string) => void;
  onSpeech: (speaking: boolean) => void;
};
const errors: Record<string, string> = {
  "not-allowed":
    "Microphone or speech recognition permission was denied. Allow it in your browser’s site settings, then enable Voice Minds again.",
  "service-not-allowed":
    "Your browser blocked its speech service. Try a supported browser or use a text mention.",
  "audio-capture":
    "Speech recognition cannot access your microphone. Check the selected input device and microphone permissions.",
  network:
    "The browser speech service could not connect. Check your connection or use a text mention; browser recognition may require internet access.",
  "language-not-supported":
    "Your browser speech service does not support English recognition on this device.",
};
export class BrowserSpeechRecognitionProvider {
  private recognition: RecognitionInstance | null = null;
  private wanted = false;
  private restart: ReturnType<typeof setTimeout> | null = null;
  constructor(
    private Constructor: RecognitionConstructor,
    private callbacks: Callbacks,
    private audioTrack?: MediaStreamTrack,
  ) {}
  start() {
    if (this.wanted) return;
    this.wanted = true;
    let recognition: RecognitionInstance;
    try {
      recognition = new this.Constructor();
    } catch {
      this.wanted = false;
      this.callbacks.onStatus("off");
      this.callbacks.onError(
        "Your browser could not initialize speech recognition. Use a text mention or try a supported browser.",
      );
      return;
    }
    this.recognition = recognition;
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    const finalResults = new Set<number>();
    recognition.onstart = () => {
      if (!this.wanted) return;
      finalResults.clear();
      this.callbacks.onStatus("listening");
    };
    recognition.onresult = (event) => {
      if (!this.wanted) return;
      const finalized: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (finalResults.has(i)) continue;
        const transcript = result[0]?.transcript.trim().slice(0, 3000);
        if (!transcript) continue;
        if (result.isFinal) {
          finalResults.add(i);
          finalized.push(transcript);
        }
      }
      if (finalized.length)
        this.callbacks.onTranscript(
          finalized.join(" ").replace(/\s+/g, " ").trim(),
          true,
        );
      const interim: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        if (!event.results[i].isFinal)
          interim.push(event.results[i][0]?.transcript ?? "");
      }
      const draft = interim
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 3000);
      if (draft) this.callbacks.onTranscript(draft, false);
    };
    recognition.onspeechstart = () => {
      if (this.wanted) this.callbacks.onSpeech(true);
    };
    recognition.onspeechend = () => {
      if (this.wanted) this.callbacks.onSpeech(false);
    };
    recognition.onerror = (event) => {
      if (
        !this.wanted ||
        event.error === "no-speech" ||
        event.error === "aborted"
      )
        return;
      this.stop();
      this.callbacks.onStatus("off");
      this.callbacks.onError(
        errors[event.error] ??
          `Speech recognition stopped (${event.error}). Use a text mention or try enabling it again.`,
      );
    };
    recognition.onend = () => {
      if (!this.wanted) return;
      this.callbacks.onSpeech(false);
      this.callbacks.onStatus("reconnecting");
      this.restart = setTimeout(() => this.begin(recognition), 350);
    };
    this.begin(recognition);
  }
  private begin(recognition: RecognitionInstance) {
    if (!this.wanted) return;
    this.callbacks.onStatus("starting");
    try {
      if (
        this.audioTrack &&
        (this.audioTrack.kind !== "audio" ||
          this.audioTrack.readyState !== "live")
      )
        throw new Error("Call microphone track stopped.");
      recognition.start(this.audioTrack);
    } catch {
      this.stop();
      this.callbacks.onStatus("off");
      this.callbacks.onError(
        "Your browser could not start speech recognition. Check microphone permissions and enable Voice Minds again.",
      );
    }
  }
  stop() {
    this.wanted = false;
    if (this.restart) clearTimeout(this.restart);
    this.restart = null;
    if (!this.recognition) return;
    const recognition = this.recognition;
    recognition.onstart =
      recognition.onend =
      recognition.onspeechstart =
      recognition.onspeechend =
        null;
    recognition.onresult = recognition.onerror = null;
    try {
      recognition.abort();
    } catch {
      /* Already stopped by the browser. */
    }
    this.recognition = null;
  }
}
