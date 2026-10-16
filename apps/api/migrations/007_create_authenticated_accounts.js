'use strict';

module.exports = {
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS authenticated_accounts (
        id UUID PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS authenticated_account_identities (
        provider VARCHAR(64) NOT NULL,
        issuer VARCHAR(2048) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        account_id UUID NOT NULL REFERENCES authenticated_accounts(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (provider, issuer, subject),
        CHECK (provider ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
        CHECK (issuer ~ '^https://[^[:space:]]+$'),
        CHECK (btrim(subject) <> '')
      );

      CREATE INDEX IF NOT EXISTS idx_authenticated_account_identities_account
        ON authenticated_account_identities(account_id);
    `);
  },
  down: async (db) => {
    await db.query('DROP TABLE IF EXISTS authenticated_account_identities');
    await db.query('DROP TABLE IF EXISTS authenticated_accounts');
  }
};
