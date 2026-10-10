'use strict';

module.exports = {
  up: async (db) => {
    await db.query(`
      ALTER TABLE passport_wallet_bindings
        ADD COLUMN IF NOT EXISTS passport_issuer VARCHAR(2048),
        ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS revoked_by VARCHAR(255),
        ADD COLUMN IF NOT EXISTS revocation_reason VARCHAR(500);

      ALTER TABLE passport_wallet_bindings
        DROP CONSTRAINT IF EXISTS passport_wallet_bindings_pkey;

      CREATE UNIQUE INDEX IF NOT EXISTS uq_passport_identity_issuer_subject
        ON passport_wallet_bindings(passport_issuer, passport_subject)
        WHERE passport_issuer IS NOT NULL;

      ALTER TABLE passport_wallet_bindings
        DROP CONSTRAINT IF EXISTS passport_wallet_bindings_issuer_https;
      ALTER TABLE passport_wallet_bindings
        ADD CONSTRAINT passport_wallet_bindings_issuer_https
        CHECK (passport_issuer IS NULL OR passport_issuer ~ '^https://');
    `);
  },
  down: async (db) => {
    await db.query(`
      DROP INDEX IF EXISTS uq_passport_identity_issuer_subject;
      ALTER TABLE passport_wallet_bindings
        DROP CONSTRAINT IF EXISTS passport_wallet_bindings_issuer_https,
        DROP COLUMN IF EXISTS revocation_reason,
        DROP COLUMN IF EXISTS revoked_by,
        DROP COLUMN IF EXISTS revoked_at,
        DROP COLUMN IF EXISTS passport_issuer;
    `);
  }
};
