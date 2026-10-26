'use strict';

const { fingerprintGameplayRules } = require('../src/gameplay/ruleFingerprint');

const RULE_SET_KEY = 'idle-materials-prototype';
const RULE_SET_ID = 'a95b4a15-f621-4c4f-8908-12cb3e060002';
const RULES = [
  ['wheat_farm', 'wheat', 60, 132],
  ['lumber_mill', 'wood', 45, 100],
  ['quarry', 'stone', 30, 66],
  ['provisioner', 'food', 15, 33],
  ['textile_mill', 'cloth', 15, 33]
].flatMap(([building_type, asset_code, levelOneRate, levelTwoRate]) => [
  { building_type, level: 1, asset_code, units_per_hour: levelOneRate, storage_limit_ms: 28_800_000 },
  { building_type, level: 2, asset_code, units_per_hour: levelTwoRate, storage_limit_ms: 43_200_000 }
]);
const COSTS = {
  wheat_farm: { wood: 180, stone: 120, food: 60, cloth: 60 },
  lumber_mill: { wheat: 240, stone: 120, food: 60, cloth: 60 },
  quarry: { wheat: 240, wood: 180, food: 60, cloth: 60 },
  provisioner: { wheat: 240, wood: 180, stone: 120, cloth: 60 },
  textile_mill: { wheat: 240, wood: 180, stone: 120, food: 60 }
};
const UPGRADE_COSTS = Object.entries(COSTS).flatMap(([building_type, costs]) =>
  Object.entries(costs).map(([asset_code, amount]) => ({
    building_type, from_level: 1, to_level: 2, asset_code, amount
  }))
);

module.exports = {
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS building_upgrade_cost_rules (
        rule_set_id UUID NOT NULL REFERENCES building_rule_sets(id) ON DELETE RESTRICT,
        building_type VARCHAR(64) NOT NULL,
        from_level SMALLINT NOT NULL CHECK (from_level > 0),
        to_level SMALLINT NOT NULL CHECK (to_level = from_level + 1),
        asset_code VARCHAR(64) NOT NULL CHECK (asset_code <> ''),
        amount BIGINT NOT NULL CHECK (amount > 0),
        PRIMARY KEY (rule_set_id, building_type, from_level, to_level, asset_code),
        FOREIGN KEY (rule_set_id, building_type, from_level)
          REFERENCES building_level_rules(rule_set_id, building_type, level) ON DELETE RESTRICT,
        FOREIGN KEY (rule_set_id, building_type, to_level)
          REFERENCES building_level_rules(rule_set_id, building_type, level) ON DELETE RESTRICT
      );

      CREATE TRIGGER immutable_building_upgrade_cost_rule
        BEFORE UPDATE OR DELETE ON building_upgrade_cost_rules
        FOR EACH ROW EXECUTE FUNCTION deny_building_level_rule_mutation();

      CREATE TABLE IF NOT EXISTS building_upgrade_requests (
        id UUID PRIMARY KEY,
        account_id UUID NOT NULL REFERENCES authenticated_accounts(id) ON DELETE RESTRICT,
        idempotency_key VARCHAR(128) NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]+$'),
        rule_set_id UUID NOT NULL,
        rules_fingerprint CHAR(64) NOT NULL CHECK (rules_fingerprint ~ '^[0-9a-f]{64}$'),
        request_fingerprint CHAR(64) NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
        building_id UUID NOT NULL,
        from_level SMALLINT NOT NULL,
        to_level SMALLINT NOT NULL CHECK (to_level = from_level + 1),
        settled_at TIMESTAMPTZ(3),
        result JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (account_id, idempotency_key),
        UNIQUE (id, account_id),
        FOREIGN KEY (rule_set_id, rules_fingerprint)
          REFERENCES building_rule_sets(id, fingerprint) ON DELETE RESTRICT,
        FOREIGN KEY (building_id, account_id)
          REFERENCES kingdom_buildings(id, account_id) ON DELETE RESTRICT,
        CHECK ((settled_at IS NULL) = (result IS NULL))
      );

      CREATE TABLE IF NOT EXISTS building_upgrade_ledger (
        id UUID PRIMARY KEY,
        request_id UUID NOT NULL,
        account_id UUID NOT NULL,
        building_id UUID NOT NULL,
        rule_set_id UUID NOT NULL REFERENCES building_rule_sets(id) ON DELETE RESTRICT,
        building_type VARCHAR(64) NOT NULL,
        from_level SMALLINT NOT NULL,
        to_level SMALLINT NOT NULL CHECK (to_level = from_level + 1),
        asset_code VARCHAR(64) NOT NULL,
        interval_start TIMESTAMPTZ(3) NOT NULL,
        settled_at TIMESTAMPTZ(3) NOT NULL,
        active_milliseconds BIGINT NOT NULL CHECK (active_milliseconds >= 0),
        discarded_milliseconds BIGINT NOT NULL CHECK (discarded_milliseconds >= 0),
        credited_amount BIGINT NOT NULL CHECK (credited_amount >= 0),
        carry_before BIGINT NOT NULL CHECK (carry_before >= 0 AND carry_before < 3600000),
        carry_after BIGINT NOT NULL CHECK (carry_after >= 0 AND carry_after < 3600000),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (request_id),
        UNIQUE (id, account_id),
        FOREIGN KEY (request_id, account_id)
          REFERENCES building_upgrade_requests(id, account_id) ON DELETE RESTRICT,
        FOREIGN KEY (building_id, account_id)
          REFERENCES kingdom_buildings(id, account_id) ON DELETE RESTRICT,
        CHECK (settled_at >= interval_start)
      );

      CREATE TABLE IF NOT EXISTS building_upgrade_cost_ledger (
        id UUID PRIMARY KEY,
        upgrade_id UUID NOT NULL,
        account_id UUID NOT NULL,
        asset_code VARCHAR(64) NOT NULL,
        amount BIGINT NOT NULL CHECK (amount > 0),
        occurred_at TIMESTAMPTZ(3) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (upgrade_id, asset_code),
        FOREIGN KEY (upgrade_id, account_id)
          REFERENCES building_upgrade_ledger(id, account_id) ON DELETE RESTRICT
      );

      CREATE TRIGGER immutable_building_upgrade_ledger
        BEFORE UPDATE OR DELETE ON building_upgrade_ledger
        FOR EACH ROW EXECUTE FUNCTION deny_idle_audit_mutation();
      CREATE TRIGGER immutable_building_upgrade_cost_ledger
        BEFORE UPDATE OR DELETE ON building_upgrade_cost_ledger
        FOR EACH ROW EXECUTE FUNCTION deny_idle_audit_mutation();
    `);

    const fingerprint = fingerprintGameplayRules(RULE_SET_KEY, RULES, UPGRADE_COSTS, 2);
    await db.query(
      'UPDATE building_rule_sets SET is_active = FALSE WHERE rule_set_key = $1 AND is_active',
      [RULE_SET_KEY]
    );
    await db.query(`
      INSERT INTO building_rule_sets (id, rule_set_key, version_number, fingerprint, is_active)
      VALUES ($1, $2, 2, $3, TRUE)
    `, [RULE_SET_ID, RULE_SET_KEY, fingerprint]);
    for (const rule of RULES) {
      await db.query(`
        INSERT INTO building_level_rules
          (rule_set_id, building_type, level, asset_code, units_per_hour, storage_limit_ms)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [RULE_SET_ID, rule.building_type, rule.level, rule.asset_code,
        rule.units_per_hour, rule.storage_limit_ms]);
    }
    for (const cost of UPGRADE_COSTS) {
      await db.query(`
        INSERT INTO building_upgrade_cost_rules
          (rule_set_id, building_type, from_level, to_level, asset_code, amount)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [RULE_SET_ID, cost.building_type, cost.from_level, cost.to_level,
        cost.asset_code, cost.amount]);
    }
    await db.query(`
      UPDATE kingdom_buildings
      SET rule_set_id = $1, updated_at = date_trunc('milliseconds', clock_timestamp())
      WHERE rule_set_id IN (
        SELECT id FROM building_rule_sets
        WHERE rule_set_key = $2 AND version_number = 1
      )
    `, [RULE_SET_ID, RULE_SET_KEY]);
  },
  down: async () => {
    throw new Error('Prototype building upgrades cannot be removed after level 2 buildings exist');
  }
};
