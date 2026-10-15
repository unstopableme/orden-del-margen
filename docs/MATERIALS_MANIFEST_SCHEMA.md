# Specification: Materials manifest schema and data attributes

**Document ID:** `SPEC-DATA-MATERIALS-2026`  
**System module:** Gameplay catalog / inventory presentation  
**Status:** Offline design specification; implementation deferred

## Purpose and authority boundary

This document defines the proposed shape and meaning of an offline materials
catalog manifest. It does not create `materials_manifest.json`, a JSON Schema,
a database table, a migration, a validator, a loot table, a crafting recipe,
player inventory, or runtime authority.

The manifest describes material kinds and presentation metadata. It never
stores an account's quantity, grants an item, rolls loot, charges a recipe, or
changes a balance. A future service and PostgreSQL persistence remain
authoritative for owned quantities and committed inventory mutations.

## Domain separation

The future content system must keep these artifacts distinct:

| Artifact | Responsibility | Must not contain |
| --- | --- | --- |
| Materials manifest | Stable material identifiers, classification, display references, quantity semantics, and lifecycle metadata | Player quantities, drop probabilities, recipe costs, transaction state |
| Loot tables | Versioned source pools, exact integer/rational selection weights, independent rolls, and eligibility conditions | Player balances or mutable catalog definitions |
| Recipe rules | Versioned material inputs, outputs, `$DONCELLA` costs, prerequisites, and outcome policy | Current player inventory or unversioned display text |
| Player inventory | Authoritative account/material quantities and concurrency version | Catalog descriptions, probabilities, or recipe definitions |
| Asset ledger | Immutable inventory credits/debits and their source/idempotency evidence | Mutable material metadata or UI layout |

`$DONCELLA` is the canonical utility asset and is not a material. “Bronze
currency” must not appear as a separate material or asset. `$MARGEN`, equipment,
mining plots, buildings, chests, and currencies also remain outside this
manifest. A chest may reference loot tables; it is not itself a material unless
a separate design explicitly adopts consumable container items.

## Manifest envelope

| Attribute | Type | Required | Constraints and meaning |
| --- | --- | --- | --- |
| `schemaVersion` | string | yes | Schema contract identifier such as `materials-manifest-v1`; exact, case-sensitive, and supported by the consumer |
| `manifestId` | string | yes | Stable identifier for the catalog lineage; canonical lower-case slug |
| `revision` | string | yes | Immutable content revision within `manifestId`; canonical positive decimal integer string |
| `status` | enum string | yes | `draft`, `reviewed`, `active`, or `retired`; this document does not authorize any revision as active |
| `contentLocale` | string | yes | BCP 47 language tag for inline fallback display text; localization keys remain canonical |
| `createdAt` | UTC timestamp string | yes | Canonical RFC 3339/ISO 8601 UTC timestamp with `Z`; provenance only, not activation time |
| `effectiveAt` | UTC timestamp string or null | yes | Proposed activation boundary; must be null unless activation is separately authorized |
| `supersedesRevision` | string or null | yes | Earlier immutable revision replaced by this one; null for the first revision |
| `materials` | array | yes | Material definition records, sorted lexicographically by `materialId`; identifiers unique within the manifest |
| `contentDigest` | object or null | yes | Optional publication integrity metadata; null while draft |

Unknown top-level attributes must be rejected by a strict future validator. An
empty `materials` array is structurally valid for drafting but cannot become an
active gameplay catalog without separate content approval.

## Material definition attributes

### Identity and lifecycle

| Attribute | Type | Required | Constraints and meaning |
| --- | --- | --- | --- |
| `materialId` | string | yes | Stable canonical identifier matching `^[a-z][a-z0-9_]{1,63}$`; never reused for a different meaning |
| `catalogVersion` | string | yes | Positive decimal integer string for this material definition's semantic revision |
| `lifecycleStatus` | enum string | yes | `draft`, `active`, `deprecated`, or `retired`; catalog status only, not proof of runtime enablement |
| `replacementMaterialId` | string or null | yes | Optional forward reference when deprecated/retired; cannot reference itself or form a replacement cycle |
| `categoryCode` | string | yes | Closed, versioned classification code; initial code set remains unapproved |
| `rarityCode` | string or null | yes | Optional presentation/classification code; null until a rarity taxonomy is approved |
| `tags` | array of strings | yes | Sorted, unique canonical slugs; descriptive/filtering only and never authorization or rule inputs unless separately adopted |

The stable identifier is independent from display names, localization, rarity,
and artwork. Renaming a label must not change `materialId`. Changing a material
into a semantically different resource requires a new identifier.

### Display and localization

| Attribute | Type | Required | Constraints and meaning |
| --- | --- | --- | --- |
| `displayNameKey` | string | yes | Stable localization key; does not contain rendered prose |
| `descriptionKey` | string | yes | Stable localization key for accessible descriptive text |
| `fallbackDisplayName` | string | yes | Nonblank text in `contentLocale`; offline/editor fallback only |
| `fallbackDescription` | string | yes | Plain text in `contentLocale`; no executable markup |
| `iconRef` | string or null | yes | Repository-relative logical asset reference or null; no remote URL, data URI, traversal segment, or absolute path |
| `colorToken` | string or null | yes | Approved design-system token or null; raw color alone must not communicate rarity or state |
| `sortKey` | string | yes | Canonical stable ordering key; ties resolve by `materialId` |

All player-facing interfaces must remain understandable without icon, color,
hover, animation, or untranslated fallback content. The manifest must not embed
HTML, scripts, CSS, audio, or executable template expressions.

### Quantity and stacking semantics

| Attribute | Type | Required | Constraints and meaning |
| --- | --- | --- | --- |
| `quantityScale` | canonical positive decimal integer string | yes | Number of base units per displayed unit; use `1` for indivisible quantities |
| `displayPrecision` | integer | yes | Integer from `0` through `18`; must be compatible with `quantityScale` |
| `stackPolicy` | object | yes | Presentation/container limits; never the authoritative total account balance |
| `stackPolicy.mode` | enum string | yes | `unbounded_display`, `fixed_display_stack`, or `non_stackable`; gameplay meaning requires separate approval |
| `stackPolicy.maxDisplayUnits` | decimal integer string or null | yes | Required only for `fixed_display_stack`; positive and expressed in base units |

Stored quantities must use exact integers in base units. Binary floating-point
values, signed strings, exponent notation, grouping separators, and leading
zeroes are invalid. A UI stack limit cannot cause overflow quantities to be
discarded and does not authorize a database balance cap.

### Policy descriptors

| Attribute | Type | Required | Constraints and meaning |
| --- | --- | --- | --- |
| `bindingPolicy` | enum string | yes | Proposed values: `unresolved`, `account_bound`, or `transferable`; only `unresolved` is safe until transfer rules are adopted |
| `consumptionPolicy` | enum string | yes | `unresolved`, `consumable`, or `non_consumable`; recipe behavior remains separate |
| `visibilityPolicy` | enum string | yes | `visible`, `hidden_until_discovered`, or `internal`; discovery rules remain separate |
| `sourcePolicyRefs` | array of strings | yes | Sorted unique identifiers of separately versioned acquisition policies; may be empty |
| `sinkPolicyRefs` | array of strings | yes | Sorted unique identifiers of separately versioned consumption policies; may be empty |

These fields describe approved policy references; they do not implement trade,
drop, crafting, burn, salvage, or transfer behavior. Missing rules must use an
explicit unresolved state rather than permissive defaults.

### Provenance and audit metadata

| Attribute | Type | Required | Constraints and meaning |
| --- | --- | --- | --- |
| `designStatus` | enum string | yes | `illustrative`, `proposed`, or `adopted`; distinct from runtime lifecycle |
| `decisionRefs` | array of strings | yes | Sorted unique repository-relative document anchors supporting adopted semantics |
| `notes` | array of strings | yes | Non-authoritative editor notes; must not contain hidden rules |

Rules required by runtime behavior must never live only in `notes`, fallback
descriptions, tags, filenames, or icon metadata.

## Content digest

When publication integrity is later adopted, `contentDigest` contains:

| Attribute | Type | Required when non-null | Meaning |
| --- | --- | --- | --- |
| `algorithm` | enum string | yes | Initially proposed as `sha256` |
| `canonicalization` | string | yes | Versioned canonical serialization identifier; undefined until separately approved |
| `value` | string | yes | Lowercase hexadecimal digest of the canonical manifest excluding `contentDigest.value` |

Raw JSON text hashing is forbidden because whitespace, key order, and Unicode
normalization can differ without changing the data. The canonicalization
contract must define object-key order, array order, UTF-8 encoding, Unicode
normalization, number representation, null handling, and the digest-field
exclusion before a digest is authoritative.

## Cross-record validation invariants

A future strict validator must reject a manifest when:

- a required attribute is missing, unknown, incorrectly typed, or noncanonical;
- `materialId`, localization keys, or ordering identities collide;
- a replacement reference is missing, self-referential, or cyclic;
- a material marked `active` has `designStatus` other than `adopted`;
- a policy reference points to an unavailable or incompatible version;
- currency, equipment, player quantity, loot probability, or recipe data is
  embedded in a material definition;
- quantity scale and display precision cannot represent one another exactly;
- a fixed stack lacks a positive exact maximum, or another mode supplies one;
- an asset reference is absolute, remote, executable, or escapes its approved
  repository root; or
- digest metadata is present without a supported canonicalization contract.

Validation proves structural conformance only. It does not prove gameplay
balance, legal status, economic safety, accessible presentation, asset rights,
or runtime activation.

## Illustrative offline record

This example demonstrates attribute shape only. It does not adopt `iron_scrap`
as a material or approve any stack, rarity, source, sink, or inventory value.

```json
{
  "schemaVersion": "materials-manifest-v1",
  "manifestId": "core_materials",
  "revision": "1",
  "status": "draft",
  "contentLocale": "en",
  "createdAt": "2026-10-04T00:00:00.000Z",
  "effectiveAt": null,
  "supersedesRevision": null,
  "materials": [
    {
      "materialId": "iron_scrap",
      "catalogVersion": "1",
      "lifecycleStatus": "draft",
      "replacementMaterialId": null,
      "categoryCode": "unapproved_salvage_example",
      "rarityCode": null,
      "tags": ["example"],
      "displayNameKey": "materials.iron_scrap.name",
      "descriptionKey": "materials.iron_scrap.description",
      "fallbackDisplayName": "Iron Scrap",
      "fallbackDescription": "Illustrative material entry.",
      "iconRef": null,
      "colorToken": null,
      "sortKey": "example.iron_scrap",
      "quantityScale": "1",
      "displayPrecision": 0,
      "stackPolicy": {
        "mode": "unbounded_display",
        "maxDisplayUnits": null
      },
      "bindingPolicy": "unresolved",
      "consumptionPolicy": "unresolved",
      "visibilityPolicy": "visible",
      "sourcePolicyRefs": [],
      "sinkPolicyRefs": [],
      "designStatus": "illustrative",
      "decisionRefs": [],
      "notes": ["Shape example only; not approved content."]
    }
  ],
  "contentDigest": null
}
```

## Known repository candidates, not manifest approval

The isolated idle-production calculator currently emits `wheat`, `wood`,
`stone`, `food`, and `cloth`, plus the non-material utility asset `$DONCELLA`.
Those calculator identifiers do not automatically establish catalog entries,
rarities, stack capacities, recipes, loot sources, transfer rules, or final
material semantics. Reconciliation requires an explicit content decision before
any candidate can be marked `adopted` or `active` in a future manifest.

## Implementation boundary

No manifest file, parser, validator, generator, database loader, inventory
service, Forge simulation, UI integration, or test is authorized by this
offline specification. Any future executable schema must be reviewed against
this document and versioned independently.

Additional illustrative combat-loot material IDs are cataloged for offline
review in `16_combat_loot_table_weights.md`; they are not approved entries.
