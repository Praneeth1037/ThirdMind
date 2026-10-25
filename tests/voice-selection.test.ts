import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import {
  loadSpeakingVoices,
  selectSpeakingVoice,
} from "../src/lib/voice-selection";
import { MINDS } from "../src/lib/minds";
import { BrowserTTSProvider } from "../src/lib/media-providers";
const voice = (name: string, primary = false) => ({
  name,
  lang: "en-US",
  default: primary,
});
test("Bentham chooses a named speaking voice regardless of platform voice list ordering", () => {
  const voices = [
    voice("Bells"),
    voice("Good News", true),
    voice("Daniel"),
    voice("Cellos"),
    voice("Samantha"),
  ];
  assert.equal(selectSpeakingVoice(voices, "utilitarian")?.name, "Daniel");
  assert.equal(
    selectSpeakingVoice([...voices].reverse(), "utilitarian")?.name,
    "Daniel",
  );
});
test("musical and novelty voices are excluded even when they are the platform default", () => {
  for (const name of [
    "Good News",
    "Bad News",
    "Cellos",
    "Bells",
    "Organ",
    "Superstar",
    "Albert",
    "Bahh",
  ])
    assert.equal(
      selectSpeakingVoice([voice(name, true), voice("Karen")], "utilitarian")
        ?.name,
      "Karen",
    );
});
test("voice selection falls back to ordinary speech or no selection without choosing a musical voice", () => {
  assert.equal(
    selectSpeakingVoice([voice("Cellos"), voice("Samantha")], "utilitarian")
      ?.name,
    "Samantha",
  );
  assert.equal(
    selectSpeakingVoice([voice("Cellos", true), voice("Bells")], "utilitarian"),
    undefined,
  );
  assert.equal(selectSpeakingVoice([], "utilitarian"), undefined);
});

test("every Mind rejects musical and unknown default voices in any voice-list order", () => {
  const voices = [
    voice("Unknown singing voice", true),
    voice("Good News"),
    voice("Bells"),
    voice("Samantha"),
    voice("Daniel"),
  ];
  for (const mind of MINDS) {
    for (const ordered of [voices, [...voices].reverse()]) {
      assert.ok(
        ["Samantha", "Daniel"].includes(
          selectSpeakingVoice(ordered, mind.voiceId)?.name ?? "",
        ),
        mind.displayName,
      );
    }
    assert.equal(
      selectSpeakingVoice([voice("Unknown singing voice", true)], mind.voiceId),
      undefined,
      mind.displayName,
    );
    assert.equal(
      selectSpeakingVoice(
        [voice("Cellos"), voice("Good News", true)],
        mind.voiceId,
      ),
      undefined,
      mind.displayName,
    );
  }
});

class VoiceSource extends EventTarget {
  voices: SpeechSynthesisVoice[] = [];
  getVoices() {
    return this.voices;
  }
}

test("an initially empty voice list waits for voiceschanged before selection", async () => {
  const source = new VoiceSource();
  const pending = loadSpeakingVoices(source, 100);
  source.dispatchEvent(new Event("voiceschanged"));
  source.voices = [voice("Samantha") as SpeechSynthesisVoice];
  source.dispatchEvent(new Event("voiceschanged"));
  assert.equal(
    selectSpeakingVoice(await pending, "socrates")?.name,
    "Samantha",
  );
});

test("an unavailable voice list times out without selecting an unchecked native default", async () => {
  assert.deepEqual(await loadSpeakingVoices(new VoiceSource(), 5), []);
});

function installSynthesis(t: TestContext, source: VoiceSource) {
  let spoken = 0;
  const synthesis = Object.assign(source, {
    cancel() {},
    resume() {},
    speak() {
      spoken++;
    },
  });
  for (const [name, value] of Object.entries({
    window: { speechSynthesis: synthesis },
    speechSynthesis: synthesis,
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
  return () => spoken;
}

test("the speech provider refuses playback when only novelty voices are installed", async (t) => {
  const source = new VoiceSource();
  source.voices = [voice("Good News", true) as SpeechSynthesisVoice];
  const spoken = installSynthesis(t, source);
  await assert.rejects(
    new BrowserTTSProvider().speak("Hello", "socrates"),
    /No standard English speaking voice/,
  );
  assert.equal(spoken(), 0);
});

test("stopping speech while voices load prevents delayed playback", async (t) => {
  const source = new VoiceSource();
  const spoken = installSynthesis(t, source);
  const provider = new BrowserTTSProvider();
  const pending = provider.speak("Hello", "socrates");
  provider.stop();
  source.voices = [voice("Samantha") as SpeechSynthesisVoice];
  source.dispatchEvent(new Event("voiceschanged"));
  await pending;
  assert.equal(spoken(), 0);
});
