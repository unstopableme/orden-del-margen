'use strict';

module.exports = {
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS training_ground_sessions (
        id UUID PRIMARY KEY,
        account_id UUID NOT NULL REFERENCES authenticated_accounts(id) ON DELETE RESTRICT,
        idempotency_key VARCHAR(128) NOT NULL
          CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]+$'),
        request_fingerprint CHAR(64) NOT NULL
          CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
        rules_version INTEGER NOT NULL CHECK (rules_version = 1),
        started_at TIMESTAMPTZ(3) NOT NULL,
        quota_date DATE NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE'
          CHECK (status IN ('ACTIVE', 'COMPLETED_SUCCESS', 'COMPLETED_FAILURE', 'EXPIRED', 'VOID')),
        correct_count SMALLINT CHECK (correct_count BETWEEN 0 AND 5),
        result JSONB,
        void_code VARCHAR(40),
        voided_at TIMESTAMPTZ(3),
        void_evidence_ref VARCHAR(512),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (account_id, idempotency_key),
        UNIQUE (id, account_id, quota_date),
        CHECK ((status = 'ACTIVE' AND correct_count IS NULL AND result IS NULL
          AND void_code IS NULL AND voided_at IS NULL AND void_evidence_ref IS NULL)
          OR (status = 'VOID' AND correct_count IS NULL AND result IS NULL
          AND void_code IS NOT NULL AND voided_at IS NOT NULL AND void_evidence_ref IS NOT NULL)
          OR (status IN ('COMPLETED_SUCCESS', 'COMPLETED_FAILURE', 'EXPIRED')
          AND correct_count IS NOT NULL AND result IS NOT NULL
          AND void_code IS NULL AND voided_at IS NULL AND void_evidence_ref IS NULL))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_training_ground_one_active_per_account
        ON training_ground_sessions(account_id) WHERE status = 'ACTIVE';
      CREATE INDEX IF NOT EXISTS idx_training_ground_sessions_quota
        ON training_ground_sessions(account_id, quota_date, status);

      CREATE TABLE IF NOT EXISTS training_ground_daily_quotas (
        account_id UUID NOT NULL REFERENCES authenticated_accounts(id) ON DELETE RESTRICT,
        quota_date DATE NOT NULL,
        starts_used SMALLINT NOT NULL DEFAULT 0 CHECK (starts_used BETWEEN 0 AND 6),
        rewards_reserved SMALLINT NOT NULL DEFAULT 0 CHECK (rewards_reserved BETWEEN 0 AND 4),
        rewards_awarded SMALLINT NOT NULL DEFAULT 0 CHECK (rewards_awarded BETWEEN 0 AND 4),
        updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (account_id, quota_date),
        CHECK (rewards_reserved + rewards_awarded <= 4)
      );

      CREATE TABLE IF NOT EXISTS training_ground_quota_reservations (
        session_id UUID PRIMARY KEY,
        account_id UUID NOT NULL,
        quota_date DATE NOT NULL,
        start_status VARCHAR(12) NOT NULL DEFAULT 'RESERVED'
          CHECK (start_status IN ('RESERVED', 'CONSUMED', 'RELEASED')),
        reward_status VARCHAR(12) NOT NULL DEFAULT 'RESERVED'
          CHECK (reward_status IN ('RESERVED', 'CONSUMED', 'RELEASED')),
        created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id, account_id, quota_date)
          REFERENCES training_ground_sessions(id, account_id, quota_date) ON DELETE RESTRICT,
        CHECK ((start_status = 'RESERVED' AND reward_status = 'RESERVED')
          OR (start_status = 'CONSUMED' AND reward_status IN ('CONSUMED', 'RELEASED'))
          OR (start_status = 'RELEASED' AND reward_status = 'RELEASED'))
      );

      CREATE TABLE IF NOT EXISTS training_ground_challenges (
        id UUID PRIMARY KEY,
        session_id UUID NOT NULL REFERENCES training_ground_sessions(id) ON DELETE RESTRICT,
        ordinal SMALLINT NOT NULL CHECK (ordinal BETWEEN 1 AND 5),
        family_id VARCHAR(64) NOT NULL,
        variant_id VARCHAR(96) NOT NULL,
        prompt TEXT NOT NULL,
        state JSONB NOT NULL,
        option_order JSONB NOT NULL,
        correct_action_id VARCHAR(64) NOT NULL,
        opens_at TIMESTAMPTZ(3) NOT NULL,
        closes_at TIMESTAMPTZ(3) NOT NULL,
        status VARCHAR(12) NOT NULL DEFAULT 'PENDING'
          CHECK (status IN ('PENDING', 'CORRECT', 'INCORRECT', 'MISSED')),
        selected_action_id VARCHAR(64),
        answered_at TIMESTAMPTZ(3),
        UNIQUE (session_id, ordinal),
        UNIQUE (id, session_id),
        CHECK (closes_at > opens_at),
        CHECK ((status = 'PENDING' AND selected_action_id IS NULL AND answered_at IS NULL)
          OR (status IN ('CORRECT', 'INCORRECT') AND selected_action_id IS NOT NULL
            AND answered_at IS NOT NULL)
          OR (status = 'MISSED' AND selected_action_id IS NULL AND answered_at IS NULL))
      );

      CREATE TABLE IF NOT EXISTS training_ground_answers (
        id UUID PRIMARY KEY,
        session_id UUID NOT NULL REFERENCES training_ground_sessions(id) ON DELETE RESTRICT,
        challenge_id UUID NOT NULL,
        idempotency_key VARCHAR(128) NOT NULL
          CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]+$'),
        payload_fingerprint CHAR(64) NOT NULL
          CHECK (payload_fingerprint ~ '^[0-9a-f]{64}$'),
        action_id VARCHAR(64) NOT NULL,
        is_correct BOOLEAN NOT NULL,
        result JSONB NOT NULL,
        received_at TIMESTAMPTZ(3) NOT NULL,
        UNIQUE (session_id, idempotency_key),
        UNIQUE (challenge_id),
        FOREIGN KEY (challenge_id, session_id)
          REFERENCES training_ground_challenges(id, session_id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS character_xp_ledger (
        id UUID PRIMARY KEY,
        account_id UUID NOT NULL REFERENCES authenticated_accounts(id) ON DELETE RESTRICT,
        source_type VARCHAR(32) NOT NULL CHECK (source_type = 'training_grounds'),
        source_event_id UUID NOT NULL REFERENCES training_ground_sessions(id) ON DELETE RESTRICT,
        xp INTEGER NOT NULL CHECK (xp = 25),
        occurred_at TIMESTAMPTZ(3) NOT NULL,
        quota_date DATE NOT NULL,
        rules_version INTEGER NOT NULL CHECK (rules_version = 1),
        created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (account_id, source_type, source_event_id),
        FOREIGN KEY (source_event_id, account_id, quota_date)
          REFERENCES training_ground_sessions(id, account_id, quota_date) ON DELETE RESTRICT
      );
      CREATE INDEX IF NOT EXISTS idx_character_xp_ledger_account
        ON character_xp_ledger(account_id, occurred_at, id);

      CREATE TABLE IF NOT EXISTS training_ground_void_audit (
        id UUID PRIMARY KEY,
        session_id UUID NOT NULL UNIQUE REFERENCES training_ground_sessions(id) ON DELETE RESTRICT,
        void_code VARCHAR(40) NOT NULL
          CHECK (void_code IN ('RULESET_INTEGRITY', 'CHALLENGE_DATA_UNAVAILABLE', 'SERVER_ABORTED_SESSION')),
        evidence_ref VARCHAR(512) NOT NULL CHECK (btrim(evidence_ref) <> ''),
        service_version VARCHAR(64) NOT NULL CHECK (btrim(service_version) <> ''),
        voided_at TIMESTAMPTZ(3) NOT NULL,
        created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE OR REPLACE FUNCTION deny_training_ground_audit_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'training ground audit records are append-only';
      END;
      $$;
      CREATE TRIGGER immutable_character_xp_ledger
        BEFORE UPDATE OR DELETE ON character_xp_ledger
        FOR EACH ROW EXECUTE FUNCTION deny_training_ground_audit_mutation();
      CREATE TRIGGER immutable_training_ground_void_audit
        BEFORE UPDATE OR DELETE ON training_ground_void_audit
        FOR EACH ROW EXECUTE FUNCTION deny_training_ground_audit_mutation();
    `);
  },
  down: async () => {
    throw new Error('Training Grounds sessions and XP ledger are append-only and cannot be removed');
  }
};
