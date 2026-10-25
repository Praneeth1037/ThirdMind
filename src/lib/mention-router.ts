import { MINDS } from "./minds";
export type Invocation = {
  targetMind: string | null;
  targetMinds: string[];
  referencedMind?: string;
  explicitInvocation: boolean;
  intent: "respond" | "challenge" | "evaluate" | "explain" | "debate";
  turns: number;
};
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const aliases = MINDS.flatMap((m) =>
  m.aliases.map((alias) => ({ alias, id: m.id })),
).sort((a, b) => b.alias.length - a.alias.length);
const names = aliases.map((a) => escape(a.alias)).join("|");
const action =
  /^(?:please\s+)?(?:what\b|why\b|how\b|can\s+you\b|could\s+you\b|would\s+you\b|do\s+you\b|respond\b|reply\b|speak\b|talk\b|tell\s+(?:us|me)\b|share\b|challenge\b|evaluate\b|explain\b|debate\b|give\b|help\b|compare\b|analyze\b|analyse\b|summarize\b|summarise\b|find\b|plan\b|weigh\b|consider\b)/i;
export function routeMention(
  text: string,
  enabled = MINDS.map((m) => m.id),
): Invocation {
  const empty: Invocation = {
    targetMind: null,
    targetMinds: [],
    explicitInvocation: false,
    intent: "respond",
    turns: 0,
  };
  const value = text.trim().replace(/^(?:hey|hi|okay|ok)\s+/i, "");
  // Only an address at the start is permission. A name later in prose is context.
  const header = new RegExp(
    `^(@?(?:${names}))(?=$|[\\s,:.!?—&-])(?:\\s*(?:,?\\s+and\\s+|,\\s*|&\\s*)@?(?:${names})(?=$|[\\s,:.!?—&-]))*`,
    "i",
  ).exec(value);
  if (!header) return empty;
  const rest = value.slice(header[0].length).replace(/^[\s,:.!?—-]+/, "");
  const hasAt = header[0].includes("@");
  if (!rest || (!hasAt && !action.test(rest))) return empty;
  const targets: string[] = [];
  const matcher = new RegExp(`@?(${names})(?=$|[\\s,&:])`, "gi");
  for (const match of header[0].matchAll(matcher)) {
    const entry = aliases.find(
      (a) => a.alias.toLowerCase() === match[1].toLowerCase(),
    );
    if (entry && enabled.includes(entry.id) && !targets.includes(entry.id))
      targets.push(entry.id);
  }
  if (!targets.length) return empty;
  const intent = /\bdebate\b/i.test(rest)
    ? "debate"
    : /\bchallenge\b/i.test(rest)
      ? "challenge"
      : /\bevaluate\b/i.test(rest)
        ? "evaluate"
        : /\bexplain\b/i.test(rest)
          ? "explain"
          : "respond";
  const digits = /\b(\d+|one|two|three|four|five|six)\s+turns?\b/i
    .exec(rest)?.[1]
    ?.toLowerCase();
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
  };
  const turns =
    intent === "debate" && targets.length > 1
      ? Math.min(6, Math.max(1, digits ? (words[digits] ?? Number(digits)) : 4))
      : targets.length;
  const referencedMind = aliases.find(
    (a) =>
      !targets.includes(a.id) &&
      new RegExp(`\\b${escape(a.alias)}\\b`, "i").test(rest),
  )?.id;
  return {
    targetMind: targets[0],
    targetMinds: targets,
    referencedMind,
    explicitInvocation: true,
    intent,
    turns,
  };
}
