# Vercel production test report

Tested https://thirdmind-psi.vercel.app on 25 October 2026. Final call checks used deployment dpl_6wvb1xM1fDK8LHnpcawatQUBAi4A. All application pages and API requests used the public Vercel production origin; calls connected to LiveKit Cloud. No local application server or mocked AI, speech synthesis, or media transport was used.

Passed:

- Created computer science, medical, friends, and cooking rooms backed by Redis; each returned a real Groq response from the addressed Mind and stayed silent before invitation.
- Two independent Chrome browsers joined one production room and exchanged messages.
- Both clients received camera and microphone RTP through LiveKit Cloud. Camera and microphone inputs were generated test media, not physical devices.
- Socrates returned the same real reply to both call participants; native device speech emitted start and end events in both browsers.
- Bentham's Speak button started Daniel device-voice playback in both browsers; Stop AI stopped playback on both.
- Inviting Feynman, muting/unmuting Bentham, leaving calls, and continuing group chat worked.
- Homepage and three-AI call layouts fit 1440, 768, 390 and 320 px without overlapping tiles. All 12 portraits loaded in the picker and the 108-second demo video loaded from Vercel.
- Unauthorized room, call-token and speech requests returned 401. No JavaScript page errors or local application requests were observed.

Fixed and deployed:

Production screenshots exposed overlapping AI tiles when a third Mind was invited. Grid rows now preserve tile height, and tile widths fit their columns. The production build passed; the deployed call was retested at four viewport sizes, followed by two-browser speech completion, mute/unmute and Stop AI. All passed.

Remaining failure:

Groq natural speech returned HTTP 503 because the account owner must review and accept Orpheus model terms. Device speech fallback worked; cloud character voices are not enabled. Physical microphones, physical devices, recognition accuracy and subjective voice quality were not tested in this run.

Evidence: [server/scenarios](scenarios-and-server.json), [group call](group-call.json), [layout/assets](layout-and-assets.json), [desktop call](live-call-desktop.png), [mobile call](live-call-mobile.png).
