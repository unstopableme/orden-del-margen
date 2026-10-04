'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const idleProduction = require('../../src/gameplay/idleProduction');

const { calculateIdleProduction } = idleProduction;

function at(milliseconds) {
  return new Date(Date.UTC(2026, 0, 1) + milliseconds).toISOString();
}

test('exports and exercises the public CommonJS calculator', () => {
  assert.equal(typeof idleProduction.calculateIdleProduction, 'function');
  assert.equal(calculateIdleProduction, idleProduction.calculateIdleProduction);
});

test('uses every documented hourly rate and the doncella_bank name', () => {
  const expected = {
    wheat_farm: [['wheat', '60'], ['wheat', '132']],
    lumber_mill: [['wood', '45'], ['wood', '100']],
    quarry: [['stone', '30'], ['stone', '66']],
    provisioner: [['food', '15'], ['food', '33']],
    textile_mill: [['cloth', '15'], ['cloth', '33']],
    doncella_bank: [['$DONCELLA', '10'], ['$DONCELLA', '25']]
  };

  for (const [buildingType, levels] of Object.entries(expected)) {
    levels.forEach(([asset, producedUnits], index) => {
      const result = calculateIdleProduction({
        buildingType,
        level: index + 1,
        lastSettledAt: at(0),
        settledAt: at(60 * 60 * 1000)
      });
      assert.equal(result.asset, asset);
      assert.equal(result.producedUnits, producedUnits);
      assert.equal(result.carryNumerator, '0');
    });
  }
});

test('repeated short collections equal one collection over the same uncapped duration', () => {
  let state = { lastSettledAt: at(0), carryNumerator: '0' };
  let repeatedUnits = 0n;

  for (let milliseconds = 250; milliseconds <= 60_000; milliseconds += 250) {
    const result = calculateIdleProduction({
      buildingType: 'wheat_farm', level: 1,
      lastSettledAt: state.lastSettledAt, settledAt: at(milliseconds),
      carryNumerator: state.carryNumerator
    });
    repeatedUnits += BigInt(result.producedUnits);
    state = result;
  }

  const once = calculateIdleProduction({
    buildingType: 'wheat_farm', level: 1,
    lastSettledAt: at(0), settledAt: at(60_000)
  });
  assert.equal(repeatedUnits.toString(), once.producedUnits);
  assert.equal(state.carryNumerator, once.carryNumerator);
  assert.equal(repeatedUnits.toString(), '1');
});

test('pays exactly at a whole-unit boundary', () => {
  const beforeBoundary = calculateIdleProduction({
    buildingType: 'wheat_farm', level: 1,
    lastSettledAt: at(0), settledAt: at(59_999)
  });
  const atBoundary = calculateIdleProduction({
    buildingType: 'wheat_farm', level: 1,
    lastSettledAt: at(0), settledAt: at(60_000)
  });
  assert.equal(beforeBoundary.producedUnits, '0');
  assert.equal(beforeBoundary.carryNumerator, '3599940');
  assert.equal(atBoundary.producedUnits, '1');
  assert.equal(atBoundary.carryNumerator, '0');
});

test('preserves partial seconds exactly across settlement and restoration', () => {
  const first = calculateIdleProduction({
    buildingType: 'lumber_mill', level: 1,
    lastSettledAt: at(0), settledAt: at(500)
  });
  const restored = JSON.parse(JSON.stringify(first));
  const second = calculateIdleProduction({
    buildingType: 'lumber_mill', level: 1,
    lastSettledAt: restored.lastSettledAt, settledAt: at(80_000),
    carryNumerator: restored.carryNumerator
  });
  assert.equal(first.producedUnits, '0');
  assert.equal(first.carryNumerator, '22500');
  assert.equal(second.producedUnits, '1');
  assert.equal(second.carryNumerator, '0');
});

test('applies the Level 1 eight-hour storage cap and reports discarded time', () => {
  const result = calculateIdleProduction({
    buildingType: 'wheat_farm', level: 1,
    lastSettledAt: at(0), settledAt: at(9 * 60 * 60 * 1000)
  });
  assert.equal(result.producedUnits, '480');
  assert.equal(result.activeMilliseconds, 8 * 60 * 60 * 1000);
  assert.equal(result.discardedMilliseconds, 60 * 60 * 1000);
});

test('applies the Level 2 twelve-hour storage cap', () => {
  const result = calculateIdleProduction({
    buildingType: 'wheat_farm', level: 2,
    lastSettledAt: at(0), settledAt: at(13 * 60 * 60 * 1000)
  });
  assert.equal(result.producedUnits, '1584');
  assert.equal(result.activeMilliseconds, 12 * 60 * 60 * 1000);
  assert.equal(result.discardedMilliseconds, 60 * 60 * 1000);
});

test('includes previously carried production while capping only new elapsed time', () => {
  const result = calculateIdleProduction({
    buildingType: 'wheat_farm', level: 1,
    lastSettledAt: at(0), settledAt: at(9 * 60 * 60 * 1000),
    carryNumerator: '3599999'
  });
  assert.equal(result.producedUnits, '480');
  assert.equal(result.carryNumerator, '3599999');
});

test('validates building type, level, timestamps, and carry state', () => {
  const valid = {
    buildingType: 'quarry', level: 1,
    lastSettledAt: at(0), settledAt: at(1_000), carryNumerator: '0'
  };
  assert.throws(() => calculateIdleProduction({ ...valid, buildingType: 'bronze_bank' }), /unsupported building type/);
  assert.throws(() => calculateIdleProduction({ ...valid, buildingType: 'toString' }), /unsupported building type/);
  assert.throws(() => calculateIdleProduction({ ...valid, level: 3 }), /unsupported level/);
  assert.throws(() => calculateIdleProduction({ ...valid, lastSettledAt: 'not-a-date' }), /canonical UTC ISO/);
  assert.throws(() => calculateIdleProduction({ ...valid, settledAt: at(-1) }), /must not be earlier/);
  assert.throws(() => calculateIdleProduction({ ...valid, carryNumerator: -1 }), /decimal integer string/);
  assert.throws(() => calculateIdleProduction({ ...valid, carryNumerator: '3600000' }), /must be less than/);
});

test('carry state survives JSON serialization and restoration without precision loss', () => {
  const first = calculateIdleProduction({
    buildingType: 'doncella_bank', level: 2,
    lastSettledAt: at(0), settledAt: at(123_456)
  });
  const restored = JSON.parse(JSON.stringify(first));
  const second = calculateIdleProduction({
    buildingType: 'doncella_bank', level: 2,
    lastSettledAt: restored.lastSettledAt, settledAt: at(246_912),
    carryNumerator: restored.carryNumerator
  });
  const once = calculateIdleProduction({
    buildingType: 'doncella_bank', level: 2,
    lastSettledAt: at(0), settledAt: at(246_912)
  });
  assert.equal((BigInt(first.producedUnits) + BigInt(second.producedUnits)).toString(), once.producedUnits);
  assert.equal(second.carryNumerator, once.carryNumerator);
  assert.equal(restored.carryDenominator, '3600000');
});
