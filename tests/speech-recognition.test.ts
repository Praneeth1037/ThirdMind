import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BrowserSpeechRecognitionProvider,
  type RecognitionInstance,
  type RecognitionEvent,
  type RecognitionError,
} from "../src/lib/speech-recognition";

class FakeRecognition implements RecognitionInstance {
  static latest: FakeRecognition;
  lang = "";
  continuous = false;
  interimResults = false;
  starts = 0;
  aborts = 0;
  inputTrack?: MediaStreamTrack;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  onspeechend: (() => void) | null = null;
  onresult: ((event: RecognitionEvent) => void) | null = null;
  onerror: ((event: RecognitionError) => void) | null = null;
  constructor() {
    FakeRecognition.latest = this;
  }
  start(track?: MediaStreamTrack) {
    this.inputTrack = track;
    this.starts++;
    this.onstart?.();
  }
  abort() {
    this.aborts++;
    this.onend?.();
  }
}
function setup() {
  const transcripts: { text: string; final: boolean }[] = [],
    statuses: string[] = [],
    errors: string[] = [],
    speech: boolean[] = [];
  const provider = new BrowserSpeechRecognitionProvider(FakeRecognition, {
    onTranscript: (text, final) => transcripts.push({ text, final }),
    onStatus: (value) => statuses.push(value),
    onError: (value) => errors.push(value),
    onSpeech: (value) => speech.push(value),
  });
  provider.start();
  return {
    provider,
    recognition: FakeRecognition.latest,
    transcripts,
    statuses,
    errors,
    speech,
  };
}
test("speech recognition opts into continuous final/interim input and emits each final result once", () => {
  const { provider, recognition, transcripts } = setup();
  assert.equal(recognition.lang, "en-US");
  assert.equal(recognition.continuous, true);
  assert.equal(recognition.interimResults, true);
  recognition.onresult?.({
    resultIndex: 0,
    results: [{ isFinal: false, 0: { transcript: "Socrates" } }],
  });
  const final = {
    resultIndex: 0,
    results: [{ isFinal: true, 0: { transcript: "Socrates, speak." } }],
  };
  recognition.onresult?.(final);
  recognition.onresult?.(final);
  assert.deepEqual(transcripts, [
    { text: "Socrates", final: false },
    { text: "Socrates, speak.", final: true },
  ]);
  provider.stop();
  assert.equal(recognition.aborts, 1);
  assert.equal(recognition.onresult, null);
});
test("native split result fragments form one coherent draft and final request", () => {
  const { provider, recognition, transcripts } = setup();
  recognition.onresult?.({
    resultIndex: 0,
    results: [
      { isFinal: false, 0: { transcript: "Socrates" } },
      { isFinal: false, 0: { transcript: " what do you think" } },
    ],
  });
  recognition.onresult?.({
    resultIndex: 0,
    results: [
      { isFinal: true, 0: { transcript: "Socrates" } },
      { isFinal: true, 0: { transcript: " what do you think" } },
    ],
  });
  assert.deepEqual(transcripts, [
    { text: "Socrates what do you think", final: false },
    { text: "Socrates what do you think", final: true },
  ]);
  provider.stop();
});
test("speech recognition uses the same live audio track as the call", () => {
  const track = { kind: "audio", readyState: "live" } as MediaStreamTrack;
  const provider = new BrowserSpeechRecognitionProvider(
    FakeRecognition,
    {
      onTranscript: () => {},
      onStatus: () => {},
      onSpeech: () => {},
      onError: () => {},
    },
    track,
  );
  provider.start();
  assert.equal(FakeRecognition.latest.inputTrack, track);
  provider.stop();
});
test("speech errors stop listening and surface actionable feedback without retrying permission denial", () => {
  const { provider, recognition, errors } = setup();
  recognition.onerror?.({ error: "not-allowed" });
  assert.equal(recognition.aborts, 1);
  assert.equal(recognition.onend, null);
  assert.match(errors[0], /permission was denied/);
  provider.stop();
});
test("speech service network failures remain visible instead of claiming to listen", () => {
  const { provider, recognition, errors, statuses } = setup();
  recognition.onerror?.({ error: "network" });
  assert.equal(statuses.at(-1), "off");
  assert.match(errors[0], /could not connect/);
  assert.equal(recognition.onend, null);
  provider.stop();
});
test("recognition initialization failure is reported without escaping into the call UI", () => {
  class FailingRecognition extends FakeRecognition {
    constructor() {
      super();
      throw new Error("Unavailable service");
    }
  }
  const errors: string[] = [];
  const provider = new BrowserSpeechRecognitionProvider(FailingRecognition, {
    onTranscript: () => {},
    onStatus: () => {},
    onSpeech: () => {},
    onError: (message) => errors.push(message),
  });
  assert.doesNotThrow(() => provider.start());
  assert.match(errors[0], /could not initialize/);
  provider.stop();
});
test("browser session endings restart only while listening is explicitly enabled", async () => {
  const { provider, recognition } = setup();
  recognition.onend?.();
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.equal(recognition.starts, 2);
  recognition.onend?.();
  provider.stop();
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.equal(recognition.starts, 2);
});
test("stopping recognition prevents late callbacks and resets speech activity ownership", () => {
  const { provider, recognition, transcripts, speech } = setup();
  recognition.onspeechstart?.();
  recognition.onspeechend?.();
  const late = recognition.onresult;
  provider.stop();
  late?.({
    resultIndex: 0,
    results: [{ isFinal: true, 0: { transcript: "Socrates, speak." } }],
  });
  assert.equal(transcripts.length, 0);
  assert.deepEqual(speech, [true, false]);
});
