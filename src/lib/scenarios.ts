export const SCENARIOS = {
  cs: {
    id: "cs",
    title: "The computer science lab",
    short: "Computer science",
    tagline: "Think through the system before you build it.",
    description:
      "Pressure-test a design, untangle a concept, or prepare for your next technical interview.",
    image: "/images/scenarios/computer-science.jpg",
    minds: ["architect", "security", "feynman"],
    messages: [
      [
        "Maya",
        "Our class project needs a login system. We have one week, and the demo could have 200 students.",
      ],
      [
        "Alex",
        "We can use a managed auth service, but what happens if it goes down during the demo?",
      ],
    ],
    prompts: [
      "@Software Architect, help us choose a simple, reliable design.",
      "@Security Engineer, challenge the trust boundaries in our plan.",
      "@Feynman, explain authentication versus authorization with an example.",
    ],
  },
  medical: {
    id: "medical",
    title: "The clinical case study",
    short: "Medical",
    tagline: "A fuller view of the case.",
    description:
      "Discuss a hypothetical clinical case with clinical, ethical, and patient-centered perspectives.",
    image: "/images/scenarios/medical.jpg",
    minds: ["doctor", "medical_ethicist", "patient_advocate"],
    messages: [
      [
        "Maya",
        "For tomorrow's seminar: a hypothetical patient refuses a recommended treatment. Their family disagrees.",
      ],
      [
        "Alex",
        "How do we balance patient autonomy, informed consent, and the family's concerns?",
      ],
    ],
    prompts: [
      "@Doctor, explain which questions we should explore in this hypothetical case.",
      "@Medical Ethicist, evaluate the conflict between autonomy and beneficence.",
      "@Patient Advocate, what might we be missing from the patient's perspective?",
    ],
  },
  friends: {
    id: "friends",
    title: "The Friday night plan",
    short: "Friends",
    tagline: "Less planning in circles. More actually going.",
    description:
      "Turn a group chat full of preferences into a plan your friends can agree on.",
    image: "/images/scenarios/friends.jpg",
    minds: ["mediator", "devils_advocate"],
    messages: [
      [
        "Maya",
        "Friday night? I finish class at 6, can spend $15, and would love something outdoors.",
      ],
      [
        "Alex",
        "I'm free until 9, but I don't have a car. Can we keep it near campus?",
      ],
    ],
    prompts: [
      "@Mediator, suggest a Friday plan that respects everyone's time and budget.",
      "@Devil's Advocate, what could go wrong with our plan?",
      "@Mediator, summarize what each friend still needs to confirm.",
    ],
  },
  cooking: {
    id: "cooking",
    title: "Dinner, figured out",
    short: "Cooking",
    tagline: "One meal. Everyone at the table.",
    description:
      "Plan dinner around ingredients, dietary needs, time, and a student budget.",
    image: "/images/scenarios/cooking.jpg",
    minds: ["mediator", "judge"],
    messages: [
      [
        "Maya",
        "Can we cook for four tonight? We have rice, chickpeas, tomatoes, spinach, and a $12 budget.",
      ],
      [
        "Alex",
        "One friend is vegan, another has a peanut allergy, and we only have 30 minutes. Please avoid peanuts and cross-contact.",
      ],
    ],
    prompts: [
      "@Mediator, suggest a simple dinner and divide up the cooking tasks.",
      "@Judge, check whether our meal fits the budget, time, and dietary constraints.",
      "@Mediator, make a shopping list and ask what we need to confirm first.",
    ],
  },
  ethics: {
    id: "ethics",
    title: "The ethics study group",
    short: "Philosophy",
    tagline: "A little perspective goes a long way.",
    description:
      "Invite Socrates and Bentham into the argument. Let a better question change your mind.",
    image: "/images/scenarios/philosophy.jpg",
    minds: ["socrates", "utilitarian"],
    messages: [
      ["Pardha", "Would you sacrifice one person to save five?"],
      ["Maya", "No. You cannot intentionally kill an innocent person."],
    ],
    prompts: [
      "@Socrates, challenge our assumptions.",
      "@Bentham, what consequences are we overlooking?",
      "@Socrates and @Bentham, debate this for four turns.",
    ],
  },
  study: {
    id: "study",
    title: "The study sprint",
    short: "Study together",
    tagline: "A plan that fits your whole group.",
    description:
      "Find a study window that respects classes, work shifts, travel time, and budget.",
    image: "/images/scenarios/study.jpg",
    minds: ["mediator", "judge"],
    messages: [
      [
        "Maya",
        "Can we study before the ethics seminar? I have class until 4 pm and a $10 budget.",
      ],
      ["Alex", "I work at 5:30 pm. Somewhere quiet, on campus, please."],
    ],
    prompts: [
      "@Mediator, help us find a plan that fits everyone.",
      "@Judge, check our time and travel constraints.",
    ],
  },
} as const;
export type ScenarioId = keyof typeof SCENARIOS | "blank";
export const SCENARIO_IDS = [
  "cs",
  "medical",
  "friends",
  "cooking",
  "ethics",
  "study",
  "blank",
] as const;
export const getScenario = (id: string) =>
  SCENARIOS[id as keyof typeof SCENARIOS];
export const scenarioRoomName = (id: ScenarioId) =>
  id === "ethics"
    ? "Ethics study group"
    : id === "blank"
      ? ""
      : (getScenario(id)?.title ?? "");
