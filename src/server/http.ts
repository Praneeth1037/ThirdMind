import { ZodError } from "zod";
import { HttpError } from "./rooms";
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function api(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ZodError)
      return json({ error: error.issues[0]?.message ?? "Invalid input." }, 400);
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    const message = error instanceof Error ? error.message : "";
    if (/Too many/.test(message)) return json({ error: message }, 429);
    if (/not found|expired/.test(message))
      return json({ error: "Room not found or expired." }, 404);
    if (/Configure Upstash/.test(message)) return json({ error: message }, 503);
    if (error instanceof SyntaxError)
      return json({ error: "Invalid JSON." }, 400);
    console.error(
      "ThirdMind request failed:",
      error instanceof Error ? error.name : "Unknown error",
    );
    return json(
      { error: "Could not complete that request. Please try again." },
      500,
    );
  }
}
export async function readJson(request: Request) {
  const raw = await request.text();
  if (raw.length > 12000) throw new HttpError("Request is too large.", 413);
  return JSON.parse(raw);
}
