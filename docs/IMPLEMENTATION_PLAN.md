# Isolated gameplay prototype implementation plan

## Current status (October 11, 2026)

The owner reports a successful manual rerun of
`npm --prefix apps/api run test:gameplay:integration` against the dedicated
disposable database `orden_margen_gameplay_test`, after correcting the
account-state balance expectation to include all five materials. The harness
contains one top-level PostgreSQL test; the command output was not captured or
independently verified in this session. This run covers the updated
persistence/service assertions, including the complete balance result and
cross-account isolation. It does not validate HTTP routes, gameplay-route
authentication, rate limiting, or feature-flag behavior.

Gameplay routes remain unmounted by default. They are locally implemented
behind `GAMEPLAY_API_ENABLED=false`; the community demo and its existing routes
remain independent of PostgreSQL and the gameplay feature flag.

## Initial gameplay milestone: collection planning

Implemented `apps/api/src/gameplay/idleCollection.js` as a pure batch settlement
planner, with direct unit tests. It validates building ownership, unique IDs,
and supported activity; aggregates credits by asset; preserves fractional
carry; and returns deterministic building updates and per-building ledger
entries without mutating input. The planner itself remains a pure helper and
does not authenticate callers, lock rows, persist credits, or provide request
idempotency. Its account key must come from a trusted server-side caller
context, never directly from a request body.

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
executed. Separately, repository-owned idle calculator, collection planner,
versioned prototype rules, transaction-owning PostgreSQL persistence service,
and authenticated HTTP routes have been implemented. The HTTP routes are
mounted only when PostgreSQL and the explicit feature flag are enabled; the
flag defaults to disabled. Route-contract tests pass with injected
authentication, while live PostgreSQL route-query assertions and enabled
server startup remain unverified. Gameplay UI remains deferred.

## Review classification

The supplied Express application and Tower PL/pgSQL function remain proposals
only. Neither has been executed, installed as a migration, or added to the
runtime. The repository-owned idle implementation is separate from that
proposal and includes the approved prototype migrations, persistence service,
route handlers, and tests. Gameplay routes remain disabled by default.

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
- Unassociated accounts may play and progress but receive no weekly rewards,
  fallback-pool allocation, or retroactive allocation. Each confirmed
  participant explicitly designates one primary account. Accounts retain their
  own XP and Tower progression, and a newly designated primary must independently
  complete Tower Level 3. An approved switch activates at the next weekly
  boundary and is limited to once per four weekly periods, except for separately
  authorized and audited recovery exceptions. Verification evidence, the switch
  approval procedure, and recovery-exception criteria remain proposed and
  require explicit approval. Weekly periods run from Sunday 00:00 UTC inclusive
  to the following Sunday 00:00 UTC exclusive. Identity-provider selection,
  assurance profiles, and restricted-evidence retention also remain unresolved.
  Device or IP similarity alone must not establish a confirmed association.

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

The supplied PostgreSQL view and original JavaScript payout snippet remain
proposal material and were not executed or added to a migration. A separate
pure CommonJS calculator now implements only integer allocation, the 5% cap,
and retained Game Vault accounting. Snapshot persistence, payout storage,
scheduled execution, and an API remain unimplemented.

The proposed `SUSPECT_UNASSOCIATED_POOL` is not adopted. Unassociated accounts
may play and progress but receive no weekly rewards, fallback-pool allocation,
or retroactive allocation. They must not be forced into a shared reward identity
or cap group.

A live aggregation view is not an authoritative weekly distribution record.
The next revision must consume a validated, immutable weekly snapshot that
captures at least the reward period, snapshot time, confirmed participant and
account associations, designated primary account, completed Tower level,
deduplicated eligible mining-plot scores, calculated weight, and the applicable
pool and cap inputs. Snapshot validation and payout persistence must make
retries idempotent and preserve an auditable explanation of every allocation
and retained amount.

The adopted payout persistence identity is `(snapshot_id, participant_id)`,
not `(snapshot_id, account_id)`: the participant receives the combined capped
allocation, while the designated primary account is immutable snapshot
evidence. A deterministic allocation key must use the canonical length-prefixed
encoding in `IDEMPOTENCY_AND_UNIQUENESS.md`, and a separate request fingerprint
must detect conflicting payload reuse. This remains design-only; no payout
schema, migration, service, or job is authorized here.

Before weight conversion, the future snapshot producer must apply the adopted
`TOWER_LEVEL_3_ELIGIBILITY_CHECKER.md` contract to state effective at the
exclusive weekly period end. It must exclude unassociated participants,
participants without exactly one designated primary account, and participants
whose designated primary account has not completed Tower Level 3. Contradictory
source state must fail snapshot generation rather than being recorded as a
zero-weight eligible participant.

The original supplied JavaScript was incomplete: its `basePool` conditional was
truncated, and validation and `totalWeight` construction were absent. The new
pure calculator replaces that snippet and has direct tests for invalid pool
values, invalid or duplicate participant records, negative and zero weights,
zero total weight, integer rounding, the participant-level 5% cap, retained
Game Vault balance, large integers, and conservation of the base pool. Clipped
amounts remain in the Game Vault unless a separate redistribution rule is
confirmed.

The pure allocator consumes canonical integer weights only. The adopted
`reward-weight-v1` contract specifies exact rational formula inputs, a `10^12`
scale, floor rounding, complete-operation interval bounds, exact-boundary proofs,
and explicit input/resource limits. Converter implementation, Portfolio rational
construction, nonzero conformance vectors, and snapshot integration remain
pending; platform `Math.pow` and `Math.log` results are not authoritative
weights.

### Participant-review service requirements

The later application service must enforce all of the following regardless of
the eventual participant-verification method:

- Only authorized reviewers may approve or overturn cases. A player may submit
  an appeal only for a case involving that player's own account.
- A decision transaction must lock the case row, validate its current state,
  update the case status, and insert the corresponding history event atomically.
- Approval requires reviewed evidence and a nonempty reason. Device or IP
  similarity may be evidence but cannot establish an association by itself.
- An appeal is a request for reconsideration. It must reference and preserve the
  original decision rather than rewriting it.
- Creating a confirmed participant association is a separate, authorized,
  audited operation; approving a case must not create one implicitly.
- The application database role may insert case-history events but must have no
  permission to update or delete them. Corrections use additive events.

The persistence design therefore needs explicit case states, ownership links,
reviewer authorization, evidence references, decision and appeal records,
append-only history, association audit events, idempotency keys, and tests for
concurrent decisions and cross-account appeal attempts. Database grants must be
verified in integration tests; application checks alone are insufficient.

#### Resolve-appeal endpoint contract

The adopted validation and separation contract is consolidated in
`ADMIN_APPEAL_VALIDATION_WORKFLOW.md`. It preserves the existing route
vocabulary and permits cases involving unassociated accounts; `participant_id`
is case context only when a confirmed association already exists.

```http
POST /api/admin/review-cases/:caseId/resolve-appeal
Idempotency-Key: <unique request key>
```

Example request body:

```json
{
  "expectedVersion": 3,
  "outcome": "overturned",
  "reasonCode": "INDEPENDENT_ACCOUNT_CONTROLLERS",
  "decisionNote": "Reviewed evidence supports independent users.",
  "evidenceIds": ["123", "124"]
}
```

This authorized-reviewer endpoint resolves a pending appeal against the
identified review case. It does not resolve reward eligibility directly.

- `Idempotency-Key` is required. The service must persist the key, request
  fingerprint, and result in the same transaction as the resolution. Repeating
  the same request returns the recorded result; reusing the key with different
  input fails without mutation.
- The service must verify reviewer authority, lock the case row, confirm that
  the appeal belongs to that case and is pending, validate reviewed evidence
  and a nonempty reason, update the appeal/case state, and append history in one
  transaction.
- `expectedVersion` must be a positive integer matching the locked case version.
  A stale value fails with a conflict and makes no changes. A successful
  resolution increments the case version exactly once.
- `outcome` must be either `approved` when reconsideration upholds the original
  decision or `overturned` when the appeal succeeds. `reasonCode` must be a
  supported closed code; for
  `INDEPENDENT_ACCOUNT_CONTROLLERS`, the reviewed evidence must support the
  conclusion that the accounts have independent controllers.
- `decisionNote` is required, nonempty, length-limited, and stored with the
  decision event. `evidenceIds` must be a nonempty list of unique canonical
  identifiers for reviewed evidence attached and visible to the case.
- The original decision and its history remain unchanged. The new history event
  records whether reconsideration upheld or overturned the decision, the
  reviewer, reason, evidence references, idempotency key, and timestamp.
- The endpoint must not create, delete, or move participant associations; alter
  a designated primary account; assign an unassociated account to a reward
  group; or change a weekly snapshot or payout record.
- `SUSPECT_UNASSOCIATED_POOL` was not adopted. This endpoint must not create or
  emulate that shared pool, and appeal resolution must not move accounts between
  reward pools.

If an overturned appeal warrants a confirmed participant association, an
authorized reviewer must initiate the separate audited association operation
afterward. That operation has its own authorization, idempotency, locking, and
history requirements.

Inside `reviewService.resolveAppeal`, one database transaction must execute the
following sequence:

1. Revalidate the actor's current reviewer permission and reject a reviewer who
   is reviewing a case involving the reviewer's own account.
2. Check the persisted idempotency record for this operation, actor, case, and
   key. Return the original committed result for an identical fingerprint;
   reject the key if its stored fingerprint differs. The database uniqueness
   constraint and transaction must also serialize concurrent first uses of the
   same key.
3. Lock the case row with `SELECT ... FOR UPDATE`, require
   `status = 'appealed'`, and compare the locked version with
   `expectedVersion`.
4. Verify that every evidence reference belongs to the locked case, is visible
   to the reviewer, has been reviewed, and supports an outcome allowed by the
   approved review policy.
5. Set the resolved case status to `overturned` when the appeal succeeds or to
   `approved` when reconsideration upholds the original decision. The original
   decision record remains immutable in either path.
6. Increment the case version once, append the audit event, and persist the
   idempotent response atomically before commit.

Any failure rolls back the status, version, audit event, and new idempotency
record together. An overturned review does not grant reward eligibility or
automatically revoke an existing confirmed participant association. Association
corrections require a separate authorized and audited process. Unassociated
accounts remain excluded from weekly rewards, and this workflow introduces no
payout or snapshot endpoint.

#### Proposed Express handler review

The supplied `createResolveAppealHandler(reviewService)` and route registration
are review material only. They have not been added to `src/app.js`, executed, or
tested and are not a deployable endpoint.

The proposal correctly places authenticated identity in trusted middleware,
requires the `Idempotency-Key` header, applies bounded request validation,
delegates decisions to a service, uses server-side permission and CSRF
middleware, and forwards failures to a centralized error handler. Those route-
level checks do not implement the service safeguards described above.

The next revision must resolve these handler issues:

- Use only the confirmed service vocabulary: `approved` means the original
  decision was upheld after reconsideration, while `overturned` means the
  appeal succeeded. Responses and audit events must make that meaning explicit.
- Reject a missing, null, array, or otherwise non-object body as a typed 400
  response instead of allowing destructuring to reach the error handler.
- Require every `evidenceIds` element to be a string before applying the digit
  pattern. Regular expressions coerce numeric JSON values, and mixed values
  such as `"123"` and `123` can bypass the current duplicate check.
- Define canonicalization for the idempotency key, reason code, decision note,
  and evidence identifiers before calculating the request fingerprint. Reject
  blank or unsupported idempotency-key characters, not only excessive length.
- Define stable typed-error mappings, including unauthorized/forbidden,
  missing case or appeal, stale `expectedVersion`, idempotency-key payload
  mismatch, unavailable evidence, and invalid state transitions. Internal
  details must not be exposed.
- Confirm that authentication middleware always supplies a valid `accountId`
  and that `reviews.resolve_appeal` is granted only to authorized reviewers.
  Route middleware is defense in depth; the service must enforce authorization
  again at its trust boundary.

The service remains responsible for idempotency persistence, row locking,
optimistic-version enforcement, appeal/case state validation, evidence access
and reviewed status, atomic status/history writes, append-only history grants,
the self-review prohibition, and the prohibition on association, reward-group,
snapshot, or payout changes. No handler response may claim success until that
transaction commits.

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
- `community_members` remains a community profile table, separate from the
  canonical authenticated account model. Community demo identifiers are
  in-memory strings; the authenticated account uses a UUID key.
- Community authentication and persistent canonical accounts with Passport
  issuer/subject mappings are implemented. A revocable local
  session-to-account mapping and gameplay access remain unimplemented. The
  proposed routes trust a client-supplied `playerId`, so either route could act
  on another player's state.
- Community routes have rate limiting, but gameplay-specific CSRF protection,
  request rate limiting, gameplay service/database integration harnesses, and
  account-owned gameplay persistence remain missing for gameplay integration.
- The proposal calls the currency column `bronze`. New schema and code must use
  `$DONCELLA` conceptually and a neutral SQL identifier such as
  `doncella_amount`; `bronze` must not become a second balance.
- The proposal is standalone application code and would bypass the existing
  `src/app.js`, database pool, migration runner, startup modes, and error
  boundaries.

## Required safeguards before runtime integration

Runtime integration must not expose gameplay endpoints until all of these are
in place:

1. The shared identity foundation now provides canonical UUID accounts and
   verified Passport-to-community mappings; the owner reports the guarded
   PostgreSQL integration suite passed in an isolated disposable database.
   Keep gameplay account ownership tied to this key. A revocable local session
   is a separate authentication decision; do not create a parallel `players`
   identity.
2. Server middleware that derives `account_id` exclusively from the verified
   session. Request bodies and URL parameters must not select the acting
   account.
3. Authorization, CSRF protection for session-authenticated writes, rate
   limits, request-size limits, and consistent API error handling.
4. A gameplay feature flag that defaults to disabled and does not change
   community demo startup with or without `DATABASE_URL`.
5. The community PostgreSQL harness exists and has a user-reported passing run.
   Gameplay-specific route/service tests and PostgreSQL integration coverage
   remain to be designed and explicitly authorized.
6. Approved definitions and migrations for every table, key, constraint,
   counter, and equipment rule referenced by the Tower function.
7. Confirmed game rules for building types, levels, production rates, storage
   caps, upgrade costs, and the handling of disabled or unknown buildings.
8. A server-authoritative time policy using PostgreSQL `TIMESTAMPTZ` values and
   a controllable clock for tests.
9. Before weekly rewards, approve and implement verification evidence, reviewer
   authority, primary-account switch, and individual recovery-exception
   procedures. Implement the adopted Sunday-to-Sunday calendar contract. Wallet
   binding and device/IP similarity alone cannot establish association.

## Next milestone design proposal: account-owned gameplay persistence

**Prototype rules approved:** on October 11, 2026, the project owner approved
five material buildings, one per type/account, Level 1, their existing
prototype Level 1 rates, an eight-hour cap with discarded time reported, and
`active` state only with no fuel model. `$DONCELLA` production is excluded.
This approval is limited to the prototype; it does not approve production
economy values, Tower upgrades, weekly rewards, or route mounting. Preserve the
in-memory community demo and keep gameplay routes disabled.

Use the existing `authenticated_accounts.id UUID` as the only account key.
Migration `007_create_authenticated_accounts.js` already defines
`authenticated_accounts` and `authenticated_account_identities`; Passport
identity rows resolve to that account key. Community member profiles remain
separate, and caller-supplied account IDs are never authoritative.

### Candidate relational schema

The following signatures are design targets, not executed SQL. Names and
constraints may be refined when converted to migrations.

| Relation | Candidate columns and constraints | Status and purpose |
| --- | --- | --- |
| `authenticated_accounts` | Existing `id UUID PRIMARY KEY`, `created_at TIMESTAMPTZ`; provider mappings in `authenticated_account_identities(provider, issuer, subject, account_id)` with the existing composite identity key | **Implemented** in migration 007; use as the FK root, not a second player table |
| `kingdom_towers` | `account_id UUID PRIMARY KEY REFERENCES authenticated_accounts(id)`, `tower_level SMALLINT NOT NULL`, `lifetime_character_xp BIGINT NOT NULL DEFAULT 0`, `row_version BIGINT NOT NULL DEFAULT 1`, timestamps; checks for nonnegative XP and positive `row_version` | **Deferred** account-specific Tower snapshot; `row_version` is only an optimistic concurrency counter, distinct from a ruleset's `version_number`; XP is lifetime progress, not a spendable balance |
| `character_xp_events` | `id UUID PRIMARY KEY`, `account_id UUID NOT NULL`, `source_type`, `source_event_id`, positive `xp BIGINT`, `occurred_at TIMESTAMPTZ(3)`, creation/audit fields; unique `(account_id, source_type, source_event_id)` and FK to account | **Proposed later slice**; append-only source ledger for verified XP awards and replay prevention |
| `building_rule_sets` | `id UUID PRIMARY KEY`, logical `rule_set_key`, `version_number INTEGER`, SHA-256 `fingerprint CHAR(64)`, `is_active BOOLEAN`; unique `(rule_set_key, version_number)` and at most one active ruleset | **Implemented for the prototype** in migration 008; definition rows are immutable, runtime re-hashes key/version/rules and validates the caller's expected fingerprint |
| `building_level_rules` | FK to rule set; `(rule_set_id, building_type, level)` key; `asset_code`, integer `units_per_hour`, `storage_limit_ms`; positive rate and nonnegative capacity checks | **Implemented for the approved five Level 1 material rules**; prototype-only seed data, not production economy approval |
| `kingdom_buildings` | `id UUID PRIMARY KEY`, `account_id UUID NOT NULL`, explicit `rule_set_id UUID NOT NULL`, `building_type`, `level SMALLINT`, `asset_code`, `activity_state`, `last_settled_at TIMESTAMPTZ(3) NOT NULL`, `carry_numerator BIGINT NOT NULL DEFAULT 0`, timestamps; FK to account and `(rule_set_id, building_type, level, asset_code)`; unique `(account_id, building_type)`; `0 <= carry_numerator < 3600000` | **Implemented for the first increment**; account-scoped ownership, exactly one per approved type, and exact millisecond fractional carry |
| `game_asset_balances` | `account_id UUID NOT NULL`, `asset_code TEXT NOT NULL`, `amount BIGINT NOT NULL DEFAULT 0`, updated timestamp; primary/unique key `(account_id, asset_code)` and `amount >= 0` check | **Implemented first increment**; only material assets are credited; no `$DONCELLA` balance or production |
| `production_collection_requests` | UUID request ID, `account_id`, client idempotency key, explicit `rule_set_id`, exact `rules_fingerprint` FK to the selected immutable ruleset, database settlement timestamp, stored response/result, unique `(account_id, idempotency_key)` | **Implemented first increment**; validates the expected fingerprint and exact retries return the original committed result; reusing a key with another fingerprint conflicts |
| `production_settlements` | UUID ID, request/account/building FKs, explicit `rule_set_id`, interval start/end, active/discarded milliseconds, credited integer amount, carry before/after; unique `(request_id, building_id)` | **Implemented first increment**; immutable per-building settlement evidence |
| `game_asset_ledger` | UUID ID, account, asset code, direction (`credit`/`debit`) plus positive `amount`, reason, settlement FK and timestamp; unique source/direction/reason | **Implemented first increment**; append-only audit of every balance mutation; ledger and balance commit atomically |

For Tower Level 3, the confirmed gate is at least 4,500 lifetime Character XP
from Training Grounds, Arena Stage Victories, Bounty Board tasks, and completed
Idle Expeditions/Adventures, plus Tier I-or-higher gear equipped on the main
avatar in Weapon, Armor, Helmet, Boots, Ring, and Amulet slots. Construction
XP/community points do not qualify. XP and equipment are checks, never consumed.
The Tower tables above provide a place to persist this progress; they do not
authorize XP awards, Tower costs, lower-level gates, or upgrade operations.

### Prototype values, explicitly provisional

`idleProduction.js` currently encodes the following arithmetic inputs. The
project owner approved the five material-building Level 1 rates below **for
this prototype only**. The migration seeds only those five Level 1 rules in
the fingerprinted `idle-materials-prototype` ruleset, version 1. This is not approval
for a production economy:

| Prototype building | Output asset | Approved prototype Level 1 units/hour |
| --- | --- | ---: |
| `wheat_farm` | `wheat` | 60 |
| `lumber_mill` | `wood` | 45 |
| `quarry` | `stone` | 30 |
| `provisioner` | `food` | 15 |
| `textile_mill` | `cloth` | 15 |

The existing calculator also contains unapproved Level 2 rates of 132 wheat,
100 wood, 66 stone, 33 food, 33 cloth, and 25 `$DONCELLA` per hour, plus
`doncella_bank` Level 1 at 10 per hour. **None of those Level 2 or
`doncella_bank` rules are seeded or enabled.** For the approved prototype,
all five Level 1 rules use an eight-hour (28,800,000 millisecond) production
cap; excess time is discarded and reported. Fractional output uses denominator
`3,600,000` (milliseconds per hour). There is no fuel model; only `active`
buildings are supported. These settings remain prototype-only.

### Pending decisions and recommendations

| Decision | Existing prototype value | Recommendation |
| --- | --- | --- |
| First-increment buildings and level | Approved for prototype: five material types, Level 1, one of each per account | Seed exactly these five types and enforce `UNIQUE (account_id, building_type)`; keep all other types/levels unavailable |
| Level 1 rates, storage cap, and overflow | Approved for prototype: rates above, 8-hour cap, discard elapsed excess and report it | Store in immutable, fingerprinted ruleset; do not promote to production economy without separate approval |
| Activity, fuel, and `$DONCELLA` | Approved for prototype: `active` only, no fuel, no `$DONCELLA` production | Reject unsupported states; omit `doncella_bank` from the seeded ruleset and balances |
| Rule changes and stale clients | Prototype ruleset has an explicit version and SHA-256 fingerprint | Validate the submitted fingerprint against immutable rule rows; bind requests, buildings, and settlements to the explicit ruleset ID; conflict on request/fingerprint mismatch |
| Collection atomicity and retries | Prototype planner only before this increment; persistence now implemented | Keep one transaction for balances, carry/timestamp, settlements, and ledger; same account/key/fingerprint returns original result |
| Tower upgrades and weekly rewards | No runtime integration in this prototype | Defer both; preserve confirmed Level 3 XP/equipment gates for a later milestone |
| Gameplay PostgreSQL validation | Separate gameplay harness authorized by owner | Use only a newly created dedicated disposable gameplay database; app DB remains out of scope |

### First implementable increment: idle collection persistence

Prioritize only account-owned buildings, asset balances, and idle collection;
defer Tower upgrades, XP award processing, UI, weekly rewards, and deployed
feature-flag activation. The owner approved implementation of this prototype
increment and its separately guarded disposable PostgreSQL test suite:

1. Implemented: seed only `idle-materials-prototype`, version 1, with the five approved Level 1
   material rules. Provision exactly one active building of each type per
   account, at Level 1; do not seed Level 2 or `$DONCELLA`.
2. Implemented in migration 008: versioned rule, building, balance,
   collection-request, settlement, and ledger tables reference
   `authenticated_accounts.id`. No community tables are modified.
3. Implemented: the transaction-owning collection service derives account identity
   from trusted auth; lock only that account's buildings in stable ID order;
   reads one active ruleset and one database timestamp; calculates and persists
   exact integer credits/carry; writes the request result, settlements, ledger,
   and balances in the same transaction. HTTP routes now delegate to this
   service only when the explicit feature flag and startup prerequisites pass;
   the flag is disabled by default.
4. Implemented: retries are idempotent on `(account_id, idempotency_key)` and
   store a canonical request fingerprint bound to the exact SHA-256 rules
   fingerprint. The guarded PostgreSQL suite covers replay, wrong/stale and
   tampered fingerprints, custom rates/caps, account isolation, collections
   racing with different idempotency keys without double credit, append-only
   ledger/settlements, and transaction rollback. The owner reports the
   PostgreSQL suite passed manually against the dedicated disposable gameplay
   test database; see `TEST_MANIFEST.md` for the reported result and its
   verification boundary.
5. Added a separately guarded disposable PostgreSQL suite for persistence,
   fingerprint validation, retries, ownership, and rollback. The suite requires
   a new, dedicated gameplay test database; its credentials must be supplied
   only to the local test process. A passing manual run was reported for the
   persistence suite; the newly added account-state assertions still need to be
   run. Route contracts have local tests, but the gameplay feature flag remains
   off unless explicitly enabled.

### Next increment: feature-flagged authenticated idle API

The query, collection, and explicit initial-provisioning routes are implemented
locally, with `GAMEPLAY_API_ENABLED=false` as the default. This does not
authorize enabling the flag in any deployed environment. Startup requires
PostgreSQL and Immutable Passport authentication when the flag is explicitly
enabled; the server verifies the prototype tables and active ruleset before
listening. The feature remains unavailable in community demo mode.

| Method and path | Contract |
| --- | --- |
| `GET /api/gameplay/idle-collection` | Return only the authenticated account's buildings, balances, and active ruleset fingerprint; do not mutate or provision state |
| `POST /api/gameplay/idle-buildings/provision` | Explicitly provision the approved initial buildings for the authenticated account, requiring `expectedRulesFingerprint`; repeated exact provisioning is safe |
| `POST /api/gameplay/idle-collection` | Collect for the authenticated account only, requiring the `Idempotency-Key` header and `expectedRulesFingerprint`; delegate writes to the existing transaction-owning service |

All handlers derive `accountId` exclusively from verified server-side caller
context and reject a body-supplied `accountId`. Route tests cover mocked
authentication, IP throttling before authentication, shared per-account
throttling for query/provision/collection, body/fingerprint/idempotency
validation, idempotency conflict mapping, and disabled-route behavior. The
newly added account-state query assertions have not yet been included in the
owner's previously reported PostgreSQL execution. Run the guarded suite again
in the same dedicated disposable gameplay test database before claiming those
assertions validated. Do not use the application database.

Tower, rewards, gameplay UI, and enabling the flag in any deployed environment
remain out of scope.

Recommendations:

- Keep community demo startup and data independent of PostgreSQL and gameplay.
- Version rule rows immutably and snapshot the selected version in each
  settlement; do not hard-code rates in the persistence service.
- Store balances and ledger quantities as exact integers (or an explicitly
  reviewed fixed-scale numeric if fractional assets are later approved), never
  floating point.
- Forbid direct balance edits; every delta must have a unique ledger source
  and the settlement/balance/ledger change must be one transaction.
- Do not feed idle resources into Portfolio or weekly `$MARGEN` calculations.
- Keep Tower upgrade costs/prerequisites out of this first increment; preserve
  the confirmed Level 3 lifetime-XP/equipped-gear gates for its later design.

### Short list of decisions still needed

1. Approve the proposed building list, levels, rates, 8/12-hour caps, discard
   behavior, and whether `doncella_bank` may issue `$DONCELLA`.
2. Set duplicate-building/count limits, valid activity/fuel states, and how
   state changes settle production under the prior state.
3. Define upgrade prerequisites/costs/timing/refunds and rule-set activation.
4. Identify the authoritative main-avatar gear and verified XP-event sources;
   decide Tower starting level and all non-Level-3 gates/costs.
5. Explicitly authorize the first gameplay migrations/service and its isolated
   PostgreSQL harness. Current test authorization covers community persistence
   only.

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

## Implemented prototype artifacts and future Tower work

The implemented idle prototype now includes the calculator, collection planner,
versioned persistence service, fingerprinted rules, guarded database suite, and
the locally mounted-only-when-enabled HTTP routes:

```text
apps/api/src/gameplay/idleProduction.js
apps/api/src/gameplay/idleCollection.js
apps/api/src/gameplay/postgresIdleCollection.js
apps/api/src/gameplay/ruleFingerprint.js
apps/api/src/routes/gameplay.js
apps/api/migrations/007_create_authenticated_accounts.js
apps/api/migrations/008_create_idle_collection_persistence.js
apps/api/test/gameplay/idleProduction.test.js
apps/api/test/gameplay/idleCollection.test.js
apps/api/test/gameplay/gameplayRoutes.test.js
apps/api/test/integration/gameplayCollectionPostgres.test.js
```

Gameplay routes require PostgreSQL, Immutable Passport caller identity, and
`GAMEPLAY_API_ENABLED=true`; the default is false. The approved five-building
prototype uses `authenticated_accounts` as its account root. Tower upgrades,
Character XP events, weekly rewards, and UI remain future work. The older
`003`-`006` migration names below are proposal artifacts, not implemented
migrations:

```text
apps/api/migrations/003_create_gameplay_core_tables.js
apps/api/migrations/004_create_gameplay_rule_tables.js
apps/api/migrations/005_create_gameplay_ledgers.js
apps/api/migrations/006_create_gameplay_upgrade_function.js
apps/api/src/gameplay/towerUpgrades.js
apps/api/src/models/KingdomBuilding.js
apps/api/src/models/KingdomTower.js
apps/api/src/models/GameAssetLedger.js
apps/api/test/gameplay/production.postgres.test.js
apps/api/test/gameplay/towerUpgrades.postgres.test.js
```

Migration `007` already establishes the canonical authenticated account root;
migration `008` implements the prototype buildings, balances, rules, and
collection persistence against that account key. Future gameplay migrations
must continue to reference this account and must not introduce a duplicate
player identity.

## Remaining migration sequence

1. Implement Tower tables and Character XP events separately from the completed
   building/balance persistence. The Passport account and issuer/subject
   mapping exist; a revocable local session-to-account mapping remains a
   separate decision.
2. Add approved Tower-specific rules and immutable upgrade ledgers only after
   the costs, progression rules, and architecture have been confirmed.
3. Add the reviewed Tower upgrade function only if keeping the logic in
   PostgreSQL is an explicit architecture decision. Otherwise implement a
   transaction-owning service and omit the function migration.
4. Add indexes after validating actual query shapes and lock order.
5. Add isolated service and PostgreSQL integration tests for those future
   systems.
6. Add UI in a later change, hidden while disabled and clearly separated from
   community points and weekly rewards.

Each migration should be reversible where data safety permits and run through
the existing migration runner, never as an untracked pgAdmin operation.

## Required verification before enabling the feature flag in a deployment

**Idle collection PostgreSQL status: owner-reported manual pass** for the
previous persistence-suite revision; the newly added account-state query
assertions still need execution. Follow the authorization and isolation
requirements in `TEST_MANIFEST.md`. Tower concurrency, broad economic
simulations, and unrelated database-locking categories remain deferred.

The following verification remains outstanding before enabling the flag in a
deployment:

- The existing direct unit tests cover fractional carry, exact payout
  boundaries, caps, invalid rules, timestamp boundaries, and serialization.
  The newly added state-query and HTTP route contract tests cover account
  scoping and input validation with injected services/authentication.
- Rerun the guarded PostgreSQL suite to validate the account-state read and
  account isolation assertions added with the HTTP API. The owner-reported run
  already covered different-key concurrent collections without double credit;
  collection racing a Tower upgrade remains future work.
- Additional persistence tests are still needed for deadlock retry handling
  and any future debit/upgrade paths. Collection replay, transaction rollback,
  append-only ledger/settlements, and production-credit reconciliation are
  already covered by the existing guarded suite.
- Tower tests for every approved XP/equipment/cost rule, concurrent upgrades,
  stale expected levels, and Level 3 eligibility only after commit.
- Route tests proving unauthenticated requests fail, request-body account IDs
  are rejected, and the feature flag leaves routes unavailable by default
  (mocked route-contract tests now exist). Add/retain coverage for account
  isolation and explicit provisioning as the route implementation evolves.
- Regression checks confirming the community demo starts without PostgreSQL
  and its existing routes and non-monetary semantics are unchanged.

## Local gameplay validation record (October 12, 2026)

The development-only flags were enabled in ignored local environment files and
the API was run against `orden_margen_gameplay_dev`; no production setting or
deployment was changed. A real browser session at `http://localhost:8000`,
authenticated as the linked **Passport Developer** identity, completed the
following flow:

1. The initial authenticated account-state query succeeded.
2. The UI provisioned exactly five Level 1 buildings: provisioner, wheat farm,
   lumber mill, quarry, and textile mill.
3. The UI submitted an initial collection, then a later collection after real
   elapsed production time. PostgreSQL recorded `wheat=1` and `wood=1`, with
   two matching credit-ledger entries totaling two units.
4. Replaying the first persisted idempotency key returned the original result,
   kept one request row for that account/key, and left balances unchanged.
5. Final process inspection showed one web listener on port 8000 and one API
   listener on port 3001.

The first authenticated attempt exposed an operational gap: when the API could
not reach Immutable's JWKS endpoint, it returned the same 401 response used for
an invalid token, which the UI described as an expired session. The milestone
now requires provider/JWKS transport failures to return
`503 AUTH_PROVIDER_UNAVAILABLE`; malformed, expired, incorrectly signed, or
wrong-audience tokens continue to return `401 UNAUTHORIZED`. This distinction
is covered by an offline authentication test and does not weaken JWT claim or
signature validation.

The clean-checkout database validation was subsequently completed manually
from commit `e019cc7` against the two authorized disposable databases. The
guarded community suite passed all five integration tests and the guarded
gameplay suite passed its single integration test, with zero failures and zero
skips across both commands. Each harness used its repository-defined advisory
lock and temporary-schema lifecycle; this result does not authorize production
enablement or deployment.

The prototype building-upgrade revision was subsequently rerun manually in the
guarded disposable gameplay database after the upgrade FK/building lock-order
fix. The gameplay integration completed with **1 passed, 0 failed, and 0
skipped**. Its concurrent different-key case continued to require one success
and one `BUILDING_UPGRADE_CONFLICT`, while the same-key case replayed the
original result. The run also exercised rollback, one-time cost debits, Level
1 settlement, carry preservation, and the persisted upgrade ledgers. A
database deadlock code was not accepted as a successful outcome. This record
does not authorize production enablement or publication.

Automated regression follow-up: the guarded PostgreSQL integration test now
checks the successful wheat-farm upgrade's structurally expected balance
snapshot and confirms that a same-key replay returns the original result
without changing balances a second time. The web component test invokes the
upgrade button's click handler and verifies the refreshed Level 2 card shows
`132 wheat/hour · 12h storage cap`. This is a Node component-harness test, not
a real-browser button test. The browser opened for this follow-up was
unauthenticated, so no browser-issued upgrade request or authenticated browser
button click was performed; a direct browser HTTP request alone would verify
the endpoint, not the UI click path.

The owner subsequently reported a successful manual run of
`npm --prefix apps/api run test:gameplay:integration` against
`orden_margen_gameplay_test`: **1 passed, 0 failed, 0 skipped**. This execution
validated the new successful-upgrade balance and same-key replay assertions,
including that replay does not debit costs twice. It was a PostgreSQL
integration run; it was not a real-browser button click. The button behavior
remains covered by the separate Node DOM-harness test above.
