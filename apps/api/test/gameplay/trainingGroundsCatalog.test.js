'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { CATALOG, createSessionChallenges, shuffle } = require('../../src/gameplay/trainingGroundsCatalog');

test('training catalog selects server rules whose correct action depends on scenario state', () => {
  assert.equal(CATALOG.length, 5);
  for (const family of CATALOG) {
    assert.equal(family.variants.length, 2);
    assert.notEqual(family.variants[0].correctActionId, family.variants[1].correctActionId);
    for (const variant of family.variants) {
      assert.equal(variant.options.some(([actionId]) => actionId === variant.correctActionId), true);
      assert.equal(new Set(variant.options.map(([actionId]) => actionId)).size, 3);
    }
  }
});

test('session presentation persists an independently shuffled list with stable action IDs', () => {
  const challenges = createSessionChallenges({
    pickIndex: () => 0
  });
  assert.equal(challenges.length, 5);
  for (const challenge of challenges) {
    assert.equal(challenge.options.length, 3);
    assert.equal(new Set(challenge.options.map((option) => option.id)).size, 3);
    assert.equal(challenge.options.some((option) => option.id === challenge.correctActionId), true);
    assert.deepEqual(challenge.state, CATALOG[challenge.ordinal - 1].variants[0].state);
  }
  assert.notDeepEqual(
    challenges[0].options.map((option) => option.id),
    CATALOG[0].variants[0].options.map(([actionId]) => actionId)
  );
});

test('shuffle rejects invalid random indices instead of silently producing an order', () => {
  assert.throws(() => shuffle(['A', 'B', 'C'], () => 3), /outside the requested range/);
});
