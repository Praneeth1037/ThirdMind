export const SCENARIO_DEMO: Record<string, Record<string, string>> = {
  cs: {
    architect:
      "For a one-week class project, use managed authentication and keep your own server responsible for authorization. Validate sessions on every protected API route, and make authentication outages fail closed. Before committing, confirm whether your chosen service supports the campus sign-in requirements.",
    security:
      "Separate identity from permission: being logged in must not grant access to another student's records. Check ownership on the server, keep service keys out of the browser, and test an expired session and an authentication-provider outage. What is the most sensitive action your demo allows?",
    feynman:
      "Authentication asks, 'Who are you?' Authorization asks, 'What are you allowed to do?' Your student ID proves who you are, but it does not let you open every locked laboratory. Where should your system check each question?",
  },
  medical: {
    doctor:
      "For this hypothetical case, first clarify the patient's understanding, decision-making capacity, goals, and alternatives. A treatment recommendation does not replace informed consent. What information would the patient need to make a voluntary decision?",
    medical_ethicist:
      "Autonomy and beneficence may point in different directions here. Explore what the patient values, whether the refusal is informed, and how the family's concerns can be heard without overriding the patient. What unresolved facts would change your ethical analysis?",
    patient_advocate:
      "Ask the patient to describe their concerns in their own words, then check that the explanation was understandable. Fear, practical burdens, or past experiences might matter, but we should ask rather than assume. How would you make space for their preferences?",
  },
  friends: {
    mediator:
      "A campus picnic or a walk followed by an inexpensive snack could fit the time, budget, and transport constraints. Meet after 6, choose a walkable location, and aim to finish by 8:30. Before deciding, can everyone confirm the location and a backup if the weather changes?",
    devils_advocate:
      "The plan assumes everyone can walk comfortably, that the location is open, and that the weather cooperates. None of those is confirmed yet. Could we agree on one accessible indoor backup before the group commits?",
  },
  cooking: {
    mediator:
      "A chickpea, tomato, and spinach rice bowl uses the ingredients you already have and can be vegan. One person cooks the rice, two prepare the chickpeas and vegetables, and one checks labels, cleans surfaces, and sets the table. Confirm all ingredients and equipment are safe for the friend with the peanut allergy before starting.",
    judge:
      "The meal appears to fit the vegan constraint and the available ingredients, but the allergy precautions, portion sizes, cooking equipment, and rice cooking time still need confirmation. Keep the shopping list short to protect the $12 budget. Can the group confirm those details before we settle on it?",
  },
};
