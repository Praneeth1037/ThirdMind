# ThirdMind

**Bring the right minds into the conversation.**

A campus group chat with real audio/video and explicitly invited AI perspectives. Your friends have the conversation; Socrates, Bentham, Judge and other Minds listen until a human addresses them.

This is a Cubbie Track 3 prototype. It is its own messaging application, with text chat at the center. Computer science, medical case studies, friends, cooking, ethics, and study sprint templates help groups learn, disagree, and coordinate around real constraints.

## Run locally

Use Node.js 24 (recommended; a LiveKit transitive dependency requires at least 22.22).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Choose a campus scenario, enter your name, and copy the room link to a second browser. Without external credentials, shared chat works on this server and AI uses **visibly labeled scripted samples**. Scripted replies do not reason over new questions. Do not present them as real model output.

The in-memory development store disappears when the process restarts. Never use it for shared Vercel deployments; the API refuses room operations on Vercel until Redis is configured.

## What is implemented

- Create, join and share invite-only rooms, with 24-hour expiry and individual membership tokens.
- Create invite-only **Ice Breaker** rooms for up to 10 people, with an optional pre-join survey, private survey storage, and shared on-screen topic suggestions. On request, suggestions may use aggregate themes and intentionally posted room-chat messages; raw profiles and call audio are not sent for this feature. Use the room invite link to bring participants together; there is no public stranger-matching queue.
- Shared human text chat using roughly 1.2-second polling, including during video calls.
- LiveKit audio/video with camera and microphone controls, remote media, reconnection and leaving the call without losing chat. Devices start off.
- Twelve Minds, categories, search, add/remove/mute, mention completion, visible turn states and supplied photographic character portraits.
- Deterministic explicit invocation; plain references to a Mind never trigger generation. Only invited and unmuted Minds are eligible.
- Groq model discovery and secure text generation; optional Gemini REST provider through the same interface. No OpenAI API key needed.
- Bounded context plus rolling extractive memory. Each generation receives exactly the selected Mind's persona.
- A shared generation/speaking lease, sequential queue, four-turn debates capped at six, stop controls and human priority.
- Push-to-talk audio clips transcribed by Groq Whisper. Transcripts are visibly reviewed before being sent and invoking a Mind.
- Opt-in **Voice Minds** during calls: browser speech recognition shares final transcripts, routes explicit requests, and automatically enables local read-aloud. Listening/error status and a speaker test are visible.
- Optional local neural character voices through Kokoro, plus a device-voice fallback when no neural service is configured. Playback failures are visible; text remains available.
- Responsive desktop and mobile UI, keyboard controls, native modal focus handling and reduced-motion support.

## Setup and credentials

All credentials are server-side environment variables. Never add `NEXT_PUBLIC_` to a service key.

| Variable                   | Purpose                                                                     |
| -------------------------- | --------------------------------------------------------------------------- |
| `LLM_PROVIDER`             | `groq` (default) or `gemini`                                                |
| `GROQ_API_KEY`             | Groq text generation and transcription                                      |
| `GROQ_MODEL`               | Optional model ID; checked against the account's `/models` list before use  |
| `GROQ_STT_MODEL`           | Defaults to documented `whisper-large-v3-turbo`                             |
| `GEMINI_API_KEY`           | Optional alternate provider key                                             |
| `GEMINI_MODEL`             | Required when Gemini is selected; choose an available generateContent model |
| `CHARACTER_VOICE_URL`      | Optional neural voice worker URL; locally `http://127.0.0.1:7891`            |
| `CHARACTER_VOICE_TOKEN`    | Private shared token authenticating the app to the neural voice worker     |
| `LIVEKIT_URL`              | LiveKit project's `wss://…` URL                                             |
| `LIVEKIT_API_KEY`          | LiveKit server API key                                                      |
| `LIVEKIT_API_SECRET`       | LiveKit server API secret                                                   |
| `UPSTASH_REDIS_REST_URL`   | Redis REST endpoint, required on Vercel                                     |
| `UPSTASH_REDIS_REST_TOKEN` | Redis REST token, required on Vercel                                        |
| `NEXT_PUBLIC_DEMO_MODE`    | Explicitly allow labeled scripted AI when no provider key is configured     |

### Groq

SERVICE: Groq  
WHY: Real model reasoning and speech transcription.  
GET KEY: Create an account at [Groq Console](https://console.groq.com/keys).  
ENVIRONMENT VARIABLE: `GROQ_API_KEY`  
BLOCKED FEATURE: Live AI responses and speech transcription until a valid key is configured.  
CAN CONTINUE: Human chat/calls, Mind management, routing and labeled scripted demo.

At startup of the first generation, the adapter calls the [available models endpoint](https://console.groq.com/docs/models). It prefers a currently available GPT-OSS conversational model through Groq, with compatible discovered alternatives. The legacy Llama choices are listed by Groq as enterprise models; an account without them must still be able to generate replies. Set `GROQ_MODEL` if your account has different availability. Model lists cache for five minutes; provider failures never silently become scripted answers. Groq offers a free plan with [account/model limits](https://console.groq.com/docs/rate-limits).

### LiveKit

SERVICE: LiveKit Cloud  
WHY: Cross-device WebRTC audio/video.  
GET KEY: Create a project at [LiveKit Cloud](https://cloud.livekit.io/) and use its project URL and server API key pair.  
ENVIRONMENT VARIABLE: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`  
BLOCKED FEATURE: Cloud-hosted human calls until configured.  
CAN CONTINUE: Group chat, Minds, AI text and all non-call features.

The server mints short-lived tokens scoped to one room and the authenticated member's identity. See [LiveKit grants](https://docs.livekit.io/frontends/reference/tokens-grants/). The Build plan has [usage quotas](https://docs.livekit.io/deploy/admin/quotas-and-limits/); verify the current dashboard limits before a public demo.

For a no-account loopback media test on macOS:

```sh
brew install livekit
livekit-server --dev --bind 127.0.0.1 --node-ip 127.0.0.1
```

In another terminal:

```sh
LIVEKIT_URL=ws://127.0.0.1:7880 LIVEKIT_API_KEY=devkey LIVEKIT_API_SECRET=secret npm run dev
```

`devkey` / `secret` are LiveKit's public development placeholders. They are only for loopback testing; use actual Cloud credentials for deployments and shared devices. Friends on other devices cannot use your `127.0.0.1` address. Use LiveKit Cloud and HTTPS for that milestone.

### Upstash Redis

SERVICE: Upstash Redis  
WHY: Room state and turn ownership across Vercel instances.  
GET KEY: Create a Redis database in [Upstash Console](https://console.upstash.com/) and copy its REST URL/token.  
ENVIRONMENT VARIABLE: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`  
BLOCKED FEATURE: Reliable multi-instance hosting.  
CAN CONTINUE: All local single-process work.

The store uses atomic Lua revision comparison and preserves each room's original TTL. Redis has a [free plan with quotas](https://upstash.com/pricing/redis). Polling is a hackathon tradeoff: check command usage during a long demo. Production Redis behavior is implemented but requires credentialed verification against Upstash.

### Optional Gemini

Choose an available model in [Google AI Studio](https://aistudio.google.com/), set `LLM_PROVIDER=gemini`, `GEMINI_API_KEY` and `GEMINI_MODEL`. The adapter uses the documented [generateContent REST API](https://ai.google.dev/api/generate-content) with a separate system instruction. Gemini does not replace the Groq key for this app's transcription endpoint. Free usage varies by model and account; do not assume a universal allowance.

## Voice, TTS and avatars

Every invited Mind has a **Speak** button on its card, in the mobile Minds panel, and on its call tile. Click it to ask that Mind to respond aloud to the current conversation; read-aloud turns on automatically and your unfinished message stays in the composer. The button shows requesting, thinking, queued, and speaking states, prevents duplicate requests, and stays disabled while the Mind is muted or already has a turn.

Click the microphone in the composer to record up to 20 seconds. This is explicit push-to-talk, not invisible background recording. Groq receives that audio for transcription; the transcript is put in the composer for review. Sending it records the speaker identity and uses the same mention router and history as text. Raw audio is not written to application storage. Requests are capped below Vercel's usual body size limit; the documented [Groq speech API](https://console.groq.com/docs/speech-to-text) supports the chosen Whisper model.

For hands-free invocation, start a call and click **Enable Voice Minds**. This unmutes your call microphone and explicitly opts into sharing recognized speech with the room. Say **“Socrates, speak”** or **“Socrates, what do you think?”**. Saying only a name or talking about a philosopher stays silent. The **Live captions** panel updates your draft words as recognition results arrive, labels each speaker, and retains finalized speech lines alongside Mind replies. Socrates’ full reply stays readable while browser speech-boundary events highlight the current spoken word when supported. The CC button hides or shows captions without stopping recognition. Draft captions are local to your device; only final transcripts are shared into chat. Muting the microphone pauses recognition; disabling Voice Minds or leaving the call stops it. Recognition pauses during AI playback to prevent self-invocation.

This uses the [browser SpeechRecognition API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition), with runtime support detection for standard and WebKit implementations. On browsers supporting recognition from an audio track, recognition follows the call’s selected microphone track. It combines browser result fragments into coherent captions and finalized requests. It does not require a Groq transcription key, but browser support, permissions, internet access and recognition-service availability vary. The browser may send audio to its service; this is disclosed before enabling. Network/permission failures are visible and leave calls and text working. The Groq clip workflow above remains a separate fallback when a key is configured. There is no server-side always-listening agent.

Read-aloud uses local neural speech when the character voice service is configured, and `BrowserTTSProvider` otherwise. Enable it in the Minds panel (also available on mobile). Voice Minds and Speak buttons enable it automatically. Use **Test speaker** during a call to check your output. In a call, every connected participant plays the explicitly requested AI turn on their own device. Each listener acknowledges playback before the server advances the shared queue, so a faster device cannot cut off a slower one. Outside a call, read-aloud stays local to the requesting student. AI speech is synchronized through the shared room turn, not published as an AI LiveKit RTP track. Browser voice availability and autoplay vary. Text remains the reliable fallback. Headphones help prevent local speech synthesis from leaking into your microphone.

### Natural character voices

The optional voice worker runs [Kokoro-82M](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) on your CPU, without a paid speech API or account. It downloads the approximately 92 MB quantized model on first start. Each Mind has a fixed, distinct conversational voice and delivery profile in `src/lib/character-voices.ts`: Socrates uses a reflective male storyteller voice; Bentham uses a measured British male voice. These are imagined AI character performances, not authentic historical recordings or voice clones. The current model speaks English; it does not reconstruct ancient Greek or historical accents.

Set `CHARACTER_VOICE_URL=http://127.0.0.1:7891` and a private random `CHARACTER_VOICE_TOKEN` in `.env.local`, then run this alongside `npm run dev`:

```sh
npm run voice:server
```

The service binds to loopback, authenticates its requests, primes the model before reporting ready, serializes inference, and keeps a bounded cache of generated AI speech in memory. The app's authenticated `/api/rooms/[id]/speech` endpoint reads stored AI replies or fixed preview text; clients cannot send arbitrary text to the voice service through it. Long responses are split to avoid truncation. Captions retain the full response without inventing word timings. Stopping or human interruption cancels pending requests and pauses audio immediately. Voice-service failures remain visible and leave the reply in text.

On Vercel, run the voice worker on a separate CPU host behind an authenticated HTTPS endpoint and set `CHARACTER_VOICE_URL`/`CHARACTER_VOICE_TOKEN` there. Vercel cannot reach the development machine's loopback address. The native model runs outside Next.js; it is a development dependency used by the standalone worker, not included in the browser or Next.js server bundle.

When no neural service is configured, all device voices still use known conversational presets; musical, novelty, and unknown defaults are excluded. Missing supported voices leave the response in text with an actionable error.

### Groq speech in production

With `GROQ_API_KEY` configured, the deployed app can generate natural speech through Groq Orpheus without the local Kokoro worker. Fixed character voice assignments use conversational delivery and remove bracketed performance directions. Replies are split below the provider's 200-character request limit, then combined as complete WAV audio. The service uses bounded short-lived caching and authenticated access to existing AI messages. `GROQ_TTS_ENABLED=false` selects device voices instead.

Some accounts require the owner to review and accept the Orpheus model terms in Groq Console before the first speech request. The app never accepts account terms automatically. If cloud speech is unavailable, it visibly falls back to a known conversational device voice; musical and novelty voices remain excluded. Text and group calls continue working.

Call audio is enabled when joining a call. **Enable Voice Minds** is a separate opt-in to microphone transcription and spoken invocation. Click **Speak** on a character for a response without enabling microphone transcription. **AI audio** controls local read-aloud, and **Stop AI** cancels the shared turn.

`AvatarProvider` and `MockAvatarProvider` separate avatar lifecycle from conversation logic. Supplied AI character portraits appear in the picker, room cards, messages, call tiles, and featured homepage characters, with speaking indicators tied to the active turn. Portraits are static images, not lip-synced video. No commercial avatar account is necessary. A paid realtime avatar integration is **not implemented**. See [avatar research](docs/avatar-research.md) for the verified next integration and its credential/worker requirements.

## Tests and production build

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm start
```

Browser integration tests need a running server and Chromium:

```sh
npx playwright install chromium
npm run test:e2e
```

For the optional real WebRTC transport test, start the local LiveKit service and a web server with the three LiveKit environment variables, then run:

```sh
TEST_LIVEKIT=1 npx playwright test livekit.spec.ts
```

The test uses generated camera/microphone devices in two independent browser contexts and verifies decoded video, active remote audio elements and received audio/video RTP bytes. This does not replace a two-device human hearing/seeing check.

`PLAYWRIGHT_BASE_URL` selects a different web server. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an existing Chromium binary. Screenshots go to `artifacts/`. The default chat tests expect no real AI key so they can verify scripted labeling; they simulate a LiveKit outage to check isolation regardless of local call configuration. `TEST_LIVEKIT=1 npx playwright test voice.spec.ts` also checks opt-in, speech routing, TTS invocation, mute/pause, and error isolation using controlled browser recognition/synthesis doubles with a real local LiveKit connection. This does not verify a real speech-recognition service or audible output on the user’s device. The optional WebRTC test skips without `TEST_LIVEKIT=1`.

See [verification results](docs/verification.md) for actual completed checks and unverified services.

## Deploy on Vercel

1. Put this repository in your Git provider and import it into Vercel as a Next.js project. Use Node.js 24, repository root, `npm ci`, and `npm run build`.
2. Configure the Redis REST URL/token before using room routes. Configure LiveKit and Groq for the full live demo. Use environment settings; never commit keys or paste them into source.
3. Set `NEXT_PUBLIC_DEMO_MODE=false` for a real AI demo, or `true` for a clearly labeled scripted fallback. Rebuild after changing this public flag.
4. Deploy. If using the CLI instead, run `npx vercel login`, `npx vercel link`, configure project environment variables, then `npx vercel --prod`.
5. Open a `/room/...` invite directly in another browser, verify shared chat, then test camera and microphone with two devices over HTTPS. Test ordinary conversation stays silent before invoking a Mind.

The UI, token minting, room APIs, text AI and push-to-talk transcription run on Vercel. LiveKit hosts the persistent media room; Redis hosts expiring state. No Python process is required for this MVP. A future continuous transcription or commercial avatar worker must run separately on LiveKit Cloud Agents (the preferred next host), not as an ordinary Vercel function. There is no agent deployment command for a worker that does not yet exist.

Ice Breaker uses the existing room store, invite links, LiveKit call and configured text AI provider. Profiles are private room state and are removed from public room payloads; shared topics are included only when at least two participants listed them, and any participant's matching topic boundary excludes that topic. Prompts are generated on request, shared as room messages and fall back to a fixed starter if the AI provider is unavailable. No automatic silence detection, public matching directory, audio analysis, or voice facilitator is implemented.

No public deployment has been performed from this workspace; a Vercel account/project and production service credentials are still needed.

## Demo and why students would invite it

“We need a study group that can challenge an argument without taking over the room.” Friends can prepare for the same seminar with distinct perspectives, then move into a call without losing the text context.

The study sprint adds a concrete planning conflict: a 4 pm class ending, a 5:30 pm work shift, a quiet-space preference and a $10 budget. Mediator proposes an overlap; Judge checks the missing assumptions. Both share classmates' stated constraints. They ask the students to confirm, and cannot book a room, change a calendar or send a message on students' behalf.

Follow the [demo script](docs/demo.md). All prefilled classmates' messages are labeled scenario examples; online people are actual joined sessions.

## Troubleshooting and limits

- **Nothing responds:** use `@Socrates challenge that.` at the start. The Mind must be invited and unmuted. Referencing “Socrates was Greek” is deliberately silent.
- **AI unavailable:** verify the selected provider key, account model access and limits. Chat and calls remain usable.
- **Calls need LiveKit:** configure all three server variables and restart. Browser camera/mic require HTTPS or localhost. Allow device permissions, and use the room's enable-audio control if autoplay is blocked.
- **Room missing after restart:** the local memory store is ephemeral. Redis is required for shared deployments. All rooms expire 24 hours after creation.
- **Room says reconnecting:** verify the API server and Redis; the UI keeps the last state and retries polling.
- **Voice unavailable:** Groq is required even if Gemini handles text. Use text mentions when transcription fails.
- **Two browser tabs with one identity:** use separate browser contexts for independent humans. Same-tab reload preserves the membership token in session storage; closing the tab may require rejoining.
- **A browser closes mid-turn:** the lease expires; that active response is abandoned. Remaining explicitly requested turns can continue, but interrupted debates do not resume.
- **Voice invocation is opt-in:** ordinary call speech stays untranscribed until each participant enables Voice Minds. A browser speech service transcribes that participant’s microphone; remote participants need to enable their own microphone transcription. If recognition is unavailable, use a text mention or a reviewed Groq clip. Active speakers still interrupt AI turns.
- **No commercial 3D avatars, student SSO, moderation service, push notifications, calendar integration or long-term history.** Invite URLs are room access capabilities; protect them. Any member can manage Minds or stop a turn. This is a hackathon prototype, not a production campus identity system.
- Provider data handling remains subject to the configured service's policy. ThirdMind does not claim providers retain nothing.

Architecture and implementation order: [architecture](docs/architecture.md), [implementation plan](docs/implementation-plan.md).
