# Payout idempotency and uniqueness

**Document ID:** `SPEC-DATA-UNIQ-2026`  
**Status:** Adopted design parameter; implementation deferred

## Scope and repository alignment

This contract applies to the future persistence of ordinary weekly `$MARGEN`
allocations produced from an immutable reward snapshot. It adds no migration,
table, service, route, job, simulation, or executable test.

The canonical reward identity is a confirmed `participant_id`, not a `user_id`
or legal-person assertion. Each snapshot records the participant's designated
`primary_account_id` effective for that period. The participant-level identity
matches the combined-allocation and 5% cap rules already adopted by the project.

The only adopted payout kind is `weekly_allocation`. Unassociated accounts
receive no fallback or retroactive allocation. Retroactive adjustments and
operational-exception payouts are not authorized reward kinds; adopting either
would require a separate policy, accounting, authorization, and immutable
correction-ledger contract.

## Weekly boundary

Each immutable snapshot covers one period from Sunday 00:00 UTC inclusive to
the following Sunday 00:00 UTC exclusive. `snapshot_id` identifies the frozen
inputs for that non-overlapping period. The snapshot must already enforce one
record per confirmed participant before payout persistence begins.

## Deterministic allocation key

For an ordinary weekly allocation, the future snapshot service derives:

```text
allocationKey = lowercaseHex(
  SHA-256(
    lengthPrefix("weekly-payout-v1") ||
    lengthPrefix(snapshot_id) ||
    lengthPrefix(participant_id) ||
    lengthPrefix(primary_account_id) ||
    lengthPrefix("weekly_allocation")
  )
)
```

Every component is encoded as canonical UTF-8 and preceded by its unsigned
byte length in a single specified binary format. Raw string concatenation is
forbidden because different component tuples can otherwise produce the same
byte sequence. The resulting lowercase hexadecimal value is exactly 64 ASCII
characters.

The key identifies the logical allocation; it is not a request fingerprint.
The persisted row must also retain a canonical payload fingerprint covering at
least the snapshot and policy versions, participant, primary account, reward
kind, amount, asset, and destination. A repeated key with a different
fingerprint is an idempotency mismatch and must not be reported as success.

## Future relational constraints

The names below define the logical future schema. No `payout_ledger` table
currently exists, so this is a target contract rather than an alteration script.

```sql
-- Illustrative target DDL only; not an executable repository migration.
ALTER TABLE weekly_payout_allocations
    ADD COLUMN allocation_key CHAR(64) NOT NULL,
    ADD COLUMN request_fingerprint CHAR(64) NOT NULL,
    ADD CONSTRAINT uq_weekly_payout_snapshot_participant
        UNIQUE (snapshot_id, participant_id),
    ADD CONSTRAINT uq_weekly_payout_allocation_key
        UNIQUE (allocation_key),
    ADD CONSTRAINT ck_weekly_payout_allocation_key_hex
        CHECK (allocation_key ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT ck_weekly_payout_request_fingerprint_hex
        CHECK (request_fingerprint ~ '^[0-9a-f]{64}$');
```

`UNIQUE (snapshot_id, participant_id)` is the natural business constraint.
Using only `account_id` would conflict with participant-level aggregation and
could permit two allocations after a primary-account change. Adding a reward
type to this key is unnecessary while only `weekly_allocation` is adopted and
would weaken the one-allocation-per-participant guarantee.

The future table must also use foreign keys to the immutable snapshot,
participant, and snapshotted primary-account records; exact integer amount
constraints; a fixed `$MARGEN` asset discriminator; immutable audit timestamps;
and database permissions that prevent application-role updates or deletes.
Those definitions depend on the still-missing reward persistence schema.

## Replay resolution flow

```text
incoming allocation
        |
        v
validate immutable snapshot row and canonical payload
        |
        v
derive allocation key and request fingerprint
        |
        v
attempt insert in the transaction that posts the ledger effect
        |
   +----+----+
   |         |
inserted   key already exists
   |         |
   v         v
commit     read the existing row and compare its fingerprint
             |
        +----+----+
        |         |
      equal     different
        |         |
        v         v
return the      reject with a typed idempotency mismatch;
stored result   make no balance, pool, or ledger change
```

`ON CONFLICT DO NOTHING` alone is insufficient: it neither proves that the
existing row represents the same canonical payload nor returns cached details.
The service must read and compare the committed record. Allocation persistence,
the corresponding balance/ledger effect, pool accounting, and the stored
result must commit atomically.

## Deferred validation

PostgreSQL uniqueness, contention, rollback, and replay validation remains
**SKIPPED** under `TEST_MANIFEST.md`. No database-locking test, concurrency
simulation, or harness may be designed or run until a dedicated disposable
PostgreSQL integration-test environment is explicitly authorized.

The proposed future HTTP mapping for committed replay, conflicting payloads,
and in-progress operations is documented separately in
`API_IDEMPOTENCY_ERROR_HANDLING.md`. That proposal does not weaken the database
constraint or make a gateway cache authoritative.
