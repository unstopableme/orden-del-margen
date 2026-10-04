'use strict';

const CARRY_DENOMINATOR = 3_600_000n;

const PRODUCTION_RULES = Object.freeze({
  wheat_farm: Object.freeze({
    asset: 'wheat',
    rates: Object.freeze({ 1: 60, 2: 132 })
  }),
  lumber_mill: Object.freeze({
    asset: 'wood',
    rates: Object.freeze({ 1: 45, 2: 100 })
  }),
  quarry: Object.freeze({
    asset: 'stone',
    rates: Object.freeze({ 1: 30, 2: 66 })
  }),
  provisioner: Object.freeze({
    asset: 'food',
    rates: Object.freeze({ 1: 15, 2: 33 })
  }),
  textile_mill: Object.freeze({
    asset: 'cloth',
    rates: Object.freeze({ 1: 15, 2: 33 })
  }),
  doncella_bank: Object.freeze({
    asset: '$DONCELLA',
    rates: Object.freeze({ 1: 10, 2: 25 })
  })
});

const STORAGE_LIMIT_MILLISECONDS = Object.freeze({
  1: 8 * 60 * 60 * 1000,
  2: 12 * 60 * 60 * 1000
});

const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const UNSIGNED_INTEGER_PATTERN = /^(0|[1-9]\d*)$/;

function parseTimestamp(value, fieldName) {
  if (typeof value !== 'string' || !UTC_TIMESTAMP_PATTERN.test(value)) {
    throw new TypeError(`${fieldName} must be a canonical UTC ISO timestamp with millisecond precision`);
  }

  const milliseconds = Date.parse(value);
  if (!Number.isSafeInteger(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new RangeError(`${fieldName} is not a valid timestamp`);
  }

  return milliseconds;
}

function parseCarryNumerator(value) {
  if (typeof value !== 'string' || !UNSIGNED_INTEGER_PATTERN.test(value)) {
    throw new TypeError('carryNumerator must be a nonnegative decimal integer string');
  }

  const numerator = BigInt(value);
  if (numerator >= CARRY_DENOMINATOR) {
    throw new RangeError(`carryNumerator must be less than ${CARRY_DENOMINATOR}`);
  }

  return numerator;
}

function calculateIdleProduction({
  buildingType,
  level,
  lastSettledAt,
  settledAt,
  carryNumerator = '0'
} = {}) {
  if (typeof buildingType !== 'string' || !Object.hasOwn(PRODUCTION_RULES, buildingType)) {
    throw new RangeError(`unsupported building type: ${String(buildingType)}`);
  }
  const rule = PRODUCTION_RULES[buildingType];

  if (!Number.isInteger(level) || !Object.hasOwn(rule.rates, level)) {
    throw new RangeError(`unsupported level ${String(level)} for ${buildingType}`);
  }

  const startMilliseconds = parseTimestamp(lastSettledAt, 'lastSettledAt');
  const endMilliseconds = parseTimestamp(settledAt, 'settledAt');
  if (endMilliseconds < startMilliseconds) {
    throw new RangeError('settledAt must not be earlier than lastSettledAt');
  }

  const previousCarry = parseCarryNumerator(carryNumerator);
  const elapsedMilliseconds = endMilliseconds - startMilliseconds;
  const capacityMilliseconds = STORAGE_LIMIT_MILLISECONDS[level];
  const activeMilliseconds = Math.min(elapsedMilliseconds, capacityMilliseconds);
  const discardedMilliseconds = elapsedMilliseconds - activeMilliseconds;
  const hourlyRate = BigInt(rule.rates[level]);
  const accruedNumerator = BigInt(activeMilliseconds) * hourlyRate;
  const availableNumerator = previousCarry + accruedNumerator;
  const producedUnits = availableNumerator / CARRY_DENOMINATOR;
  const nextCarry = availableNumerator % CARRY_DENOMINATOR;

  return Object.freeze({
    asset: rule.asset,
    producedUnits: producedUnits.toString(),
    carryNumerator: nextCarry.toString(),
    carryDenominator: CARRY_DENOMINATOR.toString(),
    hourlyRate: rule.rates[level],
    activeMilliseconds,
    discardedMilliseconds,
    lastSettledAt: settledAt
  });
}

module.exports = {
  CARRY_DENOMINATOR: CARRY_DENOMINATOR.toString(),
  PRODUCTION_RULES,
  STORAGE_LIMIT_MILLISECONDS,
  calculateIdleProduction
};
