import "server-only";
import { BASE_PROMPT, getMind } from "@/lib/minds";
import { characterVoice } from "@/lib/character-voices";
import { SCENARIO_DEMO } from "./scenario-demo";
import { getScenario } from "@/lib/scenarios";
import type { Job, Room } from "@/lib/types";

export type Prompt = {
  system: string;
  context: string;
  request: string;
  mindId: string;
  scenario: Room["scenario"];
};
export type Generated = { text: string; demo: boolean };
export interface LLMProvider {
  generate(prompt: Prompt): Promise<Generated>;
}
export function buildPrompt(room: Room, job: Job): Prompt {
  const mind = getMind(job.mindId);
  if (!mind) throw new Error("Unknown Mind.");
  return {
    system: `${BASE_PROMPT}\nYour perspective: ${mind.displayName}. ${mind.systemPrompt}\nDelivery: ${characterVoice(mind.id)?.delivery ?? "Speak naturally."} These are imagined AI character voices, not authentic historical recordings.`,
    context:
      `Room: ${room.name}\nScenario: ${getScenario(room.scenario)?.short ?? "Open conversation"}. ${getScenario(room.scenario)?.description ?? ""}\nEarlier conversation (extractive, may be incomplete):\n${room.summary}\nRecent conversation:\n${room.messages
        .slice(-24)
        .map((m) => `${m.senderName} [${m.kind}]: ${m.content}`)
        .join("\n")}`.slice(-26000),
    request: `${job.prompt}${job.debate ? "\nThis is one turn of a human-requested bounded debate. Respond to the latest argument from your own perspective; do not write other speakers’ turns." : ""}`,
    mindId: mind.id,
    scenario: room.scenario,
  };
}
async function checkedFetch(url: string, init: RequestInit, timeout = 22000) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeout),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`AI service returned ${response.status}.`);
  return response;
}
let modelCache: { key: string; model: string; until: number } | null = null;
export class GroqProvider implements LLMProvider {
  async generate(prompt: Prompt): Promise<Generated> {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("Groq is not configured.");
    let model =
      modelCache?.key === key && modelCache.until > Date.now()
        ? modelCache.model
        : undefined;
    if (!model) {
      const data = (await checkedFetch(
        "https://api.groq.com/openai/v1/models",
        { headers: { Authorization: `Bearer ${key}` } },
        8000,
      ).then((r) => r.json())) as { data: { id: string; active?: boolean }[] };
      const available = data.data
        .filter((m) => m.active !== false)
        .map((m) => m.id);
      const configured = process.env.GROQ_MODEL;
      // Preferences are documented models, but account availability is always checked.
      model = configured
        ? available.find((id) => id === configured)
        : [
            "openai/gpt-oss-20b",
            "openai/gpt-oss-120b",
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "qwen/qwen3-32b",
          ].find((id) => available.includes(id));
      if (!model)
        throw new Error(
          "Choose an available conversational model with GROQ_MODEL.",
        );
      modelCache = { key, model, until: Date.now() + 300000 };
    }
    const data = (await checkedFetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: prompt.system },
            {
              role: "user",
              content: `<shared_conversation>\n${prompt.context}\n</shared_conversation>\n\nExplicit human request:\n${prompt.request}`,
            },
          ],
          max_completion_tokens: model.startsWith("openai/gpt-oss")
            ? 1024
            : 320,
          ...(model.startsWith("openai/gpt-oss")
            ? { reasoning_effort: "low" }
            : {}),
          temperature: 0.65,
        }),
      },
    ).then((r) => r.json())) as { choices: { message: { content: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("The AI returned an empty response.");
    return { text: text.slice(0, 3000), demo: false };
  }
}
export class GeminiProvider implements LLMProvider {
  async generate(prompt: Prompt): Promise<Generated> {
    const key = process.env.GEMINI_API_KEY,
      model = process.env.GEMINI_MODEL;
    if (!key || !model || !/^gemini-[a-zA-Z0-9.\-]+$/.test(model))
      throw new Error("Configure GEMINI_API_KEY and a valid GEMINI_MODEL.");
    const data = (await checkedFetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompt.system }] },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Shared conversation:\n${prompt.context}\n\nExplicit request:\n${prompt.request}`,
                },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 400 },
        }),
      },
    ).then((r) => r.json())) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) throw new Error("The AI returned no text.");
    return { text: text.slice(0, 3000), demo: false };
  }
}
export class ScriptedDemoProvider implements LLMProvider {
  async generate(prompt: Prompt): Promise<Generated> {
    await new Promise((resolve) => setTimeout(resolve, 650));
    const ethics: Record<string, string> = {
      socrates:
        "Before we choose, what makes an action right: its outcome, or the principle behind it? Would your answer change if the one person were someone you loved?",
      utilitarian:
        "If all other consequences are equal, saving five lives prevents more suffering. But the effects on trust, consent, and future harm matter too. What consequences might our simple one-versus-five framing leave out?",
      judge:
        "The group agrees that human life matters; the disagreement is whether a better outcome can justify intentional harm. Maya’s argument rests on a duty not to kill, while the utilitarian view compares consequences. Which assumption should we examine first?",
      kantian:
        "Could you accept intentionally sacrificing an innocent person as a rule for everyone? A person’s dignity cannot simply be counted against a larger total.",
      mediator:
        "You share the goal of protecting lives, but weigh intentions and consequences differently. Can you agree on a case where saving more people would still cross a line?",
      feynman:
        "Try explaining your rule to a friend who has never studied ethics. What does “justified” actually mean in your argument?",
    };
    const study: Record<string, string> = {
      mediator:
        "The shared window is 4:00–5:15 pm, leaving Alex time for work. A quiet campus library session keeps Maya within the $10 budget; room availability is still unverified. Does that time and location work for everyone?",
      judge:
        "The class end time and work shift leave at most 90 minutes, before travel time. The library proposal fits the budget, but we still need to confirm availability and walking time. Shall we ask everyone to confirm 4:00–5:15?",
      socrates:
        "Are we optimizing for the longest session, or a session everyone can actually attend? How much travel time does Alex need before work?",
    };
    return {
      text:
        SCENARIO_DEMO[prompt.scenario]?.[prompt.mindId] ??
        (prompt.scenario === "study"
          ? study
          : prompt.scenario === "ethics" || prompt.scenario === "blank"
            ? ethics
            : {})[prompt.mindId] ??
        `From the ${getMind(prompt.mindId)?.displayName} perspective, which assumption in the group’s current proposal needs the strongest evidence? This is a scripted sample; connect Groq for responses tailored to your conversation.`,
      demo: true,
    };
  }
}
export function getProvider(): LLMProvider {
  const name = process.env.LLM_PROVIDER ?? "groq";
  if (name === "gemini" && process.env.GEMINI_API_KEY)
    return new GeminiProvider();
  if (name === "groq" && process.env.GROQ_API_KEY) return new GroqProvider();
  const demo =
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    (process.env.NODE_ENV !== "production" &&
      process.env.NEXT_PUBLIC_DEMO_MODE !== "false");
  if (demo) return new ScriptedDemoProvider();
  throw new Error("AI provider is not configured.");
}
