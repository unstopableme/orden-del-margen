'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { createPoolConfig } = require('../../src/databaseConfig');

const testUrl = process.env.TEST_DATABASE_URL;
const expectedTestDatabaseName = process.env.TEST_DATABASE_EXPECTED_NAME;

function databaseIdentity(value) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return { database: decodeURIComponent(parsed.pathname.slice(1)) };
  } catch {
    return null;
  }
}

const testIdentity = databaseIdentity(testUrl);
const skipReason = !testUrl
  ? 'TEST_DATABASE_URL is not configured'
  : (!testIdentity
      ? 'TEST_DATABASE_URL is invalid'
      : (process.env.TEST_DATABASE_PURPOSE !== 'disposable'
          ? 'TEST_DATABASE_PURPOSE must explicitly be disposable'
          : (!expectedTestDatabaseName || expectedTestDatabaseName !== testIdentity.database
              ? 'TEST_DATABASE_EXPECTED_NAME must exactly match the test URL database'
              : (!/test/i.test(testIdentity.database)
                  ? 'test database name must contain test'
                  : false))));

const runMigrations = require('../../src/migrate');
const data = require('../../src/data/communityData');
const { createCommunityAuthenticator } = require('../../src/auth/communityAuth');
const { PostgresCommunityPersistence } = require('../../src/data/postgresCommunityPersistence');
const { PostgresRateLimitStore } = require('../../src/rateLimit');
const { PostgresPassportIdentityStore } = require('../../src/auth/passportIdentityStore');

const baseline = Object.fromEntries(
  Object.entries(data).map(([key, value]) => [key, structuredClone(value)])
);

function resetData() {
  for (const [key, value] of Object.entries(baseline)) {
    data[key].splice(0, data[key].length, ...structuredClone(value));
  }
}

async function isolatedDatabase(t, prefix) {
  const schema = `${prefix}_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  assert.match(schema, /^community_[a-z0-9_]+$/);
  const connectionConfig = createPoolConfig({
    ...process.env,
    DATABASE_URL: testUrl,
    PGSSL_MODE: process.env.TEST_PGSSL_MODE || process.env.PGSSL_MODE
  });
  const admin = new Pool({ ...connectionConfig, max: 1 });
  const adminClient = await admin.connect();
  const actual = await adminClient.query('SELECT current_database() AS database_name');
  assert.equal(actual.rows[0].database_name, testIdentity.database);
  const lock = await adminClient.query(
    "SELECT pg_try_advisory_lock(hashtext('orden-del-margen-community-integration')) AS acquired"
  );
  assert.equal(lock.rows[0].acquired, true, 'integration database is already in use');

  await adminClient.query(`CREATE SCHEMA "${schema}"`);
  const pool = new Pool({
    ...connectionConfig,
    max: 20,
    options: `-c search_path=${schema}`
  });
  t.after(async () => {
    resetData();
    await pool.end();
    assert.match(schema, /^community_[a-z0-9_]+$/);
    await adminClient.query(`DROP SCHEMA "${schema}" CASCADE`);
    await adminClient.query(
      "SELECT pg_advisory_unlock(hashtext('orden-del-margen-community-integration'))"
    );
    adminClient.release();
    await admin.end();
  });
  await runMigrations(pool);
  resetData();
  const persistence = new PostgresCommunityPersistence(pool);
  await persistence.initialize(data, { seed: true });
  return { pool, persistence };
}

async function withHttpApp(pool, persistence, run) {
  const express = require('express');
  const { createCommunityRouter } = require('../../src/routes/community');
  const app = express();
  app.use(express.json());
  app.use('/api/community', createCommunityRouter({
    persistence,
    authenticate: createCommunityAuthenticator({ 'integration-session': 'member-1' })
  }));
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}/api/community`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function apiRequest(baseUrl, pathName, { method = 'GET', body } = {}) {
  const headers = { Authorization: 'Bearer integration-session' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${baseUrl}${pathName}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

test('API state persists after the API and repository are recreated', { skip: skipReason }, async (t) => {
  const { pool, persistence } = await isolatedDatabase(t, 'community_restart_test');
  await withHttpApp(pool, persistence, async (baseUrl) => {
    assert.equal((await apiRequest(baseUrl, '/members/member-1/status', {
      method: 'PATCH', body: { status: 'Persisted after restart' }
    })).status, 200);
    assert.equal((await apiRequest(baseUrl, '/referrals', {
      method: 'POST', body: { inviteeName: 'Persistent neighbor' }
    })).status, 201);
    assert.equal((await apiRequest(baseUrl, '/coffee-gifts', {
      method: 'POST', body: { recipientId: 'member-2', message: 'Persistent thanks' }
    })).status, 201);
  });

  const restarted = new PostgresCommunityPersistence(pool);
  await restarted.reload(data);
  await withHttpApp(pool, restarted, async (baseUrl) => {
    const response = await apiRequest(baseUrl, '/dashboard');
    assert.equal(response.status, 200);
    const dashboard = await response.json();
    assert.equal(dashboard.member.status, 'Persisted after restart');
    assert.equal(dashboard.referrals.some((item) => item.inviteeName === 'Persistent neighbor'), true);
    assert.equal(dashboard.coffeeGifts.some((item) => item.message === 'Persistent thanks'), true);
  });
});

test('concurrent HTTP knowledge and quest requests grant each reward once', { skip: skipReason }, async (t) => {
  const { pool, persistence } = await isolatedDatabase(t, 'community_concurrency_test');
  const before = await pool.query("SELECT points, knowledge_score FROM community_members WHERE external_id='member-1'");

  await withHttpApp(pool, persistence, async (baseUrl) => {
    const knowledgeResponses = await Promise.all(Array.from({ length: 8 }, () =>
      apiRequest(baseUrl, '/games/knowledge/answers', {
        method: 'POST', body: { challengeId: 'knowledge-1', option: 1 }
      })
    ));
    const knowledgePayloads = await Promise.all(knowledgeResponses.map((response) => response.json()));
    assert.equal(knowledgeResponses.every((response) => response.status === 200), true);
    assert.equal(knowledgePayloads.filter((payload) => payload.pointsAwarded === 50).length, 1);
    assert.equal(knowledgePayloads.filter((payload) => payload.alreadyRewarded).length, 7);

    const questResponses = await Promise.all(Array.from({ length: 8 }, () =>
      apiRequest(baseUrl, '/quests/quest-1/resolve', { method: 'POST', body: {} })
    ));
    assert.equal(questResponses.filter((response) => response.status === 200).length, 1);
    assert.equal(questResponses.filter((response) => response.status === 409).length, 7);
  });

  const after = await pool.query("SELECT points, knowledge_score FROM community_members WHERE external_id='member-1'");
  assert.equal(after.rows[0].points, before.rows[0].points + 170);
  assert.equal(after.rows[0].knowledge_score, before.rows[0].knowledge_score + 50);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM knowledge_reward_claims')).rows[0].count, 1);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM progression_events WHERE source_type IN ('quest','knowledge_challenge')")).rows[0].count, 2);
});

test('reward transactions roll back claims, points, and quest state on event failures', { skip: skipReason }, async (t) => {
  const { pool, persistence } = await isolatedDatabase(t, 'community_atomicity_test');
  const before = await pool.query("SELECT points, knowledge_score FROM community_members WHERE external_id='member-1'");

  await pool.query(`ALTER TABLE progression_events ADD CONSTRAINT reject_knowledge_test
    CHECK (event_type <> 'knowledge_pvp')`);
  await assert.rejects(() => persistence.awardKnowledge('member-1', 'knowledge-1', 1));
  let member = await pool.query("SELECT points, knowledge_score FROM community_members WHERE external_id='member-1'");
  assert.deepEqual(member.rows[0], before.rows[0]);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM knowledge_reward_claims')).rows[0].count, 0);
  await pool.query('ALTER TABLE progression_events DROP CONSTRAINT reject_knowledge_test');

  await pool.query(`ALTER TABLE progression_events ADD CONSTRAINT reject_quest_test
    CHECK (event_type <> 'community_quest')`);
  await assert.rejects(() => persistence.resolveQuest('member-1', 'quest-1'));
  member = await pool.query("SELECT points, knowledge_score FROM community_members WHERE external_id='member-1'");
  assert.deepEqual(member.rows[0], before.rows[0]);
  const quest = await pool.query("SELECT status, resolved_by, resolved_at FROM community_quests WHERE external_id='quest-1'");
  assert.deepEqual(quest.rows[0], { status: 'open', resolved_by: null, resolved_at: null });
});

test('PostgreSQL rate limits are shared across application instances', { skip: skipReason }, async (t) => {
  const { pool } = await isolatedDatabase(t, 'community_rate_limit_test');
  const firstInstance = new PostgresRateLimitStore(pool);
  const secondInstance = new PostgresRateLimitStore(pool);
  assert.equal((await firstInstance.consume('shared-test', 'member-1', 2, 60_000)).allowed, true);
  assert.equal((await secondInstance.consume('shared-test', 'member-1', 2, 60_000)).allowed, true);
  const limited = await firstInstance.consume('shared-test', 'member-1', 2, 60_000);
  assert.equal(limited.allowed, false);
  assert.equal(limited.remaining, 0);
  assert.equal(limited.retryAfterSeconds > 0, true);
});

test('Passport subject maps through a server-owned wallet binding to properties', { skip: skipReason }, async (t) => {
  const { pool } = await isolatedDatabase(t, 'community_passport_mapping_test');
  const organization = await pool.query(`INSERT INTO organizations (name) VALUES ('Integration owner') RETURNING id`);
  const property = await pool.query(`INSERT INTO properties (organization_id, address, city, state)
    VALUES ($1, 'Verified integration property', 'Test City', 'CA') RETURNING id`,
  [organization.rows[0].id]);
  await pool.query(`INSERT INTO passport_wallet_bindings
    (passport_issuer, passport_subject, member_id, wallet_address)
    SELECT 'https://auth.immutable.com/', 'passport-subject-test', id,
      '0x1111111111111111111111111111111111111111'
    FROM community_members WHERE external_id='member-1'`);
  await pool.query(`INSERT INTO wallet_property_access (wallet_address, property_id, access_role)
    VALUES ('0x1111111111111111111111111111111111111111', $1, 'resident')`,
  [property.rows[0].id]);

  const identityStore = new PostgresPassportIdentityStore(pool);
  await identityStore.verifyReady();
  const identity = await identityStore.findByIdentity(
    'https://auth.immutable.com/', 'passport-subject-test'
  );
  assert.equal(identity.memberId, 'member-1');
  assert.equal(identity.walletAddress, '0x1111111111111111111111111111111111111111');
  assert.equal(identity.properties.length, 1);
  assert.equal(identity.properties[0].address, 'Verified integration property');
  assert.equal(await identityStore.findByIdentity(
    'https://different-issuer.example/', 'passport-subject-test'
  ), null);
  await pool.query(`UPDATE passport_wallet_bindings SET revoked_at=now(), revoked_by='integration-test'
    WHERE passport_issuer='https://auth.immutable.com/' AND passport_subject='passport-subject-test'`);
  assert.equal(await identityStore.findByIdentity(
    'https://auth.immutable.com/', 'passport-subject-test'
  ), null);
});
