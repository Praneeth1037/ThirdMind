import { z } from "zod";
import { api, json, readJson } from "@/server/http";
import { createRoom, joinRoom, publicRoom } from "@/server/rooms";
import { rateLimit } from "@/server/store";
import { getMind } from "@/lib/minds";
import { SCENARIO_IDS } from "@/lib/scenarios";
const schema = z.object({
  name: z.string().trim().min(1).max(64),
  displayName: z.string().trim().min(1).max(32),
  scenario: z.enum(SCENARIO_IDS).default("blank"),
  initialMind: z
    .string()
    .refine((id) => Boolean(getMind(id)), "Unknown Mind.")
    .optional(),
});
export async function POST(request: Request) {
  return api(async () => {
    const input = schema.parse(await readJson(request));
    await rateLimit(
      `create:${request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local"}`,
      12,
    );
    const room = await createRoom(
      input.name,
      input.scenario,
      input.initialMind,
    );
    const session = await joinRoom(room.id, input.displayName);
    return json({ session, room: publicRoom(room) }, 201);
  });
}
