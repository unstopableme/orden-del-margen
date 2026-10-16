# Design Document: Crafting and Error-State Audio Cue Sheet

Consolidated candidate crafting and interface parameters are tracked in
[`04_gameplay_proposals_supplement.md`](04_gameplay_proposals_supplement.md).
Audio remains presentation-only and does not authorize gameplay outcomes.

**System module:** Audio / Sound Effects Trigger Map  
**Status:** Gameplay-only design proposal; no implementation is authorized

All cue names, triggers, synthesis direction, frequencies, durations, levels,
priorities, and mix behavior in this document are candidates pending audio,
accessibility, platform, and safety review. Audio reinforces a recorded state; it
must never be the only way that state is communicated.

## 1. Candidate audio event matrix

| Cue ID | Candidate trigger | Candidate acoustic direction | Candidate asset peak | Priority |
| --- | --- | --- | ---: | --- |
| `SND_FORGE_START` | An authoritative crafting request is accepted, not merely when the button is pressed. | Mechanical drone into a pneumatic hiss; illustrative `200 Hz` to `1.2 kHz` sweep over `0.8 s`. | `-12 dBFS` | Medium |
| `SND_CRAFT_SUCCESS` | A crafting attempt commits a successful result. | Pentatonic major crystal-bell chime with an illustrative `2.5 s` reverb decay. | `-10 dBFS` | High |
| `SND_CRAFT_FAIL_T1_T2` | A lower-tier attempt commits a gameplay failure, only if a future approved rule permits that outcome. | Muted metallic impact with an illustrative `800 Hz` to `150 Hz` downward slide over `0.4 s`. | `-14 dBFS` | Low |
| `SND_CRAFT_FAIL_T3` | A Tier 3 attempt commits a gameplay failure under an approved rule. | Low synthetic impact and glass-like texture with controlled transient and noise content. | `-8 dBFS` | High |

The current recipe proposal gives Tier 1 and Tier 2 a 100% success rate, so it
does not currently establish a valid trigger for `SND_CRAFT_FAIL_T1_T2`.
Technical, network, validation, and synchronization failures need distinct cues
and must not be presented as gameplay crafting failures.

Asset peak in dBFS is not a perceived-loudness target. Before approval, an audio
delivery specification must define measurement method, integrated or short-term
loudness targets where applicable, true-peak ceiling, channel layout, sample
rate, bit depth, codec, headroom, normalization, and platform-specific playback
calibration. User master, effects, music, and accessibility settings take
precedence over candidate mix values.

## 2. Authoritative trigger and retry rules

- A future service records the crafting outcome and atomic inventory and
  `$DONCELLA` transaction before a result cue is eligible to play.
- The client associates playback with a stable attempt identifier and outcome.
- Retrying the same request returns the recorded outcome and must not create a
  second charge, result, or mandatory cue. A reconnect may restore the visual
  result without replaying disruptive audio.
- A rejected, rolled-back, or unresolved attempt must not play a success or
  gameplay-failure cue.
- Audio playback failure never changes the authoritative crafting result.

The proposed Tier 3 85% success rate, partial material penalty, a cost of
`5,000` `$DONCELLA`, and three-second acknowledgement delay remain pending
explicit approval.

## 3. Candidate ducking and interruption

- During the proposed Tier 3 result overlay, background music may be ducked by a
  candidate `12 dB`; this is ducking, not muting.
- Attack, hold, and release curves must be reviewed in context to avoid abrupt
  or uncomfortable level changes. The overlay duration must not be treated as a
  security or idempotency mechanism.
- Leaving the Forge may stop session loops and apply a candidate `150 ms`
  fade-out to attached tails. Navigation, pause, focus loss, and transition
  behavior remain to be defined.
- At most one audible Tier 3 failure voice per attempt is proposed. A complete
  voice policy still needs per-cue, per-session, and global limits plus explicit
  steal, suppress, and retrigger rules.

## 4. Accessibility and safety

- Every cue has a simultaneous visual and text equivalent.
- Players can independently reduce or disable effects, music ducking, intense
  transients, low-frequency effects, and reverb where supported.
- Do not rely on sudden loudness, white noise, or frequency extremes to convey a
  required action.
- Final assets require hearing-safety review across supported devices and mix
  settings; the listed dBFS peaks do not establish safe playback volume.
- Captions or descriptive labels identify meaningful sounds without requiring
  pitch recognition.
- Repeated input, held controls, and rapid retries must not create stacked or
  unbounded playback.

## 5. Asset and lifecycle requirements

Before implementation, each approved cue needs an asset identifier and version,
source and license record, loop and trim metadata, localization-independent
caption, duration, checksum, supported formats, memory budget, preload or
streaming policy, and fallback behavior for a missing or corrupt asset.

## 6. Prototype boundary

Any linked soundboard, sandbox, testing console, or simulated trigger remains an
illustrative prototype until its source, assets, measurements, and behavior are
reviewed. This document does not establish that an audio engine, cue asset,
mixing bus, Forge integration, or runtime trigger exists.
