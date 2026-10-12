# Prototype building-upgrade milestone

## Scope

This milestone adds the isolated Level 1-to-Level 2 building-upgrade path to
the feature-flagged gameplay prototype. It does not change the community MVP,
Tower progression, weekly `$MARGEN` eligibility, or any deployed environment.

The implementation:

- adds immutable, fingerprinted Level 2 production rules and material costs;
- settles Level 1 production before changing a building's level;
- preserves exact fractional carry;
- debits collected materials and writes upgrade ledgers atomically;
- uses account-scoped idempotency keys;
- serializes collection and upgrade operations through a consistent building
  lock order; and
- leaves the feature disabled by default.

## Insufficient-material behavior

An insufficient-material request returns HTTP `409` with
`INSUFFICIENT_COLLECTED_BALANCE`. The transaction rolls back completely. It
must not change:

- the building level;
- any collected balance;
- the building's fractional carry;
- `last_settled_at`; or
- upgrade request, upgrade ledger, or cost-ledger counts.

The browser normally disables an unaffordable upgrade button and shows the
cost deficits. The API remains authoritative if a stale or modified client
submits the request. The UI maps the authoritative insufficient-balance code to
a material-specific rejection instead of presenting it as a generic rules
conflict.

## Browser and database validation

Validated on October 12, 2026 using a temporary isolated Chrome profile,
authenticated personally through Immutable Passport, against the local
development database `orden_margen_gameplay_dev`. Chrome debugging was bound
to loopback only. The temporary browser was closed afterward and only its
temporary profile directory was deleted.

The authenticated browser loaded ruleset version 2 and displayed the Wheat
Farm Level 2 costs as 60 cloth, 60 food, 120 stone, and 180 wood. The account
had only one wheat and one wood, so no successful upgrade was attempted.

An authenticated browser-context request for the Wheat Farm upgrade returned:

```text
409 INSUFFICIENT_COLLECTED_BALANCE
Insufficient collected cloth for building upgrade
```

Snapshots taken immediately before and after the request were identical:

- all five buildings remained at Level 1;
- balances remained `wheat=1` and `wood=1`, with no other balance rows;
- every building retained its exact carry numerator;
- every building retained its exact `last_settled_at` timestamp; and
- upgrade request, upgrade ledger, and cost-ledger counts remained zero.

No successful upgrade was executed during this browser validation.

## Verification

Targeted API tests:

```text
node --test test/gameplay/ruleFingerprint.test.js test/gameplay/gameplayRoutes.test.js
16 passed, 0 failed, 0 skipped
```

Targeted web tests after the insufficient-balance message correction:

```text
node --test test/gameplay.test.js
20 passed, 0 failed, 0 skipped
```

The guarded PostgreSQL integration suite was subsequently run manually from a
clean checkout of commit `a8384a8` against the separately authorized disposable
`orden_margen_gameplay_test` database with its database-name, disposable-purpose,
empty-`public`-schema, advisory-lock, and isolated-schema guards enabled. The
result was:

```text
1 passed, 0 failed, 0 skipped
```

This integration test covers insufficient-balance rollback, successful
settlement and debit, same-key replay, different-key concurrency, audit
ledgers, and rollback on a forced ledger failure. It was not redirected to the
application development database.

## Included implementation surface

```text
apps/api/migrations/010_add_prototype_building_upgrades.js
apps/api/src/gameplay/postgresIdleCollection.js
apps/api/src/gameplay/ruleFingerprint.js
apps/api/src/routes/gameplay.js
apps/api/test/gameplay/gameplayRoutes.test.js
apps/api/test/gameplay/ruleFingerprint.test.js
apps/api/test/integration/gameplayCollectionPostgres.test.js
apps/web/src/gameplay.js
apps/web/styles.css
apps/web/test/gameplay.test.js
```

`docs/IMPLEMENTATION_PLAN.md` and `docs/TEST_MANIFEST.md` contain pre-existing
staged and unstaged work from other milestones. They are intentionally excluded
from this isolated commit so those layers remain available for separate review.
