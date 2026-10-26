'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { planIdleCollection } = require('../../src/gameplay/idleCollection');

const start = '2026-01-01T00:00:00.000Z';
const end = '2026-01-01T01:00:00.000Z';
const building = (id, overrides = {}) => ({
  id, accountId: 'account-1', activity: 'active', buildingType: 'wheat_farm',
  level: 1, lastSettledAt: start, carryNumerator: '0', ...overrides
});
const plan = (buildings, settledAt = end) => planIdleCollection({
  accountId: 'account-1', buildings, settledAt
});

test('aggregates duplicate building types and reconciles ledger credits', () => {
  const result = plan([building('b'), building('a'), building('c', { buildingType: 'quarry' })]);
  assert.deepEqual(result.credits, [{ asset: 'stone', amount: '30' }, { asset: 'wheat', amount: '120' }]);
  assert.deepEqual(result.buildingUpdates.map(row => row.buildingId), ['a', 'b', 'c']);
  for (const credit of result.credits) {
    const ledgerTotal = result.ledgerEntries.filter(row => row.asset === credit.asset)
      .reduce((total, row) => total + BigInt(row.amount), 0n);
    assert.equal(ledgerTotal.toString(), credit.amount);
  }
});

test('settlement plan is deterministic, serializable, and does not change input', () => {
  const buildings = [building('b'), building('a')];
  const original = structuredClone(buildings);
  const result = plan(buildings);
  assert.deepEqual(buildings, original);
  assert.deepEqual(result, plan([...buildings].reverse()));
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  assert.ok(Object.isFrozen(result.buildingUpdates[0]));
});

test('fractional carry survives collection and an immediate repeat adds no credit', () => {
  const first = plan([building('a')], '2026-01-01T00:00:30.000Z');
  assert.equal(first.buildingUpdates[0].carryNumerator, '1800000');
  assert.deepEqual(first.ledgerEntries, []);
  const restored = building('a', first.buildingUpdates[0]);
  const repeated = plan([restored], first.settledAt);
  assert.equal(repeated.credits[0].amount, '0');
  const next = plan([restored], '2026-01-01T00:01:00.000Z');
  assert.equal(next.credits[0].amount, '1');
});

test('invalid ownership, duplicate ids, activity, and timestamps reject the batch without mutation', () => {
  for (const invalid of [
    building('b', { accountId: 'other' }), building('a'),
    building('b', { activity: 'paused' }), building('b', { buildingType: 'unknown' }),
    building('b', { lastSettledAt: '2026-01-02T00:00:00.000Z' })
  ]) {
    const buildings = [building('a'), invalid];
    const original = structuredClone(buildings);
    assert.throws(() => plan(buildings));
    assert.deepEqual(buildings, original);
  }
  assert.throws(() => plan([]), /nonempty array/);
  assert.throws(() => planIdleCollection({ accountId: '', buildings: [building('a')], settledAt: end }), /accountId/);
});
