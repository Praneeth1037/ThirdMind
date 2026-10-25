export const CHARACTER_VOICES = {
  socrates: {
    voice: "bm_fable",
    speed: 0.9,
    label: "Reflective storyteller",
    delivery:
      "Speak thoughtfully, with measured phrasing and a calm, curious tone.",
  },
  utilitarian: {
    voice: "bm_george",
    speed: 0.96,
    label: "Measured British thinker",
    delivery:
      "Speak with measured British phrasing, warmth, and clear practical reasoning.",
  },
  kantian: {
    voice: "bm_daniel",
    speed: 0.94,
    label: "Precise and deliberate",
    delivery:
      "Speak precisely and deliberately, using short, carefully reasoned sentences.",
  },
  feynman: {
    voice: "am_michael",
    speed: 1.04,
    label: "Lively American teacher",
    delivery:
      "Speak with lively conversational curiosity and simple, concrete examples.",
  },
  judge: {
    voice: "bf_emma",
    speed: 0.96,
    label: "Calm and authoritative",
    delivery: "Speak evenly and clearly, with calm authority.",
  },
  mediator: {
    voice: "af_heart",
    speed: 0.98,
    label: "Warm and reassuring",
    delivery:
      "Speak warmly and reassuringly, making room for everyone's concerns.",
  },
  doctor: {
    voice: "af_sarah",
    speed: 1,
    label: "Clear and composed",
    delivery: "Speak clearly and calmly, explaining unfamiliar terms.",
  },
  medical_ethicist: {
    voice: "bm_lewis",
    speed: 0.97,
    label: "Thoughtful and balanced",
    delivery:
      "Speak thoughtfully and compassionately, weighing values carefully.",
  },
  patient_advocate: {
    voice: "af_bella",
    speed: 0.98,
    label: "Empathetic and direct",
    delivery:
      "Speak with empathy and directness, centering the person's preferences.",
  },
  architect: {
    voice: "am_fenrir",
    speed: 1.02,
    label: "Confident and practical",
    delivery: "Speak confidently and practically, making tradeoffs concrete.",
  },
  security: {
    voice: "af_kore",
    speed: 1,
    label: "Focused and clear",
    delivery:
      "Speak with focused clarity, explaining risks without dramatizing them.",
  },
  devils_advocate: {
    voice: "af_nova",
    speed: 1.03,
    label: "Animated and questioning",
    delivery:
      "Speak with lively, respectful skepticism and a conversational tone.",
  },
} as const;

export function characterVoice(mindId: string) {
  return CHARACTER_VOICES[
    (mindId === "bentham"
      ? "utilitarian"
      : mindId) as keyof typeof CHARACTER_VOICES
  ];
}

export const VOICE_PREVIEW =
  "Let us take a moment to consider the question. What matters most to you in this conversation?";
