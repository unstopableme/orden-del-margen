# Specification: Fictional faction selection onboarding sheets

**System module:** Character onboarding / interface localization strings  
**Status:** Gameplay proposal; implementation and system validation deferred  
**Tracking scope:** Offline reference only; no token allocation mechanics

## 1. Functional and identity boundary

The proposed onboarding step lets an authenticated account choose a faction
alignment for a newly created gameplay character. The faction supplies
narrative text and candidate visual/audio presentation for that character.

Faction selection is character-level cosmetic metadata. It must not:

- create or confirm a `participant_id`;
- associate accounts or wallets;
- designate or change a participant's primary progression account;
- modify Character XP, Kingdom Tower progression, Portfolio, reward weight,
  participant-level caps, snapshots, or payouts;
- grant materials, equipment, currency, combat modifiers, or crafting effects;
  or
- affect community points, badges, referrals, or knowledge scores.

The proposal does not place faction choice “immediately before” primary-account
designation. Participant verification and primary-account designation are
separate administrative/account processes and may not be inferred from a
character-onboarding sequence.

The repository has no adopted character-slot, faction, onboarding, or deletion
schema. Selection permanence, reselection, deletion consequences, default
behavior, skip behavior, and multi-character behavior remain unresolved.

## 2. Proposed faction records

The following are narrative candidates only. Identifiers, names, copy, and
style tokens are not active manifest entries.

### Faction 01: The Iron Syndicate

| Attribute | Proposed value |
| --- | --- |
| `factionId` | `fac_iron_syndicate` |
| `titleKey` | `factions.iron_syndicate.title` |
| `mottoKey` | `factions.iron_syndicate.motto` |
| `descriptionKey` | `factions.iron_syndicate.description` |
| Fallback title | The Iron Syndicate |
| Fallback motto | Forged in Structure. Unbroken in Execution. |
| Candidate primary color | Industrial Ash Gray (`#4B5563`) |
| Candidate background tint | Deep Steel (`#1F2937`) |

> Born in the dense subterranean foundry sectors, the Iron Syndicate values
> rigid architectural discipline, mechanical optimization, and defensive
> fortification. They view Tower progression not as an adventure, but as a
> systematic construction project to be completed within defined resource
> parameters.

### Faction 02: The Amber Conclave

| Attribute | Proposed value |
| --- | --- |
| `factionId` | `fac_amber_conclave` |
| `titleKey` | `factions.amber_conclave.title` |
| `mottoKey` | `factions.amber_conclave.motto` |
| `descriptionKey` | `factions.amber_conclave.description` |
| Fallback title | The Amber Conclave |
| Fallback motto | Preserving the Ledger. Channeling the Current. |
| Candidate primary color | Luminescent Amber (`#D97706`) |
| Candidate background tint | Warm Gold (`#78350F`) |

> A reclusive order of chroniclers studies the resonant properties of
> crystallized magical sap. The Amber Conclave seeks to harmonize natural magic
> with algorithmic data loops. In its fictional tradition, the order treats the
> Sunday 00:00 UTC transition as a ceremonial cosmic heartbeat.

The boundary reference is lore only. It neither schedules a job nor changes the
adopted weekly period contract, which runs from Sunday 00:00 UTC inclusive to
the following Sunday 00:00 UTC exclusive.

### Faction 03: The Prismatic Vanguard

| Attribute | Proposed value |
| --- | --- |
| `factionId` | `fac_prismatic_vanguard` |
| `titleKey` | `factions.prismatic_vanguard.title` |
| `mottoKey` | `factions.prismatic_vanguard.motto` |
| `descriptionKey` | `factions.prismatic_vanguard.description` |
| Fallback title | The Prismatic Vanguard |
| Fallback motto | Shattering Boundaries. Embracing the Flux. |
| Candidate primary color | Volatile Violet (`#7C3AED`) |
| Candidate background tint | Obsidian Edge (`#4C1D95`) |

> An alliance of outcasts, arena duelists, and rogue engineers manipulates
> volatile crystal matrices. The Prismatic Vanguard values adaptability,
> experimental craft, and dramatic combat style. Its stories celebrate calm
> recovery during unexpected anomalies.

Lore references to optimization, risk, efficiency, recovery, or anomalies do
not create gameplay bonuses, security permissions, failure-rate changes, or
operational incident roles.

## 3. Proposed localization strings

| Localization key | Fallback English text | Status |
| --- | --- | --- |
| `TXT_LBL_CHOOSE_FACTION` | `SELECT ALIGNMENT` | Proposed |
| `TXT_LBL_CONFIRM_FACTION` | `CONFIRM SELECTION` | Proposed |
| `TXT_WARN_FACTION_LOCK` | `Confirm this character's faction aesthetic. Change and deletion rules have not yet been finalized.` | Proposed |

“LOCK SELECTION” and a claim that the choice remains permanent until character
deletion are not used as authoritative copy because neither permanence nor
character deletion is adopted. If an irreversible choice is later approved,
the interface must state its exact consequences before confirmation and offer a
review/back step.

Keys are stable localization identifiers; fallback English is not a substitute
for localized resources. A future localization contract must define supported
locales, fallback order, interpolation, pluralization, length constraints,
Unicode normalization, review ownership, and versioning.

## 4. Proposed sheet interaction

```text
open character faction step
          |
          v
review all available faction sheets
          |
          v
select one candidate faction
          |
          v
review selection and current change-policy disclosure
          |
          +---- back/change selection
          |
          v
confirm through a future authenticated character service
```

The client must not treat local selection state as committed. Any future write
must derive the acting account from authentication, validate ownership of the
character slot, use an approved faction catalog/version, enforce the adopted
change policy, and persist the result atomically and idempotently.

No default faction may be silently assigned. Behavior for cancellation,
disconnects, retries, unavailable content revisions, and partially completed
onboarding remains unresolved.

## 5. Accessibility and presentation requirements

- Color must not be the only indication of faction identity or selection.
- Candidate color pairs require contrast testing in every actual UI state.
- Sheets require keyboard, controller, touch, screen-reader, zoom, and
  reduced-motion support.
- Focus order and selected state must be programmatically exposed.
- Lore must remain readable without background art, animation, or audio.
- Audio styling requires a separate cue manifest, captions or equivalent
  non-audio feedback where meaningful, volume controls, and a mute-safe flow.
- Text layout must support localization expansion and bidirectional scripts.

Hex values are illustrative visual candidates, not approved design-system
tokens. Faction presentation must not expose account, participant, credential,
or reward-state information.

## 6. Proposed future manifest separation

A future faction catalog may contain stable identifiers, localization keys,
fallback text, presentation-token references, audio-style references, lifecycle
state, and content revision metadata. It must remain separate from:

- character ownership and selected-faction state;
- participant/account associations and primary-account designation;
- Tower, XP, equipment, inventory, and combat state;
- reward snapshots, allocation weights, and payout ledgers; and
- authentication, authorization, and identity-proofing records.

This document does not define executable JSON, JSON Schema, SQL, or migration
names. Physical schema design requires a separate review after character and
account foundations are adopted.

## 7. Offline boundary

No code, faction manifest, localization bundle, UI preview, audio asset,
database initialization, migration, route, simulation, or test is authorized.
All system validation remains deferred and offline.

Faction references used only as quest-story anchors are proposed in
`14_game_quest_log_descriptions.md`; they do not add faction mechanics.
