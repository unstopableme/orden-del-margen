# Design Document: Fictional Arena Leaderboard UI

**System module:** Menu Systems / Social Competition Overlay  
**Status:** Gameplay-only design proposal; no implementation is authorized

All ranking metrics, eligibility rules, display values, weapon attributes, and
visual treatments in this document are candidates. This proposal does not create
an Arena service, leaderboard, reward, database record, scheduled task, or API.

## 1. Candidate interface wireframe

The Arena Leaderboard is proposed as a full-screen panel with a scrollable table
and a persistent summary of the local player's standing.

```text
+--------------------------------------------------------------------------------+
| ARENA LEADERBOARD — REGION: GLOBAL          PERIOD ENDS: SUNDAY 00:00:00 UTC   |
|                                             5d 12h 30m remaining (display)     |
+--------------------------------------------------------------------------------+
| Rank | Player name    | Primary weapon             | Tier | Avg. efficiency    |
|-------------------------------------------------------------------------------|
|  01  | Sovereign_01   | Prismatic Blade            |  3   | 24.85 / 25 display |
|  02  | Void_Walker    | Iron Greatsword            |  2   | 18.42 / 25 display |
|  03  | Cyber_Samurai  | Forge Armor-Breaker        |  3   | 16.10 / 25 display |
| ...  | ...            | ...                        | ...  | ...                |
|  84  | [YOU] Player_1 | Recruit's Blade            |  1   |  2.15 / 25 display |
+--------------------------------------------------------------------------------+
| MY STATS: Rank #84 | Candidate top-run cost: 14.68 Energy | Period: Active     |
+--------------------------------------------------------------------------------+
```

Player names, weapons, scores, ranks, and countdown values above are fictional
examples. `Queued` is not a leaderboard-period status and is reserved for the
separate primary-account switch workflow.

## 2. Candidate ranking contract

The proposed primary ordering is descending average Energy-efficiency score over
eligible, verified Arena encounters completed during the active period. That
sentence does not yet define an authoritative metric. Before adoption, a
separate decision must specify:

- the exact numerator and denominator;
- whether the metric represents damage, completion value, or Energy saved;
- the baseline against which Energy is considered saved;
- encounter eligibility, minimum activity, forfeits, failures, and disconnects;
- treatment of difficulty, opponents, weapons, perks, and balance versions;
- exact rational aggregation and canonical comparison without floating point;
- anti-abuse, duplicate-completion, moderation, and correction rules; and
- privacy-safe public identity and region handling.

The UI may round an exact score to two decimal places for display, but ranking
must compare canonical exact values. Two scores that merely display the same two
decimal places are not tied.

The proposed deterministic tie-break sequence is also unresolved. An
authoritative encounter timestamp could be one component, but “achieved the
average first” is ambiguous when every later encounter can change an average.
Any adopted sequence must end with a stable unique key so pagination and repeated
queries cannot reorder tied entries.

## 3. Period boundary and archives

If Arena standings use the adopted weekly calendar, each period starts Sunday at
00:00:00 UTC inclusive and ends the following Sunday at 00:00:00 UTC exclusive.
The countdown is a derived display and is not authoritative state.

At the boundary, a new active period becomes effective. The prior period is not
“flushed” or deleted: its final standings and supporting audit references remain
archived according to a future retention policy. Processing may occur after the
boundary as long as effective-period assignment is deterministic and no interval
gap or overlap is introduced.

This calendar alignment does not connect Arena Energy regeneration to weekly
rewards. Energy remains an elapsed-time calculation independent of the weekly
boundary.

## 4. Candidate visual treatment

- Ranks 1–3 may use gold-, silver-, and bronze-colored treatments.
- The local player's row may use dark amber (`#D97706`).
- Rank, text, and icons must communicate state without depending on color.
- Animated glow requires a reduced-motion alternative and must respect flash and
  contrast accessibility limits.
- The table requires keyboard and controller navigation, screen-reader headers,
  focus preservation, responsive layouts, and stable paginated or virtualized
  ordering.

## 5. Integrity and display boundary

- The overlay displays authoritative recorded results; it does not calculate
  encounter efficiency, determine eligibility, or assign rank locally.
- Retrying the same encounter-completion request must not add another result.
- Corrections must be audited and must not silently rewrite archived standings.
- Leaderboard placement grants no weekly reward eligibility or payout unless a
  separate policy explicitly establishes that relationship.
- Weapon efficiency attributes, Energy discounts, leaderboard rewards, and all
  example values remain proposals.

## 6. Prototype boundary

Any linked sandbox or dashboard remains an illustrative prototype until its
source and actual behavior are reviewed. This document does not establish that a
leaderboard renderer, simulation, archive process, or integration exists.
