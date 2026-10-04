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

The supplied Express server and PL/pgSQL function have not been integrated or
executed. Separately, the isolated pure calculator and its direct unit tests
described below have been added; they do not expose routes or access a database.

## Review classification

The supplied Express application and Tower PL/pgSQL function remain proposals
only. Neither has been executed, installed as a migration, or added to the
runtime. The implemented scope is limited to the dependency-free idle-production
calculator and tests; it contains no submitted route or SQL code.

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

Kingdom Tower Level 3 requires at least 4,500 lifetime Character XP, the
authoritative account-level Tower progression counter. Only Training Grounds, Arena Stage Victories,
Bounty Board tasks, and completed Idle Expeditions/Adventures qualify.
Construction/building XP and community points are excluded. Listing completed
Adventures as an XP source does not decide when Adventures will be implemented.

The Level 3 equipment prerequisite is Tier I-or-higher gear equipped on the
main avatar in all six slots: Weapon, Armor, Helmet, Boots, Ring, and Amulet.
Inventory ownership without equipped status does not qualify. Character XP and
equipment are checked, not spent or consumed. An upgrade never deducts, burns,
reserves, or resets Character XP; the full lifetime total remains available for
future progression. Only specified `$DONCELLA` and material costs may be
consumed. Any failed prerequisite must leave the Tower level and every balance
unchanged. Thresholds for future Tower levels remain undefined.

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

### Confirmed reward identity policy

- Each confirmed participant has one designated primary progression account.
  It supplies the Kingdom Level multiplier and must complete Tower Level 3.
- Secondary accounts provide no additional Kingdom Level multiplier. The system
  must not automatically designate the highest-level account as primary.
- Eligible time-weighted mining-plot scores are aggregated exactly once across
  associated holdings under the established activity rules.
- The 5% weekly payout cap applies to the participant's combined allocation.
- Pet contributions remain deferred. Under the current confirmed rule, every
  undistributed allocation, including a cap-clipped amount, remains in the Game
  Vault and is not redistributed.
- Participant verification, unassociated-account eligibility, and primary-
  account switching remain unresolved. Device or IP similarity alone must not
  establish a confirmed association.

### Proposed wallet binding

This proposal is not implemented or confirmed:

- The authenticated Web2 account would be the primary game identity. Wallet
  linking would be optional and would not replace account authentication.
- One account could link multiple supported wallet identities after proof of
  control. Each supported wallet identity could link to only one account, with
  uniqueness enforced by persistent data constraints.
- Wallet uniqueness would prevent one wallet from being attached to multiple
  accounts, but would not prove that different accounts are controlled by
  different people.
- Wallet binding is not participant verification and cannot establish a
  confirmed association by itself.

### Reward eligibility and payout proposal review

The supplied PostgreSQL view and JavaScript payout snippet are implementation
proposals only. Neither has been executed, added to a migration, or integrated
into the runtime. No payout implementation exists in this repository.

The proposed `SUSPECT_UNASSOCIATED_POOL` is not adopted. Unassociated-account
eligibility remains unresolved, so unassociated accounts must not be forced
into a shared reward identity or cap group by implementation assumption.

A live aggregation view is not an authoritative weekly distribution record.
The next revision must consume a validated, immutable weekly snapshot that
captures at least the reward period, snapshot time, confirmed participant and
account associations, designated primary account, completed Tower level,
deduplicated eligible mining-plot scores, calculated weight, and the applicable
pool and cap inputs. Snapshot validation and payout persistence must make
retries idempotent and preserve an auditable explanation of every allocation
and retained amount.

The supplied JavaScript is incomplete: its `basePool` conditional is truncated,
and the validation and `totalWeight` construction needed by the later formula
are absent. No function was added or tested. A later proposal must provide one
complete CommonJS function using `$MARGEN` terminology plus direct tests for
invalid pool values, invalid or duplicate participant records, negative and
zero weights, zero total weight, integer rounding, the participant-level 5%
cap, retained Game Vault balance, large integers, and conservation of the base
pool. Clipped amounts must remain in the Game Vault unless a separate
redistribution rule is confirmed.

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

## Required safeguards before runtime integration

Runtime integration must not expose gameplay endpoints until all of these are
in place:

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
9. Before weekly rewards, approved participant-verification, unassociated-
   account eligibility, and primary-account designation/switching procedures.
   Wallet binding and device/IP similarity alone cannot establish association.

## Proposed schema requirements

Names below describe a possible isolated schema, not approved migrations.
Final foreign-key types must match the future authenticated account key.

### Account-owned gameplay state

- `kingdom_towers`: one row per account, with non-null `account_id`, Tower
  level, the authoritative lifetime Character XP value backed by auditable
  qualifying-source events, timestamps, and an optimistic version or
  equivalent concurrency field.
- `kingdom_buildings`: one row per owned building instance, with non-null
  `account_id`, constrained building type, constrained level, status,
  `last_settled_at TIMESTAMPTZ NOT NULL`, fractional-production carry, and
  timestamps. If only one building of each type is allowed, enforce that with
  a unique constraint rather than application code.
- `game_asset_balances`: one row per account and asset code, with a nonnegative
  exact balance and a unique `(account_id, asset_code)` key. `$DONCELLA` should
  use one canonical code; no separate `bronze` asset should exist.

If the wallet-binding proposal is approved, wallet links should reference the
authenticated account key, record wallet type/network and a canonical wallet
identity, store proof-of-control verification metadata, and enforce uniqueness
for each supported wallet identity. Wallet links remain optional. Mining-asset
attribution needs a separate uniqueness rule so the same asset cannot contribute
to more than one Portfolio path.

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

### Isolated calculator contract

The isolated calculator in `apps/api/src/gameplay/idleProduction.js` implements
only deterministic production arithmetic. It has no database, HTTP, account,
or community-runtime dependency.

- Time is represented as canonical UTC ISO timestamps with millisecond
  precision. Elapsed time is calculated as an exact integer number of
  milliseconds.
- Fractional production is a rational number with the fixed denominator
  `3,600,000`, the number of milliseconds in an hour. The persisted
  `carryNumerator` is a nonnegative decimal string smaller than that
  denominator. Its unit is "asset-unit milliseconds." For example, 500 ms at
  45 units/hour adds exactly `22,500` to the numerator.
- Whole credited units and carry numerators are returned as decimal strings so
  the result survives JSON serialization without floating-point conversion.
- New accrual is limited to 8 hours for a Level 1 building and 12 hours for a
  Level 2 building. Time beyond the limit is reported as discarded and the
  settlement timestamp still advances to the requested settlement time.
- Previously carried production is never discarded by the storage-time cap.
  It is added to the capped new accrual before whole units are paid, and any
  remainder is carried forward.
- Repeated settlements over the same uncapped active duration produce the same
  total whole units and final carry as one settlement over that duration.
- The calculator recognizes `doncella_bank` and returns the `$DONCELLA` asset;
  it does not introduce a separate Bronze currency.

The fixed denominator is an implementation choice for this millisecond-based
prototype, not approval of the submitted rates, building types, or game rules.

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

`Math.floor(elapsedSeconds * hourlyRate / 3600)` in the submitted route
discards every fractional remainder while still advancing `last_collected_at`.
The isolated calculator replaces that behavior with the exact rational carry
described above. Future persistence must store the numerator as an exact
integer and must not round it through JavaScript `Number` or a floating-point
database column.

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

Building upgrades and any active, fueled, paused, disabled, or similar activity
change must first settle through one authoritative timestamp under the old
rate and old activity state. Only then may the transaction change the rate or
state. This prevents a new rate or state from being applied retroactively.

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
  equipped row. It does not validate the confirmed Tier I minimum, an
  authenticated main-avatar association, ownership constraints, or uniqueness
  enforced by schema. Inventory-only items must not satisfy the query.
- `total_xp` is treated as authoritative global account XP, but the confirmed
  counter is lifetime Character XP from the four qualifying source groups. The proposal
  does not prove or audit those sources and must exclude construction/building
  XP and community points.
- Tower level and all balances are stored together in `player_assets`, with no
  supplied nonnegative checks, foreign keys, uniqueness constraint, or exact
  account-key definition. The update does not verify that exactly one row was
  changed.
- Costs are deducted without immutable ledger entries, an upgrade event, a
  rule/version snapshot, or a caller-supplied idempotency key. A successful
  retry is therefore reported as a max-level failure rather than the result of
  the original request.
- Although the submitted function returns before its balance update when its
  explicit checks fail, the final implementation must guarantee that every
  failed prerequisite or validation error leaves Tower level and all balances
  unchanged. Character XP must never be deducted, burned, reserved, or reset,
  and equipment must never be consumed. Only specified `$DONCELLA` and material
  costs may be debited after every prerequisite succeeds.
- The `bronze` balance conflicts with the confirmed `$DONCELLA` terminology.
  A canonical asset code must be selected without creating a second balance;
  Bronze mining land remains a separate concept.
- Free-form `TEXT` messages beginning with `FAILED` are being used as an API
  contract. Stable result codes or typed errors are needed instead.
- The Level 3 success string says the weekly reward pool is "unlocked." The
  approved meaning is eligibility after completed Level 3, subject to the
  available allocation and participant-level combined cap; it is not a
  guaranteed payout.
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

These transactional requirements do not select an implementation location.
The same confirmed rules and failure guarantees apply whether a later decision
uses a PostgreSQL function or an application service.

## Remaining integration requirements

The pure calculator is not authorization to add a collection endpoint. Runtime
integration remains blocked on all of the following:

- **Authenticated identity:** derive the acting account from a verified
  session. Never trust a request-body or URL `playerId`.
- **Consistent locking:** collection, building upgrades, activity changes, and
  Tower progression must lock the account, business rows, balances, and other
  validated state in one documented, stable order. Business rows must be
  locked before their settlement timestamps or carry values are used.
- **Atomic balances:** settlement-state updates, exact balance credits, and
  immutable ledger entries must commit in the same transaction.
- **Missing asset rows:** define whether canonical balance rows are provisioned
  with an account or created by a constrained atomic upsert. A missing row must
  never allow a settlement timestamp to advance without its credit.
- **Retry handling:** accept an idempotency key, persist the outcome, safely
  return the original result for duplicate requests, and define bounded retry
  behavior for serialization failures or deadlocks.
- **Progression gates:** enforce the confirmed lifetime Character XP source and
  equipped Tier I gear rules. Separately approve the still-proposed building,
  exact resource cost, and Tower-level rules before enabling progression.

PostgreSQL integration must also define an exact integer column and constraint
for `carryNumerator`, preserve millisecond timestamps end to end, use one
database-derived settlement timestamp per transaction, and verify affected-row
counts. No `ALTER TABLE` statement from the proposal has been executed.

## Unresolved design choices

The supplied material does not decide the following. They must remain open:

- whether the proposed starting level of 1, maximum level of 3, and resource
  upgrade costs are approved game rules;
- how much Character XP each qualifying activity awards and how completion
  events are verified, deduplicated, corrected, and audited;
- when Idle Expeditions/Adventures will be implemented; their timing remains
  separate from their confirmed eligibility as a Character XP source;
- the Character XP thresholds and other gates for Tower levels after Level 3;
- how participant identity and account associations are verified;
- whether and how accounts not associated with a confirmed participant can
  qualify for weekly rewards;
- how a participant initially designates and later switches the primary
  progression account, including timing and anti-abuse constraints;
- supported wallet identity formats, networks, proof-of-control challenges,
  rotation/revocation/recovery behavior, and verification expiry;
- canonical mining-asset identity and conflict handling needed to prevent
  duplicate Portfolio attribution;
- idle-building ownership limits and whether duplicate building types are
  allowed;
- authoritative rates and storage caps beyond the two proposed levels;
- active, fueled, paused, disabled, and upgrading-state production rules;
- upgrade duration, cancellation, refund, and failure rules;
- whether `doncella_bank` is an approved building type and what gameplay action
  produces `$DONCELLA`;
- whether Armory Chests and Resource Chests are distinct systems, along with
  their prices, contents, limits, and access rules; and
- whether any idle-produced resource may ever affect Portfolio. Current design
  defines Portfolio through active, fueled mining plots, so no connection may
  be assumed.

## Isolated prototype files

The only implemented gameplay files are the pure calculator and its direct
unit tests:

```text
apps/api/src/gameplay/idleProduction.js
apps/api/test/gameplay/idleProduction.test.js
```

No route, migration, model, job, or balance integration has been added. Once
the account key and open rules are resolved, a possible repository-aligned
layout for later work is:

```text
apps/api/migrations/003_create_gameplay_core_tables.js
apps/api/migrations/004_create_gameplay_rule_tables.js
apps/api/migrations/005_create_gameplay_ledgers.js
apps/api/migrations/006_create_gameplay_upgrade_function.js
apps/api/src/gameplay/towerUpgrades.js
apps/api/src/models/KingdomBuilding.js
apps/api/src/models/KingdomTower.js
apps/api/src/models/GameAssetLedger.js
apps/api/src/routes/gameplay.js
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

## Required verification before enabling runtime integration

The isolated calculator suite covers its exported arithmetic contract. The
following broader service, database, concurrency, and regression verification
remains required before any runtime integration is enabled:

- The existing direct unit tests cover fractional carry, exact payout
  boundaries, caps, invalid rules, timestamp boundaries, and serialization.
  Add service-level tests for duplicate building types and summary aggregation
  when those integration components exist.
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
