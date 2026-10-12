'use strict';

const { randomUUID } = require('node:crypto');
const { planIdleCollection } = require('./idleCollection');
const {
  fingerprintRules,
  fingerprintGameplayRules,
  fingerprintCollectionRequest,
  fingerprintUpgradeRequest
} = require('./ruleFingerprint');

const ACCOUNT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

class CollectionConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CollectionConflictError';
    this.code = 'IDEMPOTENCY_CONFLICT';
    this.status = 409;
  }
}

class CollectionNotProvisionedError extends Error {
  constructor() {
    super('Initial gameplay buildings have not been provisioned for this account');
    this.name = 'CollectionNotProvisionedError';
    this.code = 'GAMEPLAY_NOT_PROVISIONED';
    this.status = 409;
  }
}

class BuildingUpgradeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BuildingUpgradeError';
    this.code = code;
    this.status = 409;
  }
}

function validateInput({ accountId, idempotencyKey, expectedRulesFingerprint }) {
  if (typeof accountId !== 'string' || !ACCOUNT_ID_PATTERN.test(accountId)) {
    throw new TypeError('accountId must be a UUID from trusted server authentication');
  }
  if (typeof idempotencyKey !== 'string' || !IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
    throw new TypeError('idempotencyKey must contain 1-128 supported characters');
  }
  if (typeof expectedRulesFingerprint !== 'string' ||
      !FINGERPRINT_PATTERN.test(expectedRulesFingerprint)) {
    throw new TypeError('expectedRulesFingerprint must be a lowercase SHA-256 fingerprint');
  }
}

function rowsFromRuleset(rows) {
  if (rows.length === 0) throw new Error('The active idle collection ruleset is empty');
  const ruleSetKey = rows[0].rule_set_key;
  if (rows.some((row) => row.rule_set_key !== ruleSetKey)) {
    throw new Error('Active idle collection rules contain multiple rulesets');
  }
  return rows.map(({ building_type, level, asset_code, units_per_hour, storage_limit_ms }) => ({
    building_type,
    level: Number(level),
    asset_code,
    units_per_hour: Number(units_per_hour),
    storage_limit_ms: Number(storage_limit_ms)
  }));
}

async function loadActiveRuleset(executor, { lock = false } = {}) {
  const { rows } = await executor.query(`
    SELECT rs.id AS rule_set_id, rs.rule_set_key, rs.version_number,
      rs.fingerprint AS stored_fingerprint, r.building_type, r.level,
      r.asset_code, r.units_per_hour, r.storage_limit_ms
    FROM building_rule_sets rs
    JOIN building_level_rules r ON r.rule_set_id = rs.id
    WHERE rs.is_active = TRUE
    ORDER BY r.building_type, r.level
    ${lock ? 'FOR SHARE OF rs, r' : ''}
  `);
  const rules = rowsFromRuleset(rows);
  const row = rows[0];
  const versionNumber = Number(row.version_number);
  const { rows: costRows } = await executor.query(`
    SELECT building_type, from_level, to_level, asset_code, amount
    FROM building_upgrade_cost_rules
    WHERE rule_set_id = $1
    ORDER BY building_type, from_level, to_level, asset_code
    ${lock ? 'FOR SHARE' : ''}
  `, [row.rule_set_id]);
  const upgradeCosts = costRows.map((cost) => ({
    building_type: cost.building_type,
    from_level: Number(cost.from_level),
    to_level: Number(cost.to_level),
    asset_code: cost.asset_code,
    amount: Number(cost.amount)
  }));
  const fingerprint = upgradeCosts.length > 0
    ? fingerprintGameplayRules(row.rule_set_key, rules, upgradeCosts, versionNumber)
    : fingerprintRules(row.rule_set_key, rules, versionNumber);
  if (fingerprint !== row.stored_fingerprint) {
    throw new Error('Stored idle collection rules do not match their fingerprint');
  }
  return {
    rules,
    upgradeCosts,
    ruleSet: {
      id: row.rule_set_id,
      key: row.rule_set_key,
      versionNumber,
      fingerprint
    }
  };
}

async function finish(client, result) {
  await client.query('COMMIT');
  return result;
}

class PostgresIdleCollectionService {
  constructor(pool) {
    if (!pool || typeof pool.connect !== 'function') {
      throw new TypeError('pool must provide connect()');
    }
    this.pool = pool;
  }

  async verifyReady() {
    const client = await this.pool.connect();
    try {
      for (const table of [
        'authenticated_accounts',
        'building_rule_sets',
        'building_level_rules',
        'kingdom_buildings',
        'game_asset_balances',
        'production_collection_requests',
        'production_settlements',
        'game_asset_ledger',
        'building_upgrade_cost_rules',
        'building_upgrade_requests',
        'building_upgrade_ledger',
        'building_upgrade_cost_ledger'
      ]) {
        await client.query(`SELECT 1 FROM ${table} LIMIT 0`);
      }
      await loadActiveRuleset(client);
    } finally {
      client.release();
    }
  }

  async getActiveRulesetFingerprint() {
    const { rules, upgradeCosts, ruleSet } = await loadActiveRuleset(this.pool);
    return {
      ruleSetId: ruleSet.id,
      ruleSetKey: ruleSet.key,
      versionNumber: ruleSet.versionNumber,
      fingerprint: ruleSet.fingerprint,
      rules,
      upgradeCosts
    };
  }

  async getAccountState({ accountId } = {}) {
    if (typeof accountId !== 'string' || !ACCOUNT_ID_PATTERN.test(accountId)) {
      throw new TypeError('accountId must be a UUID from trusted server authentication');
    }

    const client = await this.pool.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      transactionStarted = true;

      const account = await client.query(
        'SELECT id FROM authenticated_accounts WHERE id = $1',
        [accountId]
      );
      if (account.rowCount !== 1) {
        return await finish(client, null);
      }

      const { rules, upgradeCosts, ruleSet } = await loadActiveRuleset(client);
      const { rows: buildingRows } = await client.query(`
        SELECT id, rule_set_id, building_type, level, asset_code,
          activity_state, last_settled_at, carry_numerator
        FROM kingdom_buildings
        WHERE account_id = $1
        ORDER BY building_type
      `, [accountId]);
      const { rows: balanceRows } = await client.query(`
        SELECT asset_code, amount
        FROM game_asset_balances
        WHERE account_id = $1
        ORDER BY asset_code
      `, [accountId]);

      return await finish(client, {
        accountId,
        ruleSet: {
          id: ruleSet.id,
          key: ruleSet.key,
          versionNumber: ruleSet.versionNumber,
          fingerprint: ruleSet.fingerprint,
          rules: rules.map((rule) => ({
            buildingType: rule.building_type,
            level: rule.level,
            assetCode: rule.asset_code,
            unitsPerHour: rule.units_per_hour,
            storageLimitMs: rule.storage_limit_ms
          })),
          upgradeCosts: upgradeCosts.map((cost) => ({
            buildingType: cost.building_type,
            fromLevel: cost.from_level,
            toLevel: cost.to_level,
            assetCode: cost.asset_code,
            amount: String(cost.amount)
          }))
        },
        buildings: buildingRows.map((building) => ({
          id: building.id,
          ruleSetId: building.rule_set_id,
          buildingType: building.building_type,
          level: Number(building.level),
          assetCode: building.asset_code,
          activity: building.activity_state,
          lastSettledAt: new Date(building.last_settled_at).toISOString(),
          carryNumerator: String(building.carry_numerator)
        })),
        balances: balanceRows.map((balance) => ({
          assetCode: balance.asset_code,
          amount: String(balance.amount)
        }))
      });
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          throw new AggregateError([error, rollbackError], 'Gameplay state query and rollback both failed');
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async provisionInitialBuildings({ accountId, expectedRulesFingerprint } = {}) {
    if (typeof accountId !== 'string' || !ACCOUNT_ID_PATTERN.test(accountId)) {
      throw new TypeError('accountId must be a UUID from trusted server authentication');
    }
    if (typeof expectedRulesFingerprint !== 'string' ||
        !FINGERPRINT_PATTERN.test(expectedRulesFingerprint)) {
      throw new TypeError('expectedRulesFingerprint must be a lowercase SHA-256 fingerprint');
    }

    const client = await this.pool.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;
      const account = await client.query(
        'SELECT id FROM authenticated_accounts WHERE id = $1 FOR UPDATE',
        [accountId]
      );
      if (account.rowCount !== 1) throw new Error('Authenticated account does not exist');

      const active = await loadActiveRuleset(client, { lock: true });
      const rules = active.rules.filter((rule) => rule.level === 1);
      const ruleSet = {
        rule_set_id: active.ruleSet.id,
        rule_set_key: active.ruleSet.key
      };
      const actualFingerprint = active.ruleSet.fingerprint;
      if (actualFingerprint !== expectedRulesFingerprint) {
        throw new CollectionConflictError('Requested rules fingerprint is stale or invalid');
      }

      const existing = await client.query(`
        SELECT id, account_id, rule_set_id, building_type, level, asset_code,
          activity_state, last_settled_at, carry_numerator
        FROM kingdom_buildings WHERE account_id = $1
        ORDER BY building_type
      `, [accountId]);
      if (existing.rowCount > 0) {
        const exactSet = existing.rowCount === rules.length && rules.every((rule) =>
          existing.rows.some((building) =>
            building.rule_set_id === ruleSet.rule_set_id &&
            building.building_type === rule.building_type &&
            Number(building.level) === rule.level &&
            building.asset_code === rule.asset_code &&
            building.activity_state === 'active'
          )
        );
        if (!exactSet) {
          throw new CollectionConflictError('Account has a partial or incompatible initial building set');
        }
        await client.query('COMMIT');
        return existing.rows;
      }

      const { rows: timestampRows } = await client.query(
        "SELECT date_trunc('milliseconds', clock_timestamp()) AS created_at"
      );
      const createdAt = timestampRows[0].created_at;
      const provisioned = [];
      for (const rule of rules) {
        const { rows } = await client.query(`
          INSERT INTO kingdom_buildings
            (id, account_id, rule_set_id, building_type, level, asset_code,
             activity_state, last_settled_at)
          VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
          RETURNING id, account_id, rule_set_id, building_type, level, asset_code,
            activity_state, last_settled_at, carry_numerator
        `, [randomUUID(), accountId, ruleSet.rule_set_id, rule.building_type,
          rule.level, rule.asset_code, createdAt]);
        provisioned.push(rows[0]);
      }
      await client.query('COMMIT');
      return provisioned;
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          throw new AggregateError([error, rollbackError], 'Building provisioning and rollback both failed');
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async collect({ accountId, idempotencyKey, expectedRulesFingerprint } = {}) {
    validateInput({ accountId, idempotencyKey, expectedRulesFingerprint });
    const client = await this.pool.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;

      const { rows: priorRequests } = await client.query(`
        SELECT rule_set_id, rules_fingerprint, request_fingerprint, result
        FROM production_collection_requests
        WHERE account_id = $1 AND idempotency_key = $2
        FOR UPDATE
      `, [accountId, idempotencyKey]);
      if (priorRequests[0]) {
        const requestFingerprint = fingerprintCollectionRequest({
          accountId,
          ruleSetId: priorRequests[0].rule_set_id,
          rulesFingerprint: expectedRulesFingerprint
        });
        if (priorRequests[0].rules_fingerprint !== expectedRulesFingerprint ||
            priorRequests[0].request_fingerprint !== requestFingerprint) {
          throw new CollectionConflictError('Idempotency key was already used with another rules fingerprint');
        }
        if (!priorRequests[0].result) {
          throw new Error('A previously committed collection request has no result');
        }
        return await finish(client, priorRequests[0].result);
      }

      const active = await loadActiveRuleset(client, { lock: true });
      const { rules } = active;
      const ruleSet = {
        rule_set_id: active.ruleSet.id,
        rule_set_key: active.ruleSet.key,
        version_number: active.ruleSet.versionNumber
      };
      const computedFingerprint = active.ruleSet.fingerprint;
      if (expectedRulesFingerprint !== computedFingerprint) {
        throw new CollectionConflictError('Requested rules fingerprint is stale or invalid');
      }
      const requestFingerprint = fingerprintCollectionRequest({
        accountId,
        ruleSetId: ruleSet.rule_set_id,
        rulesFingerprint: computedFingerprint
      });

      const requestId = randomUUID();
      const { rows: inserted } = await client.query(`
        INSERT INTO production_collection_requests
          (id, account_id, idempotency_key, rule_set_id, rules_fingerprint, request_fingerprint)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (account_id, idempotency_key) DO NOTHING
        RETURNING id
      `, [requestId, accountId, idempotencyKey, ruleSet.rule_set_id,
        computedFingerprint, requestFingerprint]);
      if (inserted.length === 0) {
        const { rows } = await client.query(`
          SELECT rule_set_id, rules_fingerprint, request_fingerprint, result
          FROM production_collection_requests
          WHERE account_id = $1 AND idempotency_key = $2
          FOR UPDATE
        `, [accountId, idempotencyKey]);
        const conflictingFingerprint = rows[0] && fingerprintCollectionRequest({
          accountId,
          ruleSetId: rows[0].rule_set_id,
          rulesFingerprint: expectedRulesFingerprint
        });
        if (!rows[0] || rows[0].rules_fingerprint !== expectedRulesFingerprint ||
            rows[0].request_fingerprint !== conflictingFingerprint) {
          throw new CollectionConflictError('Idempotency key was already used with another rules fingerprint');
        }
        if (!rows[0].result) throw new Error('A concurrent collection request has no committed result');
        return await finish(client, rows[0].result);
      }

      const { rows: buildingRows } = await client.query(`
        SELECT id, account_id, rule_set_id, building_type, level, asset_code,
          activity_state, last_settled_at, carry_numerator
        FROM kingdom_buildings
        WHERE account_id = $1
        ORDER BY id
        FOR UPDATE
      `, [accountId]);
      if (buildingRows.length === 0) throw new CollectionNotProvisionedError();
      const rulesByBuilding = new Map(rules.map((rule) =>
        [`${rule.building_type}\0${rule.level}`, rule]));
      for (const building of buildingRows) {
        const rule = rulesByBuilding.get(`${building.building_type}\0${Number(building.level)}`);
        if (!rule || building.rule_set_id !== ruleSet.rule_set_id ||
            building.asset_code !== rule.asset_code || building.activity_state !== 'active') {
          throw new Error(`Building ${building.id} does not match the active ruleset`);
        }
      }
      if (buildingRows.length !== new Set(rules.map((rule) => rule.building_type)).size) {
        throw new Error('Account buildings do not match the complete active ruleset');
      }

      const { rows: timestampRows } = await client.query(
        "SELECT date_trunc('milliseconds', clock_timestamp()) AS settled_at"
      );
      const settledAt = timestampRows[0].settled_at.toISOString();
      const buildings = buildingRows.map((building) => {
        const rule = rulesByBuilding.get(`${building.building_type}\0${Number(building.level)}`);
        return {
          id: building.id,
          accountId: building.account_id,
          buildingType: building.building_type,
          level: Number(building.level),
          activity: building.activity_state,
          lastSettledAt: new Date(building.last_settled_at).toISOString(),
          carryNumerator: String(building.carry_numerator),
          productionRule: {
            asset: rule.asset_code,
            unitsPerHour: rule.units_per_hour,
            storageLimitMs: rule.storage_limit_ms
          }
        };
      });
      const plan = planIdleCollection({ accountId, buildings, settledAt });
      const assetByBuildingId = new Map(buildingRows.map((row) => [row.id, row.asset_code]));
      const updateTime = timestampRows[0].settled_at;

      for (const update of plan.buildingUpdates) {
        const building = buildingRows.find((row) => row.id === update.buildingId);
        const changed = await client.query(`
          UPDATE kingdom_buildings
          SET last_settled_at = $1, carry_numerator = $2, updated_at = $1
          WHERE id = $3 AND account_id = $4 AND rule_set_id = $5
        `, [update.lastSettledAt, update.carryNumerator, update.buildingId,
          accountId, ruleSet.rule_set_id]);
        if (changed.rowCount !== 1) throw new Error(`Building ${update.buildingId} changed during collection`);

        const settlementId = randomUUID();
        const assetCode = assetByBuildingId.get(update.buildingId);
        await client.query(`
          INSERT INTO production_settlements
            (id, request_id, account_id, building_id, rule_set_id, asset_code,
             interval_start, interval_end, active_milliseconds, discarded_milliseconds,
             credited_amount, carry_before, carry_after)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [settlementId, requestId, accountId, update.buildingId, ruleSet.rule_set_id,
          assetCode, building.last_settled_at, update.lastSettledAt, update.activeMilliseconds,
          update.discardedMilliseconds, update.producedUnits, building.carry_numerator,
          update.carryNumerator]);

        if (BigInt(update.producedUnits) > 0n) {
          await client.query(`
            INSERT INTO game_asset_balances (account_id, asset_code, amount)
            VALUES ($1, $2, 0)
            ON CONFLICT (account_id, asset_code) DO NOTHING
          `, [accountId, assetCode]);
          const balance = await client.query(`
            UPDATE game_asset_balances SET amount = amount + $1, updated_at = $2
            WHERE account_id = $3 AND asset_code = $4
          `, [update.producedUnits, updateTime, accountId, assetCode]);
          if (balance.rowCount !== 1) throw new Error(`Balance row missing for ${assetCode}`);
          await client.query(`
            INSERT INTO game_asset_ledger
              (id, account_id, asset_code, direction, amount, reason, settlement_id, occurred_at)
            VALUES ($1, $2, $3, 'credit', $4, 'idle_production', $5, $6)
          `, [randomUUID(), accountId, assetCode, update.producedUnits, settlementId, updateTime]);
        }
      }

      const result = {
        requestId,
        accountId,
        ruleSetId: ruleSet.rule_set_id,
        ruleSetKey: ruleSet.rule_set_key,
        rulesFingerprint: computedFingerprint,
        settledAt,
        credits: plan.credits,
        settlements: plan.buildingUpdates.map((update) => ({
          buildingId: update.buildingId,
          asset: assetByBuildingId.get(update.buildingId),
          amount: update.producedUnits,
          activeMilliseconds: update.activeMilliseconds,
          discardedMilliseconds: update.discardedMilliseconds,
          carryNumerator: update.carryNumerator
        }))
      };
      const completed = await client.query(`
        UPDATE production_collection_requests SET settled_at = $1, result = $2::jsonb
        WHERE id = $3 AND account_id = $4
      `, [settledAt, JSON.stringify(result), requestId, accountId]);
      if (completed.rowCount !== 1) throw new Error('Collection request changed before commit');
      return await finish(client, result);
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          throw new AggregateError([error, rollbackError], 'Idle collection and rollback both failed');
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async upgradeBuilding(input = {}) {
    const { accountId, idempotencyKey, expectedRulesFingerprint } = input;
    validateInput({ accountId, idempotencyKey, expectedRulesFingerprint });
    const maximumAttempts = 3;
    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      try {
        return await this.upgradeBuildingOnce(input);
      } catch (error) {
        if (error?.code !== '40P01' || attempt === maximumAttempts) throw error;
      }
    }
    throw new Error('Unreachable building upgrade retry state');
  }

  async upgradeBuildingOnce({
    accountId, buildingType, targetLevel, idempotencyKey, expectedRulesFingerprint
  } = {}) {
    if (typeof buildingType !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(buildingType)) {
      throw new TypeError('buildingType must be a supported building identifier');
    }
    if (!Number.isInteger(targetLevel) || targetLevel !== 2) {
      throw new TypeError('targetLevel must be 2 for this prototype');
    }
    const fromLevel = targetLevel - 1;
    const client = await this.pool.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;

      const { rows: priorRequests } = await client.query(`
        SELECT r.rule_set_id, r.rules_fingerprint, r.request_fingerprint, r.result,
          b.building_type
        FROM building_upgrade_requests r
        JOIN kingdom_buildings b ON b.id = r.building_id AND b.account_id = r.account_id
        WHERE r.account_id = $1 AND r.idempotency_key = $2
        FOR UPDATE OF r
      `, [accountId, idempotencyKey]);
      if (priorRequests[0]) {
        const expectedRequestFingerprint = fingerprintUpgradeRequest({
          accountId,
          ruleSetId: priorRequests[0].rule_set_id,
          rulesFingerprint: expectedRulesFingerprint,
          buildingType,
          fromLevel,
          toLevel: targetLevel
        });
        if (priorRequests[0].building_type !== buildingType ||
            priorRequests[0].rules_fingerprint !== expectedRulesFingerprint ||
            priorRequests[0].request_fingerprint !== expectedRequestFingerprint) {
          throw new CollectionConflictError('Idempotency key was already used for another upgrade');
        }
        if (!priorRequests[0].result) throw new Error('A committed upgrade request has no result');
        return await finish(client, priorRequests[0].result);
      }

      const active = await loadActiveRuleset(client, { lock: true });
      if (active.ruleSet.fingerprint !== expectedRulesFingerprint) {
        throw new CollectionConflictError('Requested rules fingerprint is stale or invalid');
      }
      const oldRule = active.rules.find((rule) =>
        rule.building_type === buildingType && rule.level === fromLevel);
      const newRule = active.rules.find((rule) =>
        rule.building_type === buildingType && rule.level === targetLevel);
      const costs = active.upgradeCosts.filter((cost) =>
        cost.building_type === buildingType && cost.from_level === fromLevel &&
        cost.to_level === targetLevel);
      if (!oldRule || !newRule || costs.length === 0 || oldRule.asset_code !== newRule.asset_code) {
        throw new BuildingUpgradeError('BUILDING_UPGRADE_UNAVAILABLE',
          'The active ruleset does not define this building upgrade');
      }

      // Collection locks every account building in this exact order before touching balances.
      // Locking first also avoids FK key-share -> row-update conversion deadlocks between upgrades.
      const { rows: buildings } = await client.query(`
        SELECT id, account_id, rule_set_id, building_type, level, asset_code,
          activity_state, last_settled_at, carry_numerator
        FROM kingdom_buildings
        WHERE account_id = $1
        ORDER BY id
        FOR UPDATE
      `, [accountId]);
      const building = buildings.find((candidate) => candidate.building_type === buildingType);
      if (!building) {
        throw new BuildingUpgradeError('BUILDING_UPGRADE_UNAVAILABLE', 'Building was not found');
      }
      const requestFingerprint = fingerprintUpgradeRequest({
        accountId,
        ruleSetId: active.ruleSet.id,
        rulesFingerprint: active.ruleSet.fingerprint,
        buildingType,
        fromLevel,
        toLevel: targetLevel
      });

      // A same-key contender may have completed while this transaction waited on buildings.
      const { rows: requestsAfterBuildingLock } = await client.query(`
        SELECT r.rule_set_id, r.rules_fingerprint, r.request_fingerprint, r.result,
          b.building_type
        FROM building_upgrade_requests r
        JOIN kingdom_buildings b ON b.id = r.building_id AND b.account_id = r.account_id
        WHERE r.account_id = $1 AND r.idempotency_key = $2
        FOR UPDATE OF r
      `, [accountId, idempotencyKey]);
      if (requestsAfterBuildingLock[0]) {
        const prior = requestsAfterBuildingLock[0];
        if (prior.building_type !== buildingType ||
            prior.rules_fingerprint !== expectedRulesFingerprint ||
            prior.request_fingerprint !== requestFingerprint) {
          throw new CollectionConflictError('Idempotency key was already used for another upgrade');
        }
        if (!prior.result) throw new Error('A committed upgrade request has no result');
        return await finish(client, prior.result);
      }

      if (!building || Number(building.level) !== fromLevel ||
          building.rule_set_id !== active.ruleSet.id || building.asset_code !== oldRule.asset_code ||
          building.activity_state !== 'active') {
        throw new BuildingUpgradeError('BUILDING_UPGRADE_CONFLICT',
          'Building is not an active level 1 building under the expected ruleset');
      }
      const requestId = randomUUID();
      await client.query(`
        INSERT INTO building_upgrade_requests
          (id, account_id, idempotency_key, rule_set_id, rules_fingerprint,
           request_fingerprint, building_id, from_level, to_level)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [requestId, accountId, idempotencyKey, active.ruleSet.id,
        active.ruleSet.fingerprint, requestFingerprint, building.id, fromLevel, targetLevel]);

      const { rows: timestampRows } = await client.query(
        "SELECT date_trunc('milliseconds', clock_timestamp()) AS settled_at"
      );
      const settledAtValue = timestampRows[0].settled_at;
      const settledAt = settledAtValue.toISOString();
      const plan = planIdleCollection({
        accountId,
        settledAt,
        buildings: [{
          id: building.id,
          accountId,
          buildingType,
          level: fromLevel,
          activity: building.activity_state,
          lastSettledAt: new Date(building.last_settled_at).toISOString(),
          carryNumerator: String(building.carry_numerator),
          productionRule: {
            asset: oldRule.asset_code,
            unitsPerHour: oldRule.units_per_hour,
            storageLimitMs: oldRule.storage_limit_ms
          }
        }]
      });
      const settlement = plan.buildingUpdates[0];
      const balanceAssets = [...new Set([
        oldRule.asset_code, ...costs.map((cost) => cost.asset_code)
      ])].sort();
      for (const assetCode of balanceAssets) {
        await client.query(`
          INSERT INTO game_asset_balances (account_id, asset_code, amount)
          VALUES ($1, $2, 0) ON CONFLICT (account_id, asset_code) DO NOTHING
        `, [accountId, assetCode]);
      }
      const { rows: balances } = await client.query(`
        SELECT asset_code, amount FROM game_asset_balances
        WHERE account_id = $1 AND asset_code = ANY($2::varchar[])
        ORDER BY asset_code
        FOR UPDATE
      `, [accountId, balanceAssets]);
      const available = new Map(balances.map((balance) =>
        [balance.asset_code, BigInt(balance.amount)]));
      available.set(oldRule.asset_code,
        (available.get(oldRule.asset_code) || 0n) + BigInt(settlement.producedUnits));
      const insufficient = costs.find((cost) =>
        (available.get(cost.asset_code) || 0n) < BigInt(cost.amount));
      if (insufficient) {
        throw new BuildingUpgradeError('INSUFFICIENT_COLLECTED_BALANCE',
          `Insufficient collected ${insufficient.asset_code} for building upgrade`);
      }

      if (BigInt(settlement.producedUnits) > 0n) {
        await client.query(`
          UPDATE game_asset_balances SET amount = amount + $1, updated_at = $2
          WHERE account_id = $3 AND asset_code = $4
        `, [settlement.producedUnits, settledAtValue, accountId, oldRule.asset_code]);
      }
      for (const cost of costs) {
        const debited = await client.query(`
          UPDATE game_asset_balances SET amount = amount - $1, updated_at = $2
          WHERE account_id = $3 AND asset_code = $4 AND amount >= $1
        `, [cost.amount, settledAtValue, accountId, cost.asset_code]);
        if (debited.rowCount !== 1) throw new Error(`Balance changed for ${cost.asset_code}`);
      }
      const upgraded = await client.query(`
        UPDATE kingdom_buildings
        SET level = $1, last_settled_at = $2, carry_numerator = $3, updated_at = $2
        WHERE id = $4 AND account_id = $5 AND level = $6 AND rule_set_id = $7
      `, [targetLevel, settledAtValue, settlement.carryNumerator, building.id,
        accountId, fromLevel, active.ruleSet.id]);
      if (upgraded.rowCount !== 1) throw new Error('Building changed during upgrade');

      const upgradeId = randomUUID();
      await client.query(`
        INSERT INTO building_upgrade_ledger
          (id, request_id, account_id, building_id, rule_set_id, building_type,
           from_level, to_level, asset_code, interval_start, settled_at,
           active_milliseconds, discarded_milliseconds, credited_amount,
           carry_before, carry_after)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [upgradeId, requestId, accountId, building.id, active.ruleSet.id, buildingType,
        fromLevel, targetLevel, oldRule.asset_code, building.last_settled_at, settledAtValue,
        settlement.activeMilliseconds, settlement.discardedMilliseconds,
        settlement.producedUnits, building.carry_numerator, settlement.carryNumerator]);
      for (const cost of costs) {
        await client.query(`
          INSERT INTO building_upgrade_cost_ledger
            (id, upgrade_id, account_id, asset_code, amount, occurred_at)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [randomUUID(), upgradeId, accountId, cost.asset_code, cost.amount, settledAtValue]);
      }

      const result = {
        requestId,
        upgradeId,
        accountId,
        ruleSetId: active.ruleSet.id,
        rulesFingerprint: active.ruleSet.fingerprint,
        building: {
          id: building.id,
          buildingType,
          level: targetLevel,
          assetCode: newRule.asset_code,
          activity: 'active',
          lastSettledAt: settledAt,
          carryNumerator: settlement.carryNumerator
        },
        settlement: {
          asset: oldRule.asset_code,
          amount: settlement.producedUnits,
          activeMilliseconds: settlement.activeMilliseconds,
          discardedMilliseconds: settlement.discardedMilliseconds,
          carryNumerator: settlement.carryNumerator
        },
        costs: costs.map((cost) => ({ asset: cost.asset_code, amount: String(cost.amount) }))
      };
      const completed = await client.query(`
        UPDATE building_upgrade_requests SET settled_at = $1, result = $2::jsonb
        WHERE id = $3 AND account_id = $4
      `, [settledAtValue, JSON.stringify(result), requestId, accountId]);
      if (completed.rowCount !== 1) throw new Error('Upgrade request changed before commit');
      return await finish(client, result);
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          throw new AggregateError([error, rollbackError], 'Building upgrade and rollback both failed');
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = {
  CollectionConflictError,
  CollectionNotProvisionedError,
  BuildingUpgradeError,
  PostgresIdleCollectionService
};
