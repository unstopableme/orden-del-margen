'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const weeklyPayout = require('../../src/gameplay/weeklyPayout');

const { calculateWeeklyMargenPayout } = weeklyPayout;

function assertConservation(result) {
  const allocated = result.allocations.reduce(
    (total, record) => total + BigInt(record.allocation),
    0n
  );
  assert.equal(allocated.toString(), result.allocatedTotal);
  assert.equal(
    (allocated + BigInt(result.retainedGameVaultBalance)).toString(),
    result.basePool
  );
}

test('exports and exercises the public CommonJS payout calculator', () => {
  assert.equal(typeof weeklyPayout.calculateWeeklyMargenPayout, 'function');
  const result = calculateWeeklyMargenPayout({ basePool: '0', participants: [] });
  assert.equal(result.asset, '$MARGEN');
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.allocations));
});

test('rejects invalid pool values', () => {
  for (const basePool of [undefined, null, -1, 1, '', '01', '-1', '1.5']) {
    assert.throws(() => calculateWeeklyMargenPayout({ basePool, participants: [] }), TypeError);
  }
});

test('rejects invalid and duplicate participant records', () => {
  assert.throws(
    () => calculateWeeklyMargenPayout({ basePool: '100', participants: 'not-an-array' }),
    TypeError
  );
  assert.throws(
    () => calculateWeeklyMargenPayout({ basePool: '100' }),
    /participants must be an array/
  );
  for (const participant of [null, [], 'participant']) {
    assert.throws(
      () => calculateWeeklyMargenPayout({ basePool: '100', participants: [participant] }),
      TypeError
    );
  }
  assert.throws(
    () => calculateWeeklyMargenPayout({
      basePool: '100',
      participants: [
        { participantId: 'p-1', weight: '1' },
        { participantId: 'p-1', weight: '2' }
      ]
    }),
    /duplicate participantId/
  );
});

test('rejects missing, blank, and numeric participant identifiers', () => {
  for (const participantId of [undefined, '', '   ', 123]) {
    assert.throws(
      () => calculateWeeklyMargenPayout({
        basePool: '100',
        participants: [{ participantId, weight: '1' }]
      }),
      /participantId must be a nonblank canonical string/
    );
  }
});

test('rejects missing, numeric, blank, and leading-zero weights', () => {
  for (const weight of [undefined, 1, '', ' ', '01', '00']) {
    assert.throws(
      () => calculateWeeklyMargenPayout({
        basePool: '100',
        participants: [{ participantId: 'p-1', weight }]
      }),
      /weight must be a canonical nonnegative decimal integer string/
    );
  }
});

test('rejects negative weights and accepts canonical zero weights', () => {
  assert.throws(
    () => calculateWeeklyMargenPayout({
      basePool: '100',
      participants: [{ participantId: 'p-1', weight: '-1' }]
    }),
    TypeError
  );

  const result = calculateWeeklyMargenPayout({
    basePool: '100',
    participants: [
      { participantId: 'p-zero', weight: '0' },
      { participantId: 'p-positive', weight: '1' }
    ]
  });
  assert.equal(result.allocations[0].allocation, '0');
  assert.equal(result.allocations[1].allocation, '5');
  assertConservation(result);
});

test('retains the full pool when total weight is zero', () => {
  const result = calculateWeeklyMargenPayout({
    basePool: '987654321',
    participants: [
      { participantId: 'p-1', weight: '0' },
      { participantId: 'p-2', weight: '0' }
    ]
  });
  assert.equal(result.totalWeight, '0');
  assert.equal(result.allocatedTotal, '0');
  assert.equal(result.retainedGameVaultBalance, '987654321');
  assertConservation(result);
});

test('retains a positive pool when the participant list is empty', () => {
  const result = weeklyPayout.calculateWeeklyMargenPayout({
    basePool: '12345',
    participants: []
  });
  assert.deepEqual(result.allocations, []);
  assert.equal(result.totalWeight, '0');
  assert.equal(result.allocatedTotal, '0');
  assert.equal(result.retainedGameVaultBalance, '12345');
  assertConservation(result);
});

test('uses integer flooring and retains fractional remainders', () => {
  const participants = Array.from({ length: 21 }, (_, index) => ({
    participantId: `p-${index + 1}`,
    weight: '1'
  }));
  const result = calculateWeeklyMargenPayout({ basePool: '101', participants });
  assert.equal(result.participantCap, '5');
  assert.ok(result.allocations.every((record) => record.allocation === '4'));
  assert.equal(result.allocatedTotal, '84');
  assert.equal(result.retainedGameVaultBalance, '17');
  assertConservation(result);
});

test('caps each participant at five percent without redistribution', () => {
  const result = calculateWeeklyMargenPayout({
    basePool: '1000',
    participants: [
      { participantId: 'heavy', weight: '19' },
      { participantId: 'light', weight: '1' }
    ]
  });
  assert.deepEqual(result.allocations, [
    {
      participantId: 'heavy', weight: '19', uncappedAllocation: '950',
      allocation: '50', capClipped: '900'
    },
    {
      participantId: 'light', weight: '1', uncappedAllocation: '50',
      allocation: '50', capClipped: '0'
    }
  ]);
  assert.equal(result.retainedGameVaultBalance, '900');
  assertConservation(result);
});

test('handles integers beyond Number.MAX_SAFE_INTEGER exactly', () => {
  const basePool = '10000000000000000000000000000000000000000';
  const result = calculateWeeklyMargenPayout({
    basePool,
    participants: Array.from({ length: 20 }, (_, index) => ({
      participantId: `large-${index + 1}`,
      weight: '999999999999999999999999999999999999999'
    }))
  });
  assert.equal(result.participantCap, '500000000000000000000000000000000000000');
  assert.ok(result.allocations.every((record) => record.allocation === result.participantCap));
  assert.equal(result.retainedGameVaultBalance, '0');
  assertConservation(result);
});
