# Design Document: Character Equipment Inventory Overlay

Consolidated candidate balance and overlay parameters are tracked in
[`04_gameplay_proposals_supplement.md`](04_gameplay_proposals_supplement.md).
This focused document does not authorize implementation.

The proposed historical crafting-log presentation is documented in
[`13_weapon_upgrade_crafting_logs.md`](13_weapon_upgrade_crafting_logs.md).

**System module:** Inventory UI / Menu System  
**Status:** Gameplay-only design proposal; no implementation is authorized

All layout, item, attribute, perk, capacity, and key-binding values in this
document are candidates. The item names are fictional examples. Crafting recipes
and character ascension remain undefined unless separately approved.

## 1. Candidate overlay layout

The candidate inventory view places a dark, blurred overlay over gameplay and
opens a dual-panel workspace. A proposed `I` key binding may open it, but the
final interaction must also support remapping, keyboard navigation, controllers,
touch input, focus management, and assistive technology.

The proposed 70% background treatment must be tested for contrast and
readability. Blur and transparency are presentation choices, not security or
state-isolation mechanisms.

### Left panel: active loadout

The panel displays the selected character's equipped weapon and armor slots. An
illustrative weapon card may show:

- Item: `Tier 3 Prismatic Armor-Breaker`
- Item tier: `3`
- Candidate rarity treatment: `Mythic` red border
- Candidate efficiency attribute: `20.0 / 25.0`
- Candidate perk: `Continuous Flow`

The efficiency scale, `Mythic` rarity, `Continuous Flow`, and any Energy-cost
effect are unapproved examples. The overlay must display recorded authoritative
data and must not derive combat costs from these labels.

### Right panel: materials inventory

- Candidate layout: a responsive grid with up to six columns, rather than a
  mandatory `6x6` layout on every screen size.
- Each slot displays an authoritative quantity and, if approved, its configured
  stack capacity, for example `354 / 999` Iron Scrap.
- Item details expose the display name, stable item identifier, candidate rarity,
  and fictional description through hover, keyboard focus, touch, and controller
  interaction.
- Quantities must not be read directly from an illustrative design manifest as
  though it were live player inventory.

## 2. Manifest boundary

The offline attribute contract is now proposed in
[`MATERIALS_MANIFEST_SCHEMA.md`](MATERIALS_MANIFEST_SCHEMA.md). It does not
create `materials_manifest.json`, a runtime schema, or approved catalog content.
The content architecture separates:

1. a material catalog containing identifiers, display metadata, classification,
   exact quantity semantics, lifecycle state, and candidate stack presentation;
2. loot tables containing exact integer or rational probability weights and
   independent boss-roll rules; and
3. authoritative per-player inventory quantities.

The ordinary-loot candidates remain one rarity roll—70% Common, 25% Uncommon,
and 5% Rare—followed by a separately defined selection within that rarity. The
boss proposal remains a guaranteed material plus an independent 10% rare-bonus
roll. These values and selection rules are not adopted.

## 3. Crafting and currency boundary

- Candidate Forge costs use `$DONCELLA`, not Gold.
- Proposed weapon recipes, the Tier 3 85% success rate, and partial failure
  penalty remain proposals pending explicit approval.
- A future overlay presents an authoritative crafting result; it does not roll
  success, calculate deductions, or apply inventory mutations.
- Retrying the same crafting request must not charge resources or grant an item
  twice. Transactional behavior, idempotency, concurrency, and rollback remain
  future service requirements.

## 4. Prototype boundary

Any playground, sandbox, dashboard, manifest validator, Forge simulator, or
inventory loop is an illustrative prototype until its actual behavior and source
are reviewed. This document does not claim that any such component has been
updated or integrated.
