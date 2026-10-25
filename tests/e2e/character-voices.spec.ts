import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test.use({
  launchOptions: {
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
    ignoreDefaultArgs: ["--mute-audio"],
  },
});

test("natural character speech plays distinct neural voices and stops immediately on request", async ({
  page,
  request,
}) => {
  test.skip(
    !process.env.TEST_CHARACTER_VOICES,
    "Requires the real local neural speech worker and CHARACTER_VOICE_URL/TOKEN in the app environment.",
  );
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    const nativePlay = HTMLMediaElement.prototype.play;
    const events: { event: string; duration?: number }[] = [];
    Object.assign(window, { characterVoiceProbe: events });
    const players: HTMLAudioElement[] = [];
    Object.assign(window, { characterVoicePlayers: players });
    const audioLoads: { bytes: number; signature: string }[] = [];
    Object.assign(window, { characterVoiceLoads: audioLoads });
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await nativeFetch(...args);
      if (response.url.endsWith("/speech") && response.ok) {
        const buffer = await response.clone().arrayBuffer();
        audioLoads.push({
          bytes: buffer.byteLength,
          signature: new TextDecoder().decode(buffer.slice(0, 4)),
        });
      }
      return response;
    };
    HTMLMediaElement.prototype.play = function () {
      if (this instanceof HTMLAudioElement && this.src.startsWith("blob:")) {
        players.push(this);
        this.addEventListener("playing", () =>
          events.push({ event: "playing", duration: this.duration }),
        );
        this.addEventListener("ended", () => events.push({ event: "ended" }));
        this.addEventListener("pause", () => events.push({ event: "pause" }));
        this.addEventListener("error", () => events.push({ event: "error" }));
      }
      return nativePlay.call(this);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: /The ethics study group/ }).click();
  await page.getByLabel("Your display name").fill("Neural voice tester");
  await page
    .getByRole("button", { name: "Create conversation", exact: true })
    .click();
  await expect(
    page.getByText("Natural character voices · AI generated", { exact: true }),
  ).toBeVisible();
  const voices: { mind: string; voice: string | null; bytes: number }[] = [];
  for (const [index, name] of ["Socrates", "Bentham"].entries()) {
    const audioResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/speech") && response.status() === 200,
    );
    await page
      .locator(".room-minds-panel")
      .getByRole("button", { name: `Speak ${name}`, exact: true })
      .click();
    const response = await audioResponse;
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { characterVoiceLoads: unknown[] })
              .characterVoiceLoads.length,
        ),
      )
      .toBe(index + 1);
    const body = await page.evaluate(
      (index) =>
        (
          window as unknown as {
            characterVoiceLoads: { bytes: number; signature: string }[];
          }
        ).characterVoiceLoads[index],
      index,
    );
    expect(body.signature).toBe("RIFF");
    expect(body.bytes).toBeGreaterThan(10000);
    voices.push({
      mind: name,
      voice: response.headers()["x-character-voice"],
      bytes: body.bytes,
    });
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (
                window as unknown as {
                  characterVoiceProbe: { event: string }[];
                }
              ).characterVoiceProbe.filter((event) => event.event === "playing")
                .length,
          ),
        { timeout: 15000 },
      )
      .toBe(index + 1);
    if (index === 0)
      await page.screenshot({
        path: "artifacts/natural-character-voices.png",
        fullPage: true,
      });
    await expect(
      page
        .locator(".room-minds-panel")
        .getByRole("button", { name: `Speak ${name}`, exact: true }),
    ).toBeEnabled({ timeout: 45000 });
  }
  expect(voices.map((voice) => voice.voice)).toEqual(["bm_fable", "bm_george"]);
  const audioResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/speech") && response.status() === 200,
  );
  await page
    .locator(".room-minds-panel")
    .getByRole("button", { name: "Speak Socrates", exact: true })
    .click();
  await audioResponse;
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as { characterVoiceProbe: { event: string }[] }
          ).characterVoiceProbe.filter((event) => event.event === "playing")
            .length,
      ),
    )
    .toBe(3);
  await page.getByRole("button", { name: "Stop AI turn", exact: true }).click();
  await expect(
    page
      .locator(".room-minds-panel")
      .getByRole("button", { name: "Speak Socrates", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { characterVoicePlayers: HTMLAudioElement[] }
      ).characterVoicePlayers.every((audio) => audio.paused),
    ),
  ).toBe(true);
  const stoppedPlayers = await page.evaluate(() =>
    (
      window as unknown as { characterVoicePlayers: HTMLAudioElement[] }
    ).characterVoicePlayers.map((audio) => ({
      paused: audio.paused,
      hasSource: audio.hasAttribute("src"),
    })),
  );
  // Clearing a media source can discard its queued pause event; inspect the
  // actual detached Audio elements rather than counting that optional event.
  expect(stoppedPlayers).toHaveLength(3);
  expect(stoppedPlayers[2]).toEqual({ paused: true, hasSource: false });
  const roomId = page.url().split("/room/")[1];
  expect(
    (
      await request.post(`/api/rooms/${roomId}/speech`, {
        data: { previewMindId: "socrates" },
      })
    ).status(),
  ).toBe(401);
  const events = await page.evaluate(
    () =>
      (window as unknown as { characterVoiceProbe: { event: string }[] })
        .characterVoiceProbe,
  );
  expect(events.filter((event) => event.event === "ended")).toHaveLength(2);
  expect(events.filter((event) => event.event === "error")).toHaveLength(0);
  expect(pageErrors).toEqual([]);
  await writeFile(
    "artifacts/natural-character-playback.json",
    JSON.stringify({ voices, events, stoppedPlayers, pageErrors }, null, 2),
  );
});
