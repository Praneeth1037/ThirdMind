import { z } from "zod";
import { api, json, readJson } from "@/server/http";
import { createRoom, joinRoom, publicRoom } from "@/server/rooms";
import { rateLimit } from "@/server/store";
import { getMind } from "@/lib/minds";
import { SCENARIO_IDS } from "@/lib/scenarios";
import { icebreakerProfileSchema } from "@/lib/icebreaker";
const schema = z
  .object({
    name: z.string().trim().min(1).max(64),
    displayName: z.string().trim().min(1).max(32),
    scenario: z.enum(SCENARIO_IDS).default("blank"),
    initialMind: z
      .string()
      .refine((id) => Boolean(getMind(id)), "Unknown Mind.")
      .optional(),
    icebreaker: z.boolean().default(false),
    icebreakerProfile: icebreakerProfileSchema.optional(),
  })
  .refine((input) => !input.icebreaker || Boolean(input.icebreakerProfile), {
    message: "Complete the short Ice Breaker survey to create this room.",
    path: ["icebreakerProfile"],
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
      input.icebreaker,
    );
    const session = await joinRoom(
      room.id,
      input.displayName,
      input.icebreaker ? input.icebreakerProfile : undefined,
    );
    return json({ session, room: publicRoom(room) }, 201);
  });
}
