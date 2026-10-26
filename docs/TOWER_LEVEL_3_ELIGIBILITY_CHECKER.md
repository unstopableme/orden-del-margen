# Specification: Tower Level 3 eligibility checker

**System module:** Snapshot generator / reward gate  
**Status:** Adopted design parameter; implementation deferred

## Functional mandate

The future checker evaluates reward eligibility using authoritative state
effective at the exclusive end of a weekly period: Sunday 00:00:00 UTC. The
period begins at the preceding Sunday 00:00:00 UTC inclusive and lasts exactly
seven days.

The check closes the period that just ended; it does not qualify a participant
for an unspecified “upcoming cycle.” A snapshot may be created at or after the
boundary, but every eligibility input must be evaluated as of that boundary so
later account changes cannot alter the closed period.

The checker is a gate. It does not calculate reward weight, allocate `$MARGEN`,
post a ledger entry, modify progression, designate an account, or infer a
participant association.

## Canonical inputs

For each confirmed participant considered by the snapshot producer, the checker
requires authoritative, effective-dated evidence of:

- `participant_id`;
- the participant-account association effective at `period_end`;
- exactly one explicitly designated `primary_account_id` effective at
  `period_end`;
- the primary account's completed `tower_level` effective at `period_end`; and
- source revisions or immutable references sufficient to reproduce the result.

The repository has no implemented participant, account-designation, Tower, or
reward-snapshot schema. Names such as `is_primary_designation` and “player
accounts ledger” are therefore not adopted physical columns or tables. Future
persistence must implement the semantic inputs above without creating a second
player identity or treating an asset ledger as the designation authority.

## Deterministic evaluation

```text
participant candidate at period_end
                |
                v
confirmed association effective? -- no --> exclude: PARTICIPANT_UNASSOCIATED
                |
               yes
                v
exactly one explicit primary account? -- no --> exclude: PRIMARY_ACCOUNT_MISSING
                |                         \
               yes                         -> more than one: SNAPSHOT_INVALID
                v
primary account Tower Level >= 3? -- no --> exclude: PRIMARY_TOWER_LEVEL_UNDER_3
                |
               yes
                v
include participant as eligible snapshot input
```

A valid, unique primary designation and independently completed Tower Level 3
are both required. Secondary-account Tower levels do not qualify the
participant, and the checker must never choose the highest-level account
automatically.

Multiple effective primary designations are an invalid source-state invariant,
not an ordinary participant disqualification. Snapshot publication must stop
until that inconsistency is resolved; silently choosing one would make the
result nondeterministic.

## Exclusion and weight boundary

An unassociated participant candidate, a missing primary designation, or a
primary account below Tower Level 3 is excluded from payout participation for
the closed period. The snapshot records the stable exclusion reason and the
evidence references needed for audit.

Excluded records do not enter the pure payout calculator and receive no weekly
allocation, fallback allocation, or retroactive allocation. They are not
represented as eligible participants with an assigned weight of zero. A
confirmed, eligible participant may still have a canonical calculated weight
of zero only if the separately adopted reward-weight contract permits that
result for otherwise valid inputs.

## Immutable snapshot evidence

The published snapshot freezes, at minimum:

- `snapshot_id`, `period_start`, `period_end`, and `snapshot_at`;
- `participant_id` and association evidence effective at `period_end`;
- the designated `primary_account_id` effective at `period_end`;
- the qualifying Tower level and its authoritative source revision;
- the eligibility outcome and stable exclusion reason, when excluded; and
- the policy/schema versions used by the checker.

An account switch effective after `period_end` affects only a later period. It
must not rewrite the participant, primary account, Tower evidence, eligibility,
weight, or payout inputs of a published snapshot.

## Failure behavior

Missing source data, duplicate effective primary designations, an invalid
weekly boundary, inconsistent effective dates, or an unverifiable source
revision invalidates snapshot generation. These conditions must not be reduced
to ordinary ineligibility because doing so could conceal a system integrity
failure.

## Implementation and validation boundary

No checker, schema, migration, trigger, service, scheduled job, or API is
authorized by this specification. PostgreSQL snapshot, boundary, and
concurrency validation remains **SKIPPED** under `TEST_MANIFEST.md` until a
dedicated disposable PostgreSQL integration-test environment is explicitly
authorized.
