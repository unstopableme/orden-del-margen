# Specification: Character skill tree descriptions

**System module:** Character progression / skill tree interface  
**Status:** Gameplay proposal; implementation and system validation deferred  
**Tracking scope:** Offline reference only; no token allocation mechanics

## 1. Functional and authority boundary

The proposed Character Skill Tree interface lets an authenticated gameplay
account inspect fictional specialization branches, candidate prerequisites,
candidate activation costs, and recorded node state for one owned character.

The repository has no local character progression file, persistent character
model, skill catalog, or skill-allocation service. A future authenticated
service and PostgreSQL persistence must be authoritative for Character XP,
character ownership, prerequisites, `$DONCELLA` balances, node activation, and
committed modifiers. Client or offline state cannot unlock a node or charge a
balance.

Skill nodes must not:

- create or modify participant/account associations;
- designate a primary progression account;
- increase or substitute for Kingdom Tower level, lifetime Character XP, or
  equipped-item prerequisites;
- alter reward-weight inputs, Portfolio, snapshots, participant-level caps, or
  `$MARGEN` payouts; or
- grant eligibility for weekly distributions or `$DONCELLA` Armory Chests.

Every branch, node, cost, prerequisite, percentage, and modifier below remains
an illustrative proposal.

## 2. Progression vocabulary

The submitted phrase “Kingdom Level Mod” is ambiguous and must not be used to
imply a reward multiplier or progression increase. This document separates:

- `towerLevelRequirement`: a read-only prerequisite checked against the
  acting account's authoritative completed Kingdom Tower level; and
- `skillEffect`: a gameplay-only effect applied after a committed activation.

A skill cannot add Tower levels, satisfy Tower Level 3 indirectly, or modify the
Kingdom Level value used by future reward calculations. Candidate requirements
such as “Tower Level 3 or higher” gate only the proposed node.

Character XP remains the account-level Tower progression counter defined by the
project. A future skill system needs its own adopted skill-point or purchase
model; this document does not silently consume Character XP.

### Dual-resource proposal disposition

The refined candidate submitted a `600 $DONCELLA / 50 $MARGEN` activation cost
for Ledger Defense and a `TXT_VAL_ALT_CURRENCY_UNIT` label. That dual-currency
rule is **not adopted** and is excluded from the active wireframe and
localization-token proposal.

`$MARGEN` spending eligibility, burn treatment, locked-balance use, custody,
ledger destination, refund behavior, and legal/economic consequences remain
unresolved. A cosmetic skill proposal cannot authorize those mechanics. If
`$MARGEN` skill spending is ever approved, it requires a separate versioned
economic decision, accounting contract, transaction design, and explicit update
to this document. Until then, candidate skill activation costs use only
`$DONCELLA`.

## 3. Proposed branch and node records

### Branch: Cognitive Forge

#### Node 01: Core Efficiency

| Attribute | Proposed value |
| --- | --- |
| `skillId` | `skl_core_efficiency_01` |
| `titleKey` | `skills.core_efficiency_01.title` |
| `descriptionKey` | `skills.core_efficiency_01.description` |
| `branchId` | `skill_branch_cognitive_forge` |
| `prerequisiteSkillIds` | Empty |
| `towerLevelRequirement` | Unresolved; no requirement adopted |
| Candidate activation cost | `450` `$DONCELLA` |
| Candidate effect | Return energy equal to `10%` of an undefined critical-attunement basis |
| Design status | Illustrative |

> Refine the internal operational logic of your gear. The discipline explores
> energy use during sustained fictional combat sequences.

“Critical Attunement,” its trigger, percentage basis, rounding, cap, stacking,
cooldown, and interaction with exact energy carry are undefined. The candidate
effect cannot be implemented from this prose.

#### Node 02: Advanced Surge Anchor

| Attribute | Proposed value |
| --- | --- |
| `skillId` | `skl_adv_surge_02` |
| `titleKey` | `skills.adv_surge_02.title` |
| `descriptionKey` | `skills.adv_surge_02.description` |
| `branchId` | `skill_branch_cognitive_forge` |
| `prerequisiteSkillIds` | `skl_core_efficiency_01` |
| `towerLevelRequirement` | Candidate: completed Tower Level `3` or higher |
| Candidate activation cost | `1500` `$DONCELLA` |
| Candidate effect | Reduce an undefined heavy-attack energy cost by `15%` |
| Design status | Illustrative |

> Enables fictional load balancing across weapon attributes and stabilizes
> output variance during high-stress combat cycles. Its order observes the
> Sunday boundary as a ceremonial handoff.

The Sunday reference is lore only. It does not schedule a job or interact with
the adopted Sunday 00:00 UTC weekly reward boundary. Heavy attack, percentage
basis, exact rounding, minimum cost, stacking order, and effect duration remain
undefined.

### Branch: Margen Syndicate

#### Node 01: Ledger Defense

| Attribute | Proposed value |
| --- | --- |
| `skillId` | `skl_ledger_defense_01` |
| `titleKey` | `skills.ledger_defense_01.title` |
| `descriptionKey` | `skills.ledger_defense_01.description` |
| `branchId` | `skill_branch_margen_syndicate` |
| `prerequisiteSkillIds` | Empty |
| `towerLevelRequirement` | None proposed |
| Candidate activation cost | `600` `$DONCELLA` |
| Candidate effect | Increase an undefined quest-failure salvage basis by `5%` |
| Design status | Illustrative |

> Bolster fictional resource-mitigation layers used by adventurers recovering
> from failed quests.

“Margen” in this branch name is narrative branding only. The node has no access
to `$MARGEN`, reward pools, payout ledgers, snapshot accounting, or system-error
recovery. Technical failures must never be converted into gameplay failures or
material-loss events. Quest-failure salvage is unapproved and undefined.

## 4. Text layout and wireframe proposal

```text
+----------------------------------------------------------------------------+
| [CHARACTER PROGRESSION: SKILL LINES]                     [TAB: OVERVIEW]   |
+----------------------------------------------------------------------------+
| BRANCH 01: COGNITIVE FORGE
|
| [NODE 01_01]: CORE EFFICIENCY
|   SKILL ID:              skl_core_efficiency_01
|   TOWER REQUIREMENT:     Unresolved
|   PREREQUISITE NODES:    None
|   CANDIDATE COST:        450 $DONCELLA
|   PROPOSED EFFECT:       10% energy return on Critical Attunement
|   STATUS:                AVAILABLE / LOCKED / ACTIVE (illustrative)
|
|   +-- [NODE 01_02]: ADVANCED SURGE ANCHOR
|       SKILL ID:          skl_adv_surge_02
|       TOWER REQUIREMENT: Candidate Tower Level 3+
|       PREREQUISITE:      skl_core_efficiency_01
|       CANDIDATE COST:    1,500 $DONCELLA
|       PROPOSED EFFECT:   15% heavy-attack energy-cost reduction
| --------------------------------------------------------------------------
| BRANCH 02: MARGEN SYNDICATE
|
| [NODE 02_01]: LEDGER DEFENSE
|   SKILL ID:              skl_ledger_defense_01
|   TOWER REQUIREMENT:     None proposed
|   PREREQUISITE NODES:    None
|   CANDIDATE COST:        600 $DONCELLA
|   PROPOSED EFFECT:       5% quest-failure salvage modifier
+----------------------------------------------------------------------------+
| [REQUEST SKILL RESET]                                      [BACK TO HUD]  |
+----------------------------------------------------------------------------+
```

ASCII indentation is illustrative and must not be the only expression of tree
relationships. A semantic node graph, prerequisite text, and nonvisual
navigation order are required.

Statuses in the wireframe are presentation candidates. The interface must
distinguish unavailable content, unmet prerequisites, insufficient balance,
pending request, active node, retired rule, and service failure rather than
collapsing them into one generic locked state.

## 5. Proposed localization tokens

| Localization key | Fallback English text |
| --- | --- |
| `TXT_SKILL_HEADER` | `CHARACTER PROGRESSION: SKILL LINES` |
| `TXT_SKILL_TAB_OVERVIEW` | `OVERVIEW` |
| `TXT_SKILL_LABEL_TOWER_REQUIREMENT` | `TOWER REQUIREMENT` |
| `TXT_SKILL_LABEL_PREREQUISITES` | `PREREQUISITE NODES` |
| `TXT_SKILL_LABEL_CANDIDATE_COST` | `CANDIDATE COST` |
| `TXT_SKILL_LABEL_PROPOSED_EFFECT` | `PROPOSED EFFECT` |
| `TXT_SKILL_ACTION_ACTIVATE` | `REQUEST ACTIVATION` |
| `TXT_SKILL_ACTION_RESET` | `REQUEST SKILL RESET` |
| `TXT_SKILL_ACTION_BACK` | `BACK TO HUD` |
| `TXT_SKILL_ERROR_PREREQUISITE` | `Node activation blocked because a required node is inactive.` |
| `TXT_SKILL_ERROR_TOWER_LEVEL` | `Node activation blocked because the Tower requirement is not met.` |
| `TXT_SKILL_ERROR_DONCELLA` | `Node activation requires more $DONCELLA.` |
| `TXT_ASSET_DONCELLA` | `$DONCELLA` |

Separate error strings prevent prerequisite, Tower, and balance failures from
being conflated. They may be displayed only after the authoritative service
returns an allowed typed result. Localized messages must never be parsed as
state or identifiers.

No `TXT_VAL_ALT_CURRENCY_UNIT`/`$MARGEN` activation token is defined. Merely
displaying such a token could falsely imply that `$MARGEN` spending is an
approved skill mechanic.

## 6. Activation transaction boundary

A future activation operation must:

1. derive the acting account and owned character from authentication;
2. load one immutable skill-catalog/rule version;
3. lock or otherwise serialize relevant character, node, and balance state;
4. validate lifecycle, graph prerequisites, Tower requirement, and exact
   `$DONCELLA` balance;
5. reject cycles, duplicate activation, stale versions, and incompatible nodes;
6. atomically record the node activation, `$DONCELLA` debit and ledger entry,
   audit event, and idempotent response; and
7. apply effects only from the committed versioned rule, never UI text.

This is a future service contract, not authorization to implement it. Failed
validation or a technical failure with no committed outcome must leave node and
balance state unchanged.

## 7. Reset and correction boundary

“Reset all nodes” is not adopted. A reset could be destructive and requires
explicit rules for eligibility, confirmation, cooldown, `$DONCELLA` refunds or
fees, effect removal, dependency order, historical records, equipped state,
active encounters, retries, and partial failure.

The proposed `REQUEST SKILL RESET` label therefore represents no executable
action. Any future reset must preserve immutable activation/debit history and
use additive correction or reset events rather than deleting records.

## 8. Future manifest separation

A future skill catalog may contain versioned branch/node identifiers,
localization keys, graph edges, requirement references, cost references, effect
rule references, lifecycle state, and presentation metadata. It must remain
separate from:

- per-character activated-node state;
- account Tower, Character XP, `$DONCELLA`, equipment, and inventory state;
- immutable activation, asset-ledger, and correction events;
- participant associations, reward snapshots, and payouts; and
- localization bundles and visual/audio assets.

The manifest must reject missing references, self-dependencies, cycles,
duplicate edges, unsupported effect types, and incompatible rule versions. This
document does not define executable JSON, JSON Schema, SQL, or physical tables.

## 9. Accessibility and presentation

- Expose graph relationships, prerequisites, selection, and activation state
  programmatically.
- Support keyboard, controller, touch, screen readers, zoom/reflow, and reduced
  motion.
- Never rely only on indentation, connector lines, color, animation, or sound.
- Provide a list/outline alternative to a spatial tree.
- Preserve logical focus when branches expand, collapse, or filter.
- Support localization expansion and bidirectional text.
- Do not expose account IDs, participant IDs, ledger keys, or internal errors.

## 10. Offline boundary

No code, local progression file, database initialization, skill manifest,
activation/reset service, currency debit, UI preview, simulation, or test is
authorized. All implementation and validation remains deferred and offline.
