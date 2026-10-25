import { randomUUID } from "node:crypto";
import { getMind } from "@/lib/minds";
import { claimTurn, completeGeneration } from "@/lib/turn-manager";
import type { Job, Room } from "@/lib/types";
import { buildPrompt, getProvider, type LLMProvider } from "./providers";
import { mutateRoom } from "./store";

export async function runNextTurn(
  roomId: string,
  memberId: string,
  provider?: LLMProvider,
) {
  const claimed = await mutateRoom(roomId, (room) => claimTurn(room, memberId));
  const job: Job | null = claimed.result;
  if (!job) return claimed.room;
  try {
    const result = await (provider ?? getProvider()).generate(
      buildPrompt(claimed.room, job),
    );
    return (
      await mutateRoom(roomId, (room) =>
        completeGeneration(room, job.id, {
          id: randomUUID(),
          senderId: job.mindId,
          senderName: getMind(job.mindId)!.displayName,
          kind: "ai",
          content: result.text,
          at: Date.now(),
          demo: result.demo,
        }),
      )
    ).room;
  } catch (error) {
    const status =
      error instanceof Error
        ? /returned (\d{3})/.exec(error.message)?.[1]
        : undefined;
    console.error("AI provider request failed", {
      status: status ?? "unknown",
      type: error instanceof Error ? error.name : "Error",
      issue:
        error instanceof Error &&
        /available conversational model/.test(error.message)
          ? "no-supported-model"
          : error instanceof Error && /empty response/.test(error.message)
            ? "empty-response"
            : "request-failed",
    });
    const reason =
      status === "401"
        ? "The AI service did not accept its API key. Ask the room owner to check the AI connection."
        : status === "429"
          ? "The AI service has reached a usage limit. Please try again later."
          : status === "403"
            ? "The AI model is not enabled for this account. Ask the room owner to check the AI connection."
            : "Your conversation can continue. Please try again in a moment.";
    return (
      await mutateRoom(roomId, (room: Room) => {
        if (room.active?.id !== job.id) return;
        room.messages.push({
          id: randomUUID(),
          senderId: "system",
          senderName: "ThirdMind",
          kind: "system",
          content: `${getMind(job.mindId)?.displayName} is temporarily unavailable. ${reason}`,
          at: Date.now(),
        });
        room.active = null;
        // Stop this failed debate/request rather than cascading provider failures.
        room.queue = room.queue.filter((j) => j.requestId !== job.requestId);
      })
    ).room;
  }
}
