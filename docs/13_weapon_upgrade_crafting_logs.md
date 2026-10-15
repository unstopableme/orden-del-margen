# Specification: Weapon upgrade crafting logs

**System module:** Inventory UI / historical forging logs  
**Status:** Gameplay proposal; implementation and system validation deferred  
**Tracking scope:** Offline reference only; no token allocation mechanics

## 1. Functional and authority boundary

The proposed Weapon Upgrade Crafting Logs screen is a read-only, scrollable
history of committed equipment-crafting attempts visible to the authenticated
account. It may render target equipment, the immutable recipe/rule version,
configured success parameters, exact charged resources, the committed outcome,
and resulting inventory references.

The screen is not itself an audit ledger and must not reconstruct financial or
inventory truth from localized text. A future PostgreSQL-backed crafting event
record and immutable asset ledger remain authoritative. The UI must never roll
an outcome, calculate deductions, grant equipment, mutate inventory, retry a
craft, or infer missing history.

Crafting is independent of participant verification, primary-account
designation, weekly reward eligibility, snapshots, Portfolio, participant-level
 
for candidate crafting costs; Gold is not a separate gameplay currency.

All recipes, costs, probabilities, failure rules, items, and materials in this
document remain proposals consolidated from
`04_gameplay_proposals_supplement.md`.

## 2. Proposed history-record presentation fields

| Display field | Proposed source | Requirement |
| --- | --- | --- |
| `eventId` | Immutable crafting event | Opaque stable reference; not editable |
| `committedAt` | Authoritative transaction timestamp | Canonical UTC instant; UI may localize separately |
| `targetItemId` and recorded label | Snapshotted recipe/output metadata | Preserve historical meaning after later catalog changes |
| `recipeVersion` | Immutable rule reference | Required to explain inputs and configured outcome policy |
| `configuredSuccessRate` | Snapshotted rule metadata | Exact rational/integer representation; display only, not a reroll |
| `outcomeCode` | Committed crafting result | Stable closed code rendered through localization |
| `currencyDebits` | Immutable ledger references | Exact base-unit amounts and canonical asset code |
| `materialDebits` | Immutable ledger references | Exact material IDs and base-unit amounts actually consumed |
| `materialCredits` | Immutable ledger references | Show only real committed return/salvage credits |
| `outputItemInstanceId` | Result reference or null | Present only when an item instance was committed |
| `requestReference` | Sanitized operation reference | Must not expose full idempotency keys, credentials, or internal locks |

Display grouping separators and decimal formatting are presentation only. Stored
economic quantities use exact integers or approved scaled integers, never
localized strings or binary floating point.

## 3. Text layout and wireframe proposal

The wireframe demonstrates a responsive textual view. Fixed-width typography is
optional and must remain readable under zoom, localization, and assistive
technology.

```text
+----------------------------------------------------------------------------+
| [FORGE HISTORY]                                              [FILTER: ALL] |
+----------------------------------------------------------------------------+
| [LOG] 2026-10-04T11:15:02.000Z - CRAFT ATTEMPT COMMITTED
|   TARGET ITEM:       Recruit's Iron Blade (candidate Tier 1 weapon)
|   RECIPE VERSION:    candidate-t1-v1
|   CONFIGURED RATE:   100.00% (candidate rule)
|   CHARGED CURRENCY:  500 $DONCELLA
|   CONSUMED:          mat_iron_scrap (x10)
|                      mat_coarse_leather (x5)
|   OUTCOME:           SUCCESS
|   RESULT:            Equipment instance reference recorded
| --------------------------------------------------------------------------
| [LOG] 2026-10-04T12:45:18.000Z - CRAFT ATTEMPT COMMITTED
|   TARGET ITEM:       Spell-Forged Greatsword (candidate Tier 2 weapon)
|   RECIPE VERSION:    candidate-t2-v1
|   CONFIGURED RATE:   100.00% (candidate rule)
|   CHARGED CURRENCY:  1,750 $DONCELLA
|   CONSUMED:          mat_iron_scrap (x25)
|                      mat_enchanted_amber (x8)
|                      mat_refined_steel (x4)
|   OUTCOME:           SUCCESS
|   RESULT:            Equipment instance reference recorded
| --------------------------------------------------------------------------
| [LOG] 2026-10-04T14:02:11.000Z - CRAFT ATTEMPT COMMITTED
|   TARGET ITEM:       Prismatic Armor-Breaker (candidate Tier 3 weapon)
|   RECIPE VERSION:    candidate-t3-v1
|   CONFIGURED RATE:   85.00% (candidate rule)
|   CHARGED CURRENCY:  5,000 $DONCELLA
|   CONSUMED:          mat_refined_steel (x25)
|                      mat_prismatic_essence (x5)
|                      mat_dragon_glass_core (x2)
|   UNCONSUMED INPUT:  mat_refined_steel (x25)
|   OUTCOME:           FAILED_WITH_PARTIAL_CONSUMPTION
|   RESULT:            No equipment instance created
+----------------------------------------------------------------------------+
| [RESET FILTERS]                                           [CLOSE HISTORY] |
+----------------------------------------------------------------------------+
```

These are illustrative records, not claims that events occurred. The example
uses the candidate failure accounting in which only `25` Refined Steel is
debited. “Unconsumed input” is explanatory text, not a compensating inventory
credit. If a future implementation instead debits and returns resources, the
history must show both immutable ledger entries without double counting.

The phrase “item added to inventory slot” is avoided because the future
inventory may not use fixed slots and a successful commit could require a
different storage model. The result should link to an authoritative item
instance when the caller is permitted to view it.

## 4. Proposed localization tokens

| Localization key | Fallback English text |
| --- | --- |
| `TXT_FORGE_LOG_HEADER` | `FORGE HISTORY` |
| `TXT_FORGE_LOG_COMMITTED` | `CRAFT ATTEMPT COMMITTED` |
| `TXT_FORGE_LOG_TARGET_ITEM` | `TARGET ITEM` |
| `TXT_FORGE_LOG_RECIPE_VERSION` | `RECIPE VERSION` |
| `TXT_FORGE_LOG_CONFIGURED_RATE` | `CONFIGURED RATE` |
| `TXT_FORGE_LOG_CURRENCY_DEBIT` | `CHARGED CURRENCY` |
| `TXT_FORGE_LOG_MATERIAL_DEBITS` | `CONSUMED` |
| `TXT_FORGE_LOG_MATERIAL_CREDITS` | `RETURNED` |
| `TXT_FORGE_LOG_UNCONSUMED` | `UNCONSUMED INPUT` |
| `TXT_FORGE_LOG_OUTCOME` | `OUTCOME` |
| `TXT_FORGE_LOG_RESULT` | `RESULT` |
| `TXT_FORGE_LOG_STATE_SUCCESS` | `SUCCESS` |
| `TXT_FORGE_LOG_STATE_PARTIAL_FAILURE` | `FAILED WITH PARTIAL CONSUMPTION` |
| `TXT_FORGE_LOG_NO_ITEM` | `No equipment instance created` |
| `TXT_FORGE_LOG_RESET_FILTERS` | `RESET FILTERS` |
| `TXT_FORGE_LOG_CLOSE` | `CLOSE HISTORY` |
| `TXT_ASSET_DONCELLA` | `$DONCELLA` |

Localization keys are proposals, not executable constants. Runtime outcome
codes, asset codes, material IDs, and quantities must remain structured data;
they must not be parsed back out of translated messages.

“Critical failure,” “core items shattered,” and “penalty enforced” are omitted
from the canonical fallback strings because they add unapproved mechanics or
punitive interpretation beyond the candidate committed outcome. A later
narrative layer may add flavor text if it remains clearly separate from exact
accounting facts.

## 5. Filtering, pagination, and retention boundaries

- Filters operate on structured event fields and never delete or modify history.
- “Reset filters” clears only local/query filter criteria.
- Results require stable pagination using an authoritative ordering such as
  `(committed_at, event_id)`; timestamps alone may collide.
- Newly committed events must not reorder or duplicate rows already delivered
  within a stable pagination contract.
- Empty, loading, unavailable, unauthorized, and redacted states require
  separate localized messages.
- Retention, archival, export, player access, moderator access, and privacy
  policies remain unresolved.

The interface must distinguish an authoritative gameplay failure from a
technical synchronization failure. A request with no committed crafting result
must not appear as a failed craft or imply that resources were charged.

## 6. Security, privacy, and accessibility

- Derive account scope from authentication; never accept a body/query account
  identifier as authority.
- Do not expose full idempotency keys, request fingerprints, credentials,
  database keys, lock state, or internal error details.
- Escape all localized and catalog text as content; no embedded executable
  markup is permitted.
- Provide semantic list/table structure, keyboard and controller navigation,
  screen-reader labels, zoom/reflow support, and non-color state indicators.
- Do not require a console font, hover, animation, sound, or precise color
  perception to understand a record.
- Use locale-aware visual formatting without changing canonical stored values.

## 7. Missing persistence contract

The repository has no crafting-event, recipe, equipment-instance, material
inventory, or gameplay asset-ledger schema. Before implementation, a separate
design must define immutable event identity, account ownership, exact amounts,
rule snapshots, ledger reconciliation, idempotency, append-only permissions,
correction events, pagination indexes, retention, and authorization.

This UI document cannot establish those storage rules or make the illustrative
history authoritative.

## 8. Offline boundary

No code, database initialization, migration, ledger, recipe engine, inventory
mutation, route, file writer, UI preview, simulation, or test is authorized.
All implementation and system validation remains deferred and offline.
