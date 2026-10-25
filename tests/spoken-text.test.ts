import { test } from "node:test";
import assert from "node:assert/strict";
import { spokenText } from "../src/lib/spoken-text";
test("spoken replies omit Markdown markers while keeping the actual answer", () => {
  assert.equal(
    spokenText(
      "## Dinner\n- **Time**: 30 minutes.\n- **Budget**: $12.\nTry `rice` and [chickpeas](https://example.com).",
    ),
    "Dinner\nTime: 30 minutes.\nBudget: $12.\nTry rice and chickpeas.",
  );
  assert.equal(
    spokenText("Here is the code:\n```js\nconsole.log('hello');\n```"),
    "Here is the code:\nThe code is included in the chat.",
  );
  assert.equal(
    spokenText("What makes an action right?"),
    "What makes an action right?",
  );
});
