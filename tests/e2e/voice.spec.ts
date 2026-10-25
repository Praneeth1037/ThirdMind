import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const silence = resolve("test-results/voice-silence.wav");
test.use({
  launchOptions: {
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${silence}`,
    ],
  },
});
test.beforeAll(async () => {
  await mkdir("test-results", { recursive: true });
  const samples = 48000,
    header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + samples * 2, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(48000, 24);
  header.writeUInt32LE(96000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(samples * 2, 40);
  await writeFile(silence, Buffer.concat([header, Buffer.alloc(samples * 2)]));
});
type VoiceTest = {
  emit: (text: string, final?: boolean) => boolean;
  networkError: () => void;
  running: () => boolean;
  spoken: string[];
  maxSpeaking: number;
  speechError: boolean;
  instanceCount: () => number;
  holdSpeech: boolean;
  boundary: (index: number, length?: number) => void;
  finishSpeech: () => void;
};
declare global {
  interface Window {
    voiceTest: VoiceTest;
  }
}
function installSpeechMocks() {
  // These tests exercise the device-voice fallback. Native neural audio has a
  // separate integration check with the real character voice service.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    const url =
      typeof args[0] === "string"
        ? args[0]
        : args[0] instanceof URL
          ? args[0].href
          : args[0].url;
    if (
      url.includes("/api/rooms/") &&
      response.headers.get("Content-Type")?.includes("application/json")
    ) {
      const data = await response.clone().json();
      if (data.config) {
        data.config.tts = "browser";
        return new Response(JSON.stringify(data), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    return response;
  };
  type Result = { isFinal: boolean; 0: { transcript: string } };
  type Utterance = {
    text: string;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: ((e: { error: string }) => void) | null;
    onboundary:
      | ((e: { name: string; charIndex: number; charLength: number }) => void)
      | null;
  };
  const recognitions: Recognition[] = [];
  let instances = 0,
    speaking = 0,
    active: Utterance | null = null;
  const spoken: string[] = [];
  class Recognition {
    lang = "";
    continuous = false;
    interimResults = false;
    running = false;
    results: Result[] = [];
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onspeechstart: (() => void) | null = null;
    onspeechend: (() => void) | null = null;
    onresult:
      ((event: { resultIndex: number; results: Result[] }) => void) | null =
      null;
    onerror: ((e: { error: string }) => void) | null = null;
    constructor() {
      instances++;
      recognitions.push(this);
    }
    start() {
      this.results = [];
      this.running = true;
      this.onstart?.();
    }
    abort() {
      this.running = false;
      this.onend?.();
    }
  }
  Object.defineProperty(window, "SpeechRecognition", {
    configurable: true,
    value: Recognition,
  });
  Object.defineProperty(window, "SpeechSynthesisUtterance", {
    configurable: true,
    value: class {
      text: string;
      onstart = null;
      onend = null;
      onerror = null;
      onboundary = null;
      constructor(text: string) {
        this.text = text;
      }
    },
  });
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      getVoices: () => [{ name: "Samantha", lang: "en-US", default: true }],
      resume: () => {},
      cancel: () => {
        if (active) {
          const previous = active;
          active = null;
          speaking = Math.max(0, speaking - 1);
          previous.onerror?.({ error: "canceled" });
        }
      },
      speak: (utterance: Utterance) => {
        spoken.push(utterance.text);
        active = utterance;
        speaking++;
        window.voiceTest.maxSpeaking = Math.max(
          window.voiceTest.maxSpeaking,
          speaking,
        );
        utterance.onstart?.();
        setTimeout(() => {
          if (active !== utterance) return;
          if (window.voiceTest.holdSpeech && !window.voiceTest.speechError)
            return;
          active = null;
          speaking--;
          if (window.voiceTest.speechError)
            utterance.onerror?.({ error: "synthesis-failed" });
          else utterance.onend?.();
        }, 500);
      },
    },
  });
  window.voiceTest = {
    spoken,
    maxSpeaking: 0,
    speechError: false,
    holdSpeech: false,
    boundary: (index, length = 0) =>
      active?.onboundary?.({
        name: "word",
        charIndex: index,
        charLength: length,
      }),
    finishSpeech: () => {
      if (!active) return;
      const utterance = active;
      active = null;
      speaking = Math.max(0, speaking - 1);
      window.voiceTest.holdSpeech = false;
      utterance.onend?.();
    },
    instanceCount: () => instances,
    running: () => Boolean(recognitions.at(-1)?.running),
    networkError: () => recognitions.at(-1)?.onerror?.({ error: "network" }),
    emit: (text, final = true) => {
      const current = recognitions.at(-1);
      if (!current?.running) return false;
      const previous = current.results.at(-1),
        index =
          previous && !previous.isFinal
            ? current.results.length - 1
            : current.results.length;
      current.results[index] = { isFinal: final, 0: { transcript: text } };
      current.onresult?.({ resultIndex: index, results: current.results });
      return true;
    },
  };
}
test("explicit call voice input invokes only the addressed Mind and reads its reply aloud", async ({
  page,
}) => {
  test.skip(
    !process.env.TEST_LIVEKIT,
    "Needs the local LiveKit server. Recognition and synthesis are controlled browser doubles.",
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(installSpeechMocks);
  await page.goto("/");
  await page.getByRole("button", { name: /The ethics study group/ }).click();
  await page.getByLabel("Your display name").fill("Voice tester");
  await page
    .getByRole("button", { name: "Create conversation", exact: true })
    .click();
  await page.getByRole("button", { name: "Start call", exact: true }).click();
  await expect(page.locator(".call-status")).toContainText(
    "In the conversation",
  );
  expect(await page.evaluate(() => window.voiceTest.instanceCount())).toBe(0);
  await page.getByRole("button", { name: "Test speaker", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.voiceTest.spoken.length))
    .toBe(1);
  await page
    .getByRole("button", { name: "Enable Voice Minds", exact: true })
    .click();
  await expect(
    page.getByText("Listening for your speech", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Read AI responses aloud", exact: true }),
  ).toBeChecked();
  await page.evaluate(() =>
    window.voiceTest.emit("I studied Socrates yesterday."),
  );
  await expect(
    page
      .locator(".chat-scroll")
      .getByText("I studied Socrates yesterday.", { exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1300);
  await expect(page.locator(".ai-message")).toHaveCount(0);
  await page.evaluate(() => window.voiceTest.emit("Socrates"));
  await expect(
    page
      .locator(".chat-message .message-body p")
      .filter({ hasText: /^Socrates$/ }),
  ).toHaveCount(1);
  await expect(page.locator(".ai-message")).toHaveCount(0);
  await page.evaluate(() => window.voiceTest.emit("Socrates", false));
  await expect(page.locator(".caption-interim p")).toHaveText("Socrates");
  await page.evaluate(() => window.voiceTest.emit("Socrates, speak.", false));
  await expect(page.locator(".caption-interim p")).toHaveText(
    "Socrates, speak.",
  );
  await expect(
    page
      .locator(".chat-message .message-body p")
      .filter({ hasText: /^Socrates, speak\.$/ }),
  ).toHaveCount(0);
  await page.waitForTimeout(300);
  await expect(page.locator(".ai-message")).toHaveCount(0);
  await page.evaluate(() => {
    window.voiceTest.holdSpeech = true;
    window.voiceTest.emit("Socrates, speak.", true);
  });
  await expect(page.locator(".ai-message")).toHaveCount(1);
  await expect(page.locator(".ai-message .message-meta strong")).toHaveText(
    "Socrates",
  );
  await expect
    .poll(() => page.evaluate(() => window.voiceTest.spoken.length))
    .toBe(2);
  expect(await page.evaluate(() => window.voiceTest.maxSpeaking)).toBe(1);
  await expect(page.locator(".caption-ai").last()).toContainText("Socrates");
  await expect(page.locator(".caption-interim")).toHaveCount(0);
  await page.evaluate(() => window.voiceTest.boundary(0, 6));
  await expect(page.locator(".caption-current-word")).toHaveText("Before");
  await page.evaluate(() => window.voiceTest.boundary(7, 2));
  await expect(page.locator(".caption-current-word")).toHaveText("we");
  await page.screenshot({
    path: "artifacts/live-captions.png",
    fullPage: true,
  });
  await page.evaluate(() => window.voiceTest.finishSpeech());
  await expect(
    page.getByText("Listening for your speech", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".caption-current-word")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Hide live captions", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Live captions", exact: true }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => window.voiceTest.running())).toBe(true);
  await page
    .getByRole("button", { name: "Show live captions", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Live captions", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mute", exact: true }).click();
  await expect(
    page.getByText("Microphone muted · voice paused", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.voiceTest.running())).toBe(false);
  expect(
    await page.evaluate(() => window.voiceTest.emit("Bentham, respond.")),
  ).toBe(false);
  await page.getByRole("button", { name: "Unmute", exact: true }).click();
  await expect(
    page.getByText("Listening for your speech", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.voiceTest.speechError = true;
    window.voiceTest.emit("Bentham, respond.");
  });
  await expect(page.locator(".ai-message")).toHaveCount(2);
  await expect(
    page.locator(".ai-message").last().locator(".message-meta strong"),
  ).toHaveText("Bentham");
  await expect(page.locator(".room-error")).toContainText(
    "could not play the response",
  );
  await page
    .getByRole("button", { name: "Disable Voice Minds", exact: true })
    .click();
  expect(await page.evaluate(() => window.voiceTest.running())).toBe(false);
  await page.screenshot({ path: "artifacts/voice-minds.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("a speech service failure is visible and disables recognition without breaking the call", async ({
  page,
}) => {
  test.skip(!process.env.TEST_LIVEKIT, "Needs the local LiveKit server.");
  await page.addInitScript(installSpeechMocks);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start a conversation", exact: true })
    .click();
  await page.getByLabel("Your display name").fill("Voice errors");
  await page.getByLabel("Conversation name").fill("Speech error isolation");
  await page
    .getByRole("button", { name: "Create conversation", exact: true })
    .click();
  await page.getByRole("button", { name: "Start call", exact: true }).click();
  await page
    .getByRole("button", { name: "Enable Voice Minds", exact: true })
    .click();
  await expect(
    page.getByText("Listening for your speech", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.voiceTest.networkError());
  await expect(page.locator(".voice-error")).toContainText("could not connect");
  await expect(
    page.getByRole("button", { name: "Enable Voice Minds", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.voiceTest.running())).toBe(false);
  await expect(page.locator(".call-status")).toContainText(
    "In the conversation",
  );
  await page
    .getByRole("textbox", { name: "Message the group" })
    .fill("Our call and chat survive a speech-service error.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("Our call and chat survive a speech-service error.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("Speak buttons invoke invited Minds aloud, preserve drafts, and respect the turn queue", async ({
  page,
}) => {
  await page.addInitScript(installSpeechMocks);
  await page.goto("/");
  await page.getByRole("button", { name: /The ethics study group/ }).click();
  await page.getByLabel("Your display name").fill("Button tester");
  await page
    .getByRole("button", { name: "Create conversation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Speak Socrates", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Speak Bentham", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".ai-message")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Message the group" })
    .fill("Keep my unfinished message");
  await page.evaluate(() => {
    window.voiceTest.holdSpeech = true;
  });
  await page
    .getByRole("button", { name: "Speak Socrates", exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  await expect
    .poll(() => page.evaluate(() => window.voiceTest.spoken.length))
    .toBe(1);
  await expect(page.locator(".ai-message")).toHaveCount(1);
  await expect(page.locator(".ai-message .message-meta strong")).toHaveText(
    "Socrates",
  );
  await expect(
    page.getByRole("button", { name: "Speaking Socrates", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("switch", { name: "Read AI responses aloud", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("textbox", { name: "Message the group" }),
  ).toHaveValue("Keep my unfinished message");
  await page.getByRole("button", { name: "Add a Mind", exact: true }).click();
  await page
    .locator(".library-card")
    .filter({ has: page.getByRole("heading", { name: "Judge", exact: true }) })
    .getByRole("button", { name: "Invite Mind" })
    .click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Speak Judge", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Queued Judge", exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.voiceTest.spoken.length)).toBe(1);
  await page.screenshot({
    path: "artifacts/speak-buttons-desktop.png",
    fullPage: true,
  });
  await page.evaluate(() => window.voiceTest.finishSpeech());
  await expect
    .poll(() => page.evaluate(() => window.voiceTest.spoken.length))
    .toBe(2);
  await expect(
    page.locator(".ai-message .message-meta strong").nth(1),
  ).toHaveText("Judge");
  await page.evaluate(() => window.voiceTest.finishSpeech());
  await expect(
    page.getByRole("button", { name: "Speak Judge", exact: true }),
  ).toBeEnabled();
  expect(await page.evaluate(() => window.voiceTest.maxSpeaking)).toBe(1);
  await page.getByRole("button", { name: "Mute Bentham", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Muted Bentham", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Unmute Bentham", exact: true })
    .click();
  await page.route("**/api/rooms/*", async (route) => {
    if (route.request().postDataJSON()?.action === "message")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Temporary request failure" }),
      });
    else await route.continue();
  });
  await page
    .getByRole("button", { name: "Speak Bentham", exact: true })
    .click();
  await expect(page.locator(".room-error")).toContainText(
    "Temporary request failure",
  );
  await expect(
    page.getByRole("button", { name: "Speak Bentham", exact: true }),
  ).toBeEnabled();
  await page.unroute("**/api/rooms/*");
  await page
    .getByRole("button", { name: "Speak Bentham", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.voiceTest.spoken.length))
    .toBe(3);
  await expect(
    page.locator(".ai-message .message-meta strong").nth(2),
  ).toHaveText("Bentham");
});

test("mobile Minds show a working Speak button with speaking and idle states", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(installSpeechMocks);
  await page.goto("/");
  await page.getByRole("button", { name: /The ethics study group/ }).click();
  await page.getByLabel("Your display name").fill("Mobile voice tester");
  await page
    .getByRole("button", { name: "Create conversation", exact: true })
    .click();
  await page.getByRole("button", { name: "Minds", exact: true }).click();
  await page.evaluate(() => {
    window.voiceTest.holdSpeech = true;
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Speak Bentham", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.voiceTest.spoken.length))
    .toBe(1);
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Speaking Bentham", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: "artifacts/speak-buttons-mobile.png",
    fullPage: true,
  });
  await page.evaluate(() => window.voiceTest.finishSpeech());
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Speak Bentham", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(page.locator(".ai-message")).toHaveCount(1);
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
});
