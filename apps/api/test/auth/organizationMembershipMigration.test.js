'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const migration = require('../../migrations/013_create_organization_memberships');

test('organization membership migration creates empty, fail-closed access-control storage', async () => {
  const statements = [];
  await migration.up({
    async query(sql) {
      statements.push(sql);
      return { rows: [] };
    }
  });

  assert.equal(statements.length, 1);
  const sql = statements.join('\n');
  assert.match(sql, /CREATE TABLE organization_memberships/);
  assert.match(sql, /organization_id INTEGER NOT NULL[\s\S]*REFERENCES organizations\(id\) ON DELETE RESTRICT/);
  assert.match(sql, /account_id UUID NOT NULL[\s\S]*REFERENCES authenticated_accounts\(id\) ON DELETE RESTRICT/);
  assert.match(sql, /role IN \('owner', 'admin', 'editor', 'viewer'\)/);
  assert.match(sql, /status VARCHAR\(16\) NOT NULL DEFAULT 'pending'/);
  assert.match(sql, /status IN \('pending', 'active', 'revoked'\)/);
  assert.match(sql, /PRIMARY KEY \(organization_id, account_id\)/);
  assert.match(sql, /WHERE status = 'active'/);
  assert.doesNotMatch(sql, /INSERT\s+INTO\s+organization_memberships/i,
    'the migration must never assign an owner automatically');
});

test('membership rollback removes only the membership table', async () => {
  const statements = [];
  await migration.down({
    async query(sql) {
      statements.push(sql);
    }
  });
  assert.deepEqual(statements, ['DROP TABLE IF EXISTS organization_memberships']);
});
