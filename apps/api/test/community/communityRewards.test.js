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
    authenticate: createCommunityAuthenticator({ 'member-token': 'member-1' })
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

function post(baseUrl, path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer member-token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

test('repeated and retried correct knowledge answers award exact points once', async () => {
  await withApp(async (baseUrl) => {
    const startingPoints = data.members[0].points;
    const startingScore = data.members[0].knowledgeScore;
    const first = await post(baseUrl, '/games/knowledge/answers', {
      challengeId: 'knowledge-1', option: 1
    });
    const retry = await post(baseUrl, '/games/knowledge/answers', {
      challengeId: 'knowledge-1', option: 1
    });
    assert.equal(first.status, 200);
    assert.equal((await first.json()).pointsAwarded, 50);
    assert.equal(retry.status, 200);
    assert.deepEqual(
      { ...(await retry.json()), member: undefined },
      { correct: true, pointsAwarded: 0, alreadyRewarded: true, member: undefined }
    );
    assert.equal(data.members[0].points, startingPoints + 50);
    assert.equal(data.members[0].knowledgeScore, startingScore + 50);
    assert.equal(data.knowledgeAwards.length, 1);
  });
});

test('concurrent correct knowledge submissions create one reward with exact totals', async () => {
  await withApp(async (baseUrl) => {
    const startingPoints = data.members[0].points;
    const responses = await Promise.all(Array.from({ length: 8 }, () =>
      post(baseUrl, '/games/knowledge/answers', { challengeId: 'knowledge-1', option: 1 })
    ));
    const payloads = await Promise.all(responses.map((response) => response.json()));
    assert.equal(payloads.filter((payload) => payload.pointsAwarded === 50).length, 1);
    assert.equal(payloads.filter((payload) => payload.alreadyRewarded).length, 7);
    assert.equal(data.members[0].points, startingPoints + 50);
    assert.equal(data.knowledgeAwards.length, 1);
  });
});

test('repeated and concurrent quest resolution awards one completion only', async () => {
  await withApp(async (baseUrl) => {
    const startingPoints = data.members[0].points;
    const responses = await Promise.all(Array.from({ length: 8 }, () =>
      post(baseUrl, '/quests/quest-1/resolve', {})
    ));
    assert.equal(responses.filter((response) => response.status === 200).length, 1);
    assert.equal(responses.filter((response) => response.status === 409).length, 7);
    assert.equal(data.members[0].points, startingPoints + 120);
    assert.equal(
      data.progressionEvents.filter((event) => event.type === 'community_quest' && event.memberId === 'member-1').length,
      1
    );
  });
});
