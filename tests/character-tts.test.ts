import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { CharacterTTSProvider } from "../src/lib/character-tts-provider";
import type { SpeechProgress } from "../src/lib/captions";

class FakeAudio {
  static latest: FakeAudio;
  static rejectPlay = false;
  onplaying: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  preload = "";
  paused = false;
  constructor(public src: string) {
    FakeAudio.latest = this;
  }
  pause() {
    this.paused = true;
  }
  removeAttribute() {
    this.src = "";
  }
  load() {}
  play() {
    if (FakeAudio.rejectPlay) return Promise.reject(new Error("blocked"));
    queueMicrotask(() => this.onplaying?.());
    return Promise.resolve();
  }
}
function setup(t: TestContext) {
  FakeAudio.rejectPlay = false;
  const previous = Object.getOwnPropertyDescriptor(globalThis, "Audio");
  Object.defineProperty(globalThis, "Audio", {
    configurable: true,
    value: FakeAudio,
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "Audio", previous);
    else Reflect.deleteProperty(globalThis, "Audio");
  });
  const revoked: string[] = [];
  t.mock.method(URL, "createObjectURL", () => "blob:character-audio");
  t.mock.method(URL, "revokeObjectURL", (url: string) => revoked.push(url));
  return revoked;
}
const advance = () => new Promise<void>((resolve) => setImmediate(resolve));

test("neural speech reports actual audio playback and releases its audio URL on completion", async (t) => {
  const revoked = setup(t);
  const states: SpeechProgress[] = [];
  const provider = new CharacterTTSProvider(async (mindId, messageId) => {
    assert.equal(mindId, "socrates");
    assert.equal(messageId, "ai-message");
    return new Blob(["WAV"]);
  });
  const done = provider.speak(
    "A thought.",
    "socrates",
    (state) => states.push(state),
    "ai-message",
  );
  await advance();
  assert.equal(states.at(-1)?.state, "speaking");
  assert.equal(states.at(-1)?.hasWordTiming, false);
  FakeAudio.latest.onended?.();
  await done;
  assert.equal(states.at(-1)?.state, "finished");
  assert.deepEqual(revoked, ["blob:character-audio"]);
});

test("human interruption aborts pending neural synthesis without late playback", async () => {
  let signal: AbortSignal | undefined;
  let release: (blob: Blob) => void = () => {};
  const states: SpeechProgress[] = [];
  const provider = new CharacterTTSProvider(
    async (_mind, _message, inputSignal) => {
      signal = inputSignal;
      return new Promise((resolve) => {
        release = resolve;
      });
    },
  );
  const done = provider.speak("A thought", "socrates", (state) =>
    states.push(state),
  );
  provider.stop();
  assert.equal(signal?.aborted, true);
  assert.equal(states.at(-1)?.state, "stopped");
  release(new Blob(["WAV"]));
  await done;
  assert.deepEqual(
    states.map((state) => state.state),
    ["starting", "stopped"],
  );
});

test("stopping neural playback pauses audio, clears the source, and resolves the turn", async (t) => {
  const revoked = setup(t);
  const provider = new CharacterTTSProvider(async () => new Blob(["WAV"]));
  const states: SpeechProgress[] = [];
  const done = provider.speak("A thought", "socrates", (state) =>
    states.push(state),
  );
  await advance();
  provider.stop();
  await done;
  assert.ok(FakeAudio.latest.paused);
  assert.equal(FakeAudio.latest.src, "");
  assert.equal(states.at(-1)?.state, "stopped");
  assert.equal(revoked.length, 1);
});

test("blocked neural audio rejects with an actionable error and keeps no playing source", async (t) => {
  const revoked = setup(t);
  FakeAudio.rejectPlay = true;
  const provider = new CharacterTTSProvider(async () => new Blob(["WAV"]));
  await assert.rejects(
    provider.speak("A thought", "socrates"),
    /browser blocked voice playback/,
  );
  assert.ok(FakeAudio.latest.paused);
  assert.equal(revoked.length, 1);
});
