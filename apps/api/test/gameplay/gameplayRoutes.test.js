'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { configuredGameplayApiEnabled, createApp } = require('../../src/app');
const { CollectionConflictError } = require('../../src/gameplay/postgresIdleCollection');
const { MemoryRateLimitStore } = require('../../src/rateLimit');

const accountId = '123e4567-e89b-42d3-a456-426614174000';
const fingerprint = 'a'.repeat(64);

test('gameplay API feature flag defaults off and rejects ambiguous values', () => {
  assert.equal(configuredGameplayApiEnabled({}), false);
  assert.equal(configuredGameplayApiEnabled({ GAMEPLAY_API_ENABLED: 'false' }), false);
  assert.equal(configuredGameplayApiEnabled({ GAMEPLAY_API_ENABLED: 'true' }), true);
  assert.throws(() => configuredGameplayApiEnabled({ GAMEPLAY_API_ENABLED: 'yes' }),
    /must be true or false/);
});

async function withServer(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

function authenticatedCaller(req, res, next) {
  if (req.get('authorization') !== 'Bearer test-token') {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication is required' } });
  }
  req.callerContext = { accountId };
  return next();
}

function trustedTestCaller(req, res, next) {
  req.callerContext = { accountId };
  return next();
}

function enabledApp(service, authenticate = authenticatedCaller, {
  rateLimitStore = new MemoryRateLimitStore(),
  rateLimits
} = {}) {
  return createApp({
    pool: {},
    gameplayApiEnabled: true,
    gameplayCollectionService: service,
    gameplayAuthenticate: authenticate,
    rateLimitStore,
    rateLimits
  });
}

test('gameplay API requires PostgreSQL, a service, and authenticated middleware when enabled', () => {
  assert.throws(() => createApp({
    pool: null, gameplayApiEnabled: true,
    gameplayCollectionService: {}, gameplayAuthenticate: authenticatedCaller
  }), /requires PostgreSQL/);
  assert.throws(() => createApp({
    pool: {}, gameplayApiEnabled: true
  }), /requires the gameplay service and authenticated middleware/);
});

test('authenticated gameplay query, provisioning, and collection use only the caller account', async (t) => {
  const calls = [];
  const service = {
    async getAccountState(input) {
      calls.push(['query', input]);
      return { accountId, buildings: [], balances: [], ruleSet: { fingerprint } };
    },
    async provisionInitialBuildings(input) {
      calls.push(['provision', input]);
      return [{
        id: 'building-1', rule_set_id: 'rules-1', building_type: 'wheat_farm',
        level: 1, asset_code: 'wheat', activity_state: 'active',
        last_settled_at: new Date('2026-01-01T00:00:00Z'), carry_numerator: '0'
      }];
    },
    async collect(input) {
      calls.push(['collect', input]);
      return { accountId, rulesFingerprint: fingerprint, credits: [] };
    },
    async upgradeBuilding(input) {
      calls.push(['upgrade', input]);
      return { accountId, rulesFingerprint: fingerprint, building: { level: 2 } };
    }
  };
  const baseUrl = await withServer(t, enabledApp(service));
  const headers = { Authorization: 'Bearer test-token' };

  const queryResponse = await fetch(`${baseUrl}/api/gameplay/idle-collection`, { headers });
  assert.equal(queryResponse.status, 200);
  assert.deepEqual(await queryResponse.json(), {
    accountId, buildings: [], balances: [], ruleSet: { fingerprint }
  });
  assert.deepEqual(calls[0], ['query', { accountId }]);

  const provisionResponse = await fetch(`${baseUrl}/api/gameplay/idle-buildings/provision`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedRulesFingerprint: fingerprint })
  });
  assert.equal(provisionResponse.status, 200);
  assert.deepEqual(await provisionResponse.json(), {
    buildings: [{
      id: 'building-1', ruleSetId: 'rules-1', buildingType: 'wheat_farm',
      level: 1, assetCode: 'wheat', activity: 'active',
      lastSettledAt: '2026-01-01T00:00:00.000Z', carryNumerator: '0'
    }]
  });
  assert.deepEqual(calls[1], ['provision', { accountId, expectedRulesFingerprint: fingerprint }]);

  const collectionResponse = await fetch(`${baseUrl}/api/gameplay/idle-collection`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'collect-001'
    },
    body: JSON.stringify({ expectedRulesFingerprint: fingerprint })
  });
  assert.equal(collectionResponse.status, 200);
  assert.deepEqual(await collectionResponse.json(), {
    accountId, rulesFingerprint: fingerprint, credits: []
  });
  assert.deepEqual(calls[2], ['collect', {
    accountId, idempotencyKey: 'collect-001', expectedRulesFingerprint: fingerprint
  }]);

  const upgradeResponse = await fetch(`${baseUrl}/api/gameplay/idle-buildings/wheat_farm/upgrade`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'upgrade-001'
    },
    body: JSON.stringify({ expectedRulesFingerprint: fingerprint, targetLevel: 2 })
  });
  assert.equal(upgradeResponse.status, 200);
  assert.deepEqual(await upgradeResponse.json(), {
    accountId, rulesFingerprint: fingerprint, building: { level: 2 }
  });
  assert.deepEqual(calls[3], ['upgrade', {
    accountId,
    buildingType: 'wheat_farm',
    targetLevel: 2,
    idempotencyKey: 'upgrade-001',
    expectedRulesFingerprint: fingerprint
  }]);
});

test('gameplay routes require authentication and reject client-selected account IDs', async (t) => {
  let collectionCalls = 0;
  const service = {
    async getAccountState() {
      return { accountId, buildings: [], balances: [], ruleSet: { fingerprint } };
    },
    async provisionInitialBuildings() {
      return [];
    },
    async collect() {
      collectionCalls += 1;
      return {};
    }
  };
  const baseUrl = await withServer(t, enabledApp(service));

  const unauthenticated = await fetch(`${baseUrl}/api/gameplay/idle-collection`);
  assert.equal(unauthenticated.status, 401);

  const forgedAccount = await fetch(`${baseUrl}/api/gameplay/idle-collection`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'collect-002'
    },
    body: JSON.stringify({
      accountId: '123e4567-e89b-42d3-a456-426614174099',
      expectedRulesFingerprint: fingerprint
    })
  });
  assert.equal(forgedAccount.status, 400);
  assert.equal(collectionCalls, 0);
});

test('gameplay IP rate limit rejects requests before Passport authentication', async (t) => {
  let authenticationCalls = 0;
  const service = {
    async getAccountState() {
      throw new Error('service should not run');
    },
    async provisionInitialBuildings() {
      throw new Error('service should not run');
    },
    async collect() {
      throw new Error('service should not run');
    }
  };
  const authenticate = (req, res, next) => {
    authenticationCalls += 1;
    return authenticatedCaller(req, res, next);
  };
  const baseUrl = await withServer(t, enabledApp(service, authenticate, {
    rateLimits: { gameplay: { ip: { limit: 1, windowMs: 60_000 } } }
  }));

  const first = await fetch(`${baseUrl}/api/gameplay/idle-collection`);
  assert.equal(first.status, 401);
  const limited = await fetch(`${baseUrl}/api/gameplay/idle-collection`);
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, 'RATE_LIMITED');
  assert.equal(limited.headers.get('retry-after') !== null, true);
  assert.equal(authenticationCalls, 1);
});

test('gameplay account rate limit is shared across query, provisioning, and collection', async (t) => {
  let queryCalls = 0;
  let provisionCalls = 0;
  let collectionCalls = 0;
  const service = {
    async getAccountState() {
      queryCalls += 1;
      return { accountId, buildings: [], balances: [], ruleSet: { fingerprint } };
    },
    async provisionInitialBuildings() {
      provisionCalls += 1;
      return [];
    },
    async collect() {
      collectionCalls += 1;
      return {};
    }
  };
  const baseUrl = await withServer(t, enabledApp(service, trustedTestCaller, {
    rateLimits: {
      gameplay: {
        ip: { limit: 20, windowMs: 60_000 },
        account: { limit: 1, windowMs: 60_000 }
      }
    }
  }));

  const first = await fetch(`${baseUrl}/api/gameplay/idle-collection`, {
    headers: { Authorization: '******' }
  });
  assert.equal(first.status, 200, await first.clone().text());

  const limited = await fetch(`${baseUrl}/api/gameplay/idle-buildings/provision`, {
    method: 'POST',
    headers: { Authorization: '******', 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedRulesFingerprint: fingerprint })
  });
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, 'RATE_LIMITED');
  const collectionLimited = await fetch(`${baseUrl}/api/gameplay/idle-collection`, {
    method: 'POST',
    headers: {
      Authorization: '******',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'collect-rate-limited'
    },
    body: JSON.stringify({ expectedRulesFingerprint: fingerprint })
  });
  assert.equal(collectionLimited.status, 429);
  assert.equal(queryCalls, 1);
  assert.equal(provisionCalls, 0);
  assert.equal(collectionCalls, 0);
});

test('gameplay routes reject invalid bodies, fingerprints, and idempotency keys before service calls', async (t) => {
  let serviceCalls = 0;
  const service = {
    async getAccountState() {
      serviceCalls += 1;
      return { accountId, buildings: [], balances: [], ruleSet: { fingerprint } };
    },
    async provisionInitialBuildings() {
      serviceCalls += 1;
      return [];
    },
    async collect() {
      serviceCalls += 1;
      return {};
    }
  };
  const baseUrl = await withServer(t, enabledApp(service, trustedTestCaller));
  const headers = { 'Content-Type': 'application/json' };
  const invalidRequests = [
    {
      method: 'POST',
      path: '/api/gameplay/idle-collection',
      body: undefined,
      expectedMessage: 'expectedRulesFingerprint must be a lowercase SHA-256 fingerprint'
    },
    {
      method: 'POST',
      path: '/api/gameplay/idle-buildings/provision',
      body: [],
      expectedMessage: 'Request body must be a JSON object'
    },
    {
      method: 'POST',
      path: '/api/gameplay/idle-collection',
      body: {},
      expectedMessage: 'expectedRulesFingerprint must be a lowercase SHA-256 fingerprint'
    },
    {
      method: 'POST',
      path: '/api/gameplay/idle-buildings/provision',
      body: { expectedRulesFingerprint: 'A'.repeat(64) },
      expectedMessage: 'expectedRulesFingerprint must be a lowercase SHA-256 fingerprint'
    },
    {
      method: 'POST',
      path: '/api/gameplay/idle-collection',
      body: { expectedRulesFingerprint: fingerprint },
      expectedMessage: 'Idempotency-Key must contain 1-128 supported characters'
    },
    {
      method: 'POST',
      path: '/api/gameplay/idle-collection',
      headers: { 'Idempotency-Key': 'contains spaces' },
      body: { expectedRulesFingerprint: fingerprint },
      expectedMessage: 'Idempotency-Key must contain 1-128 supported characters'
    }
  ];

  for (const request of invalidRequests) {
    const response = await fetch(`${baseUrl}${request.path}`, {
      method: request.method,
      headers: { ...headers, ...request.headers },
      body: request.body === undefined ? undefined : JSON.stringify(request.body)
    });
    assert.equal(response.status, 400, await response.clone().text());
    assert.deepEqual(await response.json(), {
      error: { code: 'INVALID_REQUEST', message: request.expectedMessage }
    });
  }
  assert.equal(serviceCalls, 0);
});

test('gameplay collection maps idempotency conflicts to HTTP 409', async (t) => {
  const service = {
    async getAccountState() {
      return { accountId, buildings: [], balances: [], ruleSet: { fingerprint } };
    },
    async provisionInitialBuildings() {
      return [];
    },
    async collect() {
      throw new CollectionConflictError('Idempotency key conflicts');
    }
  };
  const baseUrl = await withServer(t, enabledApp(service));
  const response = await fetch(`${baseUrl}/api/gameplay/idle-collection`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'collect-003'
    },
    body: JSON.stringify({ expectedRulesFingerprint: fingerprint })
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'IDEMPOTENCY_CONFLICT');
});
