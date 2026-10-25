import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test.use({
  launchOptions: {
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
    ignoreDefaultArgs: ["--mute-audio"],
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
});

function observeNativeAudio() {
  const audio: { event: string; duration?: number }[] = [];
  Object.assign(window, { callAiAudio: audio });
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (this instanceof HTMLAudioElement && this.src.startsWith("blob:")) {
      this.addEventListener("playing", () =>
        audio.push({ event: "playing", duration: this.duration }),
      );
      this.addEventListener("ended", () => audio.push({ event: "ended" }));
      this.addEventListener("error", () => audio.push({ event: "error" }));
    }
    return play.call(this);
  };
}

test("both call participants hear the explicitly invited AI with native neural playback", async ({
  page,
  browser,
}) => {
  test.skip(
    !process.env.TEST_LIVEKIT || !process.env.TEST_CHARACTER_VOICES,
    "Requires local LiveKit and the neural voice worker.",
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(observeNativeAudio);
  await page.goto("/");
  await page.getByRole("button", { name: /The ethics study group/ }).click();
  await page.getByLabel("Your display name").fill("Pardha");
  await page
    .getByRole("button", { name: "Create conversation", exact: true })
    .click();
  await expect(page).toHaveURL(/\/room\//);
  const friendContext = await browser.newContext();
  const friend = await friendContext.newPage();
  friend.on("pageerror", (error) => errors.push(error.message));
  await friend.addInitScript(observeNativeAudio);
  await friend.goto(page.url());
  await friend.getByLabel("Your display name").fill("Julia");
  await friend.getByRole("button", { name: "Join room", exact: true }).click();
  for (const participant of [page, friend]) {
    await participant
      .getByRole("button", { name: "Start call", exact: true })
      .click();
    await expect(participant.locator(".call-status")).toContainText(
      "In the conversation",
    );
    await expect(
      participant
        .locator(".call-minds")
        .getByRole("button", { name: "Speak Socrates", exact: true }),
    ).toBeVisible();
  }
  await expect(page.locator(".ai-message")).toHaveCount(0);
  await page
    .locator(".call-minds")
    .getByRole("button", { name: "Speak Socrates", exact: true })
    .click();
  for (const participant of [page, friend]) {
    await expect
      .poll(
        () =>
          participant.evaluate(
            () =>
              (
                window as unknown as { callAiAudio: { event: string }[] }
              ).callAiAudio.filter((item) => item.event === "playing").length,
          ),
        { timeout: 30000 },
      )
      .toBe(1);
  }
  await page.screenshot({
    path: "artifacts/group-call-ai-speaking.png",
    fullPage: true,
  });
  await friend.screenshot({
    path: "artifacts/group-call-ai-listener.png",
    fullPage: true,
  });
  for (const participant of [page, friend]) {
    await expect
      .poll(
        () =>
          participant.evaluate(
            () =>
              (
                window as unknown as { callAiAudio: { event: string }[] }
              ).callAiAudio.filter((item) => item.event === "ended").length,
          ),
        { timeout: 30000 },
      )
      .toBe(1);
    await expect(participant.locator(".ai-message")).toHaveCount(1);
  }
  await expect(
    page
      .locator(".call-minds")
      .getByRole("button", { name: "Speak Socrates", exact: true }),
  ).toBeEnabled();
  const evidence = await Promise.all(
    [page, friend].map((participant) =>
      participant.evaluate(
        () => (window as unknown as { callAiAudio: unknown[] }).callAiAudio,
      ),
    ),
  );
  expect(errors).toEqual([]);
  await writeFile(
    "artifacts/group-call-ai-audio.json",
    JSON.stringify(
      {
        playback:
          "Native audio on each call participant's device; not a published AI RTP track",
        participants: evidence,
        errors,
      },
      null,
      2,
    ),
  );
  await friendContext.close();
});
