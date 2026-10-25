import { test } from "node:test";
import assert from "node:assert/strict";
import { routeMention } from "../src/lib/mention-router";
const cases: [string, string | null][] = [
  ["Socrates, speak.", "socrates"],
  ["Socrates please speak", "socrates"],
  ["Socrates. What do you think?", "socrates"],
  ["Socrates", null],
  ["Socrates, what do you think?", "socrates"],
  ["Hey Socrates, challenge this.", "socrates"],
  ["@Socrates challenge this.", "socrates"],
  ["Bentham, respond.", "utilitarian"],
  ["@Judge evaluate this.", "judge"],
  ["Feynman, explain this.", "feynman"],
  ["@Medical Ethicist evaluate this.", "medical_ethicist"],
  ["@Patient Advocate what are we missing?", "patient_advocate"],
  ["@Security Engineer evaluate our system.", "security"],
  ["I studied Socrates yesterday.", null],
  ["Socrates was Greek.", null],
  ["I disagree.", null],
  ["Someone said “Socrates, respond.”", null],
  ["Can Socrates answer this?", null],
  ["@Socrates", null],
  ["Socrates is wrong.", null],
  ["Socratesian philosophy", null],
  ["@Socratesish challenge this.", null],
  ["Socrates,", null],
  ["Socrates and Bentham were philosophers.", null],
  ['"@Socrates respond"', null],
];
for (const [text, target] of cases)
  test(`routing: ${text}`, () =>
    assert.equal(routeMention(text).targetMind, target));
test("referenced Mind is context, not an invoked target", () => {
  const result = routeMention("Bentham, respond to Socrates.");
  assert.deepEqual(result.targetMinds, ["utilitarian"]);
  assert.equal(result.referencedMind, "socrates");
});
test("multi-Mind voice address is bounded", () => {
  const result = routeMention("Socrates and Bentham debate for four turns.");
  assert.deepEqual(result.targetMinds, ["socrates", "utilitarian"]);
  assert.equal(result.turns, 4);
});
test("multi-Mind text address is bounded and deduplicated", () => {
  const result = routeMention(
    "@Socrates and @Bentham and @Socrates, debate this for 999 turns.",
  );
  assert.equal(result.turns, 6);
  assert.deepEqual(result.targetMinds, ["socrates", "utilitarian"]);
});
test("removed and muted Minds cannot be invoked", () => {
  assert.equal(
    routeMention("@Socrates respond.", ["judge"]).explicitInvocation,
    false,
  );
});
test("one Mind cannot produce an autonomous multi-turn debate", () =>
  assert.equal(routeMention("@Socrates debate this for six turns.").turns, 1));
