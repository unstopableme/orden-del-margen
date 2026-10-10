'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');

async function withApp(run) {
  const app = createApp({ pool: null, allowedOrigins: new Set(['https://allowed.example']) });
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('allowed origins receive CORS headers and successful preflight', async () => {
  await withApp(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/community/members/member-1`, {
      headers: { Origin: 'https://allowed.example' }
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://allowed.example');

    const preflight = await fetch(`${baseUrl}/api/community/coffee-gifts`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://allowed.example', 'Access-Control-Request-Method': 'POST' }
    });
    assert.equal(preflight.status, 204);
    assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/);
  });
});

test('rejected origins receive no CORS grant and preflight is forbidden', async () => {
  await withApp(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/community/members/member-1`, {
      headers: { Origin: 'https://rejected.example' }
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), null);

    const preflight = await fetch(`${baseUrl}/api/community/coffee-gifts`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://rejected.example', 'Access-Control-Request-Method': 'POST' }
    });
    assert.equal(preflight.status, 403);
    assert.equal((await preflight.json()).error.code, 'CORS_ORIGIN_FORBIDDEN');
  });
});

test('CORS does not authorize a mutation', async () => {
  await withApp(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/community/referrals`, {
      method: 'POST',
      headers: { Origin: 'https://allowed.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteeName: 'No session' })
    });
    assert.equal(response.status, 401);
  });
});
