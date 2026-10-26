'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  authorizeOrganizationProfile,
  verifyOrganizationMembershipSchema
} = require('../../src/auth/organizationAuthorization');

const accountId = '123e4567-e89b-42d3-a456-426614174000';

function createDb(rows = [], failure = null) {
  const calls = [];
  return {
    calls,
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (failure) throw failure;
      return { rows };
    }
  };
}

test('authorizer fails closed without a valid authenticated account or organization id', async () => {
  const db = createDb([{ allowed: true }]);
  for (const input of [
    { callerContext: null, organizationId: 7 },
    { callerContext: {}, organizationId: 7 },
    { callerContext: { accountId: 'not-a-uuid' }, organizationId: 7 },
    { callerContext: { accountId }, organizationId: 0 },
    { callerContext: { accountId }, organizationId: '7' },
    { callerContext: { accountId }, organizationId: 2_147_483_648 }
  ]) {
    assert.equal(await authorizeOrganizationProfile({ ...input, db }), false);
  }
  assert.equal(db.calls.length, 0);
});

test('authorizer queries by authenticated account id and grants only when an active membership exists', async () => {
  const db = createDb([{ '?column?': 1 }]);
  const allowed = await authorizeOrganizationProfile({
    callerContext: { accountId },
    organizationId: 7,
    db
  });

  assert.equal(allowed, true);
  assert.equal(db.calls.length, 1);
  assert.deepEqual(db.calls[0].values, [7, accountId]);
  assert.match(db.calls[0].sql, /organization_id = \$1/);
  assert.match(db.calls[0].sql, /account_id = \$2/);
  assert.match(db.calls[0].sql, /status = 'active'/);
  assert.match(db.calls[0].sql, /role IN \('owner', 'admin', 'editor', 'viewer'\)/);
});

test('missing, pending, or revoked memberships deny access', async () => {
  const db = createDb([]);
  assert.equal(await authorizeOrganizationProfile({
    callerContext: { accountId }, organizationId: 7, db
  }), false);
  assert.equal(db.calls.length, 1);
});

test('database errors are not converted into authorization grants', async () => {
  const db = createDb([], new Error('membership store unavailable'));
  await assert.rejects(
    authorizeOrganizationProfile({ callerContext: { accountId }, organizationId: 7, db }),
    /membership store unavailable/
  );
});

test('schema readiness check fails if the membership migration has not been applied', async () => {
  const db = createDb([]);
  await verifyOrganizationMembershipSchema(db);
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /FROM organization_memberships/);
  await assert.rejects(verifyOrganizationMembershipSchema(null), /db\.query must be a function/);
});
