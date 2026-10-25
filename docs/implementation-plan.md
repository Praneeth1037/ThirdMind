# ThirdMind implementation plan

## Starting point

The workspace was empty on inspection. There is no existing code or infrastructure to reuse.

## Product and campus scenario

ThirdMind is a human group chat with optional audio/video and explicitly invited AI perspectives. The first scenario is an Ethics Study Group preparing for a campus seminar: classmates discuss a trolley problem, invite Socrates and Bentham, and request a bounded debate. A second campus scenario helps classmates negotiate a study session around classes and budgets. Minds never speak without an explicit human invocation. Suggestions never book events or make commitments for students.

## Architecture and exact packages

- Next.js App Router, React, TypeScript, Tailwind CSS; `lucide-react` for interface icons.
- Next.js route handlers for room membership, messages, invocation, provider requests, transcription and LiveKit tokens. All service credentials stay server-side.
- `livekit-client`, `@livekit/components-react`, `@livekit/components-styles`, `livekit-server-sdk` for hosted WebRTC media. Calls and chat share a room ID and conversation.
- `@upstash/redis` for production room state with optimistic atomic compare-and-set. Process memory for local development only. Rooms expire after 24 hours; raw audio/video is not stored by the app.
- Native server `fetch` to the documented Groq REST endpoints, with runtime model discovery. Provider interface also supports Gemini's REST API. No OpenAI credentials or SDK required.
- Deterministic mention router; centralized queue and generation/speaking lease; bounded four-turn debates (maximum six); isolated persona system prompts and bounded recent history plus a rolling extractive summary.
- Browser MediaRecorder -> authenticated Groq Whisper transcription endpoint. Explicit push-to-talk is visibly enabled; a human reviews the transcript before sending.
- Browser speech synthesis fallback behind a TTS interface; local animated vector avatars behind an avatar interface.
- `tsx` with Node's test runner for routing, turn ownership, isolation, security and context; Playwright for browser integration.

## Deployment

The web UI and HTTP APIs run on Vercel. LiveKit Cloud carries audio/video outside Vercel. Upstash Redis shares ephemeral room state across Vercel instances. No long-running Python worker is needed for this push-to-talk MVP. A future continuous transcription/agent worker belongs on LiveKit Cloud Agents, not a Vercel function. Commercial realtime avatars are deferred until core communication is verified.

## External services and credentials

| Service           | Credentials                                      | Blocks                               | Free usage                                |
| ----------------- | ------------------------------------------------ | ------------------------------------ | ----------------------------------------- |
| LiveKit Cloud     | LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET | Cross-device audio/video             | Build plan subject to current quotas      |
| Groq              | GROQ_API_KEY; optional GROQ_MODEL                | Real AI and Whisper                  | Free plan subject to model/account limits |
| Upstash Redis     | UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN | Reliable multi-instance Vercel rooms | Free plan subject to limits               |
| Gemini (optional) | GEMINI_API_KEY, GEMINI_MODEL                     | Alternative model provider only      | Model-specific free tier                  |
| Vercel            | Vercel project/account                           | Public deployment                    | Hobby eligibility and quotas apply        |

Documentation: [LiveKit tokens](https://docs.livekit.io/frontends/reference/tokens-grants/), [LiveKit React](https://docs.livekit.io/reference/components/react/component/livekitroom/), [Groq models](https://console.groq.com/docs/models), [Groq chat](https://console.groq.com/docs/text-chat), [Groq speech](https://console.groq.com/docs/speech-to-text), [Gemini REST](https://ai.google.dev/api/generate-content), [Upstash eval](https://upstash.com/docs/redis/sdks/ts/commands/scripts/eval), [browser TTS](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis). Consulted during implementation; account model availability still needs credentialed verification.

## Risks

1. Real device media and credentialed providers cannot be verified without service credentials and two devices.
2. Local in-memory state cannot support multi-instance hosting; production must require Redis rather than silently accepting this configuration.
3. Polling provides near-realtime chat (about one second) but incurs Redis usage. This is a hackathon tradeoff, not a large-scale messaging design.
4. Browser TTS voices and autoplay vary; text must remain available. Push-to-talk is near-realtime rather than continuous room transcription.
5. A generation lease must prevent simultaneous AI responses and reject late output after human interruption. Requests need bounded timeouts.
6. Invite links are room capabilities, not university identity verification. Membership credentials protect subsequent API access. Do not treat the MVP as suitable for sensitive data.

## Implementation order

1. P0: scaffold, create/join/share room, shared chat, LiveKit token and media controls, production build.
2. P1: registry, mention router, Groq/Gemini abstraction, text AI, history, add/remove minds, honest scripted demo.
3. P2: turn queue, human priority, reviewed push-to-talk transcript, browser TTS.
4. P3: animated fallback avatars and responsive, accessible group interface.
5. Bounded debates, automated regression tests, browser checks and docs.
6. Deployment readiness and exact service setup. Deployment and credentialed integration remain explicitly unverified until keys/accounts are configured.
