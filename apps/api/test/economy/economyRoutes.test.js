'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { configuredEconomyApiEnabled, createApp } = require('../../src/app');

const accountId = '123e4567-e89b-42d3-a456-426614174010';
const listingId = '123e4567-e89b-42d3-a456-426614174020';

async function withServer(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

function authenticate(req, res, next) {
  if (req.get('authorization') !== 'Bearer test-token') {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication is required' } });
  }
  req.callerContext = { accountId };
  return next();
}

function economyApp(service) {
  return createApp({
    pool: {},
    gameplayApiEnabled: false,
    economyApiEnabled: true,
    economyService: service,
    economyAuthenticate: authenticate,
    communityAuthenticate: authenticate
  });
}

test('economy API flag defaults off and requires PostgreSQL, service, and authentication', () => {
  assert.equal(configuredEconomyApiEnabled({}), false);
  assert.equal(configuredEconomyApiEnabled({ ECONOMY_API_ENABLED: 'false' }), false);
  assert.equal(configuredEconomyApiEnabled({ ECONOMY_API_ENABLED: 'true' }), true);
  assert.throws(() => configuredEconomyApiEnabled({ ECONOMY_API_ENABLED: 'yes' }), /must be true or false/);
  assert.throws(() => createApp({ pool: null, economyApiEnabled: true }), /requires PostgreSQL/);
  assert.throws(() => createApp({ pool: {}, economyApiEnabled: true }),
    /requires the economy service and authenticated middleware/);
});

test('marketplace routes use only the authenticated account identity', async (t) => {
  const calls = [];
  const listing = { id: listingId, status: 'ACTIVE' };
  const service = {
    async listActive() {
      calls.push(['list']);
      return [listing];
    },
    async createListing(input) {
      calls.push(['create', input]);
      return listing;
    },
    async cancelListing(input) {
      calls.push(['cancel', input]);
      return { ...listing, status: 'CANCELLED' };
    },
    async purchaseListing(input) {
      calls.push(['purchase', input]);
      return { ...listing, status: 'COMPLETED', buyerAccountId: accountId };
    }
  };
  const baseUrl = await withServer(t, economyApp(service));
  const headers = { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' };

  const unauthenticated = await fetch(`${baseUrl}/api/economy/marketplace/listings`);
  assert.equal(unauthenticated.status, 401);

  const forged = await fetch(`${baseUrl}/api/economy/marketplace/listings`, {
    method: 'POST',
    headers: { ...headers, 'Idempotency-Key': 'list-1' },
    body: JSON.stringify({
      accountId: '123e4567-e89b-42d3-a456-426614174099',
      equipmentId: 1,
      currencyType: '$DONCELLA',
      price: '25'
    })
  });
  assert.equal(forged.status, 400);
  assert.equal(calls.length, 0);

  const created = await fetch(`${baseUrl}/api/economy/marketplace/listings`, {
    method: 'POST',
    headers: { ...headers, 'Idempotency-Key': 'list-1' },
    body: JSON.stringify({ equipmentId: 1, currencyType: '$DONCELLA', price: '25' })
  });
  assert.equal(created.status, 201);
  assert.deepEqual(calls[0], ['create', {
    sellerAccountId: accountId,
    equipmentId: 1,
    currencyType: '$DONCELLA',
    price: '25',
    idempotencyKey: 'list-1'
  }]);

  const purchased = await fetch(`${baseUrl}/api/economy/marketplace/listings/${listingId}/purchase`, {
    method: 'POST',
    headers: { ...headers, 'Idempotency-Key': 'buy-1' },
    body: '{}'
  });
  assert.equal(purchased.status, 200);
  assert.deepEqual(calls[1], ['purchase', {
    buyerAccountId: accountId,
    listingId,
    idempotencyKey: 'buy-1'
  }]);
});

test('economy routes are not mounted while the feature flag is disabled', async (t) => {
  const baseUrl = await withServer(t, createApp({
    pool: null,
    gameplayApiEnabled: false,
    economyApiEnabled: false,
    communityAuthenticate: authenticate
  }));
  const response = await fetch(`${baseUrl}/api/economy/marketplace/listings`);
  assert.equal(response.status, 404);
});
