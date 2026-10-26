'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  CollectionConflictError,
  PostgresIdleCollectionService
} = require('../../src/gameplay/postgresIdleCollection');
const {
  fingerprintCollectionRequest,
  fingerprintGameplayRules,
  fingerprintUpgradeRequest,
  fingerprintRules
} = require('../../src/gameplay/ruleFingerprint');
const idleMigration = require('../../migrations/008_create_idle_collection_persistence');

const rules = [
  { building_type: 'wheat_farm', level: 1, asset_code: 'wheat', units_per_hour: 60, storage_limit_ms: 28_800_000 },
  { building_type: 'quarry', level: 1, asset_code: 'stone', units_per_hour: 30, storage_limit_ms: 28_800_000 }
];

test('rule fingerprint is deterministic across row order and changes with rule values', () => {
  const fingerprint = fingerprintRules('idle-test-v1', rules);
  assert.match(fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(fingerprintRules('idle-test-v1', [...rules].reverse()), fingerprint);
  assert.notEqual(fingerprintRules('idle-test-v1', rules, 2), fingerprint);
  assert.notEqual(fingerprintRules('idle-test-v1', [
    { ...rules[0], units_per_hour: 61 }, rules[1]
  ]), fingerprint);
  assert.notEqual(fingerprintRules('idle-test-v2', rules), fingerprint);
});

test('rule fingerprint rejects empty, duplicate, and malformed rule sets', () => {
  assert.throws(() => fingerprintRules('idle-v1', []), /nonempty array/);
  assert.throws(() => fingerprintRules('idle-v1', [rules[0], rules[0]]), /duplicate/);
  assert.throws(() => fingerprintRules('idle-v1', [{ ...rules[0], units_per_hour: 1.5 }]), /invalid fingerprint/);
});

test('canonical collection fingerprint binds account, ruleset, and rules fingerprint', () => {
  const request = {
    accountId: '123e4567-e89b-42d3-a456-426614174000',
    ruleSetId: 'a95b4a15-f621-4c4f-8908-12cb3e060001',
    rulesFingerprint: fingerprintRules('idle-test-v1', rules)
  };
  const fingerprint = fingerprintCollectionRequest(request);
  assert.match(fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(fingerprintCollectionRequest(request), fingerprint);
  assert.notEqual(fingerprintCollectionRequest({ ...request, accountId: '123e4567-e89b-42d3-a456-426614174001' }), fingerprint);
  assert.notEqual(fingerprintCollectionRequest({ ...request, ruleSetId: 'a95b4a15-f621-4c4f-8908-12cb3e060002' }), fingerprint);
  assert.notEqual(fingerprintCollectionRequest({ ...request, rulesFingerprint: 'f'.repeat(64) }), fingerprint);
});

test('full gameplay fingerprint binds mixed-level rules and upgrade costs', () => {
  const mixedRules = [...rules, ...rules.map((rule) => ({
    ...rule, level: 2, units_per_hour: rule.units_per_hour * 2,
    storage_limit_ms: 43_200_000
  }))];
  const costs = [
    { building_type: 'wheat_farm', from_level: 1, to_level: 2, asset_code: 'stone', amount: 120 },
    { building_type: 'wheat_farm', from_level: 1, to_level: 2, asset_code: 'wood', amount: 180 }
  ];
  const fingerprint = fingerprintGameplayRules('idle-test-v2', mixedRules, costs, 2);
  assert.equal(fingerprintGameplayRules(
    'idle-test-v2', [...mixedRules].reverse(), [...costs].reverse(), 2
  ), fingerprint);
  assert.notEqual(fingerprintGameplayRules('idle-test-v2', mixedRules, [
    { ...costs[0], amount: 121 }, costs[1]
  ], 2), fingerprint);

  const request = {
    accountId: '123e4567-e89b-42d3-a456-426614174000',
    ruleSetId: 'a95b4a15-f621-4c4f-8908-12cb3e060002',
    rulesFingerprint: fingerprint,
    buildingType: 'wheat_farm',
    fromLevel: 1,
    toLevel: 2
  };
  const requestFingerprint = fingerprintUpgradeRequest(request);
  assert.match(requestFingerprint, /^[0-9a-f]{64}$/);
  assert.notEqual(fingerprintUpgradeRequest({ ...request, buildingType: 'quarry' }),
    requestFingerprint);
});

test('collection input rejects missing or malformed identity and fingerprint before connecting', async () => {
  let connections = 0;
  const service = new PostgresIdleCollectionService({
    async connect() { connections += 1; throw new Error('must not connect'); }
  });
  const valid = {
    accountId: '123e4567-e89b-42d3-a456-426614174000',
    idempotencyKey: 'collect-1',
    expectedRulesFingerprint: fingerprintRules('idle-test-v1', rules)
  };
  await assert.rejects(service.collect({ ...valid, expectedRulesFingerprint: 'invalid' }), /fingerprint/);
  await assert.rejects(service.collect({ ...valid, accountId: 'client-id' }), /trusted server authentication/);
  await assert.rejects(service.collect({ ...valid, idempotencyKey: '' }), /idempotencyKey/);
  assert.equal(connections, 0);
});

test('building upgrade retries the complete transaction only for bounded deadlocks with the same input', async () => {
  const service = new PostgresIdleCollectionService({ async connect() {} });
  const input = {
    accountId: '123e4567-e89b-42d3-a456-426614174000',
    buildingType: 'wheat_farm',
    targetLevel: 2,
    idempotencyKey: 'upgrade-retry-1',
    expectedRulesFingerprint: 'a'.repeat(64)
  };
  let attempts = 0;
  service.upgradeBuildingOnce = async (received) => {
    attempts += 1;
    assert.strictEqual(received, input);
    if (attempts < 3) throw Object.assign(new Error('deadlock'), { code: '40P01' });
    return { replayed: false };
  };
  assert.deepEqual(await service.upgradeBuilding(input), { replayed: false });
  assert.equal(attempts, 3);

  service.upgradeBuildingOnce = async () => {
    attempts += 1;
    throw Object.assign(new Error('still deadlocked'), { code: '40P01' });
  };
  attempts = 0;
  await assert.rejects(service.upgradeBuilding(input), { code: '40P01' });
  assert.equal(attempts, 3);

  service.upgradeBuildingOnce = async () => {
    attempts += 1;
    throw Object.assign(new Error('not retryable'), { code: '23505' });
  };
  attempts = 0;
  await assert.rejects(service.upgradeBuilding(input), { code: '23505' });
  assert.equal(attempts, 1);
});

test('fingerprint conflicts expose a stable conflict code and status', () => {
  const error = new CollectionConflictError('fingerprint mismatch');
  assert.equal(error.code, 'IDEMPOTENCY_CONFLICT');
  assert.equal(error.status, 409);
});

test('idle migration seeds only the five approved level-one prototype material rules', async () => {
  const calls = [];
  const storedRules = [];
  let ruleset;
  const db = {
    async query(sql, values = []) {
      const statement = sql.replace(/\s+/g, ' ').trim();
      calls.push(statement);
      if (statement.startsWith('INSERT INTO building_rule_sets')) {
        ruleset = { id: values[0], fingerprint: values[2] };
      } else if (statement.startsWith('SELECT id, fingerprint FROM building_rule_sets')) {
        return { rows: [{ id: ruleset.id, fingerprint: ruleset.fingerprint }] };
      } else if (statement.startsWith('INSERT INTO building_level_rules')) {
        storedRules.push({
          rule_set_id: values[0], building_type: values[1], level: values[2],
          asset_code: values[3], units_per_hour: values[4], storage_limit_ms: values[5]
        });
      } else if (statement.startsWith('SELECT building_type, level, asset_code')) {
        return {
          rows: storedRules.map(({ rule_set_id, ...rule }) => ({
            ...rule,
            units_per_hour: String(rule.units_per_hour),
            storage_limit_ms: String(rule.storage_limit_ms)
          }))
        };
      }
      return { rows: [] };
    }
  };

  await idleMigration.up(db);
  assert.equal(storedRules.length, 5);
  assert.equal(storedRules.every((rule) =>
    rule.level === 1 && rule.storage_limit_ms === 28_800_000
  ), true);
  assert.equal(storedRules.some((rule) =>
    rule.building_type === 'doncella_bank' || rule.asset_code === '$DONCELLA'
  ), false);
  assert.equal(calls.some((sql) => sql.includes('rule_set_id, rules_fingerprint')), true);
});
