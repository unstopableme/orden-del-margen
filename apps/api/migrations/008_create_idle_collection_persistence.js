'use strict';

const { fingerprintRules } = require('../src/gameplay/ruleFingerprint');

const RULE_SET_KEY = 'idle-materials-prototype';
const INITIAL_RULES = [
  { building_type: 'wheat_farm', level: 1, asset_code: 'wheat', units_per_hour: 60, storage_limit_ms: 28_800_000 },
  { building_type: 'lumber_mill', level: 1, asset_code: 'wood', units_per_hour: 45, storage_limit_ms: 28_800_000 },
  { building_type: 'quarry', level: 1, asset_code: 'stone', units_per_hour: 30, storage_limit_ms: 28_800_000 },
  { building_type: 'provisioner', level: 1, asset_code: 'food', units_per_hour: 15, storage_limit_ms: 28_800_000 },
  { building_type: 'textile_mill', level: 1, asset_code: 'cloth', units_per_hour: 15, storage_limit_ms: 28_800_000 }
];

module.exports = {
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS building_rule_sets (
        id UUID PRIMARY KEY,
        rule_set_key VARCHAR(100) NOT NULL,
        version_number INTEGER NOT NULL CHECK (version_number > 0),
        fingerprint CHAR(64) NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (rule_set_key, version_number),
        UNIQUE (id, fingerprint)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_building_rule_sets_one_active
        ON building_rule_sets (is_active) WHERE is_active;

      CREATE TABLE IF NOT EXISTS building_level_rules (
        rule_set_id UUID NOT NULL REFERENCES building_rule_sets(id) ON DELETE RESTRICT,
        building_type VARCHAR(64) NOT NULL,
        level SMALLINT NOT NULL CHECK (level > 0),
        asset_code VARCHAR(64) NOT NULL,
        units_per_hour BIGINT NOT NULL CHECK (units_per_hour > 0),
        storage_limit_ms BIGINT NOT NULL CHECK (storage_limit_ms >= 0),
        PRIMARY KEY (rule_set_id, building_type, level),
        UNIQUE (rule_set_id, building_type, level, asset_code)
      );

      CREATE OR REPLACE FUNCTION deny_building_rule_set_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'building rule set definitions are immutable';
        END IF;
        IF ROW(OLD.id, OLD.rule_set_key, OLD.version_number, OLD.fingerprint)
            IS DISTINCT FROM ROW(NEW.id, NEW.rule_set_key, NEW.version_number, NEW.fingerprint) THEN
          RAISE EXCEPTION 'building rule set definitions are immutable';
        END IF;
        RETURN NEW;
      END;
      $$;
      DROP TRIGGER IF EXISTS immutable_building_rule_set_definition ON building_rule_sets;
      CREATE TRIGGER immutable_building_rule_set_definition
        BEFORE UPDATE OR DELETE ON building_rule_sets
        FOR EACH ROW EXECUTE FUNCTION deny_building_rule_set_mutation();

      CREATE OR REPLACE FUNCTION deny_building_level_rule_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'building level rules are immutable';
        RETURN NULL;
      END;
      $$;
      DROP TRIGGER IF EXISTS immutable_building_level_rule ON building_level_rules;
      CREATE TRIGGER immutable_building_level_rule
        BEFORE UPDATE OR DELETE ON building_level_rules
        FOR EACH ROW EXECUTE FUNCTION deny_building_level_rule_mutation();

      CREATE TABLE IF NOT EXISTS kingdom_buildings (
        id UUID PRIMARY KEY,
        account_id UUID NOT NULL REFERENCES authenticated_accounts(id) ON DELETE RESTRICT,
        rule_set_id UUID NOT NULL,
        building_type VARCHAR(64) NOT NULL,
        level SMALLINT NOT NULL,
        asset_code VARCHAR(64) NOT NULL,
        activity_state VARCHAR(16) NOT NULL DEFAULT 'active'
          CHECK (activity_state = 'active'),
        last_settled_at TIMESTAMPTZ(3) NOT NULL,
        carry_numerator BIGINT NOT NULL DEFAULT 0
          CHECK (carry_numerator >= 0 AND carry_numerator < 3600000),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (account_id, building_type),
        UNIQUE (id, account_id),
        FOREIGN KEY (rule_set_id, building_type, level, asset_code)
          REFERENCES building_level_rules(rule_set_id, building_type, level, asset_code)
          ON UPDATE RESTRICT ON DELETE RESTRICT
      );
      CREATE INDEX IF NOT EXISTS idx_kingdom_buildings_account_id_id
        ON kingdom_buildings(account_id, id);

      CREATE TABLE IF NOT EXISTS game_asset_balances (
        account_id UUID NOT NULL REFERENCES authenticated_accounts(id) ON DELETE RESTRICT,
        asset_code VARCHAR(64) NOT NULL CHECK (asset_code <> ''),
        amount BIGINT NOT NULL DEFAULT 0 CHECK (amount >= 0),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (account_id, asset_code)
      );

      CREATE TABLE IF NOT EXISTS production_collection_requests (
        id UUID PRIMARY KEY,
        account_id UUID NOT NULL REFERENCES authenticated_accounts(id) ON DELETE RESTRICT,
        idempotency_key VARCHAR(128) NOT NULL
          CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]+$'),
        rule_set_id UUID NOT NULL,
        rules_fingerprint CHAR(64) NOT NULL CHECK (rules_fingerprint ~ '^[0-9a-f]{64}$'),
        request_fingerprint CHAR(64) NOT NULL
          CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
        settled_at TIMESTAMPTZ(3),
        result JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (account_id, idempotency_key),
        UNIQUE (id, account_id),
        FOREIGN KEY (rule_set_id, rules_fingerprint)
          REFERENCES building_rule_sets(id, fingerprint) ON DELETE RESTRICT,
        CHECK ((settled_at IS NULL) = (result IS NULL))
      );

      CREATE TABLE IF NOT EXISTS production_settlements (
        id UUID PRIMARY KEY,
        request_id UUID NOT NULL,
        account_id UUID NOT NULL REFERENCES authenticated_accounts(id) ON DELETE RESTRICT,
        building_id UUID NOT NULL,
        rule_set_id UUID NOT NULL REFERENCES building_rule_sets(id) ON DELETE RESTRICT,
        asset_code VARCHAR(64) NOT NULL,
        interval_start TIMESTAMPTZ(3) NOT NULL,
        interval_end TIMESTAMPTZ(3) NOT NULL,
        active_milliseconds BIGINT NOT NULL CHECK (active_milliseconds >= 0),
        discarded_milliseconds BIGINT NOT NULL CHECK (discarded_milliseconds >= 0),
        credited_amount BIGINT NOT NULL CHECK (credited_amount >= 0),
        carry_before BIGINT NOT NULL CHECK (carry_before >= 0 AND carry_before < 3600000),
        carry_after BIGINT NOT NULL CHECK (carry_after >= 0 AND carry_after < 3600000),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (interval_end >= interval_start),
        UNIQUE (request_id, building_id),
        UNIQUE (id, account_id, asset_code),
        FOREIGN KEY (request_id, account_id)
          REFERENCES production_collection_requests(id, account_id) ON DELETE RESTRICT,
        FOREIGN KEY (building_id, account_id)
          REFERENCES kingdom_buildings(id, account_id) ON DELETE RESTRICT
      );
      CREATE INDEX IF NOT EXISTS idx_production_settlements_account_time
        ON production_settlements(account_id, interval_end);

      CREATE TABLE IF NOT EXISTS game_asset_ledger (
        id UUID PRIMARY KEY,
        account_id UUID NOT NULL REFERENCES authenticated_accounts(id) ON DELETE RESTRICT,
        asset_code VARCHAR(64) NOT NULL,
        direction VARCHAR(8) NOT NULL CHECK (direction IN ('credit', 'debit')),
        amount BIGINT NOT NULL CHECK (amount > 0),
        reason VARCHAR(64) NOT NULL,
        settlement_id UUID NOT NULL,
        occurred_at TIMESTAMPTZ(3) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (settlement_id, account_id, asset_code)
          REFERENCES production_settlements(id, account_id, asset_code) ON DELETE RESTRICT,
        UNIQUE (settlement_id, direction, reason)
      );
      CREATE INDEX IF NOT EXISTS idx_game_asset_ledger_account_asset_time
        ON game_asset_ledger(account_id, asset_code, occurred_at);

      CREATE OR REPLACE FUNCTION deny_idle_audit_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
        RETURN NULL;
      END;
      $$;
      DROP TRIGGER IF EXISTS immutable_production_settlement ON production_settlements;
      CREATE TRIGGER immutable_production_settlement
        BEFORE UPDATE OR DELETE ON production_settlements
        FOR EACH ROW EXECUTE FUNCTION deny_idle_audit_mutation();
      DROP TRIGGER IF EXISTS immutable_game_asset_ledger_entry ON game_asset_ledger;
      CREATE TRIGGER immutable_game_asset_ledger_entry
        BEFORE UPDATE OR DELETE ON game_asset_ledger
        FOR EACH ROW EXECUTE FUNCTION deny_idle_audit_mutation();
    `);

    const rulesetId = 'a95b4a15-f621-4c4f-8908-12cb3e060001';
    const fingerprint = fingerprintRules(RULE_SET_KEY, INITIAL_RULES, 1);
    await db.query(`
      INSERT INTO building_rule_sets (id, rule_set_key, version_number, fingerprint, is_active)
      VALUES ($1, $2, 1, $3, TRUE)
      ON CONFLICT (rule_set_key, version_number) DO NOTHING
    `, [rulesetId, RULE_SET_KEY, fingerprint]);
    const stored = await db.query(
      'SELECT id, fingerprint FROM building_rule_sets WHERE rule_set_key = $1 AND version_number = 1',
      [RULE_SET_KEY]
    );
    if (stored.rows[0]?.id !== rulesetId || stored.rows[0]?.fingerprint !== fingerprint) {
      throw new Error(`Existing ${RULE_SET_KEY} does not match its immutable prototype definition`);
    }
    for (const rule of INITIAL_RULES) {
      await db.query(`
        INSERT INTO building_level_rules
          (rule_set_id, building_type, level, asset_code, units_per_hour, storage_limit_ms)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (rule_set_id, building_type, level) DO NOTHING
      `, [rulesetId, rule.building_type, rule.level, rule.asset_code,
        rule.units_per_hour, rule.storage_limit_ms]);
    }
    const actualRules = await db.query(`
      SELECT building_type, level, asset_code, units_per_hour, storage_limit_ms
      FROM building_level_rules WHERE rule_set_id = $1 ORDER BY building_type, level
    `, [rulesetId]);
    const normalizedRules = actualRules.rows.map((rule) => ({
      ...rule,
      level: Number(rule.level),
      units_per_hour: Number(rule.units_per_hour),
      storage_limit_ms: Number(rule.storage_limit_ms)
    }));
    if (fingerprintRules(RULE_SET_KEY, normalizedRules) !== fingerprint) {
      throw new Error(`Existing ${RULE_SET_KEY} rules do not match their stored fingerprint`);
    }
  },
  down: async (db) => {
    await db.query('DROP TABLE IF EXISTS game_asset_ledger');
    await db.query('DROP TABLE IF EXISTS production_settlements');
    await db.query('DROP TABLE IF EXISTS production_collection_requests');
    await db.query('DROP TABLE IF EXISTS game_asset_balances');
    await db.query('DROP TABLE IF EXISTS kingdom_buildings');
    await db.query('DROP TABLE IF EXISTS building_level_rules');
    await db.query('DROP TABLE IF EXISTS building_rule_sets');
    await db.query('DROP FUNCTION IF EXISTS deny_idle_audit_mutation()');
    await db.query('DROP FUNCTION IF EXISTS deny_building_level_rule_mutation()');
    await db.query('DROP FUNCTION IF EXISTS deny_building_rule_set_mutation()');
  }
};
