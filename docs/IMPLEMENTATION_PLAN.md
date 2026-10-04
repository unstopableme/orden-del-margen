# Isolated gameplay prototype implementation plan

## Proposal receipt status

Both requested code proposals have now been received and reviewed: the unified
Express API with idle collection and Tower route handlers, and the PL/pgSQL
definition of `trigger_tower_levelup(p_player_id INT)`.

- **Idle production:** received. The supplied collection route and calculation
  loop are complete enough to review against the repository, although they are
  not safe or repository-ready for the reasons documented below.
- **Kingdom Tower level-up:** received. The supplied function covers proposed
  Level 1-to-2 and Level 2-to-3 checks and deductions. Its referenced tables,
  constraints, account model, and migration definitions were not supplied and
  do not exist in this repository, so receipt does not make it repository-ready.

No gameplay code has been added or executed as part of this review.

## Review classification

The supplied Tower level-up and idle-production code is an implementation
proposal only. It has not been executed or added to the runtime. The review now
covers the Express application and the separately supplied PL/pgSQL function.

### Confirmed design requirements

The following boundaries come from `VISION.md`, `ECONOMY.md`, `ROADMAP.md`,
and `DECISIONS.md`. "Confirmed" means project direction, not current runtime
behavior, legal approval, or a guaranteed economic outcome.

The prototype must remain isolated from the current community MVP:

- keep the existing in-memory community demo and its routes unchanged;
- add no payments, custody, token transfers, or legal ownership behavior;
- keep community points and levels separate from gameplay XP and Kingdom Tower
  levels;
- treat `$DONCELLA` as the currency name in APIs and storage; “Bronze” is a
  legacy currency alias only;
- preserve Bronze plot as a distinct mining-land tier;
- do not connect idle production to Portfolio or weekly `$MARGEN` rewards until
  the time-weighted mining rules and reward integration are separately
  specified.

Kingdom Tower Level 3 completion unlocks eligibility for weekly `$MARGEN`
distributions and access to `$DONCELLA` Armory Chests. Eligibility is not a
guaranteed payout or an entitlement to company revenue; distributions remain
subject to qualified reward weight, the available weekly pool, and the 5% cap.
Portfolio is the time-weighted ring score of active, fueled mining plots. No
confirmed design connects the submitted idle-building yields to Portfolio.

### Choices made by the supplied proposals

These are implementation and game-rule choices in the submitted code, not
confirmed project requirements:

- A standalone Express server accepts a client-supplied integer `playerId`,
  uses a hard-coded local `pg` pool, and exposes collection and Tower level-up
  endpoints.
- Idle state uses `kingdom_businesses.last_collected_at` and a wide
  `player_assets` row. Six building types map to wheat, wood, stone, food,
  cloth, and a proposed `bronze` balance.
- Hourly production rates cover building Levels 1 and 2. Storage caps are
  proposed as 8 hours at Level 1 and 12 hours at Level 2.
- Collection uses application time, floors each building's yield, advances its
  timestamp, and returns a summary keyed by building type.
- The Tower function stores Tower level and `total_xp` in `player_assets` and
  supports proposed transitions from Level 1 to 2 and Level 2 to 3.
- The Level 2 proposal counts five buildings at Level 1 or higher and charges
  200 `bronze` plus 50 each of wood, stone, and wheat.
- The Level 3 proposal counts five buildings at Level 2 or higher, checks 4,500
  `total_xp`, requires equipped rows in six named slots, and charges 1,500
  `bronze`, 300 each of wood, stone, and wheat, 150 each of food and cloth,
  and 5 embers.
- The SQL returns free-form success or failure text, and the Express route
  interprets strings beginning with `FAILED` as client errors.

### Review safeguards and implementation recommendations

The security, accounting, schema, locking, migration, feature-flag, and test
measures below are reviewer recommendations required before this proposal
could be enabled safely. They do not approve the proposal's game values or
mechanics.

In particular, keep all prototype routes and jobs disabled by default behind a
dedicated feature flag until the prerequisites and verification in this plan
are complete.

## Repository fit review

The proposal cannot be integrated directly with the current repository.

- The repository obtains PostgreSQL configuration from `DATABASE_URL` and runs
  JavaScript migrations at startup. The proposal instead creates a second
  Express server and hard-codes local PostgreSQL credentials, database name,
  and port.
- No `players`, `player_assets`, or `kingdom_businesses` table exists. No
  `trigger_tower_levelup` function exists in the migrations.
- `community_members` is a community profile table, not a trustworthy
  authenticated account model. Community demo identifiers are in-memory
  strings, while the migration uses integer keys.
- Authentication remains a documented follow-up. The proposed routes trust a
  client-supplied `playerId`, so either route could act on another player's
  state.
- The repository has no CSRF middleware, request rate limiting, gameplay test
  harness, or persistent community identity from which to derive an account
  key.
- The proposal calls the currency column `bronze`. New schema and code must use
  `$DONCELLA` conceptually and a neutral SQL identifier such as
  `doncella_amount`; `bronze` must not become a second balance.
- The proposal is standalone application code and would bypass the existing
  `src/app.js`, database pool, migration runner, startup modes, and error
  boundaries.

## Required safeguards before implementation

Implementation should not expose gameplay endpoints until all of these are in
place:

1. A persistent, authenticated Web2 account model with a stable primary key.
   Decide whether and how community profiles attach to that account. Do not
   create a parallel `players` identity solely for these routes.
2. Server middleware that derives `account_id` exclusively from the verified
   session. Request bodies and URL parameters must not select the acting
   account.
3. Authorization, CSRF protection for session-authenticated writes, rate
   limits, request-size limits, and consistent API error handling.
4. A gameplay feature flag that defaults to disabled and does not change
   community demo startup with or without `DATABASE_URL`.
5. A test setup that can run route/service tests and PostgreSQL integration
   tests against disposable data.
6. Approved definitions and migrations for every table, key, constraint,
   counter, and equipment rule referenced by the Tower function.
7. Confirmed game rules for building types, levels, production rates, storage
   caps, upgrade costs, and the handling of disabled or unknown buildings.
8. A server-authoritative time policy using PostgreSQL `TIMESTAMPTZ` values and
   a controllable clock for tests.

## Proposed schema requirements

Names below describe a possible isolated schema, not approved migrations.
Final foreign-key types must match the future authenticated account key.

### Account-owned gameplay state

- `kingdom_towers`: one row per account, with non-null `account_id`, Tower
  level, explicit gameplay-XP fields once selected, timestamps, and an
  optimistic version or equivalent concurrency field.
- `kingdom_buildings`: one row per owned building instance, with non-null
  `account_id`, constrained building type, constrained level, status,
  `last_settled_at TIMESTAMPTZ NOT NULL`, fractional-production carry, and
  timestamps. If only one building of each type is allowed, enforce that with
  a unique constraint rather than application code.
- `game_asset_balances`: one row per account and asset code, with a nonnegative
  exact balance and a unique `(account_id, asset_code)` key. `$DONCELLA` should
  use one canonical code; no separate `bronze` asset should exist.

A normalized balance table is preferable to a wide `player_assets` row because
it avoids dynamically interpolating column names and supports constraints and
ledger reconciliation consistently. If a wide table is retained, it must have
exactly one row per account, non-null nonnegative columns, and checked update
counts.

### Configuration and accounting

- `building_level_rules`: versioned building type/level configuration for
  hourly rate, storage duration, upgrade requirements, and activation status.
  Rates and caps should not live only in JavaScript matrices.
- `game_asset_ledger`: immutable credits and debits with account, asset code,
  exact amount, reason, source identifier, idempotency key, and timestamp.
  Balance changes and ledger entries must commit together.
- `building_upgrade_events`: immutable record of the old and new level, rule
  version, settled production, charged costs, qualifying XP snapshot,
  equipment snapshot or references, request/idempotency key, and timestamp.
- `production_settlements`: optional but recommended audit record per building
  and collection interval, including elapsed capped time, rate/rule version,
  whole credited amount, and carried fraction.

All quantities require explicit `CHECK` constraints, foreign keys, unique
constraints, and indexes for account-owned lookups. Use `NUMERIC` or scaled
integers for economic quantities; do not use binary floating point for stored
balances or rates.

## Idle-production proposal findings

The supplied collection loop is not safe as written.

### Concurrency

Two collection requests can select the same `last_collected_at`, calculate the
same interval, and both credit it. The transaction alone does not prevent this
because the initial `SELECT` does not lock rows.

The collection transaction should:

1. derive `account_id` from authentication;
2. select owned building rows in stable ID order with `FOR UPDATE`;
3. use one database-derived settlement timestamp for the transaction;
4. lock or atomically upsert the affected balance rows in a stable asset order;
5. calculate and record ledger credits;
6. update each building's settlement timestamp and fractional carry; and
7. commit balances, ledger entries, and building state together.

Concurrent retries need a unique idempotency key. Row locking must use the same
order in collection and upgrade flows to reduce deadlocks. The implementation
must check affected-row counts and treat missing ownership or balance rows as
errors rather than silently succeeding.

### Fractional production

`Math.floor(elapsedSeconds * hourlyRate / 3600)` discards every fractional
remainder while still advancing `last_collected_at`. Frequent collection would
therefore lose more production than infrequent collection.

Choose and document one exact approach before implementation:

- store a fixed-point remainder per building and carry it into the next
  settlement; or
- store production in an indivisible subunit and convert to display units at
  the boundary.

In either case, perform the calculation with integer or PostgreSQL `NUMERIC`
arithmetic, define the scale and rounding rule, and test intervals that do not
produce a whole unit. The final storage-cap boundary must also specify whether
fractional carry survives time discarded beyond the cap.

### Other collection issues

- Unknown building types or levels currently fall back to zero production or
  an eight-hour cap and still advance the timestamp. Reject invalid persisted
  state instead.
- `productionSummary[biz.building_type] = generatedAmount` overwrites earlier
  values when an account owns multiple buildings of the same type. Aggregate
  by asset and, if useful, include per-building detail.
- An absent `player_assets` row produces a zero-row update but the collection
  can still commit. Require or atomically create the canonical balance row.
- Application-server time can differ across instances and from PostgreSQL.
  Use a database timestamp and define behavior for future or corrupted
  `last_settled_at` values.
- Define whether inactive, unfueled, paused, upgrading, or disabled buildings
  accrue production. The supplied query treats every row as active despite its
  comment.
- Avoid dynamic SQL identifiers derived from data. Use normalized asset rows
  or a closed server-side mapping backed by database constraints.

## Recommended building-upgrade accounting

A building upgrade changes the production rate and possibly the storage cap.
The upgrade must not retroactively apply the new rate to time accrued under the
old level.

Within one transaction, lock the account, building, required balances, and any
equipment records in a documented order. Settle production through one
database timestamp using the old rule version, preserve the fractional carry,
validate requirements, debit exact costs with ledger entries, change the
building level, record an upgrade event, and commit. A concurrent collection
must wait and then observe the new `last_settled_at` and level.

The accounting design must also decide:

- whether upgrades are immediate or have build timers;
- whether production continues during an upgrade;
- whether the storage cap changes at request time or completion time;
- whether an upgrade consumes equipment, merely requires ownership, or locks
  it;
- which costs are refundable after cancellation or failure;
- whether `$DONCELLA` is a cost, and the exact cost per level;
- whether rates are read from the current rule or the rule captured when an
  upgrade starts; and
- how administrator corrections are represented without rewriting history.

## Tower proposal findings and safeguards

The supplied PL/pgSQL function must not be installed manually in pgAdmin. Any
approved version should be represented by a repository migration and invoked
only through an authenticated service transaction.

The submitted function is not safe to integrate unchanged:

- It locks only the `player_assets` row. The qualifying
  `kingdom_businesses` and `player_equipment` rows are read without locks, so
  their state can change during an upgrade.
- Each building prerequisite counts arbitrary qualifying rows rather than five
  distinct required building types. Duplicate buildings could satisfy the
  count while a required type is absent. The idle proposal also defines six
  production types, while the Tower message refers to five baseline types.
- The Level 3 equipment check proves only that the six named slots have an
  equipped row. It does not validate an equipment tier, ownership constraints,
  uniqueness enforced by schema, or whether equipment is consumed or retained.
- `total_xp` is treated as authoritative global account XP, but this repository
  has no authenticated account model or approved gameplay-XP definition. It
  must not be populated from community points or knowledge scores by default.
- Tower level and all balances are stored together in `player_assets`, with no
  supplied nonnegative checks, foreign keys, uniqueness constraint, or exact
  account-key definition. The update does not verify that exactly one row was
  changed.
- Costs are deducted without immutable ledger entries, an upgrade event, a
  rule/version snapshot, or a caller-supplied idempotency key. A successful
  retry is therefore reported as a max-level failure rather than the result of
  the original request.
- The `bronze` balance conflicts with the confirmed `$DONCELLA` terminology.
  A canonical asset code must be selected without creating a second balance;
  Bronze mining land remains a separate concept.
- Free-form `TEXT` messages beginning with `FAILED` are being used as an API
  contract. Stable result codes or typed errors are needed instead.
- The Level 3 success string says the weekly reward pool is "unlocked." The
  approved meaning is eligibility after completed Level 3, subject to the
  available allocation and per-player cap; it is not a guaranteed payout.
- The function assumes the caller already owns the surrounding transaction.
  PostgreSQL functions execute within the caller's transaction, but that alone
  does not fix the incomplete lock set, missing audit records, or retry safety.

Completing Kingdom Tower Level 3—not merely starting or attempting the
upgrade—unlocks eligibility for weekly `$MARGEN` distributions and access to
`$DONCELLA` Armory Chests. It does not guarantee a payout or create an
entitlement to company revenue. The prototype should record the completed
Tower level but must not implement weekly `$MARGEN` distribution accounting as
part of idle production.

The level-up operation needs deterministic status/error codes rather than
parsing strings beginning with `FAILED`. It must lock the Tower row and every
balance/equipment row it validates, use an idempotency key, verify the expected
current level, debit costs and write ledger entries atomically, then record the
new level and audit event.

## Unresolved design choices

The supplied material does not decide the following. They must remain open:

- whether Level 3 requires a minimum equipment tier in addition to filling the
  six proposed slots;
- which XP counter qualifies a Tower upgrade: lifetime gameplay XP, spendable
  XP, season XP, Tower-specific XP, or the proposed `total_xp` counter;
- whether qualifying XP is consumed, reserved, or checked only;
- XP sources and whether current community points or knowledge scores are
  explicitly excluded (they should not be equated by implementation);
- whether the proposed starting level of 1, maximum level of 3, resource
  costs, and 4,500-XP Level 3 threshold are approved game rules;
- whether equipment requirements mean ownership, equipped state, locking, or
  consumption;
- idle-building ownership limits and whether duplicate building types are
  allowed;
- authoritative rates and storage caps beyond the two proposed levels;
- the fixed-point scale and rounding/carry policy for fractional production;
- behavior of fractional carry at storage cap and after building upgrades;
- active, fueled, paused, disabled, and upgrading-state production rules;
- upgrade duration, cancellation, refund, and failure rules;
- whether `bronze_bank` should be renamed and what gameplay action produces
  `$DONCELLA`;
- whether Armory Chests and Resource Chests are distinct systems, along with
  their prices, contents, limits, and access rules; and
- whether any idle-produced resource may ever affect Portfolio. Current design
  defines Portfolio through active, fueled mining plots, so no connection may
  be assumed.

## Proposed isolated prototype files

No files below should be created until the account key and open rules are
resolved. A likely repository-aligned layout is:

```text
apps/api/migrations/003_create_gameplay_core_tables.js
apps/api/migrations/004_create_gameplay_rule_tables.js
apps/api/migrations/005_create_gameplay_ledgers.js
apps/api/migrations/006_create_gameplay_upgrade_function.js
apps/api/src/gameplay/production.js
apps/api/src/gameplay/towerUpgrades.js
apps/api/src/models/KingdomBuilding.js
apps/api/src/models/KingdomTower.js
apps/api/src/models/GameAssetLedger.js
apps/api/src/routes/gameplay.js
apps/api/test/gameplay/production.test.js
apps/api/test/gameplay/production.postgres.test.js
apps/api/test/gameplay/towerUpgrades.postgres.test.js
```

If authenticated accounts require a new migration, that shared-foundation
migration must precede `003` and be designed outside the gameplay prototype.
The gameplay migrations must reference that existing account key; they must
not introduce a duplicate player identity.

## Proposed migration sequence

1. Establish the authenticated account table and session-to-account mapping in
   the shared foundation. Keep gameplay disabled.
2. Create Tower, building, and canonical asset-balance tables with foreign
   keys, constraints, and uniqueness rules.
3. Create versioned building/Tower rule tables and seed only approved rules.
   Do not treat the proposal's matrices as confirmed data.
4. Create immutable asset, production, and upgrade ledgers with idempotency
   constraints.
5. Add the reviewed Tower upgrade function only if keeping the logic in
   PostgreSQL is an explicit architecture decision. Otherwise implement a
   transaction-owning service and omit the function migration.
6. Add indexes after validating actual query shapes and lock order.
7. Add the isolated service and PostgreSQL integration tests.
8. Mount authenticated gameplay routes only when PostgreSQL and the gameplay
   feature flag are both enabled. Do not mount them in community demo mode.
9. Add UI in a later change, hidden while disabled and clearly separated from
   community points and weekly rewards.

Each migration should be reversible where data safety permits and run through
the existing migration runner, never as an untracked pgAdmin operation.

## Required verification before enabling the prototype

- Unit tests for fractional carry, rounding, caps, duplicate building types,
  unknown rules, clock boundaries, and summary aggregation.
- PostgreSQL tests proving that simultaneous collections cannot double-credit
  an interval and collection racing an upgrade applies each rate to the correct
  time segment.
- Tests for insufficient balances, missing balance rows, duplicate retries,
  deadlock retry handling, rollback after partial failure, and exact ledger to
  balance reconciliation.
- Tower tests for every approved XP/equipment/cost rule, concurrent upgrades,
  stale expected levels, and Level 3 eligibility only after commit.
- Route tests proving unauthenticated requests fail, request-body account IDs
  are ignored or rejected, cross-account access fails, and the feature flag
  leaves all gameplay routes unavailable by default.
- Regression checks confirming the community demo starts without PostgreSQL
  and its existing routes and non-monetary semantics are unchanged.
