'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAdminVerificationChecklist, validateResolveAppealInput } = require('./adminVerification');

function validInput(overrides = {}) {
  return {
    caseId: '5001', reviewerAccountId: '1001', expectedVersion: 3,
    outcome: 'overturned', reasonCode: 'INDEPENDENT_ACCOUNT_CONTROLLERS',
    decisionNote: ' Reviewed evidence supports independent users. ',
    evidenceIds: ['123', '124'], idempotencyKey: 'appeal-5001-v3', ...overrides
  };
}

test('validates and canonicalizes a resolve-appeal contract', () => {
  const result = validateResolveAppealInput(validInput());
  assert.equal(result.caseId, '5001');
  assert.equal(result.decisionNote, 'Reviewed evidence supports independent users.');
  assert.deepEqual(result.evidenceIds, ['123', '124']);
  assert.ok(Object.isFrozen(result));
});

test('rejects numeric identifiers instead of coercing them', () => {
  assert.throws(() => validateResolveAppealInput(validInput({ caseId: 5001 })), TypeError);
  assert.throws(() => validateResolveAppealInput(validInput({ reviewerAccountId: 1001 })), TypeError);
  assert.throws(() => validateResolveAppealInput(validInput({ evidenceIds: ['123', 124] })), TypeError);
});

test('rejects missing, array, null, and mistyped inputs', () => {
  for (const input of [undefined, null, [], 'payload']) {
    assert.throws(() => validateResolveAppealInput(input), TypeError);
  }
  assert.throws(() => validateResolveAppealInput(validInput({ expectedVersion: '3' })), TypeError);
  assert.throws(() => validateResolveAppealInput(validInput({ decisionNote: 42 })), TypeError);
  assert.throws(() => validateResolveAppealInput(validInput({ evidenceIds: '123' })), TypeError);
});

test('rejects stale vocabulary, duplicate evidence, and invalid keys', () => {
  assert.throws(() => validateResolveAppealInput(validInput({ outcome: 'create_association' })), TypeError);
  assert.throws(() => validateResolveAppealInput(validInput({ reasonCode: 'UNAPPROVED_CODE' })), TypeError);
  assert.throws(() => validateResolveAppealInput(validInput({ evidenceIds: ['123', '123'] })), TypeError);
  assert.throws(() => validateResolveAppealInput(validInput({ idempotencyKey: 'bad key' })), TypeError);
});

test('checklist uses appeal meanings and forbids adjacent mutations', () => {
  const checklist = buildAdminVerificationChecklist(validInput({ outcome: 'approved' }));
  assert.equal(checklist.operation, 'RESOLVE_APPEAL');
  assert.equal(checklist.outcomeMeaning, 'ORIGINAL_DECISION_UPHELD');
  assert.ok(checklist.checks.some((item) => item.includes('Do not create, delete, correct, or move')));
  assert.ok(checklist.checks.some((item) => item.includes('reward groups')));
});
