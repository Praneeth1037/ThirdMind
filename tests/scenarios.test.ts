import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoom } from "../src/server/rooms";
import { getScenario, SCENARIOS } from "../src/lib/scenarios";
import { getMind } from "../src/lib/minds";
import { routeMention } from "../src/lib/mention-router";
import { ScriptedDemoProvider, buildPrompt } from "../src/server/providers";
import { claimTurn, enqueueInvocation } from "../src/lib/turn-manager";

test("each scenario installs the matching Minds, context and explicitly addressed starter prompts", async () => {
  for (const scenario of Object.values(SCENARIOS)) {
    const room = await createRoom(scenario.title, scenario.id);
    assert.deepEqual(room.minds, [...scenario.minds]);
    assert.equal(room.messages.length, scenario.messages.length);
    for (const mindId of scenario.minds) assert.ok(getMind(mindId));
    for (const prompt of scenario.prompts)
      assert.ok(
        routeMention(prompt, room.minds).explicitInvocation,
        `${scenario.id}: ${prompt}`,
      );
    assert.equal(room.active, null);
    assert.equal(room.queue.length, 0);
  }
  assert.equal(getScenario("blank"), undefined);
});

test("new use cases produce matching labeled demo examples rather than unrelated ethics replies", async () => {
  const provider = new ScriptedDemoProvider();
  for (const id of ["cs", "medical", "friends", "cooking"] as const) {
    const scenario = SCENARIOS[id];
    const room = await createRoom(scenario.title, id);
    enqueueInvocation(room, {
      id: "request",
      kind: "human",
      senderId: "human",
      senderName: "Student",
      content: scenario.prompts[0],
      at: Date.now(),
    });
    const job = claimTurn(room, "human")!;
    const prompt = buildPrompt(room, job);
    assert.ok(prompt.context.includes(scenario.short));
    const response = await provider.generate(prompt);
    assert.equal(response.demo, true);
    assert.ok(response.text.length > 40);
    assert.doesNotMatch(
      response.text,
      /one person were someone you loved|saving five lives/,
    );
  }
});
