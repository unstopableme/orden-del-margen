# Specification: Game design and mechanics supplement

**System module:** Gameplay proposals / balance and overlay specifications  
**Status:** Gameplay proposals; implementation and verification deferred  
**Tracking scope:** Offline reference only; no implementation authorized

## Authority and interpretation

This supplement consolidates candidate combat, loot, crafting, and interface
parameters for design review. Every number, probability, item, material, perk,
layout, color, message, timer, and behavior below remains unapproved unless an
existing decision document explicitly says otherwise.

This document does not create runtime rules, a materials manifest, loot table,
recipe definition, inventory, API, database schema, migration, simulation,
validator, scheduled process, or test. It must be read with the focused UI and
audio documents and `MATERIALS_MANIFEST_SCHEMA.md`. Where this supplement
conflicts with `DECISIONS.md`, `ECONOMY.md`, or another adopted contract, the
adopted contract controls.

## 1. Combat energy candidates

| Parameter | Candidate value | Status |
| --- | ---: | --- |
| Maximum energy | `100` energy units | Proposed |
| Regeneration rate | `10` energy units per hour | Proposed |
| Ordinary Adventure encounter cost | `15` energy units | Proposed |
| Boss Arena encounter cost | `40` energy units | Proposed |

Energy is an account/gameplay resource and remains independent of the Sunday
00:00 UTC weekly reward boundary. The candidate rule does not connect energy to
participant verification, reward weight, Portfolio, `$MARGEN`, or community
points.

### Exact accumulation requirement

The proposed `10` units per hour must not be implemented as `0.1667` per minute
or stored in binary floating point. That rounded value loses exact carry. A
future authoritative implementation must use exact integer/rational arithmetic,
such as elapsed integer milliseconds plus a carried numerator under a fixed
denominator, and persist the settlement timestamp and carry atomically.

The repository has not adopted the clock source, offline cap, initial energy,
settlement frequency, regeneration while capped, encounter reservation rules,
or behavior across maintenance. Those decisions remain open.

### Encounter authorization

The client may display an insufficient-energy message, but only an
authenticated service transaction may authorize an encounter and debit energy.
The service must settle regeneration to one authoritative time, serialize the
relevant state, verify the cost, record the encounter and debit exactly once,
and commit atomically.

If the settled balance is insufficient, the operation rejects without changing
carry, balance, encounter state, inventory, or rewards. Timestamp behavior
remains unresolved. The candidate player-facing copy is “Insufficient Energy
for Encounter,” subject to localization and accessibility review.

## 2. Combat loot and illustrative materials

Loot requires a verified, uniquely identified encounter completion. Loot must
not affect participant associations, Tower eligibility, weekly reward weight,
the participant-level cap, snapshots, or payout records. Failed, abandoned,
duplicated, or replayed completion requests must not generate inventory credits.

| Candidate identifier | Fallback label | Candidate use | Catalog status |
| --- | --- | --- | --- |
| `mat_iron_scrap` | Iron Scrap | Weapon reinforcement | Illustrative |
| `mat_coarse_leather` | Coarse Leather | Armor padding | Illustrative |
| `mat_enchanted_amber` | Enchanted Amber | Element tuning | Illustrative |
| `mat_refined_steel` | Refined Steel | Alloy plates | Illustrative |
| `mat_prismatic_essence` | Prismatic Essence | Skill imbuement | Illustrative |
| `mat_dragon_glass_core` | Dragon Glass Core | Limit breaking | Illustrative |

These rows do not activate catalog entries. Rarity, classification,
descriptions, stack behavior, binding, transfer, sources, sinks, and artwork
must follow `MATERIALS_MANIFEST_SCHEMA.md` and require separate approval.

### Ordinary encounter roll proposal

| Rarity bucket | Candidate probability | Candidate members |
| --- | ---: | --- |
| Common | `70%` | `mat_iron_scrap`, `mat_coarse_leather` |
| Uncommon | `25%` | `mat_enchanted_amber`, `mat_refined_steel` |
| Rare | `5%` | `mat_prismatic_essence`, `mat_dragon_glass_core` |

This defines only candidate bucket probabilities. It does not define selection
within a bucket, quantities, pity rules, modifiers, eligibility, random-number
generation, audit evidence, or versioning. Future probabilities must use exact
integer or rational weights rather than binary floating point.

### Boss encounter roll proposal

The candidate flow grants one unspecified base material after verified boss
completion, then performs an independent rare-bonus roll with candidate
probability `10%`. The pools, selection weights, quantities, eligibility, and
replay policy remain undefined. “Guaranteed” is conditional on an authoritative
qualifying completion and committed reward transaction.

### Completion idempotency

The future service must bind rewards to a unique encounter completion and rule
version. Completion, loot decision, immutable credits, balances, and idempotent
result must commit atomically. An identical committed retry returns the recorded
result; a conflicting retry fails without mutation. Retry/reset rules remain
unresolved; this document does not adopt unlimited retries.

## 3. Weapon recipe candidates

The repository uses `$DONCELLA` for gameplay currency costs. “Gold” is not a
separate currency and has been normalized below.

| Tier | Candidate item | Candidate material inputs | Candidate `$DONCELLA` cost | Candidate success rate |
| ---: | --- | --- | ---: | ---: |
| `1` | Recruit's Iron Blade | `10` Iron Scrap; `5` Coarse Leather | `500` | `100%` |
| `2` | Spell-Forged Greatsword | `25` Iron Scrap; `8` Enchanted Amber; `4` Refined Steel | `1750` | `100%` |
| `3` | Prismatic Armor-Breaker | `50` Refined Steel; `5` Prismatic Essence; `2` Dragon Glass Core | `5000` | `85%` |

Every recipe name, tier, prerequisite, input, output, cost, and probability is a
proposal. This table is not an executable recipe manifest.

### Candidate Tier 3 failure result

If later adopted, the candidate failed outcome would consume `5000`
`$DONCELLA`, `5` Prismatic Essence, `2` Dragon Glass Core, and `25` Refined
Steel, leaving the other `25` Refined Steel unconsumed.

“Salvaged” must not become a second credit if all `50` units were never debited.
The transaction should charge only adopted failure inputs, or explicitly debit
and credit through balanced immutable entries if approved accounting requires
that representation.

The future service must derive the account from authentication, load one
immutable recipe version, validate exact balances, decide the outcome once, and
atomically commit debits, output or failure record, balances, counters, and the
idempotent response. Client timers provide no double-spend protection.

## 4. Interface overlay proposals

Interfaces render authoritative committed state; they do not calculate energy,
roll loot, decide crafting outcomes, or mutate inventory locally.

### Combat battle log HUD

Candidate placement is the lower-left region, but layout must adapt to viewport,
safe area, localization, zoom, input method, and assistive technology. A
fixed-width font is optional and must remain readable.

Candidate entries show a UTC time and event text. `HH:MM:SS` is not a unique
audit identity. Two-decimal display is allowed only when the exact unit contract
supports it; formatting must not imply nonexistent precision.

| Meaning | Candidate color | Required non-color cue |
| --- | --- | --- |
| Efficiency change | `#22C55E` | Signed value and descriptive text |
| Perk trigger | `#3B82F6` | Perk label and event description |
| Low-energy warning | `#DC2626` | Warning icon/text and accessible announcement |

Contrast must be validated against actual backgrounds. Color alone must never
communicate state.

### Character equipment and materials overlay

The proposed left panel displays equipped-item tier, recorded efficiency, and
perk descriptions. The example `20.0 / 25.0` scale and `Continuous Flow` perk
remain illustrative. Its proposed boss-cost reduction of `2` energy is not
adopted and must never be derived from display text.

The right panel may use a responsive grid. A fixed `6x6` grid and `999` stack
limit are candidates, not requirements. Display stacks come from approved
catalog metadata; totals come only from authoritative inventory. Overflow must
never be discarded because of a UI limit.

### Tier 3 crafting failure state

Candidate presentation includes a darkened backdrop, centered modal, strong
error treatment, and “Forge Synchronization Failure.” The proposed `75%`
opacity, `#DC2626` border, wording, animation, and `3.0`-second close delay all
require accessibility and usability review.

A forced delay is not a safety lock, transaction lock, or duplicate-spend
control. The UI must not trap focus or prevent accessible dismissal of
nonessential animation. Server authorization, idempotency, and atomic
persistence are the transaction protections. Technical synchronization failure
must remain distinct from an authoritative gameplay craft failure and must not
consume resources without a committed result.

## 5. Open decisions

Implementation remains blocked on the authoritative account, energy,
encounter, inventory, recipe, and ledger schemas; exact time and arithmetic
rules; approved catalog entries; versioned loot/RNG rules; approved recipes and
failure semantics; typed APIs; accessible responsive UI criteria; and explicit
authorization of a disposable PostgreSQL integration-test environment.

## 6. Offline and verification boundary

All runtime engines, database operations, routes, triggers, previews,
simulations, and PostgreSQL integration tests remain unauthorized and offline.
Concurrency and database verification remain **SKIPPED** under
`TEST_MANIFEST.md`.

The proposed read-only presentation of future committed crafting history is
documented separately in `13_weapon_upgrade_crafting_logs.md`.

Proposed quest stories, objective-sheet layouts, and localization fields are
documented separately in `14_game_quest_log_descriptions.md`.

Proposed character specialization branches and node-interface strings are
documented separately in `15_character_skill_tree_descriptions.md`.

An alternate offline item-weight layout and its unresolved table semantics are
documented separately in `16_combat_loot_table_weights.md`.
