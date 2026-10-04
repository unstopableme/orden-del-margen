'use strict';

const UNSIGNED_INTEGER_PATTERN = /^(0|[1-9]\d*)$/;
const CAP_NUMERATOR = 5n;
const CAP_DENOMINATOR = 100n;

function requirePlainObject(value, field) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value;
}

function parseUnsignedInteger(value, field) {
  if (typeof value !== 'string' || !UNSIGNED_INTEGER_PATTERN.test(value)) {
    throw new TypeError(`${field} must be a canonical nonnegative decimal integer string`);
  }
  return BigInt(value);
}

function requireParticipantId(value, field) {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    throw new TypeError(`${field} must be a nonblank canonical string`);
  }
  return value;
}

function calculateWeeklyMargenPayout({ basePool, participants } = {}) {
  const pool = parseUnsignedInteger(basePool, 'basePool');
  if (!Array.isArray(participants)) {
    throw new TypeError('participants must be an array');
  }

  const seenParticipantIds = new Set();
  const normalized = participants.map((participant, index) => {
    requirePlainObject(participant, `participants[${index}]`);
    const participantId = requireParticipantId(
      participant.participantId,
      `participants[${index}].participantId`
    );
    if (seenParticipantIds.has(participantId)) {
      throw new TypeError(`duplicate participantId: ${participantId}`);
    }
    seenParticipantIds.add(participantId);

    return {
      participantId,
      weight: parseUnsignedInteger(participant.weight, `participants[${index}].weight`)
    };
  });

  const totalWeight = normalized.reduce((total, participant) => total + participant.weight, 0n);
  const participantCap = pool * CAP_NUMERATOR / CAP_DENOMINATOR;
  let allocatedTotal = 0n;

  const allocations = normalized.map(({ participantId, weight }) => {
    const uncappedAllocation = totalWeight === 0n ? 0n : pool * weight / totalWeight;
    const allocation = uncappedAllocation < participantCap
      ? uncappedAllocation
      : participantCap;
    const capClipped = uncappedAllocation - allocation;
    allocatedTotal += allocation;

    return Object.freeze({
      participantId,
      weight: weight.toString(),
      uncappedAllocation: uncappedAllocation.toString(),
      allocation: allocation.toString(),
      capClipped: capClipped.toString()
    });
  });

  const retainedGameVaultBalance = pool - allocatedTotal;
  return Object.freeze({
    asset: '$MARGEN',
    basePool: pool.toString(),
    totalWeight: totalWeight.toString(),
    participantCap: participantCap.toString(),
    allocatedTotal: allocatedTotal.toString(),
    retainedGameVaultBalance: retainedGameVaultBalance.toString(),
    allocations: Object.freeze(allocations)
  });
}

module.exports = {
  CAP_DENOMINATOR: CAP_DENOMINATOR.toString(),
  CAP_NUMERATOR: CAP_NUMERATOR.toString(),
  calculateWeeklyMargenPayout
};
