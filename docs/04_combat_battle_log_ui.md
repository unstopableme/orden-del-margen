# Design Document: Fictional Combat Battle Log UI

Consolidated candidate balance and overlay parameters are tracked in
[`04_gameplay_proposals_supplement.md`](04_gameplay_proposals_supplement.md).
This focused document does not authorize implementation.

**System module:** HUD / Combat Feedback  
**Status:** Gameplay-only design proposal; no implementation is authorized

All names, layout measurements, colors, attributes, perks, and Energy values in
this document are candidates. The battle log presents authoritative encounter
results; it does not calculate costs, regeneration, damage, or rewards.

## 1. Interface wireframe

The candidate Combat Battle Log occupies the lower-left area of the tactical HUD
and uses a scrollable, fixed-width presentation.

```text
+------------------------------------------------------------------+
| [LOG] 14:02:11 UTC - ENTERED ENCOUNTER: CAVERN BOSS [T3]         |
| [LOG] 14:02:11 UTC - INITIAL ENERGY: 100 / 100                    |
| [LOG] 14:02:12 UTC - ACTION: CRITICAL ENGAGEMENT TRIGGERED       |
| [LOG] 14:02:12 UTC - EQUIPPED: TIER 3 PRISMATIC ARMOR-BREAKER    |
| [LOG] 14:02:12 UTC - CANDIDATE PERK: CONTINUOUS FLOW             |
| [LOG] 14:02:12 UTC - BASE COST: 40 ENERGY                         |
| [LOG] 14:02:12 UTC - RECORDED FINAL COST: 40 ENERGY               |
| [LOG] 14:02:12 UTC - CURRENT ENERGY: 60 / 100                     |
+------------------------------------------------------------------+
```

The example deliberately applies no weapon or perk discount. Any rule that
changes an encounter's Energy cost requires separate approval defining exact
arithmetic, operation order, rounding, minimum cost, stacking, and interaction
with the Energy capacity.

## 2. Exact Energy presentation

- The future authoritative service calculates regeneration from elapsed time
  with exact rational or fixed-point carry. It must not use binary
  floating-point approximations.
- At the candidate regeneration rate of 10 Energy per hour, one minute adds
  exactly `1/6 Energy`.
- A decimal display is presentation only. Two decimal places cannot represent
  `1/6` exactly and must never be described as the authoritative value.
- When a fractional value matters, the log should expose the exact value and may
  add a clearly marked rounded display, for example
  `ENERGY: 421/6 (display: 70.17)`.
- Display formatting must not feed a rounded value back into later calculations.

## 3. Timestamp and event rules

- Display timestamps as `HH:MM:SS UTC` for readability. The underlying event
  retains an authoritative instant and encounter identifier.
- Regeneration is an elapsed-time calculation independent of weekly rewards; a
  continuous backend timer is unnecessary.
- The client may warn about insufficient Energy, but a future authoritative
  service must enforce the cost. Rejection creates no encounter debit, although
  legitimate elapsed-time regeneration may update the balance.
- Retrying the same request displays the recorded result and must not create a
  second debit or reward. A new encounter has a new encounter identifier.
- The handling of Energy for a failed combat attempt remains unresolved.

## 4. Candidate visual tokens

- Encounter entry: white (`#FFFFFF`)
- Efficiency information: green (`#22C55E`)
- Candidate perk information: blue (`#3B82F6`)
- Candidate low-Energy warning below 15: crimson (`#DC2626`)

Color is supplementary. Every state also requires text or an icon, sufficient
contrast, keyboard access, screen-reader announcements, and a reduced-motion
presentation.

## 5. Scope boundary

This proposal does not approve combat calculations, weapon-based Energy
discounts, the `Continuous Flow` perk, the candidate Energy values, UI code,
encounter persistence, loot execution, or runtime integration.
