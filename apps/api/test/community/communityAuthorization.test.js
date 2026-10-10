'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const data = require('../../src/data/communityData');
const { createCommunityAuthenticator } = require('../../src/auth/communityAuth');
const { createCommunityRouter } = require('../../src/routes/community');

const originalData = Object.fromEntries(
  Object.entries(data).map(([key, value]) => [key, structuredClone(value)])
);

function resetData() {
  for (const [key, value] of Object.entries(originalData)) {
    data[key].splice(0, data[key].length, ...structuredClone(value));
  }
}

test.afterEach(resetData);

async function withApp(run) {
  const app = express();
  app.use(express.json());
  app.use('/api/community', createCommunityRouter({
    authenticate: createCommunityAuthenticator({
      'token-member-1': 'member-1',
      'token-member-2': 'member-2'
    })
  }));
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function request(baseUrl, path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${baseUrl}/api/community${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

test('all community mutations reject unauthenticated requests without changing state', async () => {
  await withApp(async (baseUrl) => {
    const before = structuredClone(data);
    const attempts = [
      ['/members/member-1/status', 'PATCH', { status: 'forged' }],
      ['/members/member-1/profile', 'PATCH', { displayName: 'Forged', bio: '', topics: [] }],
      ['/referrals', 'POST', { inviteeName: 'Forged' }],
      ['/quests/quest-1/resolve', 'POST', {}],
      ['/coffee-gifts', 'POST', { recipientId: 'member-2', message: 'Forged' }],
      ['/games/knowledge/answers', 'POST', { challengeId: 'knowledge-1', option: 1 }]
    ];
    for (const [path, method, body] of attempts) {
      const response = await request(baseUrl, path, { method, body });
      assert.equal(response.status, 401, path);
      assert.equal((await response.json()).error.code, 'UNAUTHORIZED');
    }
    assert.deepEqual(data, before);
  });
});

test('an unknown token is rejected without mutation or credential logging', async () => {
  await withApp(async (baseUrl) => {
    const before = structuredClone(data);
    const captured = [];
    const originalError = console.error;
    console.error = (...values) => captured.push(values.join(' '));
    try {
      const response = await request(baseUrl, '/referrals', {
        method: 'POST', token: 'unknown-secret-token', body: { inviteeName: 'Forged' }
      });
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error.code, 'UNAUTHORIZED');
    } finally {
      console.error = originalError;
    }
    assert.deepEqual(data, before);
    assert.equal(captured.some((line) => line.includes('unknown-secret-token')), false);
  });
});

test('forged identities and cross-member profile mutations return 403 without mutation', async () => {
  await withApp(async (baseUrl) => {
    const before = structuredClone(data);
    const attempts = [
      ['/members/member-2/status', 'PATCH', { status: 'forged' }],
      ['/members/member-2/profile', 'PATCH', { displayName: 'Forged', bio: '', topics: [] }],
      ['/referrals', 'POST', { referrerId: 'member-2', inviteeName: 'Forged' }],
      ['/quests/quest-1/resolve', 'POST', { memberId: 'member-2' }],
      ['/coffee-gifts', 'POST', { senderId: 'member-2', recipientId: 'member-1', message: 'Forged' }],
      ['/games/knowledge/answers', 'POST', { memberId: 'member-2', challengeId: 'knowledge-1', option: 1 }]
    ];
    for (const [path, method, body] of attempts) {
      const response = await request(baseUrl, path, { method, body, token: 'token-member-1' });
      assert.equal(response.status, 403, path);
      assert.equal((await response.json()).error.code, 'FORBIDDEN');
    }
    assert.deepEqual(data, before);
  });
});

test('a non-member cannot resolve a community quest or receive points', async () => {
  data.quests.push({
    id: 'quest-other-community', communityId: 'viviendas-del-sol', title: 'Other',
    description: 'Other community only', topic: 'care', points: 75, status: 'open', resolvedBy: null
  });
  await withApp(async (baseUrl) => {
    const beforePoints = data.members[0].points;
    const beforeEvents = data.progressionEvents.length;
    const response = await request(baseUrl, '/quests/quest-other-community/resolve', {
      method: 'POST', token: 'token-member-1', body: {}
    });
    assert.equal(response.status, 403);
    assert.equal(data.members[0].points, beforePoints);
    assert.equal(data.progressionEvents.length, beforeEvents);
    assert.equal(data.quests.at(-1).status, 'open');
  });
});

test('valid authenticated members can mutate only as themselves', async () => {
  await withApp(async (baseUrl) => {
    const statusResponse = await request(baseUrl, '/members/member-1/status', {
      method: 'PATCH', token: 'token-member-1', body: { status: 'Authenticated' }
    });
    assert.equal(statusResponse.status, 200);
    assert.equal(data.members[0].status, 'Authenticated');

    const referralResponse = await request(baseUrl, '/referrals', {
      method: 'POST', token: 'token-member-1', body: { inviteeName: 'New neighbor' }
    });
    assert.equal(referralResponse.status, 201);
    assert.equal(data.referrals.at(-1).referrerId, 'member-1');

    const giftResponse = await request(baseUrl, '/coffee-gifts', {
      method: 'POST', token: 'token-member-1', body: { recipientId: 'member-2', message: 'Thank you' }
    });
    assert.equal(giftResponse.status, 201);
    assert.equal(data.coffeeGifts.at(-1).senderId, 'member-1');
  });
});

test('private dashboards require authentication and cannot be selected by memberId', async () => {
  await withApp(async (baseUrl) => {
    assert.equal((await request(baseUrl, '/dashboard')).status, 401);
    assert.equal((await request(baseUrl, '/dashboard?memberId=member-2', {
      token: 'token-member-1'
    })).status, 403);
    assert.equal((await request(baseUrl, '/dashboard', { token: 'token-member-1' })).status, 200);
  });
});

test('public member responses expose only the explicit public field set', async () => {
  await withApp(async (baseUrl) => {
    const response = await request(baseUrl, '/members/member-1');
    assert.equal(response.status, 200);
    const member = await response.json();
    assert.equal(member.id, 'member-1');
    assert.equal(member.communityIds, undefined);
  });
});
