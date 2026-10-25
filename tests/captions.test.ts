import { test } from "node:test";
import assert from "node:assert/strict";
import { captionSegments } from "../src/lib/captions";
test("spoken-word captions use the actual browser character offset", () => {
  assert.deepEqual(captionSegments("Before we choose, what matters?", 7, 2), {
    before: "Before ",
    current: "we",
    after: " choose, what matters?",
  });
});
test("voices without word lengths highlight only the word at the supplied offset", () => {
  assert.deepEqual(captionSegments("Before we choose.", 10), {
    before: "Before we ",
    current: "choose.",
    after: "",
  });
});
test("whitespace boundaries and invalid offsets preserve the full utterance", () => {
  const text = "One  two";
  assert.deepEqual(captionSegments(text, 3), {
    before: "One  ",
    current: "two",
    after: "",
  });
  for (const index of [-1, 99, NaN])
    assert.deepEqual(captionSegments(text, index), {
      before: text,
      current: "",
      after: "",
    });
});
test("Unicode text and punctuation are retained without altering the spoken content", () => {
  const text = "Is “dignity” universal?";
  const parts = captionSegments(text, 3);
  assert.equal(parts.current, "“dignity”");
  assert.equal(parts.before + parts.current + parts.after, text);
});
