# Realtime avatar investigation

The implemented MVP uses the user's supplied AI character portraits, with speaking indicators and turn states following the room turn manager. Portraits are static photographs rather than animated faces or lip-synced video. There is no external avatar service dependency or face cloning.

After the working group-chat flow and local two-participant media transport were verified, the official [LiveKit avatar overview](https://docs.livekit.io/agents/models/avatar/) was checked. Its plugins publish generated video tracks through an agent worker; these are distinct from the browser's local vector tiles.

| Candidate                                                                | Verified from official LiveKit documentation                                                             | Remaining uncertainty                                                                                                                  |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| [Simli](https://docs.livekit.io/agents/models/avatar/plugins/simli/)     | Python integration, API key, configured face ID, realtime avatar video and custom/library face selection | Actual latency, account quotas, pricing, and concurrent instance limits need provider/account verification; true 3D is not established |
| [Spatius](https://docs.livekit.io/agents/models/avatar/plugins/spatius/) | A Python avatar plugin is listed                                                                         | 3D capability, cost and multi-Mind concurrency have not been independently verified                                                    |
| [LiveAvatar](https://docs.livekit.io/agents/models/avatar/)              | Python plugin listed                                                                                     | Account costs and multi-instance behavior are not verified                                                                             |
| [Tavus / Anam](https://docs.livekit.io/agents/models/avatar/)            | Python and Node.js plugins listed                                                                        | Their precise current account limits and economics have not been verified                                                              |

**Next integration candidate: Simli**, because LiveKit provides a documented Python plugin and face setup. This is an engineering choice based on integration documentation, not a claim that it is cheapest or supports true 3D. Do not provision it until there is a Simli account/key, approved generic face IDs and verified pricing/concurrency for the intended demo.

SERVICE: Simli  
WHY: Generated realtime avatar video, beyond local fallback animation.  
GET KEY: Follow the authentication link in the official Simli integration guide.  
ENVIRONMENT VARIABLE: `SIMLI_API_KEY` in a future worker, not in the browser or the current web environment template.  
BLOCKED FEATURE: Credentialed realtime avatar integration and its validation.  
CAN CONTINUE: Human calls, group chat, text/voice invocation, all local avatar states and bounded debates.

## Worker boundary

A future persistent Python LiveKit Agents worker should reuse the web application's authoritative room queue and persona/context policy. It must receive only explicitly authorized jobs, publish only the selected Mind's TTS/avatar output, and cancel both media outputs on human speech. Do not rely on the default voice-agent autonomous turn detection for permission to speak.

Deploy that worker separately with LiveKit Cloud Agents. Provider sessions need distinct participant identities for each Mind, and fallback tiles must remain available if a session fails. A commercial integration is not included or described as tested in this repository. Free-tier availability, multiple simultaneous avatars and true 3D capability are intentionally not asserted without evidence.
