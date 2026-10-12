'use strict';

const { randomUUID } = require('node:crypto');
const { planIdleCollection } = require('./idleCollection');
const { fingerprintRules, fingerprintCollectionRequest } = require('./ruleFingerprint');

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
  const fingerprint = fingerprintRules(row.rule_set_key, rules, versionNumber);
  if (fingerprint !== row.stored_fingerprint) {
    throw new Error('Stored idle collection rules do not match their fingerprint');
  }
  return {
    rules,
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
        'game_asset_ledger'
      ]) {
        await client.query(`SELECT 1 FROM ${table} LIMIT 0`);
      }
      await loadActiveRuleset(client);
    } finally {
      client.release();
    }
  }

  async getActiveRulesetFingerprint() {
    const { rules, ruleSet } = await loadActiveRuleset(this.pool);
    return {
      ruleSetId: ruleSet.id,
      ruleSetKey: ruleSet.key,
      versionNumber: ruleSet.versionNumber,
      fingerprint: ruleSet.fingerprint,
      rules
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

      const { rules, ruleSet } = await loadActiveRuleset(client);
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
      const { rules } = active;
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
      if (buildingRows.length !== rules.length) {
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
}

module.exports = {
  CollectionConflictError,
  CollectionNotProvisionedError,
  PostgresIdleCollectionService
};
