'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { PostgresPassportIdentityStore } = require('../../src/auth/passportIdentityStore');
const migration = require('../../migrations/007_create_authenticated_accounts');

function createMockPool({ linked = true, communityLinked = false, failOnInsert = false } = {}) {
  const accounts = new Set();
  const identities = new Map();
  const statements = [];
  const clients = [];

  function client() {
    const instance = {
      released: false,
      async query(sql, values = []) {
        const normalized = sql.replace(/\s+/g, ' ').trim();
        statements.push({ sql: normalized, values });
        if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') {
          return { rows: [] };
        }
        if (normalized.startsWith('SELECT m.external_id AS member_id, NULL::varchar AS wallet_address FROM passport_community_member_bindings')) {
          return { rows: communityLinked ? [{
            member_id: 'passport-developer',
            wallet_address: null
          }] : [] };
        }
        if (normalized.startsWith('SELECT m.external_id AS member_id, b.wallet_address')) {
          return { rows: linked ? [{
            member_id: 'community-member-1',
            wallet_address: '0x1111111111111111111111111111111111111111'
          }] : [] };
        }
        if (normalized.startsWith('SELECT account_id FROM authenticated_account_identities')) {
          const accountId = identities.get(`${values[0]}\0${values[1]}`);
          return { rows: accountId ? [{ account_id: accountId }] : [] };
        }
        if (normalized === 'INSERT INTO authenticated_accounts (id) VALUES ($1)') {
          if (failOnInsert) throw new Error('account write failed');
          accounts.add(values[0]);
          return { rows: [] };
        }
        if (normalized.startsWith('INSERT INTO authenticated_account_identities')) {
          identities.set(`${values[0]}\0${values[1]}`, values[2]);
          return { rows: [] };
        }
        if (normalized.startsWith('SELECT COALESCE(jsonb_agg')) {
          return { rows: [{ properties: [] }] };
        }
        throw new Error(`Unexpected query: ${normalized}`);
      },
      release() {
        instance.released = true;
      }
    };
    clients.push(instance);
    return instance;
  }

  return {
    accounts,
    identities,
    statements,
    clients,
    pool: {
      async connect() { return client(); },
      async query(sql) { statements.push({ sql: sql.replace(/\s+/g, ' ').trim(), values: [] }); return { rows: [] }; }
    }
  };
}

test('creates one stable account for a linked Passport identity and locks its binding', async () => {
  const mock = createMockPool();
  const store = new PostgresPassportIdentityStore(mock.pool);
  const first = await store.findByIdentity('https://auth.example/', 'subject-1');
  const second = await store.findByIdentity('https://auth.example/', 'subject-1');

  assert.match(first.accountId, /^[0-9a-f-]{36}$/i);
  assert.equal(second.accountId, first.accountId);
  assert.equal(mock.accounts.size, 1);
  assert.equal(mock.identities.size, 1);
  assert.equal(first.memberId, 'community-member-1');
  assert.deepEqual(first.properties, []);
  assert.equal(mock.statements.some(({ sql }) => sql.includes('FOR UPDATE OF b')), true);
  assert.equal(mock.statements.filter(({ sql }) => sql === 'COMMIT').length, 2);
  assert.equal(mock.clients.every(({ released }) => released), true);
});

test('does not provision an account for an unlinked Passport identity', async () => {
  const mock = createMockPool({ linked: false });
  const store = new PostgresPassportIdentityStore(mock.pool);

  assert.equal(await store.findByIdentity('https://auth.example/', 'unknown-subject'), null);
  assert.equal(mock.accounts.size, 0);
  assert.equal(mock.identities.size, 0);
  assert.equal(mock.statements.some(({ sql }) => sql === 'COMMIT'), true);
});

test('resolves an explicitly linked community member without inventing a wallet binding', async () => {
  const mock = createMockPool({ linked: false, communityLinked: true });
  const store = new PostgresPassportIdentityStore(mock.pool);
  const identity = await store.findByIdentity('https://auth.example/', 'subject-1');

  assert.equal(identity.memberId, 'passport-developer');
  assert.equal(identity.walletAddress, null);
  assert.deepEqual(identity.properties, []);
  assert.equal(mock.accounts.size, 1);
  assert.equal(mock.statements.some(({ sql }) => sql.startsWith('SELECT COALESCE(jsonb_agg')), false);
});

test('rolls back and propagates account persistence failures', async () => {
  const mock = createMockPool({ failOnInsert: true });
  const store = new PostgresPassportIdentityStore(mock.pool);

  await assert.rejects(
    store.findByIdentity('https://auth.example/', 'subject-1'),
    /account write failed/
  );
  assert.equal(mock.statements.some(({ sql }) => sql === 'ROLLBACK'), true);
  assert.equal(mock.clients[0].released, true);
});

test('rejects malformed provider identifiers before opening a database connection', async () => {
  const mock = createMockPool();
  const store = new PostgresPassportIdentityStore(mock.pool);

  await assert.rejects(store.findByIdentity('', 'subject-1'), /passportIssuer/);
  await assert.rejects(store.findByIdentity('https://auth.example/', ''), /passportSubject/);
  await assert.rejects(store.findByIdentity('https://auth.example/', '   '), /passportSubject/);
  assert.equal(mock.clients.length, 0);
});

test('account migration defines unique provider identity mapping and restrictive ownership', async () => {
  const statements = [];
  await migration.up({ async query(sql) { statements.push(sql); } });
  const schema = statements.join('\n');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS authenticated_accounts/);
  assert.match(schema, /id UUID PRIMARY KEY/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS authenticated_account_identities/);
  assert.match(schema, /PRIMARY KEY \(provider, issuer, subject\)/);
  assert.match(schema, /REFERENCES authenticated_accounts\(id\) ON DELETE RESTRICT/);
  assert.match(schema, /btrim\(subject\) <> ''/);
});

test('community identity migration binds one Passport subject to one existing member', async () => {
  const migration = require('../../migrations/009_create_passport_community_member_bindings');
  const statements = [];
  await migration.up({ async query(sql) { statements.push(sql); } });
  const schema = statements.join('\n');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS passport_community_member_bindings/);
  assert.match(schema, /PRIMARY KEY \(passport_issuer, passport_subject\)/);
  assert.match(schema, /member_id INTEGER NOT NULL UNIQUE REFERENCES community_members\(id\)/);
  assert.match(schema, /passport_issuer ~ '\^https:/);
});
