'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const {
  createImmutablePassportAuthenticator,
  passportConfiguration
} = require('../../src/auth/immutablePassportAuth');
const { createCommunityRouter } = require('../../src/routes/community');

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const configuration = {
  clientId: 'passport-client-test',
  issuer: 'https://auth.immutable.test/',
  jwksUri: 'https://auth.immutable.test/.well-known/jwks.json'
};
const accountId = '5720dbec-7649-4815-80f9-79fffd08e75f';
const signingClient = {
  getSigningKey(keyId, callback) {
    if (keyId !== 'test-key') return callback(new Error('unknown key'));
    return callback(null, { getPublicKey: () => publicKey.export({ type: 'spki', format: 'pem' }) });
  }
};

function token(overrides = {}, options = {}) {
  return jwt.sign({ sid: 'passport-session-1', ...overrides }, privateKey, {
    algorithm: 'RS256',
    keyid: 'test-key',
    subject: options.subject || 'passport-user-1',
    issuer: options.issuer || configuration.issuer,
    audience: options.audience || configuration.clientId,
    expiresIn: options.expiresIn || '5m'
  });
}

async function withApp(identityStore, run, signingClientOverride = signingClient) {
  const app = express();
  app.use(express.json());
  app.post('/protected', createImmutablePassportAuthenticator({
    identityStore, configuration, signingClient: signingClientOverride
  }), (req, res) => res.json({ caller: req.callerContext, receivedWallet: req.body.walletAddress }));
  app.use((error, req, res, next) => {
    void req;
    if (res.headersSent) return next(error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Request failed' } });
  });
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('verified Passport subject resolves the server-owned wallet and member mapping', async () => {
  const lookups = [];
  const identityStore = {
    async findByIdentity(issuer, subject) {
      lookups.push([issuer, subject]);
      return {
        accountId,
        memberId: 'member-1',
        walletAddress: '0x1111111111111111111111111111111111111111',
        properties: [{ id: 7, address: 'Verified property' }]
      };
    }
  };
  await withApp(identityStore, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/protected`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: '00000000-0000-0000-0000-000000000000',
        walletAddress: '0xffffffffffffffffffffffffffffffffffffffff'
      })
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(lookups, [[configuration.issuer, 'passport-user-1']]);
    assert.equal(payload.caller.accountId, accountId);
    assert.equal(payload.caller.memberId, 'member-1');
    assert.equal(payload.caller.walletAddress, '0x1111111111111111111111111111111111111111');
    assert.equal(payload.receivedWallet, '0xffffffffffffffffffffffffffffffffffffffff');
  });
});

test('missing, invalid-audience, expired, and unlinked Passport tokens are rejected', async () => {
  const identityStore = { async findByIdentity() { return null; } };
  await withApp(identityStore, async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/protected`, { method: 'POST' })).status, 401);
    assert.equal((await fetch(`${baseUrl}/protected`, {
      method: 'POST', headers: { Authorization: `Bearer ${token({}, { audience: 'wrong-client' })}` }
    })).status, 401);
    assert.equal((await fetch(`${baseUrl}/protected`, {
      method: 'POST', headers: { Authorization: `Bearer ${token({}, { expiresIn: -10 })}` }
    })).status, 401);
    const unlinked = await fetch(`${baseUrl}/protected`, {
      method: 'POST', headers: { Authorization: `Bearer ${token()}` }
    });
    assert.equal(unlinked.status, 403);
    assert.equal((await unlinked.json()).error.code, 'PASSPORT_IDENTITY_NOT_LINKED');
  });
});

test('JWKS provider failures return 503 and remain distinct from invalid tokens', async () => {
  const identityStore = { async findByIdentity() { throw new Error('must not be called'); } };
  const unavailableSigningClient = {
    getSigningKey(keyId, callback) {
      assert.equal(keyId, 'test-key');
      callback(new Error('provider network unavailable'));
    }
  };
  await withApp(identityStore, async (baseUrl) => {
    const providerFailure = await fetch(`${baseUrl}/protected`, {
      method: 'POST', headers: { Authorization: `Bearer ${token()}` }
    });
    assert.equal(providerFailure.status, 503);
    assert.deepEqual(await providerFailure.json(), {
      error: {
        code: 'AUTH_PROVIDER_UNAVAILABLE',
        message: 'Passport authentication is temporarily unavailable'
      }
    });

    const invalid = await fetch(`${baseUrl}/protected`, {
      method: 'POST', headers: { Authorization: 'Bearer not-a-jwt' }
    });
    assert.equal(invalid.status, 401);
    assert.equal((await invalid.json()).error.code, 'UNAUTHORIZED');
  }, unavailableSigningClient);
});

test('blank Passport subjects are rejected before identity lookup', async () => {
  let lookups = 0;
  const identityStore = {
    async findByIdentity() {
      lookups += 1;
      return null;
    }
  };
  await withApp(identityStore, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/protected`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token({}, { subject: '   ' })}` }
    });
    assert.equal(response.status, 401);
    assert.equal(lookups, 0);
  });
});

test('identity persistence failures remain server errors instead of invalid-token responses', async () => {
  const identityStore = {
    async findByIdentity() {
      throw new Error('database unavailable');
    }
  };
  await withApp(identityStore, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/protected`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}` }
    });
    assert.equal(response.status, 500);
    assert.equal((await response.json()).error.code, 'INTERNAL_ERROR');
  });
});

test('a missing server-owned account mapping cannot authenticate as gameplay identity', async () => {
  const identityStore = {
    async findByIdentity() {
      return {
        accountId: 'not-a-uuid',
        memberId: 'member-1',
        walletAddress: '0x1111111111111111111111111111111111111111',
        properties: []
      };
    }
  };
  await withApp(identityStore, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/protected`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}` }
    });
    assert.equal(response.status, 500);
    assert.equal((await response.json()).error.code, 'INTERNAL_ERROR');
  });
});

test('sid is optional because issuer and subject establish the Passport identity', async () => {
  const identityStore = {
    async findByIdentity() {
      return {
        accountId,
        memberId: 'member-1',
        walletAddress: '0x1111111111111111111111111111111111111111',
        properties: []
      };
    }
  };
  await withApp(identityStore, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/protected`, {
      method: 'POST', headers: { Authorization: `Bearer ${token({ sid: undefined })}` }
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).caller.passportSessionId, null);
  });
});

test('a rotated JWKS key id is resolved without restarting the authenticator', async () => {
  const rotated = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const keys = new Map([
    ['test-key', publicKey],
    ['rotated-key', rotated.publicKey]
  ]);
  const rotatingClient = {
    getSigningKey(keyId, callback) {
      const key = keys.get(keyId);
      if (!key) return callback(new Error('unknown key'));
      return callback(null, { getPublicKey: () => key.export({ type: 'spki', format: 'pem' }) });
    }
  };
  const identityStore = {
    async findByIdentity() {
      return {
        accountId,
        memberId: 'member-1',
        walletAddress: '0x1111111111111111111111111111111111111111',
        properties: []
      };
    }
  };
  const app = express();
  app.post('/protected', createImmutablePassportAuthenticator({
    identityStore, configuration, signingClient: rotatingClient
  }), (req, res) => res.json({ subject: req.callerContext.passportSubject }));
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  try {
    const url = `http://127.0.0.1:${server.address().port}/protected`;
    assert.equal((await fetch(url, {
      method: 'POST', headers: { Authorization: `Bearer ${token()}` }
    })).status, 200);
    const rotatedToken = jwt.sign({ sid: 'rotated-session' }, rotated.privateKey, {
      algorithm: 'RS256', keyid: 'rotated-key', subject: 'passport-user-1',
      issuer: configuration.issuer, audience: configuration.clientId, expiresIn: '5m'
    });
    assert.equal((await fetch(url, {
      method: 'POST', headers: { Authorization: `Bearer ${rotatedToken}` }
    })).status, 200);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('Passport configuration requires audience, issuer, and HTTPS JWKS', () => {
  assert.throws(() => passportConfiguration({}), /CLIENT_ID/);
  assert.throws(() => passportConfiguration({ IMMUTABLE_PASSPORT_CLIENT_ID: 'client' }), /ISSUER/);
  assert.throws(() => passportConfiguration({
    IMMUTABLE_PASSPORT_CLIENT_ID: 'client',
    IMMUTABLE_PASSPORT_ISSUER: 'http://issuer.example'
  }), /ISSUER must use HTTPS/);
  assert.throws(() => passportConfiguration({
    IMMUTABLE_PASSPORT_CLIENT_ID: 'client',
    IMMUTABLE_PASSPORT_ISSUER: 'https://issuer.example',
    IMMUTABLE_PASSPORT_JWKS_URI: 'http://issuer.example/jwks'
  }), /HTTPS/);
});

test('authenticated property route returns only the server-owned Passport mapping', async () => {
  const identityStore = {
    async findByIdentity() {
      return {
        accountId,
        memberId: 'member-1',
        walletAddress: '0x1111111111111111111111111111111111111111',
        properties: [{ id: 7, address: 'Verified property', accessRole: 'member' }]
      };
    }
  };
  const app = express();
  app.use(express.json());
  app.use('/api/community', createCommunityRouter({
    authenticate: createImmutablePassportAuthenticator({ identityStore, configuration, signingClient })
  }));
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  try {
    const port = server.address().port;
    const unauthenticated = await fetch(`http://127.0.0.1:${port}/api/community/me/properties`);
    assert.equal(unauthenticated.status, 401);
    const response = await fetch(`http://127.0.0.1:${port}/api/community/me/properties?walletAddress=0xffffffffffffffffffffffffffffffffffffffff`, {
      headers: { Authorization: `Bearer ${token()}` }
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      walletAddress: '0x1111111111111111111111111111111111111111',
      data: [{ id: 7, address: 'Verified property', accessRole: 'member' }]
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
