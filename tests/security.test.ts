import { test } from "node:test";
import assert from "node:assert/strict";
import {
  authenticatedRoom,
  createRoom,
  joinRoom,
  publicRoom,
} from "../src/server/rooms";
test("room membership tokens are bound to both room and participant", async () => {
  const first = await createRoom("Private", "blank"),
    second = await createRoom("Other", "blank");
  const a = await joinRoom(first.id, "Maya"),
    b = await joinRoom(first.id, "Alex");
  const request = (memberId: string, token: string) =>
    new Request("http://localhost", {
      headers: { "x-member-id": memberId, Authorization: `Bearer ${token}` },
    });
  assert.equal(
    (await authenticatedRoom(first.id, request(a.memberId, a.token))).member
      .name,
    "Maya",
  );
  await assert.rejects(
    () => authenticatedRoom(first.id, request(b.memberId, a.token)),
    /join this room/,
  );
  await assert.rejects(
    () => authenticatedRoom(second.id, request(a.memberId, a.token)),
    /join this room/,
  );
  await assert.rejects(
    () => authenticatedRoom(first.id, request(a.memberId, "bad-token")),
    /join this room/,
  );
});
test("public room excludes credential hashes, tokens and service secrets", async () => {
  const r = await createRoom("Public payload", "blank");
  const session = await joinRoom(r.id, "Maya");
  const { room } = await authenticatedRoom(
    r.id,
    new Request("http://localhost", {
      headers: {
        "x-member-id": session.memberId,
        Authorization: `Bearer ${session.token}`,
      },
    }),
  );
  const payload = JSON.stringify(publicRoom(room));
  assert.doesNotMatch(payload, /tokenHash|rateLimits/);
  assert.ok(!payload.includes(session.token));
  assert.equal(room.members[0].tokenHash.length, 64);
});
