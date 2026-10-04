'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createAdminRouter } = require('./adminRouter');

function validBody(overrides = {}) {
  return {
    expectedVersion: 3,
    outcome: 'overturned',
    reasonCode: 'INDEPENDENT_ACCOUNT_CONTROLLERS',
    decisionNote: 'Reviewed evidence supports independent users.',
    evidenceIds: ['123', '124'],
    ...overrides
  };
}

function createSpyService(implementation = async (input) => ({ caseId: input.caseId })) {
  const calls = [];
  return {
    calls,
    service: {
      async resolveAppeal(input) {
        calls.push(input);
        return implementation(input);
      }
    }
  };
}

function authenticatedAs(accountId) {
  return (req, res, next) => {
    req.callerContext = { accountId, permissions: ['reviews.resolve_appeal'] };
    next();
  };
}

function rejectUnauthorized(req, res) {
  return res.status(403).json({ success: false, code: 'FORBIDDEN' });
}

async function withTestApp({ authenticateReviewer, reviewService }, run) {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', createAdminRouter({ authenticateReviewer, reviewService }));
  app.use((error, req, res, next) => {
    void req;
    void next;
    res.status(503).json({ success: false, code: 'TEST_ERROR_HANDLER', message: error.message });
  });

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });

  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function post(baseUrl, {
  caseId = '5001',
  body = validBody(),
  idempotencyKey = 'appeal-5001-v3'
} = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (idempotencyKey !== null) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  const response = await fetch(
    `${baseUrl}/api/admin/review-cases/${encodeURIComponent(caseId)}/resolve-appeal`,
    { method: 'POST', headers, body: JSON.stringify(body) }
  );
  return { response, payload: await response.json() };
}

test('missing caller context returns 401 without calling the service', async () => {
  const spy = createSpyService();
  await withTestApp({ authenticateReviewer: (req, res, next) => next(), reviewService: spy.service }, async (url) => {
    const { response, payload } = await post(url);
    assert.equal(response.status, 401);
    assert.equal(payload.code, 'UNAUTHORIZED');
    assert.equal(spy.calls.length, 0);
  });
});

test('test authentication rejects an unauthorized reviewer', async () => {
  const spy = createSpyService();
  await withTestApp({ authenticateReviewer: rejectUnauthorized, reviewService: spy.service }, async (url) => {
    const { response, payload } = await post(url);
    assert.equal(response.status, 403);
    assert.equal(payload.code, 'FORBIDDEN');
    assert.equal(spy.calls.length, 0);
  });
});

test('invalid reviewer and case identifiers return 400 without service calls', async () => {
  for (const scenario of [
    { accountId: 1001, caseId: '5001' },
    { accountId: '1001', caseId: 'not-an-id' },
    { accountId: '1001', caseId: '0' }
  ]) {
    const spy = createSpyService();
    await withTestApp({
      authenticateReviewer: authenticatedAs(scenario.accountId),
      reviewService: spy.service
    }, async (url) => {
      const { response, payload } = await post(url, { caseId: scenario.caseId });
      assert.equal(response.status, 400);
      assert.equal(payload.code, 'INVALID_INPUT');
      assert.equal(spy.calls.length, 0);
    });
  }
});

test('missing idempotency key returns 400 without calling the service', async () => {
  const spy = createSpyService();
  await withTestApp({ authenticateReviewer: authenticatedAs('1001'), reviewService: spy.service }, async (url) => {
    const { response, payload } = await post(url, { idempotencyKey: null });
    assert.equal(response.status, 400);
    assert.equal(payload.code, 'INVALID_INPUT');
    assert.equal(spy.calls.length, 0);
  });
});

test('invalid expectedVersion values return 400 without service calls', async () => {
  for (const expectedVersion of ['3', 0, -1, 1.5, null]) {
    const spy = createSpyService();
    await withTestApp({ authenticateReviewer: authenticatedAs('1001'), reviewService: spy.service }, async (url) => {
      const { response, payload } = await post(url, { body: validBody({ expectedVersion }) });
      assert.equal(response.status, 400);
      assert.equal(payload.code, 'INVALID_INPUT');
      assert.equal(spy.calls.length, 0);
    });
  }
});

test('valid request calls resolveAppeal exactly once with authenticated and validated input', async () => {
  const spy = createSpyService(async () => ({ status: 'overturned', version: 4 }));
  await withTestApp({ authenticateReviewer: authenticatedAs('1001'), reviewService: spy.service }, async (url) => {
    const { response, payload } = await post(url);
    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(spy.calls.length, 1);
    assert.deepEqual(spy.calls[0], {
      caseId: '5001',
      reviewerAccountId: '1001',
      expectedVersion: 3,
      outcome: 'overturned',
      reasonCode: 'INDEPENDENT_ACCOUNT_CONTROLLERS',
      decisionNote: 'Reviewed evidence supports independent users.',
      evidenceIds: ['123', '124'],
      idempotencyKey: 'appeal-5001-v3'
    });
  });
});

test('service errors reach the Express error handler', async () => {
  const spy = createSpyService(async () => {
    throw new Error('simulated service outage');
  });
  await withTestApp({ authenticateReviewer: authenticatedAs('1001'), reviewService: spy.service }, async (url) => {
    const { response, payload } = await post(url);
    assert.equal(response.status, 503);
    assert.equal(payload.code, 'TEST_ERROR_HANDLER');
    assert.equal(payload.message, 'simulated service outage');
    assert.equal(spy.calls.length, 1);
  });
});

test('service TypeErrors reach the Express error handler instead of becoming HTTP 400', async () => {
  const spy = createSpyService(async () => {
    throw new TypeError('simulated service type failure');
  });
  await withTestApp({ authenticateReviewer: authenticatedAs('1001'), reviewService: spy.service }, async (url) => {
    const { response, payload } = await post(url);
    assert.equal(response.status, 503);
    assert.equal(payload.code, 'TEST_ERROR_HANDLER');
    assert.equal(payload.message, 'simulated service type failure');
    assert.equal(spy.calls.length, 1);
  });
});

test('factory rejects missing service dependencies', () => {
  assert.throws(
    () => createAdminRouter({ authenticateReviewer: authenticatedAs('1001') }),
    /reviewService\.resolveAppeal must be a function/
  );
  assert.throws(
    () => createAdminRouter({ authenticateReviewer: authenticatedAs('1001'), reviewService: {} }),
    /reviewService\.resolveAppeal must be a function/
  );
  assert.throws(
    () => createAdminRouter({ reviewService: { resolveAppeal() {} } }),
    /authenticateReviewer must be a function/
  );
});
