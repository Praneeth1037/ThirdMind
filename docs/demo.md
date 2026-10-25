# Three-minute campus demo

## Why students say “we need this”

“We can get a useful challenge in our study group without turning the whole chat into a conversation with a chatbot.” ThirdMind keeps the social conversation human and makes a fresh perspective available at the exact moment the group wants it.

## Before the demo

Configure Groq, LiveKit Cloud and Redis, then test the deployed invite URL in two browsers. Verify the model account and limits. Without a key, use the labeled scripted rehearsal and say so explicitly. The seeded messages are **scenario examples**, not fake online friends.

## 0:00–0:35 — The people come first

1. Choose **The ethics study group** and enter Pardha.
2. Copy the invite link; Maya joins on a second device.
3. Explain: “We’re studying for our ethics seminar. Socrates and Bentham are in the room, but they don’t interrupt.”
4. Pardha: “Would you sacrifice one person to save five?”
5. Maya: “No. You cannot intentionally kill an innocent person.”
6. Pause. Neither Mind responds. Even “I studied Socrates yesterday” stays silent.

## 0:35–1:20 — Bring in the right Mind

Pardha sends:

```text
@Bentham what do you think?
```

Only Bentham responds. Point to Socrates remaining in **Quietly listening**.

Maya sends:

```text
@Socrates challenge that.
```

Only Socrates responds. Add Judge through the Mind library, then ask Judge to evaluate the disagreement. Explain that everyone shares the conversation, but each Mind has its own instructions.

## 1:20–1:55 — Same conversation, another mode

Start a call on both devices. Enable microphones/cameras. Show the same chat alongside live media. With Groq configured, record “Bentham, explain your position,” review the transcript, and send it. Alternatively, click **Enable Voice Minds**, allow microphone/speech permissions, and say “Bentham, speak.” This explicitly enables browser speech transcription and local read-aloud; show the recognized text and listening status. Use **Test speaker** first. Browser service availability still needs to be checked on the demo device. Browser read-aloud is an optional local fallback, not room-wide generated audio.

## 1:55–2:25 — Different minds, shared floor

```text
@Socrates and @Bentham, debate this for four turns.
```

The order is Bentham → Socrates → Bentham → Socrates, then stop. Start another exchange and interrupt by speaking in the call or pressing **Stop AI turn**. The canceled debate does not resume on its own.

## 2:25–3:00 — A practical campus conflict

Open **The study sprint** with another friend. Its examples make the constraints visible: class until 4 pm, work at 5:30 pm, quiet campus space and a $10 budget.

```text
@Mediator help us find a plan that fits everyone.
@Judge evaluate the proposed plan and what we still need to confirm.
```

They share the stated constraints, surface the unresolved availability/travel assumptions, and ask students to confirm. They cannot book a space or make commitments. End with classmates discussing the choice.

## Submission notes

- Working group chat plus calls; campus seminar and coordination scenarios.
- Explicit multi-Mind invocation, shared context and isolated personas.
- Conflicting perspectives are sequential and bounded, with human interruption.
- Students make the final decision. No automatic bookings or third-party messages.
- Track 1 submission eligibility is the team's responsibility and is not asserted by this prototype.
- The provided challenge text ends mid-sentence, so no additional judging criteria are assumed.

Evidence and remaining credentialed checks are in [verification.md](verification.md).
