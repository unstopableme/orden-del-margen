# Specification: Game quest log description sheets

**System module:** Quest UI / interface story manifest  
**Status:** Gameplay proposal; implementation and system validation deferred  
**Tracking scope:** Offline reference only; no token allocation mechanics

## Documentation verification disposition

**Review state:** Offline documentation baseline reviewed  
**System verification state:** Not performed; not authorized

This file has been reviewed for consistency with the repository's current
terminology and separation boundaries. “Baseline reviewed” means only that the
Markdown proposal is internally aligned as described below. It does not approve
quest mechanics, lock balance parameters, validate a runtime, or change the
implementation-deferred status.

| Area | Documentation result | Verified interpretation |
| --- | --- | --- |
| Currency denomination | PASS | Candidate gameplay fees use `$DONCELLA`; no Gold/Bronze balance or `$MARGEN` quest payout is introduced |
| Authority boundary | PASS AFTER CORRECTION | A future authenticated service and PostgreSQL state are authoritative; no local player database exists or may grant completion |
| Reward-system isolation | PASS | Quest proposals do not modify participant associations, weekly snapshots, Portfolio, reward weights, caps, or payouts |
| Weekly-boundary reference | PASS AS LORE ONLY | Mission 02 may reference Sunday 00:00 UTC narratively, but cannot schedule or execute the adopted weekly period transition |
| Progression vocabulary | PASS AFTER CORRECTION | Rewards use account-level Character XP terminology, not a separate generic “Account Progression XP” balance |
| Localization structure | PASS FOR CURRENT PROPOSAL | The keys in this file are proposed stable localization identifiers; the older `TXT_QUEST_HEADER`/`TXT_LBL_*` names are not silently treated as aliases |
| Runtime/database validation | NOT RUN | No quest engine, manifest, schema, route, database, simulation, or automated test exists |

The earlier candidate text stating that quest completion is checked against a
“local player character inventory database” is rejected. The earlier wording
that treated the Sunday boundary as quest execution is also rejected. Neither
statement is part of this reviewed baseline.

## 1. Functional and authority boundary

The proposed Game Quest Log presents active, completed, failed, expired, and
otherwise archived fictional objectives for the authenticated gameplay account.
Quest sheets may render narrative context, versioned objectives, progress,
candidate costs, candidate rewards, and a committed completion result.

The UI is not authoritative for objective progress, inventory, energy,
`$DONCELLA`, Character XP, Tower state, or rewards. The repository has no local
player-character inventory database or persistent quest service. A future
authenticated service and PostgreSQL persistence must validate objective state
and commit quest outcomes; client or offline state cannot grant completion.

Quests must not create participant associations, designate primary accounts,
alter immutable weekly snapshots, change Portfolio or reward weights, bypass
Tower Level 3 eligibility, or affect participant-level payout caps. Any future
quest contribution to Character XP must follow the adopted qualifying-source
policy and immutable progression-event rules.

All quest IDs, stories, objectives, costs, rewards, energy values, and interface
strings below are illustrative proposals.

## 2. Currency and reward vocabulary

All proposed gameplay currency fees and currency rewards use `$DONCELLA` and
its future canonical storage asset code. Gold, Bronze currency, and other labels
must not become separate balances. The Bronze mining plot remains unrelated.

`$MARGEN` is prohibited from these quest-sheet proposals. Quest rewards do not
represent token allocations, weekly payouts, legal ownership, cash value, or a
claim against a participant reward pool.

The repository calls the Tower progression counter **Character XP**. It is
account-level state, but UI copy must not rename it generically to “Account
Progression XP.” Community points and Character XP remain separate.

## 3. Proposed narrative records

Faction references are story/presentation anchors only. They do not require the
character to select that faction, change faction state, or create faction-based
bonuses unless a separate rule is later adopted.

### Quest 01: Foundry Reconnaissance

| Attribute | Proposed value |
| --- | --- |
| `questId` | `qst_foundry_recon_01` |
| `titleKey` | `quests.foundry_recon_01.title` |
| `descriptionKey` | `quests.foundry_recon_01.description` |
| `factionStoryRef` | `fac_iron_syndicate` |
| `objectiveTextKey` | `quests.foundry_recon_01.objective.verify_signatures` |
| Candidate target | `15` verified fictional drone-signature encounters |
| Candidate energy cost | `15` energy per qualifying encounter |
| Candidate `$DONCELLA` fee | `0` |
| Candidate Character XP reward | `250` |
| Candidate material reward | `15` × `mat_iron_scrap` |
| Design status | Illustrative |

> The automation decks in Sector 4 are drifting out of alignment. Intercept
> the rogue terminal drones, capture their diagnostic metrics, and return the
> raw components to the Forge to restore structural order.

“Verify signatures” is fictional objective language. It does not perform or
teach account authentication, credential validation, participant verification,
software signing, or any real security operation. The proposed `15`-energy cost
inherits no authority from this document and remains subject to the unresolved
combat-energy contract.

### Quest 02: Syncing the Amber Pulse

| Attribute | Proposed value |
| --- | --- |
| `questId` | `qst_sync_amber_02` |
| `titleKey` | `quests.sync_amber_02.title` |
| `descriptionKey` | `quests.sync_amber_02.description` |
| `factionStoryRef` | `fac_amber_conclave` |
| `objectiveTextKey` | `quests.sync_amber_02.objective.tower_level_3` |
| Candidate target | Complete Kingdom Tower Level 3 on the acting account |
| Candidate `$DONCELLA` fee | `1200` attunement fee |
| Candidate Character XP reward | `500` |
| Candidate material reward | `5` × `mat_enchanted_amber` |
| Design status | Illustrative |

> The Conclave's ceremonial Sunday boundary approaches. Gather readings from
> the inner-sanctum nodes so its chroniclers can prepare the fictional
> chronological ledger for the next handoff.

The Sunday reference is lore only. This quest does not schedule, trigger, delay,
or modify the adopted weekly period from Sunday 00:00 UTC inclusive to the next
Sunday 00:00 UTC exclusive. Completing or displaying this objective cannot
grant weekly reward eligibility; eligibility is evaluated separately from
authoritative snapshot state.

The `1200` `$DONCELLA` value is ambiguous in the submitted candidate as a
“completion cost” and an “attunement fee.” Before adoption, policy must define
whether it is an entry, activation, completion, or claim fee; when it is
reserved or debited; refund behavior; and the exact atomic transaction. Until
then, the UI must label it as a candidate fee, not as a committed deduction.

## 4. Text layout and wireframe proposal

```text
+----------------------------------------------------------------------------+
| [QUEST LOG: ACTIVE MISSIONS]                              [TAB: ADVENTURE] |
+----------------------------------------------------------------------------+
| MISSION 01: FOUNDRY RECONNAISSANCE
|   QUEST ID:             qst_foundry_recon_01
|   STORY FACTION:        The Iron Syndicate
|   OBJECTIVE PROGRESS:   0 / 15 (illustrative)
|   OBJECTIVE:            Verify fictional drone-signature encounters
|   CANDIDATE ENERGY:     15 per qualifying encounter
|   CANDIDATE FEE:        0 $DONCELLA
|   PROPOSED REWARDS:     250 Character XP
|                         mat_iron_scrap (x15)
| --------------------------------------------------------------------------
| MISSION 02: SYNCING THE AMBER PULSE
|   QUEST ID:             qst_sync_amber_02
|   STORY FACTION:        The Amber Conclave
|   OBJECTIVE PROGRESS:   0 / 1 (illustrative)
|   OBJECTIVE:            Complete Kingdom Tower Level 3
|   CANDIDATE FEE:        1,200 $DONCELLA (timing unresolved)
|   PROPOSED REWARDS:     500 Character XP
|                         mat_enchanted_amber (x5)
+----------------------------------------------------------------------------+
| [REQUEST ABANDON]                                          [BACK TO HUD]  |
+----------------------------------------------------------------------------+
```

Progress and reward values must come from structured authoritative data. The UI
must not parse identifiers, amounts, or state transitions from localized prose.
“Proposed rewards” describe design candidates; after implementation, pending
rewards, committed rewards, and claimed/credited results must use distinct
states and copy.

## 5. Proposed localization tokens

| Localization key | Fallback English text |
| --- | --- |
| `TXT_QUEST_HEADER_ACTIVE` | `QUEST LOG: ACTIVE MISSIONS` |
| `TXT_QUEST_TAB_ADVENTURE` | `ADVENTURE` |
| `TXT_QUEST_LABEL_ID` | `QUEST ID` |
| `TXT_QUEST_LABEL_STORY_FACTION` | `STORY FACTION` |
| `TXT_QUEST_LABEL_OBJECTIVE` | `OBJECTIVE` |
| `TXT_QUEST_LABEL_PROGRESS` | `OBJECTIVE PROGRESS` |
| `TXT_QUEST_LABEL_CANDIDATE_ENERGY` | `CANDIDATE ENERGY` |
| `TXT_QUEST_LABEL_CANDIDATE_FEE` | `CANDIDATE FEE` |
| `TXT_QUEST_LABEL_PROPOSED_REWARDS` | `PROPOSED REWARDS` |
| `TXT_QUEST_ACTION_REQUEST_ABANDON` | `REQUEST ABANDON` |
| `TXT_QUEST_ACTION_BACK` | `BACK TO HUD` |
| `TXT_QUEST_ERROR_INSUFFICIENT_DONCELLA` | `This action requires more $DONCELLA.` |
| `TXT_ASSET_DONCELLA` | `$DONCELLA` |

The insufficient-balance message must be used only after an authoritative
service rejects a defined fee operation. It must not reveal the full balance if
the caller is unauthorized or imply that the client performed the debit.

Localization keys, quest IDs, material IDs, asset codes, objective codes, and
state codes are separate fields. Translated strings are never identifiers.

## 6. Quest lifecycle and transaction boundaries

A future quest contract must separately define:

- availability, activation, progress, completion, reward-pending, rewarded,
  failed, expired, abandoned, and archived states;
- objective event sources, deduplication, ordering, and correction rules;
- authoritative clock and effective quest/rule versions;
- whether fees exist, their timing, reservation, debit, failure, cancellation,
  and refund behavior;
- exact reward posting, inventory capacity behavior, and Character XP source
  qualification;
- replay/idempotency behavior and immutable event/ledger evidence; and
- whether abandonment is allowed, reversible, destructive, or subject to
  confirmation.

The “Request Abandon” action cannot delete history or locally change state. A
future authenticated service must validate the transition and preserve an
auditable event. Completed or rewarded history must remain distinguishable from
active objectives.

## 7. Accessibility, privacy, and presentation

- Use semantic headings, lists, progress descriptions, and status text.
- Progress must not rely only on bars, color, animation, sound, or faction art.
- Support keyboard, controller, touch, screen readers, zoom/reflow,
  reduced-motion preferences, and localization expansion.
- Candidate fixed-width presentation is optional and must remain readable.
- Show UTC and localized time only when their meanings are explicit.
- Do not expose account IDs, participant IDs, idempotency keys, internal ledger
  identifiers, security evidence, or hidden objective state.
- Archived entries and redactions require explicit accessible labels.

## 8. Future manifest separation

A future quest content manifest may describe versioned narrative keys,
objective-definition references, faction story references, presentation
metadata, and candidate rule references. It must remain separate from:

- per-account quest progress and history;
- authoritative Character XP, Tower, energy, currency, and material balances;
- immutable objective, progression, inventory, and asset ledger events;
- participant associations, reward snapshots, and payout records; and
- localization bundles and art/audio assets.

This document does not define executable JSON, JSON Schema, SQL, or physical
table names.

## 9. Offline boundary

No code, database initialization, quest manifest, quest engine, inventory
lookup, reward transaction, route, UI preview, simulation, or test is
authorized. All implementation and validation remains deferred and offline.

Candidate skill-tree descriptions and quest-salvage references are documented
separately in `15_character_skill_tree_descriptions.md`; no interaction is
adopted by either proposal.
