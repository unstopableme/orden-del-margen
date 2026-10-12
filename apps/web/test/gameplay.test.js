import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createGameplayClient,
  estimatePendingProduction,
  gameplayErrorMessage,
  mountGameplay
} from '../src/gameplay.js';

function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

const accountA = '123e4567-e89b-42d3-a456-426614174000';
const accountB = '123e4567-e89b-42d3-a456-426614174001';
const fingerprintA = 'a'.repeat(64);
const fingerprintB = 'b'.repeat(64);

function accountState(accountId, fingerprint, provisioned = false) {
  const definitions = [
    ['wheat_farm', 'wheat', 60],
    ['lumber_mill', 'wood', 45],
    ['quarry', 'stone', 30],
    ['provisioner', 'food', 15],
    ['textile_mill', 'cloth', 15]
  ];
  return {
    accountId,
    ruleSet: {
      versionNumber: 1,
      fingerprint,
      rules: definitions.map(([buildingType, assetCode, unitsPerHour]) => ({
        buildingType, level: 1, assetCode, unitsPerHour, storageLimitMs: 28_800_000
      }))
    },
    buildings: provisioned ? definitions.map(([buildingType, assetCode]) => ({
      id: `${accountId}-${buildingType}`,
      buildingType,
      level: 1,
      assetCode,
      activity: 'active',
      lastSettledAt: '2026-10-12T00:00:00.000Z',
      carryNumerator: '0'
    })) : [],
    balances: []
  };
}

test('pending production estimate uses server rule, timestamp, carry, and storage cap', () => {
  const building = {
    buildingType: 'wheat_farm', level: 1, assetCode: 'wheat', activity: 'active',
    lastSettledAt: '2026-10-12T00:00:00.000Z', carryNumerator: '3000000'
  };
  const rule = {
    buildingType: 'wheat_farm', level: 1, assetCode: 'wheat',
    unitsPerHour: 60, storageLimitMs: 28_800_000
  };
  const estimate = estimatePendingProduction({
    building, rule, now: Date.parse('2026-10-12T00:02:00.000Z')
  });

  assert.deepEqual(estimate, {
    pendingUnits: '2',
    remainingCapacityMs: 28_680_000,
    remainingCapacityUnits: '478',
    millisecondsUntilNext: 10_000,
    storageFull: false
  });
});

test('pending production estimate stops at capacity and never changes collected balances', () => {
  const state = accountState(accountA, fingerprintA, true);
  const building = state.buildings[0];
  const rule = state.ruleSet.rules[0];
  const balancesBefore = structuredClone(state.balances);
  const estimate = estimatePendingProduction({
    building,
    rule,
    now: Date.parse('2026-10-12T12:00:00.000Z')
  });

  assert.deepEqual(estimate, {
    pendingUnits: '480',
    remainingCapacityMs: 0,
    remainingCapacityUnits: '0',
    millisecondsUntilNext: null,
    storageFull: true
  });
  assert.deepEqual(state.balances, balancesBefore);
});

class FakeRoot {
  set innerHTML(html) { this.html = html; }
  get innerHTML() { return this.html; }
  querySelectorAll() {
    return [...this.html.matchAll(/<button[^>]*data-action="([^"]+)"[^>]*>/g)]
      .map((match) => ({
        dataset: { action: match[1] },
        addEventListener: (event, listener) => {
          if (event === 'click') this[`click_${match[1]}`] = listener;
        }
      }));
  }
}

test('gameplay client reads account state and sends server rules fingerprint for provisioning', async () => {
  const calls = [];
  const client = createGameplayClient(async (path, options) => {
    calls.push({ path, options });
    return jsonResponse(200, path.endsWith('/provision')
      ? { buildings: [] }
      : accountState(accountA, fingerprintA));
  });

  await client.getAccountState();
  await client.provisionInitialBuildings('a'.repeat(64));

  assert.equal(calls[0].path, '/api/gameplay/idle-collection');
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[1].path, '/api/gameplay/idle-buildings/provision');
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    expectedRulesFingerprint: 'a'.repeat(64)
  });
});

test('collection retry retains its idempotency key until a successful response', async () => {
  const calls = [];
  let generatedKeys = 0;
  let collectionAttempts = 0;
  const client = createGameplayClient(async (path, options) => {
    if (options.method === 'GET') return jsonResponse(200, accountState(accountA, fingerprintA));
    calls.push({ path, options });
    collectionAttempts += 1;
    if (collectionAttempts === 1) {
      return jsonResponse(429, {
        error: { code: 'RATE_LIMITED', message: 'Too many requests' }
      }, { 'Retry-After': '3' });
    }
    return jsonResponse(200, { credits: [] });
  }, () => `collect-key-${++generatedKeys}`);

  await client.getAccountState();
  await assert.rejects(client.collect({
    accountId: accountA, expectedRulesFingerprint: fingerprintA
  }), { status: 429, code: 'RATE_LIMITED' });
  assert.deepEqual(await client.collect({
    accountId: accountA, expectedRulesFingerprint: fingerprintB
  }), { credits: [] });
  await client.collect({ accountId: accountA, expectedRulesFingerprint: fingerprintA });

  const keys = calls.map(({ options }) => options.headers['Idempotency-Key']);
  assert.deepEqual(keys, ['collect-key-1', 'collect-key-1', 'collect-key-2']);
  assert.deepEqual(calls.map(({ options }) => JSON.parse(options.body).expectedRulesFingerprint), [
    fingerprintA, fingerprintA, fingerprintA
  ]);
  assert.equal(generatedKeys, 2);
});

test('overlapping collection calls share one in-flight request and idempotency key', async () => {
  const calls = [];
  let resolveResponse;
  const client = createGameplayClient((path, options) => {
    if (options.method === 'GET') return Promise.resolve(jsonResponse(200, accountState(accountA, fingerprintA)));
    calls.push({ path, options });
    return new Promise((resolve) => { resolveResponse = resolve; });
  }, () => 'shared-key');

  await client.getAccountState();
  const first = client.collect({ accountId: accountA, expectedRulesFingerprint: fingerprintA });
  const second = client.collect({ accountId: accountA, expectedRulesFingerprint: fingerprintA });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 1);
  resolveResponse(jsonResponse(200, { credits: [] }));
  await Promise.all([first, second]);
  assert.equal(calls[0].options.headers['Idempotency-Key'], 'shared-key');
});

test('collection operations stay scoped to their original account across Passport identity changes', async () => {
  const calls = [];
  let identity = 'passport-subject-a';
  let generatedKeys = 0;
  let collectionAttempts = 0;
  const client = createGameplayClient(async (path, options) => {
    if (options.method === 'GET') {
      return jsonResponse(200, identity === 'passport-subject-a'
        ? accountState(accountA, fingerprintA)
        : accountState(accountB, fingerprintB));
    }
    calls.push({ path, options });
    collectionAttempts += 1;
    if (collectionAttempts === 1) throw new Error('connection lost after request');
    return jsonResponse(200, { credits: [] });
  }, () => `account-operation-${++generatedKeys}`, async () => identity);

  await client.getAccountState();
  await assert.rejects(client.collect({
    accountId: accountA, expectedRulesFingerprint: fingerprintA
  }), /connection lost/);
  identity = 'passport-subject-b';
  await client.getAccountState();
  await client.collect({ accountId: accountB, expectedRulesFingerprint: fingerprintB });
  identity = 'passport-subject-a';
  await client.getAccountState();
  await client.collect({ accountId: accountA, expectedRulesFingerprint: fingerprintB });

  assert.deepEqual(calls.map(({ options }) => options.headers['Idempotency-Key']), [
    'account-operation-1', 'account-operation-2', 'account-operation-3'
  ]);
  assert.deepEqual(calls.map(({ options }) => JSON.parse(options.body)), [
    { expectedRulesFingerprint: fingerprintA },
    { expectedRulesFingerprint: fingerprintB },
    { expectedRulesFingerprint: fingerprintB }
  ]);
});

test('a changed authenticated account cannot reuse the prior account operation', async () => {
  const calls = [];
  let activeAccountId = accountA;
  let generatedKeys = 0;
  let collectAttempts = 0;
  const client = createGameplayClient(async (path, options) => {
    if (options.method === 'GET') {
      return jsonResponse(200, accountState(
        activeAccountId,
        activeAccountId === accountA ? fingerprintA : fingerprintB
      ));
    }
    calls.push({ path, options });
    collectAttempts += 1;
    if (collectAttempts === 1) throw new Error('connection lost after request');
    return jsonResponse(200, { credits: [] });
  }, () => `mapped-account-operation-${++generatedKeys}`, async () => 'same-passport-subject');

  await client.getAccountState();
  await assert.rejects(client.collect({
    accountId: accountA, expectedRulesFingerprint: fingerprintA
  }), /connection lost/);
  activeAccountId = accountB;
  await client.getAccountState();
  await client.collect({ accountId: accountB, expectedRulesFingerprint: fingerprintB });

  assert.deepEqual(calls.map(({ options }) => options.headers['Idempotency-Key']), [
    'mapped-account-operation-1', 'mapped-account-operation-2'
  ]);
  assert.deepEqual(calls.map(({ options }) => JSON.parse(options.body)), [
    { expectedRulesFingerprint: fingerprintA },
    { expectedRulesFingerprint: fingerprintB }
  ]);
});

test('late account-state responses from a previous Passport session are discarded', async () => {
  let identity = 'passport-subject-a';
  let resolveOldState;
  let callNumber = 0;
  const client = createGameplayClient((path, options) => {
    callNumber += 1;
    if (callNumber === 1) {
      return new Promise((resolve) => { resolveOldState = resolve; });
    }
    if (options.method === 'POST') return Promise.resolve(jsonResponse(200, { credits: [] }));
    return Promise.resolve(jsonResponse(200, accountState(accountB, fingerprintB)));
  }, () => 'new-session-key', async () => identity);

  const oldSessionRequest = client.getAccountState();
  identity = 'passport-subject-b';
  const currentState = await client.getAccountState();
  resolveOldState(jsonResponse(200, accountState(accountA, fingerprintA)));

  await assert.rejects(oldSessionRequest, { status: 401, code: 'PASSPORT_SESSION_CHANGED' });
  assert.equal(currentState.accountId, accountB);
  await client.collect({ accountId: accountB, expectedRulesFingerprint: fingerprintB });
  assert.equal(callNumber, 3);
});

test('gameplay errors provide distinct guidance for Passport, conflict, and rate limits', () => {
  assert.match(gameplayErrorMessage({ status: 401 }), /Passport session expired/);
  assert.match(gameplayErrorMessage({
    status: 403,
    code: 'PASSPORT_IDENTITY_NOT_LINKED'
  }), /not linked/);
  assert.match(gameplayErrorMessage({ status: 409 }), /conflicted/);
  assert.match(gameplayErrorMessage({ status: 429, retryAfter: '4' }), /Retry in 4 seconds/);
});

test('gameplay panel stays unavailable without Passport in community demo mode', async () => {
  const root = { innerHTML: '' };
  let apiCalls = 0;

  await mountGameplay(root, {
    demoMode: true,
    passportFetch: async () => { apiCalls += 1; }
  });

  assert.match(root.innerHTML, /requires Passport authentication/);
  assert.match(root.innerHTML, /community demo remains available/);
  assert.equal(apiCalls, 0);
});

test('gameplay panel labels pending production as an estimate and keeps balances collected-only', async () => {
  const root = new FakeRoot();

  await mountGameplay(root, {
    getSessionIdentity: async () => 'passport-subject-a',
    passportFetch: async () => jsonResponse(200, accountState(accountA, fingerprintA, true))
  });

  assert.match(root.innerHTML, /local estimates from server timestamps and carry/i);
  assert.match(root.innerHTML, /Pending estimate/);
  assert.match(root.innerHTML, /Capacity remaining/);
  assert.match(root.innerHTML, /Next unit/);
  assert.match(root.innerHTML, /collected wheat/);
  assert.match(root.innerHTML, /collected balances change only after collection/i);
});

test('pending production and next-unit countdown advance without reload and stop at the storage cap', async () => {
  const root = new FakeRoot();
  const settledAt = Date.parse('2026-10-12T00:00:00.000Z');
  let currentTime = settledAt;
  let tick;
  let clearedTimer;
  const state = accountState(accountA, fingerprintA, true);
  state.balances = [{ assetCode: 'wheat', amount: '7' }];

  const dispose = await mountGameplay(root, {
    getSessionIdentity: async () => 'passport-subject-a',
    passportFetch: async () => jsonResponse(200, state),
    now: () => currentTime,
    setIntervalFn: (callback, delay) => {
      assert.equal(delay, 1000);
      tick = callback;
      return 42;
    },
    clearIntervalFn: (timer) => { clearedTimer = timer; }
  });

  assert.match(root.innerHTML, /Pending estimate<\/dt><dd>0 wheat/);
  assert.match(root.innerHTML, /Next unit<\/dt><dd>about 1m 0s/);
  assert.match(root.innerHTML, />7<span>collected wheat/);

  currentTime += 30_000;
  tick();
  assert.match(root.innerHTML, /Next unit<\/dt><dd>about 30s/);
  assert.match(root.innerHTML, /Pending estimate<\/dt><dd>0 wheat/);
  assert.match(root.innerHTML, />7<span>collected wheat/);

  currentTime += 30_000;
  tick();
  assert.match(root.innerHTML, /Pending estimate<\/dt><dd>1 wheat/);
  assert.match(root.innerHTML, /Next unit<\/dt><dd>about 1m 0s/);
  assert.match(root.innerHTML, />7<span>collected wheat/);

  currentTime = settledAt + 28_800_000;
  tick();
  assert.match(root.innerHTML, /Pending estimate<\/dt><dd>480 wheat/);
  assert.match(root.innerHTML, /Capacity remaining<\/dt><dd>Storage cap reached/);
  assert.match(root.innerHTML, /Next unit<\/dt><dd>Storage cap reached/);

  currentTime += 60_000;
  tick();
  assert.match(root.innerHTML, /Pending estimate<\/dt><dd>480 wheat/);
  assert.match(root.innerHTML, />7<span>collected wheat/);

  dispose();
  assert.equal(clearedTimer, 42);
});

test('collection changes balances and resets estimates only from the refreshed server state', async () => {
  const root = new FakeRoot();
  const settledAt = Date.parse('2026-10-12T00:00:00.000Z');
  let currentTime = settledAt + 60_000;
  let tick;
  let getCalls = 0;
  const beforeCollection = accountState(accountA, fingerprintA, true);
  beforeCollection.balances = [{ assetCode: 'wheat', amount: '7' }];
  const afterCollection = accountState(accountA, fingerprintA, true);
  afterCollection.buildings.forEach((building) => {
    building.lastSettledAt = '2026-10-12T00:01:00.000Z';
  });
  afterCollection.balances = [{ assetCode: 'wheat', amount: '8' }];

  await mountGameplay(root, {
    getSessionIdentity: async () => 'passport-subject-a',
    passportFetch: async (path, options) => {
      if (options.method === 'POST') return jsonResponse(200, { credits: [] });
      getCalls += 1;
      return jsonResponse(200, getCalls === 1 ? beforeCollection : afterCollection);
    },
    now: () => currentTime,
    setIntervalFn: (callback) => { tick = callback; return 43; },
    clearIntervalFn: () => {}
  });

  assert.match(root.innerHTML, /Pending estimate<\/dt><dd>1 wheat/);
  assert.match(root.innerHTML, />7<span>collected wheat/);

  currentTime += 30_000;
  tick();
  assert.match(root.innerHTML, />7<span>collected wheat/);

  await root.click_collect();
  assert.equal(getCalls, 2);
  assert.match(root.innerHTML, /Pending estimate<\/dt><dd>0 wheat/);
  assert.match(root.innerHTML, /Next unit<\/dt><dd>about 30s/);
  assert.match(root.innerHTML, />8<span>collected wheat/);
});

test('refresh reports completion and clears account data after authentication is lost', async () => {
  const root = new FakeRoot();
  let calls = 0;
  await mountGameplay(root, {
    getSessionIdentity: async () => 'passport-subject-a',
    passportFetch: async () => {
      calls += 1;
      if (calls === 1) return jsonResponse(200, accountState(accountA, fingerprintA, true));
      const error = new Error('Unauthorized');
      error.status = 401;
      throw error;
    }
  });

  await root.click_refresh();
  assert.match(root.innerHTML, /Passport session expired/);
  assert.doesNotMatch(root.innerHTML, /Wheat Farm/);
  assert.match(root.innerHTML, /data-action="refresh"/);
});

test('refresh reports success only after the account state was loaded', async () => {
  const root = new FakeRoot();
  await mountGameplay(root, {
    getSessionIdentity: async () => 'passport-subject-a',
    passportFetch: async () => jsonResponse(200, accountState(accountA, fingerprintA))
  });

  await root.click_refresh();
  assert.match(root.innerHTML, /Gameplay account refreshed/);
  assert.match(root.innerHTML, /gameplay-message success/);
});

test('refresh preserves server errors and does not report a successful refresh', async () => {
  const root = new FakeRoot();
  let calls = 0;
  await mountGameplay(root, {
    getSessionIdentity: async () => 'passport-subject-a',
    passportFetch: async () => {
      calls += 1;
      if (calls === 1) return jsonResponse(200, accountState(accountA, fingerprintA));
      return jsonResponse(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'Database unavailable' } });
    }
  });

  await root.click_refresh();
  assert.match(root.innerHTML, /Database unavailable/);
  assert.match(root.innerHTML, /gameplay-message error/);
  assert.match(root.innerHTML, /Wheat Farm/);
  assert.doesNotMatch(root.innerHTML, /Gameplay account refreshed/);
});

test('authentication loss during a gameplay action clears previously loaded account data', async () => {
  const root = new FakeRoot();
  let calls = 0;
  await mountGameplay(root, {
    getSessionIdentity: async () => 'passport-subject-a',
    passportFetch: async (path, options) => {
      calls += 1;
      if (options.method === 'GET') {
        return jsonResponse(200, accountState(accountA, fingerprintA, true));
      }
      const error = new Error('Unauthorized');
      error.status = 401;
      throw error;
    }
  });

  await root.click_collect();
  assert.match(root.innerHTML, /Passport session expired/);
  assert.doesNotMatch(root.innerHTML, /Wheat Farm/);
  assert.equal(calls, 2);
});

test('successful collection followed by failed refresh is not presented as full success', async () => {
  const root = new FakeRoot();
  let calls = 0;
  await mountGameplay(root, {
    getSessionIdentity: async () => 'passport-subject-a',
    passportFetch: async (path, options) => {
      calls += 1;
      if (options.method === 'GET') {
        if (calls === 1) return jsonResponse(200, accountState(accountA, fingerprintA, true));
        const error = new Error('Unauthorized');
        error.status = 401;
        throw error;
      }
      if (path === '/api/gameplay/idle-collection') return jsonResponse(200, { credits: [] });
      throw new Error('unexpected request');
    }
  });

  await root.click_collect();
  assert.match(root.innerHTML, /Collection completed, but account refresh failed/);
  assert.match(root.innerHTML, /gameplay-message error/);
  assert.doesNotMatch(root.innerHTML, /Wheat Farm/);
});
