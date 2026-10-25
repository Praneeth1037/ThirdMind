import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
test("start conversation dialog opens centered in the viewport", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start a conversation", exact: true })
    .click();

  const dialog = page.locator("dialog.modal");
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(Math.abs(bounds!.x + bounds!.width / 2 - 720)).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds!.y + bounds!.height / 2 - 500)).toBeLessThanOrEqual(1);
});
test("two humans share chat; Minds stay silent until invoked and debate exactly four turns", async ({
  browser,
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Bring the right minds into the conversation.",
    }),
  ).toBeVisible();
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({
    path: "artifacts/landing-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /The ethics study group/ }).click();
  await page.getByLabel("Your display name").fill("Pardha");
  await page
    .getByRole("button", { name: "Create conversation", exact: true })
    .click();
  await expect(page).toHaveURL(/\/room\//);
  await expect(
    page.getByRole("heading", { name: "Ethics study group.", exact: true }),
  ).toBeVisible();
  const url = page.url();
  const context2 = await browser.newContext();
  const friend = await context2.newPage();
  await friend.goto(url);
  await friend.getByLabel("Your display name").fill("Maya");
  await friend.getByRole("button", { name: "Join room", exact: true }).click();
  await expect(
    friend.getByRole("heading", { name: "Ethics study group.", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Message the group" })
    .fill("I studied Socrates yesterday.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    friend.getByText("I studied Socrates yesterday.", { exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1800);
  await expect(page.locator(".ai-message")).toHaveCount(0);
  await friend
    .getByRole("textbox", { name: "Message the group" })
    .fill("I disagree.");
  await friend
    .getByRole("button", { name: "Send message", exact: true })
    .click();
  await expect(page.getByText("I disagree.", { exact: true })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Message the group" })
    .fill("@Socrates challenge that.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.locator(".ai-message")).toHaveCount(1);
  await expect(friend.locator(".ai-message")).toHaveCount(1);
  await expect(page.locator(".ai-message .message-meta strong")).toHaveText(
    "Socrates",
  );
  await expect(page.locator(".ai-message")).toContainText("SCRIPTED DEMO");
  await page
    .getByRole("textbox", { name: "Message the group" })
    .fill("@Bentham respond.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.locator(".ai-message")).toHaveCount(2);
  await expect(page.locator(".ai-message").nth(1)).toContainText("Bentham");
  await page.getByRole("button", { name: "Add a Mind", exact: true }).click();
  const judge = page
    .locator(".library-card")
    .filter({ has: page.getByRole("heading", { name: "Judge", exact: true }) });
  await judge.getByRole("button", { name: "Invite Mind" }).click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(
    friend.locator(".room-mind-card").filter({ hasText: "Judge" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Message the group" })
    .fill("@Socrates and @Bentham debate this for four turns.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.locator(".ai-message")).toHaveCount(6, { timeout: 30000 });
  const sequence = await page
    .locator(".ai-message .message-meta strong")
    .allTextContents();
  expect(sequence).toEqual([
    "Socrates",
    "Bentham",
    "Bentham",
    "Socrates",
    "Bentham",
    "Socrates",
  ]);
  await page.waitForTimeout(2500);
  await expect(page.locator(".ai-message")).toHaveCount(6);
  await page.screenshot({ path: "artifacts/room-desktop.png", fullPage: true });
  await page.route("**/api/rooms/*/token", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Calls need LiveKit. Simulated service outage.",
      }),
    }),
  );
  await page.getByRole("button", { name: "Start call", exact: true }).click();
  await expect(page.locator(".room-error")).toContainText("Calls need LiveKit");
  await page
    .getByRole("textbox", { name: "Message the group" })
    .fill("Chat still works after a call service failure.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    friend.getByText("Chat still works after a call service failure.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await context2.close();
});
test("mobile create, mention suggestions, invite copy and access protection", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.screenshot({
    path: "artifacts/landing-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Start a conversation", exact: true })
    .click();
  await page.getByLabel("Your display name").fill("Alex");
  await page.getByLabel("Conversation name").fill("Late-night study club");
  await page
    .getByRole("button", { name: "Create conversation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Late-night study club." }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.getByRole("button", { name: "Minds", exact: true }).click();
  await page
    .getByRole("button", { name: "Discover Minds", exact: true })
    .click();
  await page
    .locator(".library-card")
    .filter({
      has: page.getByRole("heading", { name: "Socrates", exact: true }),
    })
    .getByRole("button", { name: "Invite Mind" })
    .click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("textbox", { name: "Message the group" }).fill("@Soc");
  await expect(page.locator(".mention-suggestions")).toContainText("Socrates");
  await page.locator(".mention-suggestions button").click();
  await page
    .getByRole("textbox", { name: "Message the group" })
    .fill("@Socrates explain this simply.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.locator(".ai-message")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Invite friends", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  const roomId = page.url().split("/room/")[1];
  const unauthorized = await request.get(`/api/rooms/${roomId}`);
  expect(unauthorized.status()).toBe(401);
  const invalid = await request.post("/api/rooms", {
    data: { name: "", displayName: "Alex" },
  });
  expect(invalid.status()).toBe(400);
  await page.screenshot({ path: "artifacts/room-mobile.png", fullPage: true });
});
