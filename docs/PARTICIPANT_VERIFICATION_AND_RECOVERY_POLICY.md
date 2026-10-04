# Participant verification and individual recovery policy

## Status

This document proposes a minimum verification, reviewer-authority, and individual
account-recovery procedure for explicit policy review. None of these
recommendations are adopted by this document. Provider selection, vendor
contracts, assurance profiles, and detailed retention schedules also remain
unresolved. Additional refinements in `SEC-PROP-2026-V4` remain proposed.

## Acceptable evidence

A verification decision requires both of these independent evidence classes:

1. An identity-proofing result from an approved issuer, addressed by the unique
   pair `(issuer, subject)`, with a restricted provider result reference,
   issuance and expiry times, assurance metadata, and policy version.
2. A fresh server-issued challenge signed by the current credential of every
   account proposed for association. The challenge binds the account,
   participant case, purpose, audience, nonce, and expiry.

The service validates issuer trust, allowed signature algorithms, audience,
expiry, replay identifier, and the verified account-key binding. A signature
proves control of a key at signing; it does not prove exclusive possession,
continued control, or legal identity. HSM, secure-enclave, or other hardware
attestation is optional supplementary evidence and is not required for ordinary
players. Device, IP, wallet, behavioral, or hardware similarity cannot establish
identity or association alone.

Store restricted evidence references and decision metadata instead of raw
identity documents wherever possible. Credentials are separate records so key
rotation and revocation preserve provider-subject identity and audit history.

## Reviewer authority and decisions

Participant verification and individual recovery require two separate decision
records from two distinct currently authorized reviewers. Each reviewer must:

- hold the operation-specific permission at decision time;
- be independent of the participant, subject accounts, and other reviewer;
- review every cited evidence reference and record a supported reason code,
  note, policy version, expected case version, and timestamp; and
- pass authorization and conflict checks again at the service trust boundary.

The original decision and both reviewer decisions remain append-only. A missed
service target never approves or rejects a case automatically. Deployment
authority does not grant verification, switch, or recovery authority.

## Ordinary primary-account switches

The authenticated participant submits an idempotent request for an already
approved associated account. Two distinct authorized reviewers approve or reject
the request through separate records. An approved request activates at the next
weekly boundary, subject to the once-per-four-weekly-period limit. Conditions
and versions are revalidated at activation, and the primary account, request
status, and audit event change atomically.

## Individual account-recovery exception

A recovery exception is individual to one participant and one switch request.
It may override only the four-period cooldown when the current primary account's
credential is verified lost, revoked, or compromised. It does not bypass identity
proofing, approved association, reviewer separation, target-account Tower Level
3 completion, the next weekly boundary, or transaction safeguards.

The request requires evidence of the credential event, an already approved
association to the target account, two ordinary reviewer approvals, and a third
authorization by a holder of the separate recovery permission. The recovery
reason, evidence, authorizers, prior primary, target primary, policy version,
and boundary are recorded in append-only history. Recovery never transfers XP,
Tower progression, assets, or prior allocations and never grants retroactive
weekly rewards.
