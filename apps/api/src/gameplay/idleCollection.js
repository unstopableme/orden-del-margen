'use strict';

const { calculateIdleProduction } = require('./idleProduction');

// Pure settlement plan. A future authenticated transaction must load and lock
// owned buildings, supply one database timestamp, and persist this atomically.
function planIdleCollection({ accountId, buildings, settledAt } = {}) {
  if (typeof accountId !== 'string' || !accountId.trim()) {
    throw new TypeError('accountId must be a nonempty server-owned account key');
  }
  if (!Array.isArray(buildings) || buildings.length === 0) {
    throw new TypeError('buildings must be a nonempty array');
  }

  const ids = new Set();
  const credits = new Map();
  const ledgerEntries = [];
  const buildingUpdates = [...buildings].sort((a, b) => {
    const left = String(a?.id);
    const right = String(b?.id);
    return left < right ? -1 : left > right ? 1 : 0;
  }).map((building) => {
    if (!building || typeof building.id !== 'string' || !building.id.trim()) {
      throw new TypeError('each building needs a nonempty string id');
    }
    if (ids.has(building.id)) throw new RangeError('duplicate building id');
    ids.add(building.id);
    if (building.accountId !== accountId) throw new RangeError('building account mismatch');
    // Activity changes need settlement under the old state. Until that service
    // exists, reject unsupported activity rather than silently advancing time.
    if (building.activity !== 'active') throw new RangeError('unsupported building activity');

    const result = calculateIdleProduction({
      buildingType: building.buildingType,
      level: building.level,
      lastSettledAt: building.lastSettledAt,
      carryNumerator: building.carryNumerator,
      settledAt
    });
    const units = BigInt(result.producedUnits);
    credits.set(result.asset, (credits.get(result.asset) || 0n) + units);
    if (units > 0n) {
      ledgerEntries.push(Object.freeze({
        accountId, buildingId: building.id, asset: result.asset,
        amount: result.producedUnits, reason: 'idle_production',
        intervalStart: building.lastSettledAt, intervalEnd: settledAt
      }));
    }
    return Object.freeze({ buildingId: building.id, ...result });
  });

  return Object.freeze({
    accountId,
    settledAt,
    credits: Object.freeze([...credits].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([asset, amount]) => Object.freeze({ asset, amount: amount.toString() }))),
    buildingUpdates: Object.freeze(buildingUpdates),
    ledgerEntries: Object.freeze(ledgerEntries)
  });
}

module.exports = { planIdleCollection };
