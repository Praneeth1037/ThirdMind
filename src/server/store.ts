import "server-only";
import { Redis } from "@upstash/redis";
import type { Room } from "@/lib/types";

const globalStore = globalThis as typeof globalThis & {
  thirdMindRooms?: Map<string, Room>;
  thirdMindRate?: Map<string, { count: number; until: number }>;
};
const memory = (globalStore.thirdMindRooms ??= new Map());
const limits = (globalStore.thirdMindRate ??= new Map());
const redisCredentials =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? {
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      }
    : process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
      ? {
          url: process.env.KV_REST_API_URL,
          token: process.env.KV_REST_API_TOKEN,
        }
      : null;
export const redisConfigured = Boolean(redisCredentials);
const redis = redisCredentials
  ? new Redis({ ...redisCredentials, automaticDeserialization: false })
  : null;
function requireStore() {
  if (process.env.VERCEL && !redis)
    throw new Error(
      "Configure Upstash Redis before deploying shared rooms on Vercel.",
    );
}
const key = (id: string) => `thirdmind:room:${id}`;
export async function loadRoom(id: string): Promise<Room | null> {
  requireStore();
  const room = redis
    ? await redis
        .get<string>(key(id))
        .then((v) => (v ? (JSON.parse(v) as Room) : null))
    : structuredClone(memory.get(id) ?? null);
  if (room && room.expiresAt <= Date.now()) {
    if (!redis) memory.delete(id);
    return null;
  }
  return room;
}
export async function saveNewRoom(room: Room) {
  requireStore();
  if (redis)
    await redis.set(key(room.id), JSON.stringify(room), {
      nx: true,
      ex: 86400,
    });
  else {
    for (const [id, value] of memory)
      if (value.expiresAt <= Date.now()) memory.delete(id);
    if (memory.size >= 1000)
      throw new Error(
        "Local room capacity reached. Restart the development server or configure Redis.",
      );
    memory.set(room.id, structuredClone(room));
  }
}
export async function mutateRoom<T>(
  id: string,
  fn: (room: Room) => T,
): Promise<{ room: Room; result: T }> {
  for (let attempt = 0; attempt < 15; attempt++) {
    const room = await loadRoom(id);
    if (!room) throw new Error("Room not found or expired.");
    const revision = room.revision;
    const result = fn(room);
    room.revision++;
    if (redis) {
      const ok = await redis.eval<[number, string], number>(
        `local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end; local room=cjson.decode(raw); if room.revision~=tonumber(ARGV[1]) then return 0 end; redis.call('SET',KEYS[1],ARGV[2],'KEEPTTL'); return 1`,
        [key(id)],
        [revision, JSON.stringify(room)],
      );
      if (ok === 1) return { room, result };
    } else if (memory.get(id)?.revision === revision) {
      memory.set(id, structuredClone(room));
      return { room, result };
    }
  }
  throw new Error("Room is busy. Please try again.");
}
export async function rateLimit(bucket: string, limit = 20, seconds = 60) {
  requireStore();
  if (redis) {
    const count = await redis.eval<[number], number>(
      `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n`,
      [`thirdmind:rate:${bucket}`],
      [seconds],
    );
    if (count > limit)
      throw new Error("Too many requests. Please wait a minute.");
  } else {
    const now = Date.now();
    for (const [key, value] of limits)
      if (value.until < now) limits.delete(key);
    const value = limits.get(bucket);
    if (!value || value.until < now)
      limits.set(bucket, { count: 1, until: now + seconds * 1000 });
    else {
      value.count++;
      if (value.count > limit)
        throw new Error("Too many requests. Please wait a minute.");
    }
  }
}
