# Verification

Completed locally on October 25, 2026:

The final test suite and optimized build were also verified with Node.js 24.22.1, matching the recommended major version. Earlier UI and media checks ran on the workspace's Node.js 22.13.1 runtime.

| Check                                                                                      | Result                                                                                                                  |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Dependency installation / npm audit during installation                                    | Passed; zero reported vulnerabilities at installation time                                                              |
| Node test suite                                                                            | 89 tests passed                                                                                                         |
| TypeScript                                                                                 | Passed                                                                                                                  |
| ESLint                                                                                     | Passed                                                                                                                  |
| Optimized Next.js production build                                                         | Passed                                                                                                                  |
| Two-context browser group chat / invocation / four-turn debate / service failure isolation | Passed                                                                                                                  |
| Mobile create / mention completion / invite copy / access rejection                        | Passed                                                                                                                  |
| LiveKit transport with two independent Chromium contexts and a real local LiveKit server   | Passed                                                                                                                  |
| Received media evidence                                                                    | Both clients decoded two camera streams, attached live remote audio, and received nonzero inbound audio/video RTP bytes |
| Camera/mic toggles, leaving call, chat during and after call                               | Passed                                                                                                                  |

Browser media used generated devices rather than real people. The local LiveKit server used its public development credentials on loopback. Cloud Groq, Gemini, Whisper, Upstash Redis, Vercel deployment and commercial avatar services are **not credentialed integration-tested**. Their provider boundaries/request shapes are covered where applicable, but that is not proof of successful real service calls.

The first browser run exposed dev-origin configuration and missing accessible names on mobile icon buttons; those were fixed and the tests rerun successfully. A test selector was also narrowed to distinguish the application's error notice from Next.js's accessibility announcer.

Screenshots are written under `artifacts/`: desktop/mobile landing and room views, plus `livekit-call.png` from the transport check. Do not submit a scripted response as credentialed AI output.

## Before calling the complete cloud MVP done

1. Add actual Groq, LiveKit and Redis credentials to the server environment.
2. Verify real Groq text generation and account model discovery; confirm only the invoked Mind responds and context is carried forward.
3. Verify Whisper with an actual spoken clip, then review and send the transcript.
4. Verify browser TTS on the intended demo browser/device; text stays available on failure.
5. Deploy to Vercel with Redis configured. Verify room state across deployments/instances rather than relying on local memory.
6. Open the invite on two physical devices. Confirm both humans see and hear one another, including reconnecting after network loss.
7. Check current service quotas and run the human-interruption demo with actual microphones.

The project is buildable and the local communication path is tested. The full cloud deployment, server-side continuous voice worker and commercial avatar end state are not claimed complete.

## Voice Minds follow-up

Added opt-in call speech recognition, automatic local read-aloud, recognized-text feedback, speaker testing, visible service/playback errors and the “Socrates, speak” command. Six recognition controller tests and routing/turn regressions pass. Two browser integration tests pass with real local LiveKit transport and controlled recognition/synthesis doubles. They verify the path from finalized recognized text to the selected Mind and a synthesis call, plus mute/disable behavior, ordinary-speech silence, playback failure reporting and recognition-network-error isolation. Actual spoken input recognition and audible synthesis on the user’s device remain unverified; service and OS permissions can differ.

## Live captions follow-up

Added a speaker-labeled live transcript panel with revisable interim human captions, finalized chat lines, full Mind responses and spoken-word highlighting from actual browser boundary events. Four caption-segmentation regressions pass; the voice browser flow now also verifies changing draft text before finalization, zero interim invocation/message submission, current-word updates, completion cleanup and caption visibility controls without stopping recognition. These timing/input events are simulated in the test; browsers without boundary events show the full response without fabricated timing.

## Native browser spoken-input check

A later manual integration run used installed Google Chrome with native Web Speech recognition and native speech synthesis. A macOS-generated audio clip saying “Hey Socrates, please explain your position” was fed through the call’s virtual microphone. Recognition and synthesis were not mocked. Chrome finalized “hey Socrates please explain your position”; ThirdMind produced one Socrates demo reply, displayed both speakers in captions, emitted 32 native speech boundary events, and completed native playback with no page, recognition or playback errors. This verifies generated-audio input through the real browser service, not a physical microphone or real Groq reasoning.

The run exposed and fixed two issues: recognition previously opened its own default microphone instead of following the call’s track, and multiple interim fragments were displayed independently rather than combined. Recognition now receives the call’s live audio track on supporting browsers, and result fragments are joined before display/submission. A shorter test phrase was revised by the recognition service to omit the addressed name and correctly did not invoke AI. Interim guesses are never used as permission to speak.

Evidence: `artifacts/native-speech/result-clear-request.json` and `artifacts/native-speech/native-browser-result.png`. The successful run used the existing scripted provider. Native recognition accuracy remains dependent on the voice, microphone/audio quality and browser service; the recognition engine revised one earlier short phrase incorrectly.

## Bentham speaking voice

Replaced voice selection by platform list position with preferred named speaking voices. Bentham prefers Daniel, with other regular English voices as fallbacks; musical and novelty voices are excluded. Three regression tests cover voice-list ordering, novelty defaults, and fallback selection. A native Google Chrome run invoked Bentham through chat with read-aloud enabled, selected Daniel (en-GB), and received playback start and end events without errors. The response used the scripted provider. Evidence: `artifacts/bentham-speaking-voice.json`.

## Conversational voices for every Mind

All Minds now select from known conversational voices, with no unchecked default or unknown-voice fallback. Voice loading waits for `voiceschanged` with a bounded timeout; missing supported voices leave the response in text with an actionable error. Stopping during voice loading prevents delayed playback. The shared generation prompt also requires normal conversation and prohibits singing or chanting. Five additional regression tests cover every registered Mind, delayed/unavailable voice lists, rejected novelty-only playback, and cancellation during voice loading. All 68 unit tests, both existing voice browser integration tests, lint, type checking, and the production build pass.

A native Chrome playback check selected Samantha for Socrates and Daniel for Bentham. Both scripted replies emitted native start/end events with no playback errors. Evidence: `artifacts/all-minds-speaking-voices.json`. Voice inventory varies by device; unsupported inventories fall back to text.

## Speak buttons

Added a shared Speak button to every invited Mind's desktop card, mobile panel row, and call tile. A click posts an explicit addressed request through the normal turn queue, enables local read-aloud, preserves the composer draft, and prevents duplicate requests while pending or active. Muted Minds cannot be invoked by the button. Two additional browser tests verify newly invited Minds, duplicate-click prevention, sequential playback, muted states, request-error recovery, and mobile speaking/idle states. All four voice browser tests and 68 unit tests pass, along with lint, type checking, and the production build.

A separate native Google Chrome run clicked Speak for Socrates and Bentham without manually enabling read-aloud. Both replies completed native synthesis playback using Samantha and Daniel respectively, without errors. Responses used the scripted provider. Evidence: `artifacts/speak-buttons-native-playback.json`; screenshots: `artifacts/speak-buttons-desktop.png` and `artifacts/speak-buttons-mobile.png`.

## Natural character voices

Added a standalone local Kokoro-82M neural speech worker, authenticated room speech endpoint, and cancellable browser audio playback. All 12 Minds have distinct fixed voice presets and character delivery instructions. Socrates uses `bm_fable` at 0.90 speed; Bentham uses `bm_george` at 0.96 speed. These are imagined English-language character performances, not historical voice clones or reconstructed ancient accents. The worker uses the 92 MB q8 model on CPU, serializes synthesis, splits long text without dropping words, and caches up to 20 generated responses in memory. Playback leases account for synthesis and response length.

Twelve new unit tests cover voice assignments, long-text preservation, playback leases, room membership, stored-text-only speech, upstream failures/empty audio, genuine playback state, cancellation during synthesis, interrupted audio, and autoplay errors. The resulting 80 tests, lint, type checking, and Node.js 24 production build pass. All four device-voice browser regressions also pass using their controlled browser speech doubles. The optional neural integration test uses the real model and native, unmuted Google Chrome audio playback: both character replies complete, a third reply is stopped, and unauthorized speech requests are rejected. Text generation uses the existing scripted provider during this check.

Evidence: `artifacts/natural-character-playback.json` and `artifacts/natural-character-voices.png`. Same-text voice samples: `artifacts/socrates-character-voice.wav` and `artifacts/utilitarian-character-voice.wav`. Character audio has no word-alignment data, so captions show the full response without fabricated word timing. Hosted neural deployment and exact historical voice authenticity are not claimed. Installing the speech dependency initially introduced an older Sharp transitive dependency; a scoped override pins the patched version, and the final full npm audit reports zero vulnerabilities.


## Video, scenarios, and deployed group calls

The supplied 108-second concept video now provides scene images for computer science, medical case studies, friends, cooking, philosophy, and study groups. A compressed 11 MB version is playable from the homepage. Scenario tabs update the preview and matching Minds; creating a room installs the relevant context and starter requests. The 12 supplied portraits replace the vector avatars in the picker, chat, room cards, homepage, and call tiles. Desktop and 320/390/768 px layouts were inspected without horizontal overflow.

Calls automatically enable AI read-aloud. Every participating browser can play an explicitly requested AI reply; the server waits for each registered listener's playback acknowledgement before advancing the turn. Leaving a call releases its obligation, and ordinary text-only observers do not delay the queue. Stop AI and AI audio are available directly in the call. AI audio remains per-device playback synchronized by shared room state, not a published AI RTP stream.

The Vercel project is connected to real Redis, LiveKit Cloud, and Groq. A credentialed production check exposed that the old default model list only covered now-enterprise Llama models. Model discovery now includes currently supported conversational models and reserves a reasoning budget where needed. Real non-demo replies were verified for computer science, medical, friends, and cooking. A deployed call completed native device-voice playback after cloud speech fell back. Groq's Orpheus endpoint reported account-owner acceptance of model terms is required; no terms were accepted automatically. Device fallback was verified, and local Kokoro neural playback completed in two independent call participants.

Evidence includes `artifacts/vercel-live-scenarios.json`, `artifacts/vercel-live-ai-call.json`, `artifacts/group-call-ai-audio.json`, `artifacts/scenario-layout-verification.json`, and updated call/home screenshots. Markdown replies render as formatted chat, and speech omits formatting markers; formatted device-voice captions show the full answer instead of inaccurate word offsets. Tests cover scenario routing, cloud WAV assembly, performance-direction removal, model discovery, spoken formatting, and playback acknowledgements.


## Production release verification

Published to https://thirdmind-psi.vercel.app after the final build and 89 unit tests passed. Seven existing desktop/mobile/voice browser regressions pass. The final native local two-listener call check also passes. A production verification used two independent Google Chrome processes, real LiveKit Cloud connections, a real Groq-generated Socrates reply, and native device speech playback in both clients. Both emitted start/end events, received the same non-demo reply, and the shared turn completed after both listeners acknowledged playback. The mobile call measured 390 px with no horizontal overflow and no page errors.

The cloud voice model remains unavailable until its account activation terms are reviewed and enabled in Groq. The user authorized review and activation, but Chrome's signed-in session blocks JavaScript automation and no direct Groq integration is connected, so activation was not performed. The app's device-voice fallback is active and tested. The activation page was opened for manual completion.

Release metadata: `docs/deployment-receipt.json`. Final production evidence: `artifacts/production-group-call-verification.json`, `artifacts/production-group-call.png`, and `artifacts/production-group-call-mobile.png`.


## Fresh Vercel production audit — 25 October 2026

A fresh run targeted only https://thirdmind-psi.vercel.app, with two independent Chrome processes and real Redis, Groq and LiveKit Cloud. All four requested scenarios generated non-demo replies. Two-way audio/video RTP, shared chat, Socrates speech completion on both clients, Bentham Speak and global Stop AI, AI invitation/muting, and chat after leaving calls passed. Generated camera and silent microphone inputs were used; physical devices and speech recognition were not exercised. No local application requests or JavaScript page errors occurred. Cloud Orpheus speech remains blocked by model-terms activation, and native device fallback passed. Full report: `artifacts/production-audit/report.md`.

Production screenshots exposed overlapping AI tiles after inviting a third Mind. The CSS grid now uses content-sized rows and tiles constrained to column width. After deployment `dpl_6wvb1xM1fDK8LHnpcawatQUBAi4A`, actual production geometry confirmed no overlap at 320/390/768/1440 px. Two-browser media transport, real replies, completed Socrates device speech, Bentham Speak, Stop AI and chat after leaving calls passed again. The production build passed; no new unit tests were added for this CSS-only fix.
