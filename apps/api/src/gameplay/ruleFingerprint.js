'use strict';

const { createHash } = require('node:crypto');

function canonicalRules(ruleSetKey, rules, versionNumber = 1) {
  if (typeof ruleSetKey !== 'string' || !ruleSetKey.trim()) {
    throw new TypeError('ruleSetKey must be a nonempty string');
  }
  if (!Number.isSafeInteger(versionNumber) || versionNumber < 1) {
    throw new TypeError('versionNumber must be a positive safe integer');
  }
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new TypeError('rules must be a nonempty array');
  }

  const seen = new Set();
  const normalized = rules.map((rule) => {
    const { building_type, level, asset_code, units_per_hour, storage_limit_ms } = rule;
    if (typeof building_type !== 'string' || !building_type ||
        typeof asset_code !== 'string' || !asset_code ||
        !Number.isInteger(level) || level < 1 ||
        !Number.isSafeInteger(units_per_hour) || units_per_hour <= 0 ||
        !Number.isSafeInteger(storage_limit_ms) || storage_limit_ms < 0) {
      throw new TypeError('rule contains invalid fingerprint fields');
    }
    const key = `${building_type}\0${level}`;
    if (seen.has(key)) throw new TypeError('rule set contains duplicate building levels');
    seen.add(key);
    return { building_type, level, asset_code, units_per_hour, storage_limit_ms };
  }).sort((left, right) => {
    if (left.building_type !== right.building_type) {
      return left.building_type < right.building_type ? -1 : 1;
    }
    return left.level - right.level;
  });

  return JSON.stringify({ ruleSetKey, versionNumber, rules: normalized });
}

function fingerprintRules(ruleSetKey, rules, versionNumber = 1) {
  return createHash('sha256').update(canonicalRules(ruleSetKey, rules, versionNumber)).digest('hex');
}

function canonicalUpgradeCosts(costs) {
  if (!Array.isArray(costs) || costs.length === 0) {
    throw new TypeError('upgrade costs must be a nonempty array');
  }
  const seen = new Set();
  return costs.map((cost) => {
    const { building_type, from_level, to_level, asset_code, amount } = cost;
    if (typeof building_type !== 'string' || !building_type ||
        !Number.isInteger(from_level) || from_level < 1 ||
        !Number.isInteger(to_level) || to_level !== from_level + 1 ||
        typeof asset_code !== 'string' || !asset_code ||
        !Number.isSafeInteger(amount) || amount <= 0) {
      throw new TypeError('upgrade cost contains invalid fingerprint fields');
    }
    const key = `${building_type}\0${from_level}\0${to_level}\0${asset_code}`;
    if (seen.has(key)) throw new TypeError('upgrade costs contain a duplicate asset');
    seen.add(key);
    return { building_type, from_level, to_level, asset_code, amount };
  }).sort((left, right) => {
    const leftKey = `${left.building_type}\0${left.from_level}\0${left.to_level}\0${left.asset_code}`;
    const rightKey = `${right.building_type}\0${right.from_level}\0${right.to_level}\0${right.asset_code}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

function fingerprintGameplayRules(ruleSetKey, rules, upgradeCosts, versionNumber) {
  const production = JSON.parse(canonicalRules(ruleSetKey, rules, versionNumber));
  const canonical = JSON.stringify({
    ...production,
    upgradeCosts: canonicalUpgradeCosts(upgradeCosts)
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function fingerprintCollectionRequest({ accountId, ruleSetId, rulesFingerprint }) {
  if (typeof accountId !== 'string' || typeof ruleSetId !== 'string' ||
      typeof rulesFingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(rulesFingerprint)) {
    throw new TypeError('collection fingerprint requires account, ruleset, and SHA-256 rules fingerprint');
  }
  const canonical = JSON.stringify({
    operation: 'idle_collection',
    accountId,
    ruleSetId,
    rulesFingerprint
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function fingerprintUpgradeRequest({
  accountId, ruleSetId, rulesFingerprint, buildingType, fromLevel, toLevel
}) {
  if (typeof accountId !== 'string' || typeof ruleSetId !== 'string' ||
      typeof rulesFingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(rulesFingerprint) ||
      typeof buildingType !== 'string' || !buildingType ||
      !Number.isInteger(fromLevel) || !Number.isInteger(toLevel)) {
    throw new TypeError('upgrade fingerprint requires account, ruleset, rules fingerprint, and levels');
  }
  return createHash('sha256').update(JSON.stringify({
    operation: 'building_upgrade', accountId, ruleSetId, rulesFingerprint,
    buildingType, fromLevel, toLevel
  })).digest('hex');
}

module.exports = {
  canonicalRules,
  fingerprintRules,
  fingerprintGameplayRules,
  fingerprintCollectionRequest,
  fingerprintUpgradeRequest
};
