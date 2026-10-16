# Specification: Administrative appeal validation workflow

**Document ID:** `SPEC-ADMIN-APPL-2026`  
**Status:** Adopted design parameter; implementation deferred

## Scope and identity boundary

This contract governs the future transactional service behind the existing,
unmounted `POST /api/admin/review-cases/:caseId/resolve-appeal` router. It does
not mount the router, add authentication, create persistence, or authorize a
runtime administrative endpoint.

An appeal is permanently anchored to its `case_id`, pending appeal record,
original decision, subject account ownership links, and immutable history. A
case may also reference a confirmed `participant_id` when an association
already exists. `participant_id` is not a mandatory appeal primitive because
an unassociated account must be able to appeal a case involving that account.
The appeal workflow must never infer or create a participant merely to resolve
the case.

## Existing route contract

The unmounted router currently accepts or derives:

- `caseId` from the route;
- `reviewerAccountId` exclusively from authenticated caller context;
- `Idempotency-Key` from the request header; and
- `expectedVersion`, `outcome`, `reasonCode`, `decisionNote`, and unique
  `evidenceIds` from the validated request body.

The adopted outcome vocabulary is:

- `approved`: reconsideration upheld the original decision; and
- `overturned`: the appeal succeeded.

`APPROVED`/`REJECTED` must not replace these meanings. An appeal outcome is not
an association approval, payout decision, account split, or asset attribution
change.

## Transactional validation workflow

```text
authenticated reviewer request
              |
              v
validate route/header/body contract
              |
              v
revalidate reviews.resolve_appeal permission and self-review prohibition
              |
              v
resolve persisted idempotency record and canonical request fingerprint
              |
              v
lock case row; require appealed state and matching expectedVersion
              |
              v
confirm pending appeal, original decision, subject ownership, and case links
              |
              v
verify every cited evidence item belongs to the case, is visible, and reviewed
              |
              v
validate supported outcome/reason and nonblank reviewer decisionNote
              |
              v
atomically update case status/version, append history, and store replay result
```

PostgreSQL persistence is the sole authority for current case state, version,
idempotency, evidence linkage, and committed outcome. No gateway or cache may
approve a resolution or substitute for the locked transaction.

## Evidence and participant context

Evidence must support an outcome allowed by the approved review policy. Device,
IP, wallet, key, or behavioral similarity may be considered but cannot by
itself establish participant identity, common control, or independent control.

A fresh account-key challenge and an approved identity-proofing result remain
proposed requirements for the separate participant-association process. They
are not adopted as universal appeal-resolution requirements. A historical
public-key fingerprint alone neither proves ownership of a `participant_id`
nor clears participant-level deduplication controls.

The reviewer must provide a nonblank `decisionNote`, a supported closed
`reasonCode`, and nonempty unique evidence references. The original decision
and its history remain immutable regardless of outcome.

## Conflict and error boundary

The future service requires stable typed errors. At minimum:

- stale `expectedVersion`, invalid case state, and idempotency-key fingerprint
  mismatch are conflicts and make no mutation;
- missing or invalid request fields are validation failures;
- missing authentication and insufficient permission remain distinct;
- unavailable, unrelated, invisible, or unreviewed evidence prevents
  resolution; and
- internal lock, schema, or transaction details must not be exposed.

The exact HTTP mapping remains part of the future common administrative error
contract. A credential-evidence mismatch must not be mislabeled as the payout
API's idempotency-key conflict.

## Separation invariants

Resolving an appeal must not:

- create, delete, correct, merge, split, or move a participant association;
- change a designated primary account or participant/account ownership link;
- change mining-asset attribution or participant-level cap inputs;
- create a reward group or fallback pool;
- change eligibility, a frozen snapshot, reward weight, or payout record; or
- grant a historical, fallback, exception, or retroactive allocation.

If an overturned appeal supports a later association correction, an authorized
reviewer must initiate the separate audited association operation. That later
operation has independent authorization, evidence, idempotency, locking,
history, and effective-date rules and cannot rewrite a closed snapshot.

## Idempotency and audit integrity

The service must persist the idempotency key, canonical request fingerprint,
case status/version change, append-only history event, and recorded response in
one transaction. An identical committed replay returns the stored result; reuse
with a different canonical request fails without mutation.

Canonical serialization must be unambiguous and versioned. The payout-specific
`weekly-payout-v1` length-prefixed allocation-key formula does not apply to
appeals. The appeal fingerprint algorithm and field encoding must be approved
as a separate administrative contract before implementation.

The application database role may insert history events but must not update or
delete them. Corrections use additive events.

## Implementation and validation boundary

The existing router and validator remain unmounted contract artifacts. The
transaction-owning service, reviewer authentication/authorization, persistence
schema, grants, typed error mapping, and composition-root wiring are missing.

No database implementation, router mount, network gateway, simulation, or
PostgreSQL locking test is authorized by this document. Database validation
remains **SKIPPED** under `TEST_MANIFEST.md` until a dedicated disposable
PostgreSQL integration-test environment is explicitly authorized.
