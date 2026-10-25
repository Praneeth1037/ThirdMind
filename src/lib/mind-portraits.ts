type Portrait = { src: string; focus: string; zoom: number; shift: string };
const portrait = (
  id: string,
  focus: string,
  zoom = 1.8,
  shift = "18%",
): Portrait => ({ src: `/images/minds/${id}.jpg`, focus, zoom, shift });

export const MIND_PORTRAITS: Record<string, Portrait> = {
  socrates: portrait("socrates", "65% 44%", 1.12, "0%"),
  utilitarian: portrait("utilitarian", "68% 29%", 1.8, "20%"),
  kantian: portrait("kantian", "71% 30%", 1.8, "18%"),
  feynman: portrait("feynman", "68% 28%", 1.7, "20%"),
  judge: portrait("judge", "60% 28%", 1.8, "21%"),
  mediator: portrait("mediator", "64% 28%", 1.8, "21%"),
  doctor: portrait("doctor", "70% 20%", 2.5, "28%"),
  medical_ethicist: portrait("medical_ethicist", "65% 30%", 1.8, "18%"),
  patient_advocate: portrait("patient_advocate", "64% 29%", 1.8, "20%"),
  architect: portrait("architect", "64% 28%", 1.8, "20%"),
  security: portrait("security", "73% 29%", 1.8, "20%"),
  devils_advocate: portrait("devils_advocate", "72% 30%", 1.8, "18%"),
};

export const getMindPortrait = (id: string): Portrait | undefined =>
  MIND_PORTRAITS[id === "bentham" ? "utilitarian" : id];
