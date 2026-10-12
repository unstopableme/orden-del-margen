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

module.exports = { canonicalRules, fingerprintRules, fingerprintCollectionRequest };
