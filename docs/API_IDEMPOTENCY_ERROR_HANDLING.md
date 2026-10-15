# Payout idempotency API error handling

**Document ID:** `SPEC-ERR-IDEM-2026`  
**Status:** Design proposal; implementation deferred

## Scope and authority boundary

This proposal defines a future HTTP response contract for ordinary weekly
`$MARGEN` allocation replay. It does not add or authorize an API gateway,
payout endpoint, cache, ledger, migration, service, job, or interactive
transaction engine.

The gateway may authenticate, apply request limits, and use a cache as a
non-authoritative optimization. It must not decide payout identity or ledger
state from cache. PostgreSQL persistence is the sole transaction-state
authority for the allocation key, canonical request fingerprint, committed
receipt, and one-allocation-per-participant invariant defined in
`IDEMPOTENCY_AND_UNIQUENESS.md`. The authenticated payout service may interpret
that persisted state but cannot replace or weaken it.

A cache miss never proves that a key is unused. A cache hit never authorizes a
ledger write, determines processing or commit status, or substitutes for a
PostgreSQL comparison with the persisted canonical fingerprint.

## Proposed response matrix

| Scenario | Resolution code | HTTP response | Required behavior |
| --- | --- | --- | --- |
| Same allocation key is durably reserved or processing, with no committed outcome yet | `IDEMPOTENCY_IN_PROGRESS` | `409 Conflict` | Return no receipt or allocation; include bounded retry guidance and make no second ledger mutation |
| Same allocation key and same canonical request fingerprint already committed | `IDEMPOTENCY_REPLAY` | `200 OK` | Return the exact stored receipt representation or a versioned reconstruction of it; allocate nothing new |
| Same allocation key but different canonical request fingerprint | `IDEMPOTENCY_PAYLOAD_MISMATCH` | `409 Conflict` | Reject as a conflict with the existing key binding and make no mutation |
| New allocation key and valid server-derived allocation request | normal processing | Success status defined by the future endpoint | Persist the allocation, ledger effect, pool accounting, fingerprint, and receipt atomically |

Payload mismatch is proposed as `409`, not `400`: the submitted representation
may be syntactically valid, but it conflicts with the resource already bound to
the allocation key. This is not automatically classified as tampering. Security
telemetry may record repeated mismatches, but a client-visible accusation or
account penalty requires a separately adopted abuse policy.

The ordinary weekly reward kind is fixed as `weekly_allocation`. A client may
not supply or modify reward weight, allocation amount, participant identity,
primary account, reward kind, asset, or destination. Those values are derived
from authenticated identity, the immutable snapshot, and server policy.

## Error envelope

Future errors use the API's eventual common error format. Until that format is
adopted, the following shape is proposed:

```json
{
  "error": {
    "code": "IDEMPOTENCY_IN_PROGRESS",
    "message": "This weekly allocation is already processing.",
    "requestId": "req_opaque_example",
    "occurredAt": "2026-10-04T20:13:45.102Z",
    "retryable": true,
    "details": {
      "allocationKeyPrefix": "d8c15c8b59bf",
      "retryAfterSeconds": 2
    }
  }
}
```

For an in-progress response, the HTTP `Retry-After` header and
`details.retryAfterSeconds` must agree. Retry guidance must be bounded and must
not imply that a payout will succeed.

For a conflicting fingerprint:

```json
{
  "error": {
    "code": "IDEMPOTENCY_PAYLOAD_MISMATCH",
    "message": "This allocation key is already bound to a different canonical request.",
    "requestId": "req_opaque_example",
    "occurredAt": "2026-10-04T20:13:46.004Z",
    "retryable": false,
    "details": {
      "allocationKeyPrefix": "d8c15c8b59bf"
    }
  }
}
```

Responses must not echo the full allocation key, canonical fingerprint,
internal lock state, reward weight, pool balance, database identifiers, or a
field-by-field fingerprint difference. A short key prefix is diagnostic only
and may be omitted if the security review rejects it.

## Successful replay envelope

An identical post-commit replay returns `200 OK`, identifies the response as a
replay, and returns the stored receipt without a new allocation:

```json
{
  "replayed": true,
  "receipt": {
    "receiptId": "payout_receipt_opaque_example",
    "snapshotId": "snapshot_opaque_example",
    "participantId": "participant_opaque_example",
    "asset": "$MARGEN",
    "amount": "0",
    "committedAt": "2026-10-04T20:13:40.000Z"
  }
}
```

The receipt schema is illustrative. The future API review must decide which
identifiers are safe for the authenticated caller and whether zero allocations
produce persisted receipts. The replay response must be semantically stable
even if presentation metadata changes.

## Resolution flow

```text
authenticated payout request
          |
          v
derive server-controlled allocation identity and canonical fingerprint
          |
          v
consult authoritative persisted idempotency/allocation state
          |
     +----+-------------------+
     |                        |
existing key               new key
     |                        |
compare fingerprint       enter atomic allocation operation
     |                        |
  +--+-----------+            v
  |              |       database uniqueness remains final arbiter
same          different
  |              |
  v              v
committed?     409 mismatch, no mutation
  |
+-+----------+
|            |
yes          processing
|            |
v            v
200 stored   409 in progress with Retry-After
receipt
```

The exact durable representation of `processing` remains unresolved. An
uncommitted PostgreSQL row is not a reliable gateway-visible state. Any future
reservation or operation table must preserve crash recovery, expiry, ownership,
atomic ledger posting, and uniqueness guarantees without allowing a stale
reservation to allocate twice.

## Deferred validation

All route, cache, PostgreSQL contention, replay, timeout, and crash-recovery
tests remain **SKIPPED** under `TEST_MANIFEST.md`. No simulation or database
locking harness may be designed or run without explicit authorization for the
dedicated disposable PostgreSQL integration-test environment.
