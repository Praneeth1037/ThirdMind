import { test, expect } from "@playwright/test";
test("LiveKit transports two-way camera and microphone while group chat stays active", async ({
  browser,
  page,
}) => {
  test.skip(
    !process.env.TEST_LIVEKIT,
    "Run with TEST_LIVEKIT=1 and configured LiveKit server environment.",
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const instrument = () => {
    const peers: RTCPeerConnection[] = [];
    const Native = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends Native {
      constructor(config?: RTCConfiguration) {
        super(config);
        peers.push(this);
      }
    };
    (
      window as typeof window & { thirdmindTestPeers: RTCPeerConnection[] }
    ).thirdmindTestPeers = peers;
  };
  await page.addInitScript(instrument);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start a conversation", exact: true })
    .click();
  await page.getByLabel("Your display name").fill("Pardha");
  await page.getByLabel("Conversation name").fill("WebRTC campus room");
  await page
    .getByRole("button", { name: "Create conversation", exact: true })
    .click();
  await expect(page).toHaveURL(/\/room\//);
  const context = await browser.newContext({
    permissions: ["camera", "microphone"],
  });
  const friend = await context.newPage();
  friend.on("pageerror", (error) => errors.push(error.message));
  await friend.addInitScript(instrument);
  await friend.goto(page.url());
  await friend.getByLabel("Your display name").fill("Maya");
  await friend.getByRole("button", { name: "Join room", exact: true }).click();
  await expect(
    friend.getByRole("heading", { name: "WebRTC campus room." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start call", exact: true }).click();
  await friend
    .getByRole("button", { name: /^(Start|Join) call$/, exact: true })
    .click();
  for (const p of [page, friend]) {
    await expect(p.locator(".call-status")).toContainText(
      "In the conversation",
    );
    await p.getByRole("button", { name: "Camera on", exact: true }).click();
    await p.getByRole("button", { name: "Unmute", exact: true }).click();
  }
  for (const p of [page, friend]) {
    await expect
      .poll(
        () =>
          p
            .locator(".call-panel video")
            .evaluateAll(
              (elements) =>
                elements.filter(
                  (el) =>
                    (el as HTMLVideoElement).videoWidth > 0 &&
                    (el as HTMLVideoElement).readyState >= 2,
                ).length,
            ),
        { timeout: 20000 },
      )
      .toBe(2);
    await expect
      .poll(
        () =>
          p.locator(".call-panel audio").evaluateAll((elements) =>
            elements.some((el) => {
              const audio = el as HTMLAudioElement;
              return (
                audio.srcObject instanceof MediaStream &&
                audio.srcObject
                  .getAudioTracks()
                  .some((t) => t.readyState === "live") &&
                !audio.paused
              );
            }),
          ),
        { timeout: 15000 },
      )
      .toBe(true);
    await expect
      .poll(
        () =>
          p.evaluate(async () => {
            const peers = (
              window as typeof window & {
                thirdmindTestPeers: RTCPeerConnection[];
              }
            ).thirdmindTestPeers;
            const kinds = new Set<string>();
            for (const peer of peers) {
              if (peer.connectionState !== "connected") continue;
              const stats = await peer.getStats();
              stats.forEach((report) => {
                if (report.type === "inbound-rtp" && report.bytesReceived > 0)
                  kinds.add(report.kind);
              });
            }
            return [...kinds].sort();
          }),
        { timeout: 15000 },
      )
      .toEqual(["audio", "video"]);
  }
  await page
    .getByRole("textbox", { name: "Message the group" })
    .fill("We can chat while both cameras are on.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    friend.getByText("We can chat while both cameras are on.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/livekit-call.png", fullPage: true });
  await page.getByRole("button", { name: "Camera off", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Camera on", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mute", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unmute", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Leave call", exact: true }).click();
  await expect(page.locator(".call-panel")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Message the group" })
    .fill("The call ended. Our conversation is still here.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    friend.getByText("The call ended. Our conversation is still here.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});
