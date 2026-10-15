# Specification: Combat loot-table random drop weight sheets

**System module:** Gameplay design / loot layout reference  
**Status:** Gameplay proposal; implementation and system validation deferred  
**Tracking scope:** Offline reference only; no live token allocation or probability engine

## 1. Functional and authority boundary

This sheet documents fictional loot-table text layouts and candidate probability
weights for design review. It cannot execute random selection, grant materials,
charge `$DONCELLA`, award Character XP, mutate inventory, or alter participant
reward calculations.

Any future loot decision must be produced by an authenticated,
server-authoritative encounter service using an immutable rule version and
committed atomically with encounter completion, inventory/ledger entries, and
an idempotent result. A UI preview is never authoritative.

Combat loot remains separate from participant associations, Tower eligibility,
Portfolio, weekly reward weights, snapshots, participant-level caps, and
`$MARGEN` payouts. `$MARGEN` is not a combat-loot or fee currency. Candidate
gameplay currency fees use `$DONCELLA`; Gold/Bronze currency must not become
separate balances.

## 2. Probability interpretation

The five percentages in the submitted layout—`50`, `20`, `20`, `5`, and `5`—
sum to `100%` only when interpreted as global weights in one illustrative
combined reward pool:

```text
50 + 20 + 20 + 5 + 5 = 100
```

The two visual “roll matrix” headings therefore do not establish two executable
tables. If `tbl_sanctum_amber_02` is intended to be an independent table, its
remaining `95%` outcome, trigger, and relationship to the foundry table are
undefined. No implementation may infer a no-drop result or normalize the lone
`5%` entry automatically.

The repository's earlier ordinary-encounter proposal uses rarity buckets of
`70%` Common, `25%` Uncommon, and `5%` Rare, with within-bucket selection still
undefined. This document is an alternate candidate layout and does not silently
replace that proposal. A future decision must choose a single versioned model:

- direct global item weights; or
- a rarity-bucket roll followed by a separately defined within-bucket roll.

Probabilities must be stored as exact integer or rational weights. Binary
floating point, display percentages, localized strings, and rendered bar length
must never be the authoritative selection input.

## 3. Illustrative material and content references

| Candidate ID | Fallback label | Relationship to existing proposal | Status |
| --- | --- | --- | --- |
| `mat_iron_scrap` | Iron Scrap | Already appears as an illustrative material candidate | Illustrative |
| `mat_copper_wire` | Copper Wiring | New candidate in this sheet | Illustrative |
| `mat_broken_core` | Broken Drone Diagnostic Core | New candidate in this sheet | Illustrative |
| `mat_steel_plate` | Refined Steel Plate | Distinct ID from existing `mat_refined_steel`; equivalence is not assumed | Illustrative |
| `mat_enchanted_amber` | Enchanted Amber Crystal | Existing ID with alternate fallback label; canonical label remains unresolved | Illustrative |

None of these rows activates a materials catalog entry. Identity, canonical
label, category, rarity, quantity scale, stack policy, binding, transfer,
sources, sinks, localization, and artwork require review under
`MATERIALS_MANIFEST_SCHEMA.md`.

`mat_steel_plate` must not be aliased to `mat_refined_steel` by display-name
similarity. Either it is a distinct material with separately approved semantics,
or one identifier must be retired through an explicit catalog decision.

## 4. Text layout and weight-sheet proposal

```text
+----------------------------------------------------------------------------+
| [COMBAT ENCOUNTER SUMMARY: LOOT PREVIEW]                    [TIER: ALPHA]  |
+----------------------------------------------------------------------------+
| ENCOUNTER STORY ANCHOR: Sector 4 Automation Deck Ruins
|
| CANDIDATE POOL: COMBINED SALVAGE PREVIEW
|   Layout reference: tbl_foundry_salvage_01 / tbl_sanctum_amber_02
|   Story factions:   Iron Syndicate / Amber Conclave
|
|   [COMMON CANDIDATES - Global display weight: 70%]
|   +-- Iron Scrap (mat_iron_scrap) --------------------------- Weight: 50%
|   +-- Copper Wiring (mat_copper_wire) ----------------------- Weight: 20%
|
|   [UNCOMMON CANDIDATES - Global display weight: 25%]
|   +-- Broken Drone Diagnostic Core (mat_broken_core) -------- Weight: 20%
|   +-- Refined Steel Plate (mat_steel_plate) ----------------- Weight: 5%
|
|   [RARE CANDIDATE - Global display weight: 5%]
|   +-- Enchanted Amber Crystal (mat_enchanted_amber) --------- Weight: 5%
|
|   CANDIDATE CHARACTER XP: +50 (separate progression proposal)
|   CANDIDATE EXTRACTION FEE: 350 $DONCELLA (timing unresolved)
|
|   LORE NOTE: Amber chroniclers ceremonially observe the Sunday boundary.
+----------------------------------------------------------------------------+
| [CONFIRM PREVIEW FILTERS]                                   [CLOSE SHEET] |
+----------------------------------------------------------------------------+
```

The visual rarity subtotals mirror the earlier `70/25/5` proposal, but the item
weights are still unapproved. “Faction” is a narrative anchor, not a probability
modifier or eligibility condition. A character's faction selection must not
change weights unless a separate mechanic is explicitly adopted.

The `+50` Character XP candidate is not part of the material random roll. A
future progression policy must decide whether the verified encounter type is a
qualifying Character XP source and record it separately from inventory credits.

## 5. Candidate extraction fee disposition

The submitted `350 $DONCELLA` “Secure Extraction Processing Fee” is ambiguous.
Before it can be adopted, policy must define:

- whether the fee is for encounter entry, loot generation, extraction, claim,
  or another operation;
- whether it applies to all candidates or only the sanctum context;
- when it is reserved/debited and whether it changes loot eligibility;
- failure, cancellation, timeout, retry, refund, and insufficient-balance
  behavior; and
- the immutable rule version, ledger reason, idempotency scope, and destination.

The offline preview itself must never require or check a `$DONCELLA` balance.
Until the fee contract is adopted, it is displayed only as a candidate and the
UI cannot expose an operative “insufficient funds” state for preview access.

## 6. Proposed localization tokens

| Localization key | Fallback English text |
| --- | --- |
| `TXT_LOOT_HEADER_PREVIEW` | `COMBAT ENCOUNTER SUMMARY: LOOT PREVIEW` |
| `TXT_LOOT_LABEL_GLOBAL_WEIGHT` | `GLOBAL DISPLAY WEIGHT` |
| `TXT_LOOT_LABEL_STORY_FACTION` | `STORY FACTION` |
| `TXT_LOOT_LABEL_CHARACTER_XP_CANDIDATE` | `CANDIDATE CHARACTER XP` |
| `TXT_LOOT_LABEL_EXTRACTION_FEE_CANDIDATE` | `CANDIDATE EXTRACTION FEE` |
| `TXT_LOOT_ACTION_CONFIRM_FILTERS` | `CONFIRM PREVIEW FILTERS` |
| `TXT_LOOT_ACTION_CLOSE` | `CLOSE SHEET` |
| `TXT_ASSET_DONCELLA` | `$DONCELLA` |

The submitted `TXT_ERR_EXTRACTION_FAILED` insufficient-balance token is not
adopted because no extraction-fee operation exists. A later transaction UI may
define a typed error mapping after fee timing and authority are approved.

Localization strings are presentation only. Table IDs, material IDs, rarity
codes, weights, quantities, state codes, and asset codes remain structured,
nonlocalized data.

## 7. Lore and weekly-boundary separation

The Sunday reference is fictional lore only. It neither executes nor modifies
the adopted weekly period from Sunday 00:00 UTC inclusive to the next Sunday
00:00 UTC exclusive. Loot tables must not use the payout boundary unless a
separate gameplay scheduling rule is explicitly adopted.

“Continuous weekly transition” is avoided because it can obscure the precise
half-open period contract. Lore must not be parsed into scheduler behavior.

## 8. Missing rule contract

Before any probability engine is designed, a separate adopted contract must
define at least:

- table identity, immutable revision, lifecycle, and activation boundaries;
- encounter eligibility and exactly-once completion identity;
- direct-weight versus rarity-then-item selection semantics;
- exact weights, quantities, no-drop behavior, independent/conditional rolls,
  modifiers, and deterministic audit evidence;
- approved random source and unbiased integer sampling procedure;
- inventory-capacity, overflow, duplicate, correction, and rollback behavior;
- fee and Character XP separation;
- atomic ledger/inventory writes and idempotent replay; and
- retention, disclosure, analytics, and player-facing probability policy.

No client preview, faction label, timestamp, or localized string may substitute
for those rules.

## 9. Accessibility and presentation

- Provide semantic tables/lists and a non-ASCII representation of hierarchy.
- Do not rely on spacing, connector glyphs, color, animation, or sound.
- Explain whether weights are global, conditional, or independent in text.
- Support keyboard, controller, touch, screen readers, zoom/reflow, reduced
  motion, localization expansion, and bidirectional text.
- Do not present unapproved weights as guaranteed player outcomes.
- Do not expose internal RNG state, seeds, account IDs, idempotency keys, or
  ledger internals.

## 10. Offline boundary

No code, live database, loot manifest, random engine, fee transaction,
inventory mutation, Character XP award, route, preview application, simulation,
or test is authorized. All implementation and validation remains deferred and
offline.
