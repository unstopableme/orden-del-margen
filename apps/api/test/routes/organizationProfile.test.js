'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const {
  createOrganizationProfileRouter
} = require('../../src/routes/organizations');

function createDatabase({ organizations = [], opportunities = [], failure = null, failureAt = null } = {}) {
  const calls = [];
  let releaseCount = 0;
  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values });

      if (failure && (!failureAt || sql.includes(failureAt))) {
        throw failure;
      }

      if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql.trim())) {
        return { rows: [] };
      }
      if (sql.includes('FROM organizations')) {
        return { rows: organizations };
      }

      if (sql.includes('FROM property_opportunities')) {
        return { rows: opportunities };
      }

      throw new Error(`Unexpected SQL in test: ${sql}`);
    },
    release() {
      releaseCount += 1;
    }
  };

  return {
    calls,
    client,
    get releaseCount() { return releaseCount; },
    async connect() { return client; }
  };
}

function authenticate(req, res, next) {
  if (req.get('authorization') !== 'Bearer test-token') {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication is required' }
    });
  }

  req.callerContext = { accountId: 'account-7' };
  return next();
}

function createAuthorizer({ allowed = true } = {}) {
  const calls = [];
  return {
    calls,
    authorize: async (input) => {
      calls.push(input);
      return allowed;
    }
  };
}

async function withTestServer({ db, authorizeOrganizationProfile }, run) {
  const app = express();
  app.use((req, res, next) => {
    req.db = db;
    next();
  });
  app.use('/api/organizations', createOrganizationProfileRouter({
    authenticate,
    authorizeOrganizationProfile
  }));
  app.use((error, req, res, next) => {
    void error;
    void req;
    void next;
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Request failed' }
    });
  });

  const server = await new Promise((resolve, reject) => {
    const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
    listeningServer.once('error', reject);
  });

  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function getProfile(baseUrl, organizationId, token = 'test-token') {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(
    `${baseUrl}/api/organizations/${encodeURIComponent(organizationId)}/profile`,
    { headers }
  );
  return { response, payload: await response.json() };
}

test('router cannot be created without authentication and organization authorization', () => {
  assert.throws(() => createOrganizationProfileRouter(), /authenticate must be a function/);
  assert.throws(
    () => createOrganizationProfileRouter({ authenticate }),
    /authorizeOrganizationProfile must be a function/
  );
});

test('unauthenticated requests receive 401 and do not query the database', async () => {
  const db = createDatabase({ organizations: [{ id: 7 }] });
  const authorizer = createAuthorizer();

  await withTestServer({ db, authorizeOrganizationProfile: authorizer.authorize }, async (baseUrl) => {
    const { response, payload } = await getProfile(baseUrl, '7', null);
    assert.equal(response.status, 401);
    assert.equal(payload.error.code, 'UNAUTHORIZED');
    assert.equal(db.calls.length, 0);
    assert.equal(authorizer.calls.length, 0);
  });
});

test('authenticated callers are denied access to organizations they cannot access', async () => {
  const db = createDatabase({ organizations: [{ id: 7 }] });
  const authorizer = createAuthorizer({ allowed: false });

  await withTestServer({ db, authorizeOrganizationProfile: authorizer.authorize }, async (baseUrl) => {
    const { response, payload } = await getProfile(baseUrl, '7');
    assert.equal(response.status, 403);
    assert.equal(payload.error.code, 'FORBIDDEN');
    assert.equal(db.calls.length, 2);
    assert.equal(db.calls[0].sql, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    assert.equal(db.calls[1].sql, 'ROLLBACK');
    assert.equal(db.releaseCount, 1);
    assert.equal(authorizer.calls.length, 1);
    assert.equal(authorizer.calls[0].organizationId, 7);
    assert.equal(authorizer.calls[0].callerContext.accountId, 'account-7');
    assert.equal(authorizer.calls[0].db, db.client);
  });
});

test('authorized requests return only allowlisted organization and opportunity fields', async () => {
  const organization = {
    id: 7,
    name: 'Café de la Doncella',
    legal_entity_name: 'Cafe de la Doncella LLC',
    ein: '12-3456789',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z'
  };
  const opportunities = [{
    id: 31,
    organization_id: 7,
    property_address: '123 Main Street',
    property_type: 'multifamily',
    property_size_sqft: 1200,
    property_units: 4,
    list_price: '450000.00',
    status: 'Lead',
    property_condition: 'good',
    seller_name: 'Private Seller',
    seller_phone: '555-0100',
    seller_email: 'seller@example.test',
    broker_name: 'Private Broker',
    broker_phone: '555-0101',
    broker_email: 'broker@example.test',
    notes: 'Internal negotiation notes'
  }];
  const db = createDatabase({ organizations: [organization], opportunities });
  const authorizer = createAuthorizer();

  await withTestServer({ db, authorizeOrganizationProfile: authorizer.authorize }, async (baseUrl) => {
    const { response, payload } = await getProfile(baseUrl, '7');

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(payload, {
      id: 7,
      name: 'Café de la Doncella',
      legal_entity_name: 'Cafe de la Doncella LLC',
      created_at: '2026-01-01T00:00:00.000Z',
      opportunities: [{
        id: 31,
        property_address: '123 Main Street',
        property_type: 'multifamily',
        property_size_sqft: 1200,
        property_units: 4,
        list_price: '450000.00',
        status: 'Lead',
        property_condition: 'good'
      }]
    });
    assert.equal(db.calls.length, 4);
    assert.equal(db.calls[0].sql, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    assert.match(db.calls[1].sql, /FROM organizations/);
    assert.match(db.calls[2].sql, /FROM property_opportunities/);
    assert.equal(db.calls[3].sql, 'COMMIT');
    assert.equal(db.releaseCount, 1);
    assert.equal(authorizer.calls.length, 1);
    assert.equal(authorizer.calls[0].organizationId, 7);
    assert.equal(authorizer.calls[0].db, db.client);
  });
});

test('rejects malformed organization IDs without calling the authorizer or database', async () => {
  const db = createDatabase();
  const authorizer = createAuthorizer();

  await withTestServer({ db, authorizeOrganizationProfile: authorizer.authorize }, async (baseUrl) => {
    const { response, payload } = await getProfile(baseUrl, '12abc');
    assert.equal(response.status, 400);
    assert.equal(payload.error.code, 'INVALID_ORGANIZATION_ID');
    assert.equal(db.calls.length, 0);
    assert.equal(authorizer.calls.length, 0);
  });
});

test('returns 404 only after the caller is authorized for a valid organization ID', async () => {
  const db = createDatabase();
  const authorizer = createAuthorizer();

  await withTestServer({ db, authorizeOrganizationProfile: authorizer.authorize }, async (baseUrl) => {
    const { response, payload } = await getProfile(baseUrl, '42');
    assert.equal(response.status, 404);
    assert.deepEqual(payload, { message: 'Organization not found' });
    assert.equal(db.calls.length, 3);
    assert.equal(db.calls[0].sql, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    assert.match(db.calls[1].sql, /FROM organizations/);
    assert.equal(db.calls[2].sql, 'COMMIT');
    assert.equal(db.releaseCount, 1);
    assert.equal(authorizer.calls.length, 1);
    assert.equal(authorizer.calls[0].db, db.client);
  });
});

test('database errors reach the generic API error handler', async () => {
  const db = createDatabase({
    failure: new Error('private database details'),
    failureAt: 'FROM organizations'
  });
  const authorizer = createAuthorizer();

  await withTestServer({ db, authorizeOrganizationProfile: authorizer.authorize }, async (baseUrl) => {
    const { response, payload } = await getProfile(baseUrl, '7');
    assert.equal(response.status, 500);
    assert.deepEqual(payload, {
      error: { code: 'INTERNAL_ERROR', message: 'Request failed' }
    });
    assert.equal(db.calls.length, 3);
    assert.equal(db.calls[0].sql, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    assert.match(db.calls[1].sql, /FROM organizations/);
    assert.equal(db.calls[2].sql, 'ROLLBACK');
    assert.equal(db.releaseCount, 1);
  });
});
