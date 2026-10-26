'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  configuredOrganizationProfileApiEnabled,
  createApp
} = require('../../src/app');

function passThrough(req, res, next) {
  next();
}

function authenticate(req, res, next) {
  if (req.get('authorization') !== 'Bearer organization-test-token') {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication is required' }
    });
  }
  req.callerContext = { accountId: 'account-7' };
  return next();
}

async function withServer(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('organization profile feature flag defaults off and validates explicit values', () => {
  assert.equal(configuredOrganizationProfileApiEnabled({}), false);
  assert.equal(configuredOrganizationProfileApiEnabled({ ORGANIZATION_PROFILE_API_ENABLED: 'false' }), false);
  assert.equal(configuredOrganizationProfileApiEnabled({ ORGANIZATION_PROFILE_API_ENABLED: 'true' }), true);
  assert.throws(
    () => configuredOrganizationProfileApiEnabled({ ORGANIZATION_PROFILE_API_ENABLED: 'yes' }),
    /must be true or false/
  );
});

test('enabling organization profiles requires PostgreSQL, authentication, and authorization', () => {
  assert.throws(
    () => createApp({
      pool: null,
      gameplayApiEnabled: false,
      organizationProfileApiEnabled: true
    }),
    /requires PostgreSQL/
  );
  assert.throws(
    () => createApp({
      pool: {},
      gameplayApiEnabled: false,
      organizationProfileApiEnabled: true
    }),
    /requires authenticated middleware and organization authorization/
  );
});

test('organization profile route is not mounted when the feature flag is disabled', async (t) => {
  const app = createApp({
    pool: null,
    gameplayApiEnabled: false,
    economyApiEnabled: false,
    organizationProfileApiEnabled: false,
    communityAuthenticate: passThrough
  });
  const baseUrl = await withServer(t, app);
  const response = await fetch(`${baseUrl}/api/organizations/7/profile`);
  assert.equal(response.status, 404);
});

test('enabling the route wires the required authentication middleware', async (t) => {
  const app = createApp({
    pool: { async query() { return { rows: [] }; } },
    gameplayApiEnabled: false,
    economyApiEnabled: false,
    organizationProfileApiEnabled: true,
    organizationProfileAuthenticate: authenticate,
    authorizeOrganizationProfile: async () => true,
    communityAuthenticate: passThrough
  });
  const baseUrl = await withServer(t, app);
  const response = await fetch(`${baseUrl}/api/organizations/7/profile`);
  assert.equal(response.status, 401);
});