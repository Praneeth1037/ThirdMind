import type { IcebreakerProfile } from "./types";
import { z } from "zod";

export const MAX_ICEBREAKER_PARTICIPANTS = 10;
export const icebreakerProfileSchema = z.object({
  interests: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
  topicsToAvoid: z.array(z.string().trim().min(1).max(40)).max(5).default([]),
  style: z
    .enum(["casual", "funny", "curious", "thoughtful"])
    .default("curious"),
  participation: z.enum(["answer", "ask", "stories", "mix"]).default("mix"),
});

export function sharedIcebreakerInterests(
  profiles: IcebreakerProfile[],
): string[] {
  const avoidedTopics = new Set(
    profiles
      .flatMap((profile) => profile.topicsToAvoid)
      .map((topic) => topic.trim().toLocaleLowerCase())
      .filter(Boolean),
  );
  const counts = new Map<
    string,
    { label: string; participants: Set<number> }
  >();
  profiles.forEach((profile, participant) => {
    const uniqueTopics = new Set(
      profile.interests
        .map((topic) => topic.trim())
        .filter(Boolean)
        .map((topic) => topic.toLocaleLowerCase()),
    );
    for (const normalized of uniqueTopics) {
      if (avoidedTopics.has(normalized)) continue;
      const label =
        profile.interests
          .find((topic) => topic.trim().toLocaleLowerCase() === normalized)
          ?.trim() ?? normalized;
      const entry = counts.get(normalized) ?? {
        label,
        participants: new Set<number>(),
      };
      entry.participants.add(participant);
      counts.set(normalized, entry);
    }
  });
  return [...counts.values()]
    .filter((entry) => entry.participants.size > 1)
    .map((entry) => entry.label)
    .sort((a, b) => a.localeCompare(b));
}

export function fallbackIcebreakerPrompt(
  interests: string[],
  previousPrompts: string[] = [],
): string {
  const previous = previousPrompts.map((prompt) => prompt.toLocaleLowerCase());
  const interest = interests.find(
    (topic) =>
      !previous.some((prompt) => prompt.includes(topic.toLocaleLowerCase())),
  );
  if (interest)
    return `A few of you enjoy ${interest}. What first got you interested in it?`;
  const starters = [
    "What is something you have been curious to learn or try lately?",
    "What is a small thing that made your week better?",
    "What place would you happily revisit, and what would you do there?",
    "What is something you recently changed your mind about?",
  ];
  return (
    starters.find(
      (starter) => !previous.includes(starter.toLocaleLowerCase()),
    ) ?? starters[0]
  );
}
