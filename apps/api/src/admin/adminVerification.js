'use strict';

/**
 * Read-only contract validator and checklist generator for appeal resolution.
 * It performs no authentication, persistence, association, reward, snapshot,
 * or payout work.
 */
const APPEAL_OUTCOMES = new Set(['approved', 'overturned']);
// This is a closed, provisional set for the contract artifact, not a complete
// approved policy catalog. Adding a code requires explicit policy approval.
const PROVISIONAL_SUPPORTED_REASON_CODES = new Set(['INDEPENDENT_ACCOUNT_CONTROLLERS']);
const MAX_DECISION_NOTE_LENGTH = 2000;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

function requirePlainObject(value, field) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value;
}

function requirePositiveId(value, field) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new TypeError(`${field} must be a positive integer string`);
  }
  return value;
}

function requireNonemptyString(value, field, maxLength) {
  if (typeof value !== 'string') {
    throw new TypeError(`${field} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new TypeError(`${field} must not be blank`);
  }
  if (normalized.length > maxLength) {
    throw new TypeError(`${field} must be at most ${maxLength} characters`);
  }
  return normalized;
}

function validateResolveAppealInput(input) {
  requirePlainObject(input, 'input');
  const caseId = requirePositiveId(input.caseId, 'caseId');
  const reviewerAccountId = requirePositiveId(input.reviewerAccountId, 'reviewerAccountId');

  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new TypeError('expectedVersion must be a positive safe integer');
  }
  if (typeof input.outcome !== 'string' || !APPEAL_OUTCOMES.has(input.outcome)) {
    throw new TypeError('outcome must be either approved or overturned');
  }
  if (
    typeof input.reasonCode !== 'string' ||
    !PROVISIONAL_SUPPORTED_REASON_CODES.has(input.reasonCode)
  ) {
    throw new TypeError('reasonCode must be a provisionally supported reason code');
  }

  const decisionNote = requireNonemptyString(input.decisionNote, 'decisionNote', MAX_DECISION_NOTE_LENGTH);
  const idempotencyKey = requireNonemptyString(
    input.idempotencyKey,
    'idempotencyKey',
    MAX_IDEMPOTENCY_KEY_LENGTH
  );
  if (!/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)) {
    throw new TypeError('idempotencyKey contains unsupported characters');
  }

  if (!Array.isArray(input.evidenceIds) || input.evidenceIds.length === 0) {
    throw new TypeError('evidenceIds must be a nonempty array');
  }
  const evidenceIds = input.evidenceIds.map((value, index) =>
    requirePositiveId(value, `evidenceIds[${index}]`)
  );
  if (new Set(evidenceIds).size !== evidenceIds.length) {
    throw new TypeError('evidenceIds must contain unique identifiers');
  }

  return Object.freeze({
    caseId,
    reviewerAccountId,
    expectedVersion: input.expectedVersion,
    outcome: input.outcome,
    reasonCode: input.reasonCode,
    decisionNote,
    evidenceIds: Object.freeze(evidenceIds),
    idempotencyKey
  });
}

function buildAdminVerificationChecklist(input) {
  const validated = validateResolveAppealInput(input);
  return Object.freeze({
    artifactStatus: 'CONTRACT_ONLY',
    mode: 'READ_ONLY_CHECKLIST',
    operation: 'RESOLVE_APPEAL',
    caseId: validated.caseId,
    outcome: validated.outcome,
    outcomeMeaning: validated.outcome === 'approved'
      ? 'ORIGINAL_DECISION_UPHELD'
      : 'APPEAL_SUCCEEDED',
    checks: Object.freeze([
      'Authenticate the reviewer and re-check reviews.resolve_appeal at the service boundary.',
      'Reject a reviewer whose account is involved in the case.',
      'Check the persisted idempotency record and canonical request fingerprint.',
      'Lock the appealed case and compare its version with expectedVersion.',
      'Confirm the pending appeal belongs to the case.',
      'Confirm every cited evidence record belongs to the case, is visible, and was reviewed.',
      'Preserve the original decision and append an immutable appeal-resolution event.',
      'Commit the case status, version, event, and idempotent result atomically.',
      'Do not create, delete, correct, or move a participant association.',
      'Do not change primary accounts, reward groups, eligibility, snapshots, or payouts.'
    ]),
    unresolvedPolicy: Object.freeze([
      'verification evidence and approval criteria',
      'exact weekly calendar boundary; Sunday 00:00 UTC is proposed',
      'primary-account switch approval procedure',
      'criteria and authorization for audited recovery exceptions'
    ])
  });
}

module.exports = { buildAdminVerificationChecklist, validateResolveAppealInput };
