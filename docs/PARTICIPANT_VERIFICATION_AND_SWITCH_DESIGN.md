# Participant verification and primary-account switch design

## Document status

This document reviews the standalone proposal identified as
`SEC-PROP-2026-V4`. That proposal remains proposal-only and pending review. Its
identity-proofing, evidence, token, review, schema, queue, execution, and test
refinements are not adopted merely because this document uses terms such as
“must” or “require.”

The adopted decision constraints identified below predate or sit outside
`SEC-PROP-2026-V4`. Recording them as review boundaries does not approve the
proposal or any supplied implementation artifact.

This is design review material, not evidence of corporate, legal, security,
privacy, or compliance approval. It does not claim that an interactive console,
API, database, worker, or production authorization system has been updated.

Any SQL, JSON, trigger, token, or Python material supplied with the proposal is
non-executable review material. The JSON is an illustrative payload rather
than a JSON Schema or valid token. The Python example is a simulation rather
than a test of the Node service or PostgreSQL behavior.

## Adopted decision constraints

The proposal must be evaluated without weakening these adopted rules.

### Participant and progression boundaries

- A confirmed participant has one designated primary progression account.
- Progression remains account-specific. Designating a different primary
  account does not copy, merge, or transfer XP, Tower level, inventory, land,
  equipment, or other progression state.
- A newly designated primary account must independently complete Kingdom Tower
  Level 3. Another account's completion cannot satisfy that requirement.
- A participant may change the designated primary account no more than once per
  four weekly periods, except through a separately authorized and audited
  recovery exception.
- An approved switch activates at the next weekly boundary; it does not rewrite
  an already-started or completed reward period.
- An account that is not associated with a confirmed participant is excluded
  from weekly rewards. It must not be assigned to a shared fallback pool or
  treated as eligible by implementation assumption.
- A switch must not create an account association, infer legal identity, or
  change reward calculations outside the adopted primary-account rule.

## Proposed verification and review refinements

The evidence and review controls below are corrections to and refinements of
`SEC-PROP-2026-V4`. They remain proposed and pending policy, security, privacy,
legal, and compliance review.

### Evidence boundaries

- A valid cryptographic signature proves control of the corresponding private
  key at the time of signing. It does not prove exclusive possession of that
  key, continued control, or the signer's legal identity.
- Hardware or platform attestation can support claims about a credential or
  execution environment, but attestation alone does not establish legal
  identity or that two accounts have the same controller.
- Device, IP, wallet, key, and behavioral similarity may be reviewed as
  evidence but cannot establish participant identity or association alone.
- Participant confirmation requires an approved identity-proofing process.

### Review and audit boundaries

- A two-reviewer flow means two distinct authorized human reviewers create two
  separate decision records. A counter, duplicated actor identifier, or a
  single record edited twice is insufficient.
- Original decisions are immutable. Reconsideration, correction, cancellation,
  and recovery add new decision or audit events rather than overwriting history.
- Deployment authorization and participant-switch approval are separate
  controls. Authority to deploy code, migrations, triggers, or workers does not
  authorize a participant's switch, and switch approval does not authorize a
  deployment.

## Proposed refinements

The refinements in this section are recommended safeguards, not confirmed
runtime behavior.

### Identity and credential records

Represent an identity-provider subject by the unique pair `(issuer, subject)`.
`subject` alone is not globally unique and must never be used without its
issuer namespace.

Keep provider identity and credentials separate:

- The provider-subject record identifies `(issuer, subject)` and its lifecycle.
- Separate credential records identify individual public keys or authenticators
  and record issuance, verification, rotation, expiry, and revocation.
- Key rotation adds or supersedes a credential without changing the provider
  subject or destroying prior verification history.
- Revocation disables the affected credential and appends an audit event; it
  does not erase decisions that relied on the credential when it was valid.

Minimize collected and retained personal data. Store restricted evidence
references, provider result identifiers, assurance metadata, and policy versions
where possible instead of raw identity documents or reusable biometric data.
Access to restricted references must be authorized and audited independently.

### Signed proof and token validation

Before accepting a signed provider result or key-binding token, the service
should verify all of the following:

1. The issuer is explicitly trusted for the applicable policy and environment.
2. The signature validates against a currently trusted issuer key.
3. The declared algorithm is on an explicit allowlist; algorithm substitution,
   unsigned tokens, and attacker-selected keys are rejected.
4. The audience exactly includes the intended service and environment.
5. Issued-at, not-before, and expiry claims satisfy bounded clock-skew rules.
6. A unique token or proof identifier is checked for replay and persisted for
   the required replay-protection window.
7. The provider subject is addressed as `(issuer, subject)`.
8. Any claimed account credential is bound through a verified challenge signed
   by the account key, with purpose, participant, nonce, audience, and expiry
   included in the signed material.
9. The credential was not revoked or superseded at the relevant time.

The supplied JSON example is only an illustrative payload showing possible
claims. It is not a JSON Schema, encoded token, signature, or proof that any
issuer, audience, algorithm, key binding, or identity check is valid.

### Review workflow

Proposed review states should distinguish submission, first decision, second
decision, approval, rejection, cancellation, queued activation, execution, and
audited recovery. Each reviewer decision should record its own actor, timestamp,
reason, policy version, evidence references, and expected case version.

A 24-hour review window is a proposed service target only. Reaching or missing
that target must never automatically approve, reject, cancel, or execute a
request. Expired service targets should produce monitoring or escalation, not a
participant-affecting decision.

### Weekly calendar

Use a weekly period beginning Sunday at `00:00:00 UTC` inclusive and ending the
following Sunday at `00:00:00 UTC` exclusive. Proposed persistence constraints
should ensure:

- every period has a duration of exactly seven days;
- both boundaries align to Sunday 00:00 UTC;
- periods do not overlap; and
- boundary ownership follows `[start_time, end_time)`, so an instant at the end
  belongs to the next period rather than both periods.

Active status is time-dependent and should be calculated at query time using a
trusted clock, for example by checking `start_time <= now` and `now < end_time`.
Do not use a generated column whose value depends on the current time; such a
column is invalid or becomes stale because generated expressions must be based
on stable row inputs. The supplied SQL must therefore be treated as a proposal
and revised before it could become a migration.

### Switch request and queue safeguards

The proposed request path should require all of the following:

- an authenticated participant request and a fresh authorization check;
- an approved association between the participant, current primary account,
  and requested account;
- exactly one pending or approved-but-unexecuted switch per participant;
- a unique idempotency key bound to the actor, participant, canonical payload,
  and operation;
- an expected participant or switch version for optimistic concurrency;
- two distinct authorized reviewer decision records;
- satisfaction of the four-week cooldown;
- a computed next-weekly-boundary activation time; and
- append-only request, decision, status, and recovery audit events.

Recovery exceptions must be separately authorized, narrowly scoped, reasoned,
and audited. They must not silently bypass identity proofing, association,
cooldown, reviewer separation, cancellation, or boundary rules.

At activation, revalidate authentication-independent persisted conditions:
association status, reviewer decisions, request state, expected versions,
cooldown, target-account eligibility, independent Tower Level 3 completion,
credential status, and the authorized weekly boundary. Update the participant's
primary account, switch status, and audit event atomically in one transaction.
No response or worker result may claim success before commit.

### Execution boundary

Execution is permitted only for a request in the approved queued state and at
its authorized activation boundary. The executor must reject:

- cancelled, rejected, already executed, superseded, or recovery-held requests;
- execution before the authorized weekly boundary;
- a changed or unauthorized boundary;
- stale versions or a concurrently changed primary account;
- requests whose associations, approvals, cooldown, credential status, or
  Tower Level 3 prerequisite no longer pass revalidation; and
- callers or workers lacking the dedicated execution permission.

A database trigger can enforce limited row invariants but is insufficient on
its own. It cannot replace authentication, reviewer authorization, identity
proofing, idempotency, complete cross-record policy checks, trusted scheduling,
or service-level transaction orchestration.

## Verification plan

The supplied Python example is a behavioral simulation. It may illustrate
dates or state transitions, but it does not verify JavaScript validation,
Express integration, PostgreSQL constraints, transaction isolation, grants, or
the actual Node service.

Future automated tests should exercise the exported Node service against a
new disposable PostgreSQL database with production migrations applied. They
should cover at least:

- cancellation before and during competing activation attempts;
- exact inclusive/exclusive weekly boundaries and UTC alignment;
- four-week cooldown edges and clock-skew handling;
- account-specific progression and independent Tower Level 3 completion;
- duplicate and concurrent queue requests for the same participant;
- distinct-reviewer enforcement and attempts to reuse one reviewer;
- idempotent replay and mismatched reuse of an idempotency key;
- stale versions and concurrent primary-account changes;
- transient serialization failures, fresh-transaction retries, and finite
  retry limits;
- credential rotation and revocation between approval and activation;
- rejected premature, cancelled, repeated, or boundary-altered execution; and
- injected failures proving atomic rollback of the primary account, switch
  status, idempotency result, and append-only audit event.

Tests must assert committed database state and permissions, not only returned
values. No test should connect to a developer, staging, or production database.

## Unresolved decisions

The following remain open and require explicit policy, security, privacy, or
compliance approval before implementation:

- identity-proofing provider selection and approved issuer registry;
- required assurance level, acceptable proofing methods, regional coverage,
  failure handling, and re-verification intervals;
- exact personal-data fields, retention periods, encryption boundaries,
  restricted-evidence access roles, deletion obligations, and incident process;
- token format, allowed algorithms, trusted-key distribution and rotation,
  audience values, clock skew, token lifetime, and replay-retention period;
- supported reason codes and the evidence threshold for each decision;
- reviewer permission model, assignment rules, conflict-of-interest checks,
  escalation path, and service-level monitoring;
- the canonical time source and operational owner of weekly period creation;
- precise cooldown calculation around an approved, cancelled, failed, recovered,
  or rolled-back switch;
- recovery-authority roles and which exceptional states are recoverable; and
- final schema, constraints, isolation level, retry classification, audit-event
  retention, and deployment/rollback procedure.
