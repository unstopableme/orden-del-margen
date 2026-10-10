'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const data = require('../../src/data/communityData');
const { createCommunityAuthenticator } = require('../../src/auth/communityAuth');
const { MemoryRateLimitStore } = require('../../src/rateLimit');
const { createCommunityRouter } = require('../../src/routes/community');

const originalData = Object.fromEntries(
  Object.entries(data).map(([key, value]) => [key, structuredClone(value)])
);
test.afterEach(() => {
  for (const [key, value] of Object.entries(originalData)) {
    data[key].splice(0, data[key].length, ...structuredClone(value));
  }
});

async function withApp(rateLimits, run) {
  const app = express();
  app.set('trust proxy', false);
  app.use(express.json());
  app.use('/api/community', createCommunityRouter({
    authenticate: createCommunityAuthenticator({ 'rate-token': 'member-1' }),
    rateLimitStore: new MemoryRateLimitStore(),
    rateLimits
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

test('authenticated limits return 429 and cannot be evaded with forwarded headers', async () => {
  await withApp({
    authenticated: { limit: 2, windowMs: 60_000 },
    rewards: { limit: 10, windowMs: 60_000 }
  }, async (baseUrl) => {
    for (const forwardedFor of ['198.51.100.1', '203.0.113.2']) {
      const response = await fetch(`${baseUrl}/dashboard`, {
        headers: { Authorization: 'Bearer rate-token', 'X-Forwarded-For': forwardedFor }
      });
      assert.equal(response.status, 200);
    }
    const limited = await fetch(`${baseUrl}/dashboard`, {
      headers: { Authorization: 'Bearer rate-token', 'X-Forwarded-For': '192.0.2.99' }
    });
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).error.code, 'RATE_LIMITED');
    assert.equal(limited.headers.get('retry-after') !== null, true);
  });
});

test('invalid-token attempts are limited before authentication and ignore spoofed forwarding headers', async () => {
  await withApp({
    authentication: { limit: 2, windowMs: 60_000 },
    authenticated: { limit: 20, windowMs: 60_000 },
    rewards: { limit: 10, windowMs: 60_000 }
  }, async (baseUrl) => {
    const before = structuredClone(data);
    for (const forwardedFor of ['198.51.100.11', '203.0.113.22']) {
      const response = await fetch(`${baseUrl}/dashboard`, {
        headers: { Authorization: 'Bearer invalid-token', 'X-Forwarded-For': forwardedFor }
      });
      assert.equal(response.status, 401);
    }
    const limited = await fetch(`${baseUrl}/dashboard`, {
      headers: { Authorization: 'Bearer another-invalid-token', 'X-Forwarded-For': '192.0.2.33' }
    });
    assert.equal(limited.status, 429);
    assert.deepEqual(data, before);
  });
});

test('reward limit rejects excess requests without a second reward mutation', async () => {
  await withApp({
    authenticated: { limit: 20, windowMs: 60_000 },
    rewards: { limit: 1, windowMs: 60_000 }
  }, async (baseUrl) => {
    const startingPoints = data.members[0].points;
    const request = () => fetch(`${baseUrl}/games/knowledge/answers`, {
      method: 'POST',
      headers: { Authorization: 'Bearer rate-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: 'knowledge-1', option: 1 })
    });
    assert.equal((await request()).status, 200);
    assert.equal((await request()).status, 429);
    assert.equal(data.members[0].points, startingPoints + 50);
    assert.equal(data.knowledgeAwards.length, 1);
  });
});
