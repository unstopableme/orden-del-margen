'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../../src/app');
const { createCommunityAuthenticator } = require('../../src/auth/communityAuth');

test('community demo remains available while gameplay endpoints are not mounted', async (t) => {
  const app = createApp({
    pool: null,
    gameplayApiEnabled: false,
    communityAuthenticate: createCommunityAuthenticator({ 'demo-token': 'member-1' })
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const dashboard = await fetch(`${baseUrl}/api/community/dashboard`, {
    headers: { Authorization: 'Bearer demo-token' }
  });
  assert.equal(dashboard.status, 200);

  const gameplayQuery = await fetch(`${baseUrl}/api/gameplay/idle-collection`);
  assert.equal(gameplayQuery.status, 404);

  const gameplay = await fetch(`${baseUrl}/api/gameplay/idle-collection`, {
    method: 'POST',
    headers: { Authorization: 'Bearer demo-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 'client-selected-account' })
  });
  assert.equal(gameplay.status, 404);

  const provisioning = await fetch(`${baseUrl}/api/gameplay/idle-buildings/provision`, {
    method: 'POST',
    headers: { Authorization: '******', 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedRulesFingerprint: 'a'.repeat(64) })
  });
  assert.equal(provisioning.status, 404);
});
